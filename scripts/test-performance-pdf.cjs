'use strict';
const assert=require('node:assert/strict'),Queue=require('./pdf-work'),T=require('./title-export');
const tick=()=>new Promise(r=>setTimeout(r,0));
(async()=>{
 const q=new Queue(),events=[];let release,active=0,peak=0;const owner={};
 const first=q.run(async work=>{active++;peak=Math.max(peak,active);events.push('read A');await new Promise(r=>release=r);work.check();active--;events.push('destroy A');},{owner});
 const second=q.run(async()=>{active++;peak=Math.max(peak,active);events.push('read B');active--;return 2;});
 await tick();assert.deepEqual(events,['read A']);release();await first;assert.equal(await second,2);assert.equal(peak,1);assert.deepEqual(events,['read A','destroy A','read B']);
 let destroyed=0;const hanging=q.run(work=>new Promise((resolve,reject)=>{work.onCancel(()=>{destroyed++;reject(Error('destroyed document'));});}),{owner});
 const cancelled=assert.rejects(hanging,e=>e.name==='AbortError');await tick();q.cancelOwner(owner);await cancelled;assert.equal(destroyed,1);
 assert.equal(await q.run(async()=>3),3,'Cancellation does not poison later reads');
 let started=0;await assert.rejects(q.run(()=>{started++;},{cancelled:()=>true}));assert.equal(started,0);
 const timeout=q.run(work=>new Promise((resolve,reject)=>work.onCancel(()=>reject(Error('destroyed')))),{timeout:5});await assert.rejects(timeout,/timed out/);
 let reads=0;const a=q.run(work=>new Promise((resolve,reject)=>work.onCancel(()=>reject(Error('unloaded'))))),b=q.run(()=>{reads++;});const failures=Promise.all([assert.rejects(a),assert.rejects(b)]);q.close();await failures;assert.equal(reads,0);assert.equal(q.jobs.length,0);assert.equal(q.active,null);
 let parseCount=0;const parse=raw=>{parseCount++;return {data:{title:'Stored BibTeX title'}};};
 const result=T.exportTitles([{path:'a',title:'Known title',bibtex:'unused'},{path:'a',title:'Known title',bibtex:'unused'},{path:'b',title:'',bibtex:'existing'},{path:'c',title:'1234.pdf'}],parse);
 assert.equal(parseCount,1);assert.equal(result.content,'Known title\nStored BibTeX title\n');assert.equal(result.missing.length,1);
 console.log('PASS: shared serial PDF work, cancellation/timeout/unload cleanup, queue recovery and lazy title export.');
})().catch(e=>{console.error(e);process.exitCode=1;});
