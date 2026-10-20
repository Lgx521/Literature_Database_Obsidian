'use strict';
const assert=require('node:assert/strict'),Work=require('./deepseek-work');
const paths=(count,root='temp')=>Array.from({length:count},(_,i)=>`${root}/${i}.pdf`);
function fixture(){
 const state={plans:[],organized:[],applied:[],taxonomy:[],active:0,peak:0};
 const service={enabled:true,cancel(){},review:()=>({error:''}),
  async planInbox(paths){state.plans.push({paths:[...paths],taxonomy:[...state.taxonomy]});return {papers:paths.map(path=>({path})),category:state.taxonomy[0]||'Confirmed category'};},
  async approvePlan(plan){return plan;},
  async organize(path,lang,plan){state.active++;state.peak=Math.max(state.peak,state.active);await Promise.resolve();state.active--;state.organized.push(path);return {path,filename:path,category:plan?.category};},
  async apply(p){state.applied.push(p.path);if(p.category&&!state.taxonomy.includes(p.category))state.taxonomy.push(p.category);}
 };
 return {service,state,work:new Work(service)};
}
(async()=>{
 // 45 unique papers require three explicit planning/preview gates, never an
 // unbounded set of previews or an implicit write/next-batch request.
 const {work:w,service:s,state}=fixture(),all=paths(45);
 await w.planInbox([...all,all[0]]);
 assert.equal(w.queue.count,3);assert.equal(w.queue.index,1);assert.equal(w.queuedCount,45);
 assert.equal(state.organized.length,0);assert.equal(state.plans[0].paths.length,20);
 await assert.rejects(w.nextBatch(),/应用或清除/);
 await w.confirmPlan();assert.equal(w.items.length,20);assert.equal(w.queuedCount,25);
 assert.equal(state.plans.length,1);assert.equal(state.applied.length,0);
 w.items[0].edits={tldr:'Human draft'};const old=w.items[0];
 await assert.rejects(w.organize(all),/应用或清除/);assert.equal(w.items[0],old);
 await assert.rejects(w.nextBatch(),/应用或清除/);assert.equal(old.edits.tldr,'Human draft');
 await w.apply(w.ready);assert.equal(state.plans.length,1,'Apply never automatically starts a new request');
 await Promise.all([w.nextBatch(),assert.rejects(w.nextBatch(),/等待/)]);
 assert.equal(w.queue.index,2);assert.equal(w.items.length,0,'Release previous previews at batch boundary');
 assert.deepEqual(state.plans[1].taxonomy,['Confirmed category'],'Later planning reuses applied vocabulary');
 await w.confirmPlan();assert.equal(w.items.length,20);await w.apply(w.ready);
 await w.nextBatch();assert.equal(w.queue.index,3);assert.equal(w.plan.papers.length,5);
 await w.confirmPlan();assert.equal(w.queuedCount,0);await w.apply(w.ready);
 assert.deepEqual(state.plans.map(p=>p.paths.length),[20,20,5]);assert.deepEqual(state.organized,all);assert.deepEqual(state.applied,all);assert.equal(state.peak,1);
 w.clear();assert.equal(w.queue,null);
 // Archived enrichment uses the same bounded queue, without the Inbox gate.
 await w.organize(paths(21,'papers'));assert.equal(w.pending.length,20);assert.equal(w.queuedCount,1);
 w.clearResults();assert.equal(w.items.length,0);assert.equal(w.queuedCount,1,'Clear previews retains queued batches');await w.nextBatch();assert.equal(w.pending.length,1);assert.equal(w.queuedCount,0);
 w.clear();
 // Stop retains completed drafts and unfinished paths. Resuming an Inbox
 // batch replans the remainder against fresh, applied taxonomy.
 let calls=0;s.organize=async(path,lang,plan)=>{if(++calls===2)w.stop();return {path,filename:path,category:plan?.category};};
 await w.planInbox(paths(25));await w.confirmPlan();assert.equal(w.phase,'stopped');assert.equal(w.pending.length,1);assert.equal(w.queuedCount,24);
 w.ignore(w.items[0]);s.organize=async path=>({path,filename:path});
 await w.nextBatch();assert.equal(w.queue.index,1);assert.deepEqual(w.plan.papers.map(p=>p.path),paths(20).slice(1));
 await w.confirmPlan();assert.equal(w.pending.length,19);w.discardQueue();assert.equal(w.queue,null);assert.equal(w.pending.length,19,'Cancel remaining leaves review drafts intact');
 w.clear();
 // Plan failure and fatal service errors do not silently drop current paths.
 const plan=s.planInbox;s.planInbox=async()=>{throw Error('Network failure');};
 await w.planInbox(paths(22));assert.equal(w.queuedCount,22);assert.equal(w.phase,'error');
 s.planInbox=plan;await w.nextBatch();assert.equal(w.queue.index,1);assert.equal(w.plan.papers.length,20);
 w.clear();s.organize=async()=>{throw Error('DeepSeek 余额不足');};
 await w.organize(paths(22,'papers'));assert.equal(w.queuedCount,22);assert.equal(w.done,0);
 s.enabled=false;const before=JSON.stringify(w.queue);await assert.rejects(w.nextBatch(),/密钥/);assert.equal(JSON.stringify(w.queue),before);s.enabled=true;
 s.wire={};await assert.rejects(w.nextBatch(),/等待/);s.wire=null;
 s.organize=async path=>({path,filename:path});await w.nextBatch();assert.equal(w.pending.length,20);assert.equal(w.queuedCount,2);
 w.close();assert.equal(w.queue,null);assert.equal(w.items.length,0);
 console.log('PASS: 45-paper 20/20/5 queue, per-batch confirmation, vocabulary reuse, bounded previews, cancellation/retry and teardown.');
})().catch(error=>{console.error(error);process.exitCode=1;});
