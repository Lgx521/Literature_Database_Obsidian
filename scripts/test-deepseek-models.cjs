'use strict';
const assert=require('node:assert/strict');
const factory=require('./deepseek-beta');
const calls=[],plugin={ready:true,settings:{deepSeekModel:'text-b'},hasPendingEdit:()=>false,app:{workspace:{getLeavesOfType:()=>[]}},pdfWork:{cancelOwner(){}}};
let status=200,data={data:[{id:'text-a',name:'Model A'},{id:'text-b',name:'Model B',max_output_tokens:900,input_modalities:['text'],output_modalities:['text']},{id:'image',output_modalities:['image']},{id:'invalid',input_modalities:{}},{id:'text-a'},{id:'<bad>'}]},pending=null;
const {Service}=factory({tr:s=>s,requestUrl:async req=>{calls.push(req);if(pending)return pending;if(req.method==='GET')return {status,text:JSON.stringify(data)};return {status,text:JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{}'}}]})};}});
const service=new Service(plugin);
(async()=>{try{
 assert.equal(calls.length,0);await assert.rejects(service.listModels());
 service.enable('synthetic-key-123');const models=await service.listModels();assert.deepEqual(models.map(m=>m.id),['text-a','text-b']);assert.equal(service.selectedModel().id,'text-b');assert.equal(calls[0].method,'GET');assert.equal(calls[0].body,undefined);assert.equal(calls[0].headers.Authorization,'Bearer synthetic-key-123');
 await service.listModels();assert.equal(calls.length,1,'Cached list does not refetch on opening');
 await service.run(check=>service.request([{role:'user',content:'Synthetic'}],check));const body=JSON.parse(calls.at(-1).body);assert.equal(body.model,'text-b');assert.equal(body.max_tokens,900);
 service.selectModel('text-a');assert.throws(()=>service.selectModel('made-up'));assert.equal(service.modelId,'text-a');
 data={data:[{id:'new-provider-id'}]};await service.listModels(true);assert.equal(service.selectedModel(),undefined);const before=calls.length;await assert.rejects(service.organize('temp/a.pdf','en'));assert.equal(calls.length,before,'Withdrawn model blocks before PDF or chat request');service.selectModel('new-provider-id');
 data={data:[]};await assert.rejects(service.listModels(true),/文本模型/);data={data:'wrong'};await assert.rejects(service.listModels(true),/模型列表/);
 status=401;await assert.rejects(service.listModels(true),/密钥/);status=200;
 service.enable('different-synthetic-key');assert.equal(service.models.length,0,'Key changes invalidate account model list');
 let settle;pending=new Promise(resolve=>settle=resolve);const count=calls.length,running=service.listModels(true);while(calls.length===count)await new Promise(r=>setImmediate(r));service.cancel();await assert.rejects(running,/取消/);assert(service.wire);await assert.rejects(service.listModels(),/等待/);settle({status:200,text:JSON.stringify({data:[{id:'late'}]})});await new Promise(r=>setImmediate(r));assert.equal(service.models.length,0,'Cancelled late response is discarded');pending=null;
 data={data:[{id:'fresh'}]};service.modelId='';await service.listModels();assert.equal(service.selectedModel().id,'fresh');service.disable();assert.equal(service.models.length,0);
 console.log('DeepSeek API model discovery, selection, validation and cancellation passed.');
 }finally{service.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
