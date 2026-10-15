'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('./dashboard'),C=require('./collections'),D=require('./deadline-sharing')(E,C),Cache=require('./snapshot-cache');
class TFile{constructor(path){this.path=path;this.name=path.split('/').pop();this.extension=path.split('.').pop();this.stat={size:1,mtime:1,ctime:1};}}
const values=new Map(['library.md','collections.md','reviews.md','submissions.md'].map(n=>[n,fs.readFileSync('templates/empty-vault/'+n,'utf8')]));
values.set('library.md',E.addLibraryEntry(values.get('library.md'),'papers/Original.pdf'));
values.set('collections.md',C.change(C.add(values.get('collections.md'),'library','Research'),['papers/Original.pdf'],{scope:'library',name:'Research'}));
const files=new Map([...values.keys()].map(n=>[n,new TFile(n)])),inbox=new TFile('temp/Inbox.pdf');files.set('temp',{children:[inbox]});
const reads=[],parses=[];const engine={...E,parseLibrary:t=>(parses.push('library'),E.parseLibrary(t)),parseTracker:(t,s)=>(parses.push(s),E.parseTracker(t,s))};
const vault={getAbstractFileByPath:n=>files.get(n),getFiles:()=>{throw Error('Do not enumerate unrelated vault files');},read:async f=>(reads.push(f.path),values.get(f.path))};
(async()=>{
 const cache=new Cache(engine,C,D,TFile),first=await cache.read(vault);assert.equal(first.inbox.length,1);assert.deepEqual(first.library[0].categories,['Research']);
 reads.length=parses.length=0;assert.equal(await cache.read(vault),first);assert.equal(parses.length,0,'Explicit refresh validates contents without reparsing unchanged tables');
 reads.length=0;values.set('library.md',E.updateLibraryEntry(values.get('library.md'),first.library[0],{notes:'User notes'}));
 const second=await cache.read(vault,new Set(['library.md']));assert.deepEqual(reads,['library.md']);assert.deepEqual(parses,['library']);assert.equal(second.reviews,first.reviews);assert.equal(second.collections,first.collections);assert.equal(second.inbox,first.inbox);
 const valid=values.get('collections.md');values.set('collections.md','incomplete sync');await assert.rejects(cache.read(vault,new Set(['collections.md'])));assert.equal(cache.snapshot,second);assert.equal(cache.sources.get('collections.md').text,valid);
 values.set('collections.md',valid);assert.equal(await cache.read(vault,new Set(['collections.md'])),second);
 files.delete('reviews.md');await assert.rejects(cache.read(vault,new Set(['library.md'])));assert.equal(cache.snapshot,second);files.set('reviews.md',new TFile('reviews.md'));
 values.set('library.md',E.updateLibraryEntry(values.get('library.md'),second.library[0],{notes:'Recovered concurrent edit'}));values.set('collections.md','incomplete again');await assert.rejects(cache.read(vault,new Set(['library.md','collections.md'])));
 values.set('collections.md',valid);const recovered=await cache.read(vault,new Set(['collections.md']));assert.equal(recovered.library[0].notes,'Recovered concurrent edit','Recovery must include changes read before an incomplete sibling source failed');
 files.get('temp').children=[];const third=await cache.read(vault,new Set(['temp/Inbox.pdf']));assert.equal(third.inbox.length,0);assert.equal(third.library,recovered.library);
 cache.clear();assert.equal(cache.sources.size,0);assert.equal(cache.snapshot,null);
 // Exercise the manager's event + direct-write coalescing, including a change
 // arriving during an asynchronous read. All data and writes are in memory.
 const api={module:{exports:{}},setTimeout,clearTimeout,require:n=>n==='obsidian'?{Plugin:class{},ItemView:class{},Modal:class{},TFile,Notice:class{},Platform:{}}:require(n)};
 vm.runInNewContext(fs.readFileSync('main.js','utf8'),api);const p=new api.module.exports();
 p.app={vault:{...vault,process:async(f,fn)=>{values.set(f.path,fn(values.get(f.path)));p.schedule([f.path]);},adapter:{exists:async()=>true,write:async()=>{}}},workspace:{getLeavesOfType:()=>[]}};
 let loads=0;const load=p.loadSnapshot.bind(p);p.loadSnapshot=async dirty=>{loads++;return load(dirty);};p.renderNavigation=()=>{};await p.refresh();loads=0;reads.length=0;
 await p.mutate('library.md',t=>E.updateLibraryEntry(t,E.parseLibrary(t)[0],{notes:'Changed notes'}));await new Promise(r=>setTimeout(r,350));
 assert.equal(loads,1);assert.deepEqual(reads,['library.md','library.md'],'One guarded-write read plus one changed-source refresh');
 let release,started;const gate=new Promise(r=>release=r),start=new Promise(r=>started=r),read=p.app.vault.read;
 p.app.vault.read=async f=>{if(f.path==='library.md'){started();await gate;}return read(f);};
 const pending=p.refresh(false,['library.md']);await start;
 values.set('collections.md',C.rename(values.get('collections.md'),'library','Research','Renamed'));
 p.refresh(false,['collections.md']);release();await pending;assert.equal(p.snapshot.collections[0].name,'Renamed','Changes during refresh are drained before completion');
 p.app.vault.read=read;let releaseStopped,startedStopped;const stoppedGate=new Promise(r=>releaseStopped=r),stoppedStart=new Promise(r=>startedStopped=r);
 p.app.vault.read=async f=>{startedStopped();await stoppedGate;return read(f);};const late=p.refresh();await stoppedStart;
 p.stopped=true;p.snapshotCache.clear();releaseStopped();await late;assert.equal(p.snapshotCache.sources.size,0,'A late read cannot repopulate the cache after unload');clearTimeout(p.timer);
 console.log('PASS: source-scoped parsing, last-good snapshot, missing files, inbox traversal, coalesced writes and changes during refresh.');
})().catch(e=>{console.error(e);process.exitCode=1;});
