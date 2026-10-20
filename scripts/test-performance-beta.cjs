'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('./dashboard'),Work=require('./deepseek-work');
const ctx={module:{exports:{}},setTimeout,clearTimeout,require:n=>{assert.equal(n,'obsidian');return {Plugin:class{},Modal:class{},ItemView:class{},Platform:{}};}};
vm.runInNewContext(fs.readFileSync('main.js','utf8')+'\nmodule.exports.Beta=DeepSeekBetaModal;',ctx);
const Beta=ctx.module.exports.Beta;
(async()=>{
 // Library-size work happens once per source revision, not per keystroke.
 let membershipReads=0;const rows=Array.from({length:1000},(_,i)=>({path:'papers/'+i+'.pdf',filename:i+'.pdf',title:'Verified title '+i,tags:'#research/rl',tldr:'Complete summary',organizing:'AI 已整理'}));
 const collection={scope:'library',get members(){membershipReads++;return rows.map(r=>({path:r.path}));}};
 const plugin={snapshot:{library:rows,collections:[collection],inbox:[]}},modal=Object.create(Beta.prototype);Object.assign(modal,{plugin,paths:['papers/1.pdf'],mode:{value:'pending'}});
 assert.equal(modal.batch().length,0);const initialReads=membershipReads;for(let i=0;i<100;i++)assert.equal(modal.batch().length,0);assert.equal(membershipReads,initialReads,'No membership traversal for unchanged sources');
 const next=rows.map((r,i)=>i<30?{...r,tldr:''}:r);next[0]={...next[0],organizing:'人工完成'};plugin.snapshot={...plugin.snapshot,library:next};assert.equal(modal.batch().length,29);assert.equal(modal.batch()[0],'papers/1.pdf');assert(membershipReads>initialReads);
 assert.deepEqual([...modal.batch('selection')],['papers/1.pdf']);plugin.snapshot={...plugin.snapshot,inbox:[{path:'temp/a.pdf'},{path:'temp/a.pdf'},{path:'temp/b.pdf'}]};assert.deepEqual([...modal.batch('inbox')],['temp/a.pdf','temp/b.pdf']);
 plugin.snapshot={...plugin.snapshot,collections:[]};assert(modal.batch().length===999,'Collection changes invalidate eligibility without truncating the queue');
 // Only changed immutable edits need validation; Apply still validates via service.
 let reviews=0,writes=0;const service={enabled:true,review(p,e){reviews++;return {error:e?.tldr===''?'Missing summary':''};},async apply(){writes++;},cancel(){}};
 const work=new Work(service);work.items=Array.from({length:20},(_,i)=>({proposal:{path:i},edits:{},tagModel:{groups:[]},tagBase:{groups:[]},originalTagModel:{groups:[]},tagMapState:{zoom:1}}));
 assert.equal(work.ready.length,20);assert.equal(reviews,20);for(let i=0;i<100;i++)assert.equal(work.ready.length,20);assert.equal(reviews,20);
 const item=work.items[0];item.edits={tldr:''};assert.equal(work.ready.length,19);assert.equal(reviews,21);item.edits={tldr:'Edited'};assert.equal(work.ready.length,20);assert.equal(reviews,22);
 await work.apply(work.ready);assert.equal(writes,20);assert.equal(reviews,22,'Batch application does not repeatedly validate every other preview');assert.equal(item.tagModel,undefined);assert.equal(item.edits.tldr,'Edited');
 const ignored={proposal:{},edits:{title:'Keep this'},tagModel:{groups:[]}};work.items.push(ignored);work.ignore(ignored);assert.equal(ignored.tagModel,undefined);assert.equal(ignored.edits.title,'Keep this');
 // The modal keeps all selected paths, and continuing is disabled until the
 // current previews are resolved. Controls survive session reopen.
 service.selectedModel=()=>({id:'test-model'});
 const selected=Array.from({length:45},(_,i)=>'temp/'+i+'.pdf');
 const queueView=new Beta({deepSeekWork:work},selected);assert.equal(queueView.paths.length,45);
 const node=()=>({textContent:'',setText(value){this.textContent=value;}});
 for(const key of ['batchBar','batchStatus','nextBatchButton','discardQueueButton'])queueView[key]=node();
 work.queue={index:1,count:3,active:[],remaining:selected.slice(20)};
 work.items=[{proposal:{},edits:{}}];queueView.syncBatches();assert.equal(queueView.batchBar.hidden,false);assert.equal(queueView.nextBatchButton.disabled,true);assert.equal(queueView.nextBatchButton.hidden,false);
 work.clearResults();queueView.syncBatches();assert.equal(queueView.nextBatchButton.disabled,false);assert.equal(work.queuedCount,25);
 work.running=true;queueView.syncBatches();assert.equal(queueView.nextBatchButton.hidden,true);assert.equal(queueView.discardQueueButton.hidden,true);work.running=false;
 work.plan={};queueView.syncBatches();assert.equal(queueView.nextBatchButton.hidden,true);work.plan=null;
 service.enabled=false;queueView.syncBatches();assert.equal(queueView.nextBatchButton.disabled,true);service.enabled=true;
 work.discardQueue();queueView.syncBatches();assert.equal(queueView.batchBar.hidden,true);
 // Frame coalescing, hidden pause, and teardown are independent of job lifetime.
 const frames=new Map();let id=0,paints=0,removed=0;
 const win={requestAnimationFrame:fn=>(frames.set(++id,fn),id),cancelAnimationFrame:key=>frames.delete(key)},doc={hidden:false,removeEventListener:()=>removed++};
 const view=Object.create(Beta.prototype);Object.assign(view,{renderDoc:doc,renderWin:win,work,plugin:{},itemViews:new Map(),paths:[],contentEl:{empty(){}},sync(){paints++;this.pendingSync=false;}});
 for(let i=0;i<100;i++)view.requestSync();assert.equal(frames.size,1);let fn=[...frames.values()][0];frames.clear();fn();assert.equal(paints,1);
 doc.hidden=true;view.requestSync();assert.equal(frames.size,0);assert(view.pendingSync);doc.hidden=false;view.requestSync();assert.equal(frames.size,1);view.onClose();assert.equal(frames.size,0);assert.equal(removed,1);assert.equal(view.renderDoc,null);assert.equal(view.batchCache,null);assert.equal(view.task,null);assert.equal(work.closed,false,'Closing the modal does not cancel a job');
 work.close();
 // Custom field search text is produced once per row, with unchanged sort semantics.
 let searches=0;const samples=['paper10.pdf','paper2.pdf','Paper1.pdf','论文3.pdf','é4.pdf'].map((filename,i)=>({path:filename,filename,title:i%2?'':filename,tags:'#research/rl #research/wm',tldr:'alpha',notes:'beta',status:'待读',priority:'—',published:i%2?'待核实':'2026.5',categories:['Research']}));
 assert.equal(E.filterLibrary(samples,{query:'alpha beta gamma',tags:['#research/rl','#research/missing'],fieldSearch:()=>{searches++;return 'gamma';}}).length,5);assert.equal(searches,5);
 searches=0;E.filterLibrary(samples,{fieldSearch:()=>{searches++;}});assert.equal(searches,0,'Empty queries never build search text');
 const reference=[...samples].sort((a,b)=>a.filename.localeCompare(b.filename,'en',{numeric:true}));assert.deepEqual(E.filterLibrary(samples).map(r=>r.path),reference.map(r=>r.path));assert.equal(E.filterLibrary(samples,{sort:'published',descending:true}).at(-1).published,'待核实');assert.equal(E.filterLibrary(samples,{category:E.UNFILED_CATEGORY}).length,0);
 console.log('PASS: cached linear batch selection, per-edit validation, bounded draft release, frame coalescing/teardown and one-pass search with stable numeric sorting.');
})().catch(e=>{console.error(e);process.exitCode=1;});
