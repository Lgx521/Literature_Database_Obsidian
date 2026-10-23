'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),T=require('./tag-tree');
class Modal{constructor(app){this.app=app;}}
const ctx={module:{exports:{}},require:n=>n==='obsidian'?{Plugin:class{},ItemView:class{},Modal,Platform:{}}:require(n)};
vm.runInNewContext(fs.readFileSync('main.js','utf8')+`
SearchTagMapModal=class {
 constructor(view,draft,apply,done){Object.assign(this,{view,draft,apply,done});}
 open(){}
 close(){this.view.plugin.tagMap=null;this.done();}
};module.exports.Beta=DeepSeekBetaModal;`,ctx);
const Beta=ctx.module.exports.Beta,plain=v=>JSON.parse(JSON.stringify(v));
(async()=>{
 const catalog=T.serialize({groups:[{name:'Existing',tags:['#research/existing','#research/unused']}]}),papers=[0,1].map(index=>({index,path:'temp/'+index+'.pdf',title:'Paper '+index,tags:['#research/suggestion']}));
 const plan={papers,tags:[{tag:'#research/suggestion'}],base:{tags:['#research/existing','#research/unused','#research/from-table']}};
 let reads=0,draws=0,syncs=0;const app={vault:{getAbstractFileByPath:()=>({path:'tags.md'}),read:async()=>{reads++;return catalog;},process(){throw Error('No source writes from plan editing');}}};
 const owner=Object.create(Beta.prototype);Object.assign(owner,{app,plugin:{snapshot:{library:[{tags:'#research/from-table'}]}},work:{running:false,plan,planEdits:{}},service:{enabled:true},refreshPlanTags(){draws++;},requestSync(){syncs++;},sync(){syncs++;}});
 owner.setPlanTags(papers[0],[]);assert.deepEqual(plain(owner.planTagValues(papers[0])),[]);assert.deepEqual(plain(owner.planTagValues(papers[1])),['#research/suggestion']);assert.equal(draws,1);
 owner.openPlanTagMap(papers[0]);let map=owner.tagMap;assert(map.draft.expandAll);assert(map.draft.selectionOnly);
 const model=(await map.draft.read()).model,tags=model.groups.flatMap(g=>g.tags);for(const tag of ['#research/existing','#research/unused','#research/from-table','#research/suggestion'])assert(tags.includes(tag));assert.equal(reads,1);
 await map.view.saveMapTag('#research/existing',true);assert.deepEqual(plain(owner.planTagValues(papers[0])),[],'Checkbox changes stay local until Apply');map.close();assert.equal(owner.tagMap,null);assert.deepEqual(plain(owner.planTagValues(papers[0])),[],'Cancel preserves the plan');
 owner.openPlanTagMap(papers[0]);map=owner.tagMap;await map.view.saveMapTag('#research/existing',true);map.apply(map.view.detailRow.tags.split(/\s+/));map.close();assert.deepEqual(plain(owner.planTagValues(papers[0])),['#research/existing']);assert.equal(papers[0].tags[0],'#research/suggestion','AI proposal remains immutable');
 owner.openPlanTagMap(papers[0]);map=owner.tagMap;owner.work.plan={...plan};map.apply(['#research/unused']);map.close();assert.deepEqual(plain(owner.planTagValues(papers[0])),['#research/existing'],'A stale picker cannot edit a replacement plan');
 owner.work.plan=plan;owner.setPlanTags(papers[1],['#research/suggestion']);owner.setPlanName('tags','#research/suggestion','#research/renamed');assert.deepEqual(plain(owner.planTagValues(papers[1])),['#research/renamed'],'Rename follows explicit per-paper selections');assert.deepEqual(plain(owner.planTagValues(papers[0])),['#research/existing']);
 owner.work.running=true;owner.setPlanTags(papers[0],[]);assert.deepEqual(plain(owner.planTagValues(papers[0])),['#research/existing']);assert(syncs>0);
 console.log('PASS: Inbox plan existing/proposed tag palette, per-paper remove/select, cancel/apply isolation, stale/busy guards and immutable proposals.');
})().catch(e=>{console.error(e);process.exitCode=1;});
