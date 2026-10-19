'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('./dashboard'),A=require('./advanced-search'),Search=require('./library-search')(E,A);
const rows=Array.from({length:120},(_,i)=>({path:'papers/'+i+'.pdf',filename:i+'.pdf',title:(i%2?'World model ':'Policy ')+(120-i),tags:i%3?'#research/rl #research/wm':'#research/rl/online',published:i%7?`202${i%7}.${i%12+1}`:'待核实',tldr:'VPP2 &amp; policy',notes:i%5?'User<br>notes':'',categories:[i%2?'Robotics':'ML'],status:i%3?'在读':'待读',priority:i%2?'高':'—',organizing:'待整理',bookmarked:i%3===0,venues:i%4?['ICLR','arXiv']:[],customFields:{}}));
const original=rows.map(r=>r.path),session=new Search();
const advanced=[{},...['all','any'].map(match=>({match,conditions:[{field:'published',op:'between',value:'2021',end:'2025.10'},{field:'tags',op:'all',tags:['#research/rl']},{field:'notes',op:'empty'}]})),{conditions:[{field:'tldr',op:'contains',value:'& policy'},{field:'venues',op:'equals',value:'ICLR'}]}];
for(const sort of ['title','filename','published','status','priority'])for(const descending of [false,true])for(const query of ['','w','policy','VPP2 12','no match'])for(const plan of advanced){
 const options={sort,descending,query,advanced:plan,category:query==='w'?'Robotics':'',tags:query==='policy'?['#research/rl']:[],bookmarked:query==='VPP2 12',statusOrder:['待读','在读'],priorityOrder:['—','高']};
 assert.deepEqual(session.filter(rows,options).map(r=>r.path),E.filterLibrary(rows,options).map(r=>r.path));
}
assert.deepEqual(rows.map(r=>r.path),original,'Cached sorting must not mutate the source snapshot');
let textReads=0,sorts=0,fieldReads=0;
const engine={...E,librarySearchText(...args){textReads++;return E.librarySearchText(...args);},sortLibrary(...args){sorts++;return E.sortLibrary(...args);}};
const a={...A,fieldValue(...args){fieldReads++;return A.fieldValue(...args);}},Cached=require('./library-search')(engine,a),cached=new Cached();
const plan={match:'all',conditions:[{field:'tldr',op:'contains',value:'VPP2'}]};
const options={sort:'title',advanced:plan,query:'world',fieldSearchKey:'en',fieldSearch:()=> 'Reading'};
cached.filter(rows,options);assert.equal(sorts,1);assert.equal(textReads,rows.length);assert.equal(fieldReads,rows.length);
for(const query of ['w','wo','world','vpp2','notes',''])cached.filter(rows,{...options,query});
assert.equal(sorts,1);assert.equal(textReads,rows.length);assert.equal(fieldReads,rows.length,'Advanced conditions are not re-evaluated on plain-query changes');
options.advanced.conditions[0].value='missing';assert.equal(cached.filter(rows,options).length,0,'Even edited-in-place criteria cannot reuse stale matches');options.advanced.conditions[0].value='VPP2';
const changed=rows.map((r,i)=>i? r:{...r,title:'Replacement',tags:'#different',published:'2026.5',notes:'New note',venues:['New venue']});
for(const condition of [{field:'title',op:'equals',value:'Replacement'},{field:'tags',op:'any',tags:['#different']},{field:'published',op:'on',value:'2026.5'},{field:'notes',op:'contains',value:'New note'},{field:'venues',op:'equals',value:'New venue'}])assert.deepEqual(cached.filter(changed,{advanced:{conditions:[condition]}}),E.filterLibrary(changed,{advanced:{conditions:[condition]}}));
assert.equal(cached.filter(rows,{query:'Reading',fieldSearchKey:'en',fieldSearch:()=> 'Reading'}).length,rows.length);
assert.equal(cached.filter(rows,{query:'Reading',fieldSearchKey:'zh',fieldSearch:()=> 'Core'}).length,0,'Language/custom-field display changes invalidate search text');
// Budget exhaustion must never truncate long Notes or give partial search results.
const huge=[{...rows[0],notes:'x'.repeat(5*1024*1024)+' final-needle'}];
assert.equal(cached.filter(huge,{query:'final-needle'}).length,1);assert.equal(cached.filter(huge,{advanced:{conditions:[{field:'notes',op:'contains',value:'final-needle'}]}}).length,1);assert(cached.cacheBytes<=8*1024*1024);
cached.clear();assert.equal(cached.rows,null);assert.equal(cached.ordered,null);assert.equal(cached.matcher,null);assert.equal(cached.cacheBytes,0);assert.equal(cached.memo.get(huge[0]),undefined);
// The real browser input handler coalesces bursts, waits for IME, and tears down frames.
const frames=new Map();let seq=0,renders=0;const win={requestAnimationFrame:f=>(frames.set(++seq,f),seq),cancelAnimationFrame:id=>frames.delete(id)};
const doc={hidden:false,defaultView:win};class ItemView{constructor(){this.contentEl={ownerDocument:doc};}}
const ctx={module:{exports:{}},require:n=>{assert.equal(n,'obsidian');return {Plugin:class{},ItemView,Modal:class{},Platform:{}};}};
vm.runInNewContext(fs.readFileSync('main.js','utf8')+'\nmodule.exports.Browser=LiteratureBrowser;',ctx);
(async()=>{
 const v=new ctx.module.exports.Browser({},{});v.searchEl={value:'',focus(){}};v.syncSearchControls=()=>{};v.syncControls=()=>{};v.renderList=()=>{throw Error('Typing must not rebuild the paper list');};v.renderSearchResults=()=>{renders++;};v.remember=()=>{};
 const flush=()=>{const work=[...frames.values()];frames.clear();work.forEach(f=>f());};
 for(const value of ['w','wo','world']){v.searchEl.value=value;v.onSearchInput();}assert.equal(frames.size,1);assert.equal(renders,0);flush();assert.equal(renders,1);assert.equal(v.filters.query,'world');
 v.searchComposing=true;v.searchEl.value='世界';v.onSearchInput({isComposing:true});assert.equal(frames.size,0);assert.equal(renders,1);v.searchComposing=false;v.onSearchInput();v.onSearchInput();assert.equal(frames.size,1);flush();assert.equal(renders,2);
 v.searchEl.value='queued';v.onSearchInput();v.clearSearch();assert.equal(frames.size,0);assert.equal(v.filters.query,'');assert.equal(renders,3);
 doc.hidden=true;v.searchEl.value='hidden';v.onSearchInput();assert.equal(frames.size,0);assert(v.pendingReload);doc.hidden=false;v.pendingReload=false;
 v.notesDirty=true;v.searchEl.value='discard';v.onSearchInput();assert.equal(v.searchEl.value,'hidden');assert.equal(frames.size,0);v.notesDirty=false;
 v.searchEl.value='close';v.onSearchInput();await v.onClose();assert.equal(frames.size,0);assert.equal(v.searchSession.rows,null);flush();assert.equal(renders,3);
 console.log('PASS: 200 predicate/sort equivalence cases, immutable snapshot and language invalidation, compiled-result reuse, bounded untruncated text, frame coalescing, IME/draft/hidden guards and cache/frame disposal.');
})().catch(e=>{console.error(e);process.exitCode=1;});
