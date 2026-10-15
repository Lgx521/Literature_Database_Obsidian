'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),M=require('./agent-mcp');
(async()=>{
 const calls=[],server=await M.start({version:'test',call:async(name,args)=>{calls.push({name,args});if(args.query==='error')throw Error('Protected');return {ok:true};}});
 const request=(message,headers={},method='POST')=>new Promise((resolve,reject)=>{
  const req=http.request(server.url,{method,headers:{Authorization:'Bearer '+server.token,'Content-Type':'application/json',Accept:'application/json, text/event-stream',...headers}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,...(body?{data:JSON.parse(body)}:{})}));});req.on('error',reject);req.end(message===undefined?undefined:typeof message==='string'?message:JSON.stringify(message));
 });
 const rpc=(method,params={})=>({jsonrpc:'2.0',id:1,method,params});
 try{
  assert.equal((await request(rpc('ping'),{Authorization:''})).status,401);
  assert.equal((await request(rpc('ping'),{Origin:'https://evil.example'})).status,403);
  assert.equal((await request(rpc('ping'),{Host:'attacker.example'})).status,403);
  assert.equal((await request(rpc('ping'),{Accept:'application/json'})).status,406);
  assert.equal((await request(rpc('ping'),{'MCP-Protocol-Version':'invalid'})).status,400);
  const init=await request(rpc('initialize',{protocolVersion:'2025-11-25',clientInfo:{name:'test',version:'1'},capabilities:{}}));assert.equal(init.data.result.serverInfo.name,'Literature Database');
  assert.equal((await request({jsonrpc:'2.0',method:'notifications/initialized'})).status,202);
  const tools=(await request(rpc('tools/list'))).data.result.tools;assert.equal(tools.length,10);assert(tools.every(t=>t.inputSchema.additionalProperties===false));
  assert((await request(rpc('resources/read',{uri:'library://guide'}))).data.result.contents[0].text.includes('Never invent'));
  assert((await request(rpc('prompts/get',{name:'organize_library'}))).data.result.messages.length);
  const call=(name,args)=>request(rpc('tools/call',{name,arguments:args}));
  assert.equal((await call('list_papers',{limit:3})).data.result.isError,undefined);assert.equal(calls.length,1);
  assert((await call('enrich_paper',{path:'papers/a.pdf',revision:'x',bibtex:'fake'})).data.result.isError);assert.equal(calls.length,1);
  assert((await call('file_inbox',{path:'a',revision:'x',target:{scope:'reviews',name:'Private'}})).data.result.isError);
  assert((await call('list_papers',{query:'error'})).data.result.isError);
  assert.equal((await request('{')).data.error.code,-32700);
  assert.equal((await request(undefined,{},'GET')).status,405);
  assert.equal((await request('x'.repeat(140000))).status,413);
 }finally{await server.stop();}
 console.log('PASS: MCP initialize, discovery, resources/prompts/tools, strict schemas, errors, request bounds and loopback authentication/origin protection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
