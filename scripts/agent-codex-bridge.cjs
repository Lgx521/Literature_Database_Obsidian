'use strict';
// Bundled into main.js as text; installed only by explicit desktop setup.
// Codex starts this small stdio adapter, never Obsidian or an AI model.
async function run(id) {
  const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http');
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id||''))throw Error('Invalid Literature Database connection ID');
  const home=await fs.realpath(os.homedir()),folder=path.join(home,'.literature-database','agent-mcp',id);
  const cwd=await fs.realpath(process.cwd());
  async function connection(){
    const file=path.join(folder,'connection.json');
    if(await fs.realpath(file)!==file)throw Error('Unsafe connection file');
    const handle=await fs.open(file,require('node:fs').constants.O_RDONLY|require('node:fs').constants.O_NOFOLLOW);
    let text;try{const stat=await handle.stat();if(!stat.isFile()||stat.size>8192||(process.platform!=='win32'&&(stat.mode&0o077||stat.uid!==process.getuid())))throw Error('Unsafe connection permissions');text=await handle.readFile('utf8');}finally{await handle.close();}
    const data=JSON.parse(text),root=await fs.realpath(data.vault);
    const relative=path.relative(root,cwd);
    if(data.version!==1||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('Open Codex inside the connected vault');
    if(!/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}\/mcp$/.test(data.url)||! /^[a-f0-9]{64}$/.test(data.token))throw Error('Invalid local connection');
    return data;
  }
  const controllers=new Set();let ended=false,active=0,buffer='';
  const output=message=>{if(!ended)process.stdout.write(JSON.stringify(message)+'\n');};
  async function forward(message){
    const data=await connection();
    return new Promise((resolve,reject)=>{
      const request=http.request(data.url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:'Bearer '+data.token}},response=>{
        let text='',size=0;
        response.setEncoding('utf8');response.on('data',chunk=>{size+=Buffer.byteLength(chunk);if(size>8*1024*1024)request.destroy(Error('Response too large'));else text+=chunk;});
        response.on('error',reject);response.on('end',()=>{
          if(response.statusCode===202)return resolve(null);
          if(response.statusCode!==200)return reject(Error('Obsidian MCP unavailable'));
          try{const result=JSON.parse(text);if(result.jsonrpc!=='2.0'||result.id!==message.id)throw Error('Invalid response');resolve(result);}catch(_){reject(Error('Invalid MCP response'));}
        });
      });
      controllers.add(request);request.on('close',()=>controllers.delete(request));request.on('error',reject);
      request.setTimeout(120000,()=>request.destroy(Error('Request timed out')));request.end(JSON.stringify(message));
    });
  }
  async function receive(line){
    let message;try{message=JSON.parse(line);if(!message||Array.isArray(message)||message.jsonrpc!=='2.0'||typeof message.method!=='string')throw Error();}
    catch(_){return output({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON-RPC request'}});}
    const replyError=text=>{if(Object.hasOwn(message,'id'))output({jsonrpc:'2.0',id:message.id,error:{code:-32000,message:text}});};
    if(active>=4)return replyError('Library busy; retry after the current operation');
    active++;try{const response=await forward(message);if(response)output(response);}
    catch(_){replyError('Literature Database is unavailable. On this computer, open this vault in Obsidian and enable Agent MCP. If needed, select Prepare Codex connection, then restart the Codex session.');}
    finally{active--;}
  }
  function close(){ended=true;for(const request of controllers)request.destroy();process.stdin.pause();}
  process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>{
    buffer+=chunk;let index;
    while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);if(Buffer.byteLength(line)>128*1024){close();return;}if(line.trim())void receive(line);}
    if(Buffer.byteLength(buffer)>128*1024)close();
  });
  process.stdin.on('end',close);process.stdin.on('error',close);
  process.once('SIGTERM',close);process.once('SIGINT',close);
}
module.exports={run};
