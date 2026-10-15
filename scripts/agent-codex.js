'use strict';
// Device credentials stay outside the synced vault. The project config contains
// only an ID and a portable stdio bootstrap. No global Codex config is changed.
const BEGIN='# Literature Database MCP: begin',END='# Literature Database MCP: end';
const SERVER='literature_database';
const BOOTSTRAP="require(require('node:path').join(require('node:os').homedir(),'.literature-database','agent-mcp',process.argv[1],'bridge.cjs')).run(process.argv[1]).catch(()=>{process.stderr.write('Prepare the Codex connection in Obsidian Agent MCP on this computer.\\n');process.exitCode=1;})";
function block(id){return `${BEGIN}\n[mcp_servers.${SERVER}]\ncommand = "node"\nargs = ${JSON.stringify(['-e',BOOTSTRAP,id])}\nstartup_timeout_sec = 20\ntool_timeout_sec = 120\n${END}\n`;}
function parse(text){
  const collision=value=>/^\s*\[\s*mcp_servers\s*\.\s*(?:literature_database|"literature_database"|'literature_database')(?:\s*\]|\s*\.)/m.test(value)||/^\s*(?:literature_database|"literature_database"|'literature_database')\s*=/m.test(value);
  const begin=text.indexOf(BEGIN),end=text.indexOf(END);
  if(begin<0&&end<0){if(collision(text))throw Error('Existing literature_database MCP configuration: keep it or remove it before setup');return null;}
  if(begin<0||end<begin||text.indexOf(BEGIN,begin+1)>=0||text.indexOf(END,end+1)>=0)throw Error('Incomplete Literature Database MCP configuration; restore it before setup');
  const managed=text.slice(begin,end+END.length)+(text[end+END.length]==='\n'?'\n':'');
  const match=managed.match(/"([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})"\]/);
  if(!match||managed!==block(match[1]))throw Error('The managed MCP configuration was edited; preserve your edits before setup');
  const rest=text.slice(0,begin)+text.slice(begin+managed.length);if(collision(rest))throw Error('Duplicate MCP configuration');
  return {id:match[1],begin,length:managed.length};
}
async function read(file){
  const fs=require('node:fs/promises'),flags=require('node:fs').constants;
  let handle;try{handle=await fs.open(file,flags.O_RDONLY|flags.O_NOFOLLOW);}catch(e){if(e.code==='ENOENT')return null;throw e;}
  try{const stat=await handle.stat();if(!stat.isFile()||stat.size>1024*1024)throw Error('Unexpected MCP configuration file');return await handle.readFile('utf8');}finally{await handle.close();}
}
async function directory(base,parts,privateMode=false){
  const fs=require('node:fs/promises'),path=require('node:path');let current=await fs.realpath(base);
  for(const name of parts){current=path.join(current,name);try{await fs.mkdir(current,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}if(await fs.realpath(current)!==current||(await fs.lstat(current)).isSymbolicLink())throw Error('Symlink MCP configuration directories are not supported');if(privateMode&&process.platform!=='win32')await fs.chmod(current,0o700);}
  return current;
}
async function replace(file,before,after){
  const fs=require('node:fs/promises'),crypto=require('node:crypto'),temp=file+'.ldb-'+crypto.randomUUID();
  if(await read(file)!==before)throw Error('MCP configuration changed; retry');
  await fs.writeFile(temp,after,{flag:'wx',mode:0o600});
  try{if(await read(file)!==before)throw Error('MCP configuration changed; retry');await fs.rename(temp,file);}finally{await fs.unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
async function project(root){
  const fs=require('node:fs/promises'),path=require('node:path'),base=await fs.realpath(root),dir=path.join(base,'.codex');
  try{if(await fs.realpath(dir)!==dir)throw Error('Symlink .codex folders are not supported');}catch(e){if(e.code==='ENOENT')return {base,file:path.join(dir,'config.toml'),text:null,managed:null};throw e;}
  const file=path.join(dir,'config.toml'),text=await read(file);return {base,file,text,managed:parse(text||'')};
}
async function publish(root,running,source,options={}){
  const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),p=await project(root);
  if(!p.managed)return null;
  const folder=await directory(options.home||os.homedir(),['.literature-database','agent-mcp',p.managed.id],true),bridge=path.join(folder,'bridge.cjs'),file=path.join(folder,'connection.json');
  const previous=await read(file);
  if(previous&&JSON.parse(previous).vault!==p.base)throw Error('This connection ID belongs to another vault on this computer');
  const script=await read(bridge);if(script!==source)await replace(bridge,script,source);
  const content=JSON.stringify({version:1,vault:p.base,url:running.url,token:running.token});await replace(file,previous,content);
  return {file,content};
}
async function prepare(root,running,source,options={}){
  const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),p=await project(root);
  if(!p.managed){
    await directory(p.base,['.codex']);
    const id=crypto.randomUUID(),text=(p.text||'')+((p.text||'').endsWith('\n')||!p.text?'':'\n')+'\n'+block(id);
    if(p.text!==null){const backup=await directory(p.base,['.maintenance-backups','codex-setup-'+crypto.randomUUID()]);await fs.writeFile(path.join(backup,'config.toml'),p.text,{flag:'wx',mode:0o600});}
    await replace(p.file,p.text,text);
  }
  return publish(root,running,source,options);
}
async function revoke(registration){if(!registration)return;const fs=require('node:fs/promises');if(await read(registration.file)===registration.content)await fs.unlink(registration.file);}
module.exports={prepare,publish,revoke,parse,block,BOOTSTRAP};
