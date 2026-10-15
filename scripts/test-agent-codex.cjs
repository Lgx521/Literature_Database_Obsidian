'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const C=require('./agent-codex'),M=require('./agent-mcp');
(async()=>{
  const dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'ldb-codex-'))),vault=path.join(dir,'Vault with 空格'),home=path.join(dir,'Device A'),home2=path.join(dir,'Device B');
  for(const d of [vault,home,home2])await fs.mkdir(d);
  const source=await fs.readFile(path.join(__dirname,'agent-codex-bridge.cjs'),'utf8');
  const server=await M.start({version:'fixture',call:async(name,args)=>({name,args,synthetic:true})});let children=[];
  function client(id,cwd=vault){
    const code="require('node:os').homedir=()=>process.env.LDB_TEST_HOME;"+C.BOOTSTRAP;
    const child=spawn(process.execPath,['-e',code,id],{cwd,env:{...process.env,LDB_TEST_HOME:home},stdio:['pipe','pipe','pipe']});children.push(child);
    let buffer='',errors='',seq=0;const pending=new Map();child.stderr.on('data',chunk=>{errors+=chunk;});
    child.stdout.on('data',chunk=>{buffer+=chunk;let i;while((i=buffer.indexOf('\n'))>=0){const msg=JSON.parse(buffer.slice(0,i));buffer=buffer.slice(i+1);const task=pending.get(msg.id);if(task){clearTimeout(task.timer);pending.delete(msg.id);task.resolve(msg);}}});
    return {child,errors:()=>errors,send(method,params={}){const id=++seq;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('stdio reply timeout: '+errors));},5000);pending.set(id,{resolve,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});}};
  }
  try{
    const original='# Personal settings\nmodel_reasoning_effort = "high"\n[mcp_servers.other]\nurl = "https://example.invalid/mcp"\n';
    await fs.mkdir(path.join(vault,'.codex'));await fs.writeFile(path.join(vault,'.codex/config.toml'),original);
    const registration=await C.prepare(vault,server,source,{home}),configFile=path.join(vault,'.codex/config.toml'),config=await fs.readFile(configFile,'utf8'),id=C.parse(config).id;
    assert(config.startsWith(original));assert(!config.includes(server.token));assert(!config.includes(server.url));assert(!config.includes(home));assert(!config.includes(vault));
    assert.equal(JSON.parse(await fs.readFile(registration.file)).vault,vault);
    if(process.platform!=='win32')assert.equal((await fs.stat(registration.file)).mode&0o777,0o600);
    const backups=await fs.readdir(path.join(vault,'.maintenance-backups'));assert.equal(await fs.readFile(path.join(vault,'.maintenance-backups',backups[0],'config.toml'),'utf8'),original);
    await C.prepare(vault,server,source,{home});assert.equal(await fs.readFile(configFile,'utf8'),config);assert.equal((await fs.readdir(path.join(vault,'.maintenance-backups'))).length,1);
    // A second device uses the synced config verbatim, but its own endpoint/token.
    const another={url:'http://127.0.0.1:43210/mcp',token:'a'.repeat(64)};const reg2=await C.prepare(vault,another,source,{home:home2});assert.equal(await fs.readFile(configFile,'utf8'),config);assert.equal(JSON.parse(await fs.readFile(reg2.file)).token,another.token);assert.equal(JSON.parse(await fs.readFile(registration.file)).token,server.token);
    const c=client(id);const init=await c.send('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'fixture',version:'1'}});assert.equal(init.result.serverInfo.name,'Literature Database');
    c.child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
    const list=await c.send('tools/list');assert.equal(list.result.tools.length,10);
    const read=await c.send('tools/call',{name:'library_context',arguments:{}});assert(JSON.parse(read.result.content[0].text).synthetic);
    const outside=client(id,dir);assert((await outside.send('tools/list')).error,'Refuse the same ID from a different folder');
    // Disable removes the descriptor; existing stdio connections cannot continue.
    await C.revoke(registration);assert((await c.send('tools/list')).error);
    const resumed=await C.publish(vault,server,source,{home});assert((await c.send('tools/list')).result);
    // Do not remove a connection written by a different active instance.
    const replacement=await C.publish(vault,another,source,{home});await C.revoke(resumed);assert.equal(await fs.readFile(replacement.file,'utf8'),replacement.content);
    await C.revoke(replacement);
    // Never replace hand-written or malformed server settings or follow symlinks.
    await fs.writeFile(configFile,'[mcp_servers.literature_database]\ncommand = "custom"\n');await assert.rejects(C.prepare(vault,server,source,{home}),/Existing/);assert((await fs.readFile(configFile,'utf8')).includes('custom'));
    await fs.writeFile(configFile,config.replace('tool_timeout_sec = 120','tool_timeout_sec = 200'));await assert.rejects(C.prepare(vault,server,source,{home}),/edited/);
    await fs.unlink(configFile);await fs.writeFile(path.join(dir,'external.toml'),'preserve');await fs.symlink(path.join(dir,'external.toml'),configFile);await assert.rejects(C.prepare(vault,server,source,{home}));assert.equal(await fs.readFile(path.join(dir,'external.toml'),'utf8'),'preserve');
    assert(!c.errors().includes(server.token));assert(!outside.errors().includes(server.token));
  }finally{for(const c of children){const exited=new Promise(resolve=>c.once('exit',resolve));c.stdin.end();await exited;}await server.stop();await fs.rm(dir,{recursive:true,force:true});}
  console.log('PASS: project-scoped Codex setup, retained settings/backup, device isolation, stdio MCP handshake/tools, disable/resume and unsafe/conflicting config guards.');
})().catch(e=>{console.error(e);process.exitCode=1;});
