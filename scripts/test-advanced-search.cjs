'use strict';
const assert=require('node:assert/strict'),A=require('./advanced-search'),E=require('./dashboard'),fs=require('node:fs'),vm=require('node:vm');
const rows=[
 {path:'a',title:'World Model & Control',filename:'1234.pdf',tags:'#research/rl #research/wm',published:'2026.5',venues:['ICLR 2026','arXiv'],tldr:'Proposes VPP2 &amp; control',notes:'Line one<br>line two',categories:['Robotics'],status:'在读'},
 {path:'b',title:'Transfer Learning',filename:'5678.pdf',tags:'#research/rl/online',published:'2026',venues:[],tldr:'',notes:'',categories:['ML'],status:'待读'},
 {path:'c',title:'World Model',filename:'9101.pdf',tags:'#research/wm',published:'2025.10',venues:['NeurIPS'],tldr:'Learns action',notes:'',categories:['Robotics'],status:'待读'},
 {path:'d',title:'',filename:'new.pdf',tags:'',published:'待核实',venues:[],tldr:'',notes:'',categories:['Robotics'],status:'待读'}
];
const c=(field,op,value='',extra={})=>({field,op,value,...extra});
const find=(conditions,match='all',extra={})=>E.filterLibrary(rows,{advanced:{match,conditions},...extra}).map(r=>r.path).sort();
assert.deepEqual(find([c('title','contains','WORLD'),c('published','on','2026')]),['a']);
assert.deepEqual(find([c('title','contains','WORLD'),c('published','on','2026')],'any'),['a','b','c']);
assert.deepEqual(find([c('title','contains','WORLD'),c('published','on','2026')],'any',{category:'Robotics',status:'待读'}),['c']);
assert.deepEqual(find([c('title','contains','WORLD')],'all',{query:'1234'}),['a']);
assert.deepEqual(find([c('tags','any','',{tags:['#research/RL','#research/wm']})]),['a','c']);
assert.deepEqual(find([c('tags','all','',{tags:['#research/rl','#research/wm']})]),['a']);
assert.deepEqual(find([c('tags','none','',{tags:['#research/rl']})]),['b','c','d']);
assert.deepEqual(find([c('tags','empty')]),['d']);
assert.deepEqual(find([c('tags','notEmpty')]),['a','b','c']);
assert.deepEqual(find([c('venues','equals','iclr 2026')]),['a']);
assert.deepEqual(find([c('venues','notContains','iclr')]),['b','c','d']);
assert.deepEqual(find([c('tldr','contains','VPP2 &')]),['a']);
assert.deepEqual(find([c('notes','contains','one line two')]),['a']);
assert.deepEqual(find([c('filename','equals','1234.PDF')]),['a']);
assert.deepEqual(find([c('title','equals','new.pdf')]),['d'],'Provisional display titles stay searchable');
assert.deepEqual(find([c('tldr','empty')]),['b','d']);
assert.deepEqual(find([c('published','on','2026.05')]),['a']);
assert.deepEqual(find([c('published','before','2026.5')]),['c'],'Year-only evidence cannot satisfy month-level before/after');
assert.deepEqual(find([c('published','after','2025')]),['a','b']);
assert.deepEqual(find([c('published','between','2025.10',{end:'2026.5'})]),['a','c']);
assert.deepEqual(find([c('published','between','2025',{end:'2026'})]),['a','b','c']);
assert.deepEqual(find([c('published','empty')]),['d']);
assert.deepEqual(find([c('published','notEmpty')]),['a','b','c']);
assert.deepEqual(find([], 'any'),['a','b','c','d']);
for(const value of ['2026.13','2026.0','not-a-date','2026.5.1'])assert.equal(A.dateRange(value),null);
assert(A.problem(A.normalize({conditions:[c('published','between','2026.5',{end:'2025'})]}).conditions[0]));
assert(A.problem(A.normalize({conditions:[c('title','contains','  ')]}).conditions[0]));
assert(A.problem(A.normalize({conditions:[c('tags','all')]}).conditions[0]));
assert.equal(A.normalize({conditions:[null,c('author','contains','ignored')]}).conditions.length,0);
const conditions=[c('tags','all','',{tags:['#research/rl']})],state=A.normalize({conditions});state.conditions[0].tags.push('#extra');assert.equal(conditions[0].tags.length,1);
// Exercise actual view state and guards without host I/O or real user data.
class ItemView{constructor(){this.app={workspace:{requestSaveLayout(){}}};}async setState(){}}
const ctx={module:{exports:{}},require:n=>{assert.equal(n,'obsidian');return {Plugin:class{},ItemView,Modal:class{},Platform:{},Notice:class{}};}};
vm.runInNewContext(fs.readFileSync('main.js','utf8')+'\nmodule.exports.Browser=LiteratureBrowser;',ctx);
(async()=>{
 const view=new ctx.module.exports.Browser({},{});view.rows=rows;view.syncControls=()=>{};view.renderList=()=>{};view.reload=async()=>{};view.remember=()=>{};
 assert(view.applyAdvancedSearch({match:'any',conditions:[c('title','contains','world')]}));
 const snapshot=view.getState();snapshot.advanced.conditions[0].value='mutated';assert.equal(view.filters.advanced.conditions[0].value,'world');
 await view.setState(view.getState());assert.equal(view.filters.advanced.match,'any');
 view.filters.query='VPP2';await view.navigate({category:'Robotics'});assert.equal(view.filters.query,'VPP2');assert.equal(view.filters.advanced.conditions.length,1);
 await view.navigate({scope:'projects',category:'Writing'});assert.equal(view.filters.advanced.conditions.length,1);
 view.searchEl={focus(){}};view.clearSearch();assert.equal(view.filters.query,'');assert.equal(view.filters.advanced.conditions.length,1);
 view.notesDirty=true;view.filters.query='keep';assert.equal(view.applyAdvancedSearch({}),false);view.clearSearch();assert.equal(view.filters.query,'keep');view.clearFilters();assert.equal(view.filters.advanced.conditions.length,1);view.notesDirty=false;
 view.clearFilters();assert.equal(view.filters.advanced.conditions.length,0);
 view.applyAdvancedSearch({conditions:[c('title','contains','world')]});await view.navigate({scope:'library',revealPaths:['a']});assert.equal(view.filters.advanced.conditions.length,0);
 console.log('PASS: field predicates, AND/OR with existing filters, precise tags/dates, missing values, decoded text, validation, no authors, workspace state, navigation, clear/import resets and Notes guards.');
})().catch(e=>{console.error(e);process.exitCode=1;});
