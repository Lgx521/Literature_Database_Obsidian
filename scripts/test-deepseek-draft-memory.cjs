'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),T=require('./tag-tree');
class Scope{register(){return {};}unregister(){}}
class Modal{constructor(app){this.app=app;this.contentEl={empty(){}};}open(){}close(){this.onClose();}}
const ctx={module:{exports:{}},setTimeout,clearTimeout,require:n=>n==='obsidian'?{Plugin:class{},Modal,Scope,ItemView:class{},Platform:{}}:require(n)};
vm.runInNewContext(fs.readFileSync('main.js','utf8')+'\nmodule.exports.Beta=DeepSeekBetaModal;',ctx);
const Beta=ctx.module.exports.Beta;
(async()=>{
 const catalog={groups:Array.from({length:10},(_,g)=>({name:'G'+g,tags:Array.from({length:100},(_,t)=>`#research/g${g}/tag${t}`)}))};
 let reads=0,wait=null;const app={scope:{},vault:{getAbstractFileByPath:()=>({path:'tags.md'}),read:async()=>{reads++;if(wait)await wait;return T.serialize(catalog);}}};
 const plugin={app,snapshot:{library:[]}},owner=Object.create(Beta.prototype);
 Object.assign(owner,{app,plugin,work:{running:false},closed:false,sync(){},requestSync(){}});
 const item={path:'temp/a.pdf',proposal:{preview:{title:'Draft',tags:'#research/g0/tag0 #research/suggestion'}},edits:{}};
 const open=async()=>{owner.openDraftTagMap(item,()=>{});const map=owner.tagMap;return {map,model:(await map.draft.read()).model};};
 let {map,model}=await open();assert.equal(reads,1);
 model=T.addGroup(model,'New group');model=T.addTag(model,'New group',null,'custom').model;
 await map.draft.store(model);await map.view.saveMapTag('#research/custom',true);
 const change=T.remove(model,{kind:'tag',tag:'#research/suggestion'});await map.draft.remove(change);
 const expected=JSON.stringify(item.edits),draft=map.draft;map.close();
 assert.equal(map.draft,null);assert.equal(map.model,null);assert.equal(draft.canRemove({kind:'tag',tag:'#research/g0'}),false);
 assert.equal(item.tagModel,undefined);assert.equal(item.originalTagModel,undefined);assert.equal(item.tagBase,undefined);
 assert(JSON.stringify(item).length<2000,'Only draft deltas and primitive view state survive close');
 ({map,model}=await open());assert.equal(reads,2);assert.equal(JSON.stringify(item.edits),expected);
 assert(model.groups.some(g=>g.name==='New group'&&g.tags.includes('#research/custom')));
 assert(!model.groups.some(g=>g.tags.includes('#research/suggestion')),'Deleted suggestion does not reappear');
 assert.equal(map.draft.canRemove({kind:'tag',tag:'#research/g0'}),false,'Original vocabulary remains protected');
 assert.equal(map.draft.canRemove({kind:'tag',tag:'#research/custom'}),true);
 map.close();
 // New live vocabulary wins over old draft deletions; collisions are refused.
 catalog.groups.push({name:'Live',tags:['#research/suggestion']});
 ({map,model}=await open());assert(model.groups.some(g=>g.name==='Live'&&g.tags.includes('#research/suggestion')));map.close();
 assert.throws(()=>T.mergeAdditions(catalog,{groups:[{name:'Wrong group',tags:['#research/g0/tag0']}]}),/已改变/);
 const before=T.serialize(catalog);T.mergeAdditions(catalog,item.edits.tagAdditions);assert.equal(T.serialize(catalog),before);
 // A read settling after close must not recreate retained catalog models.
 let resolve;wait=new Promise(r=>resolve=r);owner.openDraftTagMap(item,()=>{});map=owner.tagMap;const reading=map.draft.read();map.close();resolve();await reading;assert.equal(item.tagModel,undefined);assert.equal(map.draft,null);
 console.log('PASS: compact tag draft deltas, close/reopen, deleted suggestions, live-vocabulary protection, collisions and late-read cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1;});
