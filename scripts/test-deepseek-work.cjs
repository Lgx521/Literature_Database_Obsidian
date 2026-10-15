'use strict';
const assert=require('node:assert/strict'),Work=require('./deepseek-work');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
(async()=>{
 let calls=[],notifications=0,updates=0,pending;
 const service={enabled:true,cancel(){this.cancels=(this.cancels||0)+1;pending?.reject(Error('cancelled'));},async organize(path){calls.push(path);this.onPhase('request');pending=deferred();return pending.promise;},async apply(p,edits){calls.push('apply:'+p.path);this.appliedEdits=edits;},review(p){return {error:p.incomplete?'Incomplete':''};}};
 const w=new Work(service,{changed:()=>updates++,completed:()=>notifications++});
 const badView=w.subscribe(()=>{throw Error('detached view');});
 let rendered=0,off=w.subscribe(()=>rendered++);
 const job=w.organize(['temp/a.pdf','temp/b.pdf','temp/a.pdf']);assert.equal(w.total,2);assert.equal(w.phase,'request');off();const before=rendered;badView();
 // Closing the UI is unsubscribe only: the explicit batch completes, bounded
 // metadata survives, and a new view receives state without another request.
 pending.resolve({path:'temp/a.pdf',filename:'a.pdf',changes:{tldr:'A'},target:{name:'A'}});await new Promise(r=>setImmediate(r));assert.equal(calls.length,2);pending.resolve({path:'temp/b.pdf',filename:'b.pdf',changes:{},target:null,incomplete:true});await job;
 assert.equal(rendered,before);assert.equal(w.pending.length,2);assert.equal(w.phase,'ready');assert.equal(notifications,1);assert.equal(w.ready.length,1);assert.equal(w.listeners.size,0);assert(updates>0);assert(!JSON.stringify(w.items).includes('el"'));
 w.items[0].edits={tldr:'Human draft'};w.items[0].tagInput='unfinished';assert.equal(w.ready.length,0);w.items[0].tagInput='';off=w.subscribe(()=>rendered++);w.emit();assert(rendered>before);await w.apply(w.ready);assert(w.items[0].applied);assert.equal(service.appliedEdits.tldr,'Human draft');assert.equal(w.pending.length,1);w.ignore(w.items[1]);assert.equal(w.pending.length,0);off();
 // Stop preserves finished previews but never starts the rest of the batch.
 const cancelled=w.organize(['temp/a.pdf','temp/b.pdf']);w.stop();await cancelled;assert.equal(w.phase,'stopped');assert.equal(calls.filter(p=>p==='temp/b.pdf').length,1);assert.equal(service.cancels,1);
 assert.equal(w.ask,undefined);w.clear();assert.equal(w.items.length,0);assert.equal(w.phase,'idle');
 // An already-started atomic apply completes on Stop; later writes don't run.
 w.items=[{proposal:{path:'papers/a.pdf'},filename:'a.pdf'},{proposal:{path:'papers/b.pdf'},filename:'b.pdf'}];let write=deferred(),writes=0;service.apply=async()=>{writes++;await write.promise;};const applying=w.apply(w.ready);w.stop();write.resolve();await applying;assert.equal(writes,1);assert(w.items[0].applied);assert.equal(w.phase,'stopped');
 const unloading=w.organize(['temp/a.pdf','temp/b.pdf']);w.close();await unloading;assert.equal(w.items.length,0);assert.equal(w.listeners.size,0);assert.equal(service.onPhase,null);assert.equal(service.onIdle,null);assert.deepEqual(w.draft,{});
 // Planning stops at a human gate; no per-paper call until confirmation.
 const planDeferred=deferred();let organized=0,applied=0,approved=0;
 const ps={enabled:true,cancel(){},planInbox:()=>planDeferred.promise,approvePlan:async p=>{approved++;return p;},organize:async(path,language,plan)=>{assert(plan);organized++;return {path,filename:path};},apply:async()=>applied++,review:()=>({error:''})};
 const first=new Work(ps),planning=first.planInbox(['temp/one.pdf','temp/two.pdf']);first.subscribe(()=>{} )();planDeferred.resolve({papers:[{path:'temp/one.pdf'},{path:'temp/two.pdf'}]});await planning;
 assert.equal(first.phase,'plan');assert.equal(organized,0);assert.equal(applied,0);assert(first.plan);let count=0;const reopened=first.subscribe(()=>count++);first.emit();assert.equal(count,1);reopened();
 await Promise.all([first.confirmPlan(),first.confirmPlan()]);assert.equal(approved,1,'Double click does not confirm twice');assert.equal(organized,2);assert.equal(applied,0);assert.equal(first.plan,null);assert.equal(first.pending.length,2);
 first.clear();assert.equal(first.pending.length,0);assert.deepEqual(first.planEdits,{});first.close();assert.equal(first.plan,null);
 console.log('DeepSeek task lifecycle: hidden continuation, reopen, explicit cancellation, atomic writes and teardown passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
