const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const E=require('./dashboard');
const header='| '+E.NOTES_HEADERS.join(' | ')+' |\n| --- | --- | --- | --- | --- | --- | --- |';
const row='| [One.pdf](papers/One.pdf) | 2026.10 | #research/rl | user TLDR | 在读 | 高 | A<br>&#124; B |';
const a='## A\nA notes\n'+header+'\n'+row+'\n\n';
const b='## B\nB notes\n'+header+'\n\n';
const c='## C\nC notes\n'+header+'\n\n';
const intro='USER HEADER\n',middle='## 手写说明\nKEEP BETWEEN SLOTS\n\n',suffix='<!-- library:end -->\n## A\nUSER FOOTER\n';
const source=intro+a+middle+b+c+suffix;
assert.equal(E.reorderGroups(source,'library','A','C',true,['A','B','C']),intro+b+middle+c+a+suffix);
assert.equal(E.reorderGroups(source,'library','C','A',false),intro+c+middle+a+b+suffix);
assert.equal(E.reorderGroups(source,'library','A','B',false),source);
assert.equal(E.reorderGroups(source,'library','A','A',true),source);
assert.throws(()=>E.reorderGroups(source,'library','A','B',true,['B','A','C']),/已在其他/);
assert.throws(()=>E.reorderGroups(source,'library','Missing','A'),/同一分组/);
assert.throws(()=>E.reorderGroups(source.replace('<!-- library:end -->',''),'library','A','B'),/同步/);
assert.deepEqual(E.parseLibrary(E.reorderGroups(source,'library','A','C',true))[0].cells,E.parseLibrary(source)[0].cells);
const renamed=E.renameCategory(source,'A','Renamed');assert(renamed.endsWith(suffix));assert(renamed.includes('## Renamed\nA notes'));
const deleted=E.deleteCategory(source,'A');assert(!E.getCategories(deleted).includes('A'));assert(E.getCategories(deleted).includes('未分类'));assert(deleted.includes('A notes'));assert(deleted.endsWith(suffix));
assert.deepEqual(E.parseLibrary(deleted)[0].cells,E.parseLibrary(source)[0].cells);assert.equal(E.parseLibrary(deleted)[0].category,'未分类');
assert.throws(()=>E.deleteCategory(deleted,'未分类'),/不能删除/);assert.throws(()=>E.renameCategory(deleted,'未分类','New'),/不能重命名/);
assert(!E.getCategories(E.deleteCategory(source,'B')).includes('未分类'));
const last=E.deleteCategory(intro+a+suffix,'A');assert.deepEqual(E.getCategories(last),['未分类']);assert.equal(E.parseLibrary(last).length,1);
const legacy=(intro+a+suffix).replaceAll(' | Notes','').replace('| --- | --- | --- | --- | --- | --- | --- |','| --- | --- | --- | --- | --- | --- |').replace(' | A<br>&#124; B','');assert.equal(E.parseLibrary(E.deleteCategory(legacy,'A'))[0].cells.length,7);
const crlf=source.replaceAll('\n','\r\n'),reordered=E.reorderGroups(crlf,'library','A','C',true);assert(!reordered.replaceAll('\r\n','').includes('\n'));assert(!E.deleteCategory(crlf,'A').replaceAll('\r\n','').includes('\n'));
const th='| '+E.TRACKING_HEADERS.join(' | ')+' |\n| --- | --- | --- | --- | --- |';
const staging='## 待确定 venue\n截止时间：—\n'+th+'\n\n';
const venue=(name,due)=>`## ${name}\n截止时间：${due}\n${name} notes\n${th}\n| Same title | 待审 | ${due} | 下一步 | ${name} user note |\n\n`;
const va=venue('Venue A','2026-10-21 23:59 -12:00'),vb=venue('Venue B','2027-01-01 12:30 +08:00'),tail='<!-- tracking:end -->\nUSER FOOTER';
for(const scope of ['reviews','submissions']){
 const tracker=intro+staging+va+vb+tail,out=E.reorderGroups(tracker,scope,'Venue B','Venue A');
 assert.equal(out,intro+staging+vb+va+tail);
 assert.equal(E.trackerDeadline(out,'Venue A'),'2026-10-21 23:59 -12:00');
 assert.throws(()=>E.reorderGroups(tracker,scope,'待确定 venue','Venue B'),/暂存区/);
 assert.throws(()=>E.reorderGroups(tracker,scope,'Venue A','待确定 venue'),/暂存区/);
}
// Distinguish group sorting from dropping a paper; verify insertion feedback and cancellation.
const notices=[],api={module:{exports:{}},require:n=>n==='obsidian'?{Plugin:class{},ItemView:class{},Modal:class{},Notice:class{constructor(m){notices.push(m);}}}:require(n)};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+'\nmodule.exports.groupTarget=ldbGroupReorderTarget;module.exports.groupMime=GROUP_DRAG;module.exports.paperMime=PAPER_DRAG;',api);
const {groupTarget,groupMime,paperMime}=api.module.exports;
class Element{constructor(){this.events={};this.classes=new Set();}addEventListener(n,f){this.events[n]=f;}addClass(c){this.classes.add(c);}removeClass(c){this.classes.delete(c);}contains(n){return n===this;}getBoundingClientRect(){return {top:100,height:30};}}
const evt=(type,y=105)=>({clientY:y,dataTransfer:{types:[type],getData:()=> 'token'},preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.immediate=true;}});
(async()=>{
 const calls=[],element=new Element(),plugin={groupDrag:{name:'A',scope:'library'},hasPendingEdit:()=>false,clearGroupDropIndicators(){element.classes.delete('is-order-before');element.classes.delete('is-order-after');},beginGroupDrag:()=>true,endGroupDrag(){this.groupDrag=null;this.clearGroupDropIndicators();},moveDraggedGroup:async(...args)=>calls.push(args)};
 groupTarget(element,plugin,'library','B');assert.equal(element.draggable,true);
 const upper=evt(groupMime);element.events.dragover(upper);assert(element.classes.has('is-order-before'));assert.equal(upper.dataTransfer.dropEffect,'move');
 const lower=evt(groupMime,125);element.events.dragover(lower);assert(element.classes.has('is-order-after'));assert(!element.classes.has('is-order-before'));
 await element.events.drop(lower);assert.deepEqual(calls[0],['token','library','B',true]);assert.equal(plugin.groupDrag,null);
 const paper=evt(paperMime);await element.events.drop(paper);assert(!paper.prevented);assert.equal(calls.length,1);
 plugin.groupDrag={name:'Venue',scope:'reviews'};const wrong=evt(groupMime);element.events.dragover(wrong);assert.equal(wrong.dataTransfer.dropEffect,'none');await element.events.drop(wrong);assert.equal(calls.length,1);assert(notices.some(m=>m.includes('各自')));
 plugin.groupDrag={name:'A',scope:'library'};plugin.hasPendingEdit=()=>true;const dirty=evt(groupMime);element.events.dragover(dirty);assert.equal(dirty.dataTransfer.dropEffect,'none');
 plugin.beginGroupDrag=()=>false;const start=evt(groupMime);element.events.dragstart(start);assert(start.prevented);
 console.log('PASS: exact section reordering, preserved prose/DDL/rows/Notes, fixed staging, stale order refusal, safe category deletion and last-category fallback, CRLF, separate group/paper drag routing and insertion indicators.');
})().catch(e=>{console.error(e);process.exitCode=1;});
