const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const E=require('./dashboard'),C=require('./collections');
class Element{
  constructor(o={}){this.children=[];this.events={};this.textContent=o.text||'';}
  createEl(tag,o){const e=new Element(o);e.tag=tag;this.children.push(e);return e;}createDiv(o){return this.createEl('div',o);}
  setText(t){this.textContent=t;}empty(){this.children=[];}addEventListener(n,f){this.events[n]=f;}
  all(){return this.children.flatMap(e=>[e,...e.all()]);}querySelectorAll(){return this.all().filter(e=>e.tag==='button');}
}
const modals=[],notices=[];
class Modal{constructor(){this.contentEl=new Element();this.titleEl=new Element();}open(){modals.push(this);this.onOpen();}close(){this.closed=true;this.onClose();}}
class Notice{constructor(text){notices.push(text);}hide(){}}
class MenuItem{setTitle(t){this.title=t;return this;}setChecked(v){this.checked=v;return this;}setIsLabel(){return this;}setDisabled(){return this;}onClick(f){this.action=f;return this;}}
class Menu{constructor(){this.items=[];}setUseNativeMenu(){return this;}addItem(f){const i=new MenuItem();f(i);this.items.push(i);return this;}addSeparator(){}showAtPosition(){}hide(){}}
const context={module:{exports:{}},setTimeout,clearTimeout,require:n=>n==='obsidian'?{Plugin:class{},ItemView:class{},Modal,Notice,Menu}:require(n)};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+'\nmodule.exports.Browser=LiteratureBrowser;module.exports.MembershipMenu=CollectionMembershipMenu;module.exports.i18n=LdbI18n;',context);
const tick=()=>new Promise(resolve=>setImmediate(resolve)),button=(m,t)=>m.contentEl.all().find(e=>e.tag==='button'&&e.textContent===t);
const header='| '+E.TITLE_HEADERS.join(' | ')+' |\n| '+E.TITLE_HEADERS.map(()=> '---').join(' | ')+' |\n';
const original='<!-- library:collections -->\n## 文献\n'+header+['One','Two'].map(n=>`| [${n}.pdf](papers/${n}.pdf) | 2026.10 | #research/test | Summary | 待读 | — | Personal notes |  |  |  | Actual ${n} Title |`).join('\n')+'\n<!-- library:end -->';
function fixture({shared=false,mixed=false}={}){
  let library=original,collections=C.add(C.add(C.add(C.empty(),'library','A'),'library','B'),'projects','Work');
  collections=C.change(collections,['papers/One.pdf','papers/Two.pdf'],{scope:'library',name:'A'});
  if(shared){collections=C.change(collections,mixed?['papers/One.pdf']:['papers/One.pdf','papers/Two.pdf'],{scope:'projects',name:'Work'});collections=C.setNote(collections,'Work','papers/One.pdf','Keep project note','');}
  const manager=new context.module.exports(),view=new context.module.exports.Browser({},manager),removed=[];
  manager.app={workspace:{getLeavesOfType:()=>[{view}]},vault:{getAbstractFileByPath:p=>({path:p}),read:async f=>f.path==='library.md'?library:collections}};
  manager.refresh=async()=>{manager.snapshot={library:C.decorate(E.parseLibrary(library),C.parse(collections).groups),collections:C.parse(collections).groups};view.rows=view.visibleRows=manager.snapshot.library;};
  manager.mutate=async(name,fn)=>{if(name==='library.md')library=fn(library);else collections=fn(collections);await manager.refresh();};
  manager.trashStore={remove:async(scope,row)=>{assert(manager.recordBusy);assert.equal(scope,'library');library=E.removeRecord(library,scope,row);removed.push(row);await manager.refresh();}};
  view.scope='library';view.filters={category:'A'};view.detailEl=new Element();view.lockFilters=()=>{};view.reload=async()=>{};
  return {manager,view,removed,init:async()=>{await manager.refresh();view.selectedPaths=new Set([view.rows[0].path]);},library:()=>library,collections:()=>collections,setCollections:t=>{collections=t;}};
}
(async()=>{
  // Unique membership: cancel keeps the complete paper; explicit acceptance trashes, not unfiles.
  let f=fixture();await f.init();const before=f.collections();let pending=f.view.removeMembership();await tick();let modal=modals.at(-1);
  assert.equal(modal.titleEl.textContent,'仅有一个归属');assert(!button(modal,'仅从当前集合移除'));assert.equal(f.removed.length,0);assert(f.view.dirty());
  const count=modals.length;await f.view.removeMembership();assert.equal(modals.length,count,'A second trigger cannot open another scope dialog.');
  button(modal,'取消').events.click();await pending;assert.equal(f.collections(),before);assert.equal(f.library(),original);assert(!f.manager.removalModal);
  pending=f.view.removeMembership();await tick();button(modals.at(-1),'整篇移至回收站').events.click();await pending;
  assert.equal(f.removed.length,1);assert.equal(f.collections(),before,'Keep memberships and project notes for restoration.');assert(!E.parseLibrary(f.library()).some(r=>r.path==='papers/One.pdf'));
  // Shared paper: trash button opens a scope choice. Local removal preserves master and other project notes.
  f=fixture({shared:true});await f.init();pending=f.view.requestDelete(f.view.rows[0]);await tick();modal=modals.at(-1);
  assert.equal(modal.titleEl.textContent,'选择删除范围');assert(button(modal,'仅从当前集合移除'));assert.equal(f.removed.length,0);
  button(modal,'仅从当前集合移除').events.click();await pending;
  assert.equal(f.library(),original);assert.equal(f.removed.length,0);let groups=C.parse(f.collections()).groups;
  assert(!groups.find(g=>g.name==='A').members.some(m=>m.path==='papers/One.pdf'));assert.equal(groups.find(g=>g.name==='Work').members[0].notes,'Keep project note');
  // Whole-paper choice and mixed batches retain all relationships until restoration or explicit purge.
  f=fixture({shared:true,mixed:true});await f.init();f.view.selectedPaths=new Set(f.view.rows.map(r=>r.path));const preserved=f.collections();
  pending=f.view.requestDelete(f.view.rows[0]);await tick();modal=modals.at(-1);assert(!button(modal,'仅从当前集合移除'));
  assert(modal.contentEl.all().some(e=>e.textContent.includes('不能仅移除归属')));button(modal,'整篇移至回收站').events.click();await pending;
  assert.equal(f.removed.length,2);assert.equal(f.collections(),preserved);assert.equal(E.parseLibrary(f.library()).length,0);
  // A fully shared multi-selection can be removed locally with one choice.
  f=fixture({shared:true});await f.init();f.view.selectedPaths=new Set(f.view.rows.map(r=>r.path));
  pending=f.view.requestDelete(f.view.rows[0]);await tick();button(modals.at(-1),'仅从当前集合移除').events.click();await pending;
  assert.equal(f.library(),original);assert.equal(C.parse(f.collections()).groups.find(g=>g.name==='A').members.length,0);assert.equal(f.removed.length,0);
  // Smart views have no current collection: explain global scope instead of picking an arbitrary one.
  f=fixture({shared:true});await f.init();f.view.filters.category='';pending=f.view.requestDelete(f.view.rows[0]);await tick();modal=modals.at(-1);
  assert(!button(modal,'仅从当前集合移除'));assert(modal.contentEl.all().some(e=>e.textContent.includes('没有可移除的集合')));modal.close();await pending;
  // Stale decisions cannot erase newly edited project notes or act after the last membership changed.
  for(const action of ['整篇移至回收站','仅从当前集合移除']){
    f=fixture({shared:true});await f.init();pending=f.view.requestDelete(f.view.rows[0]);await tick();modal=modals.at(-1);
    f.setCollections(C.setNote(f.collections(),'Work','papers/One.pdf','External note','Keep project note'));
    button(modal,action).events.click();await pending;assert.equal(f.library(),original);assert.equal(f.removed.length,0);assert(f.collections().includes('External note'));
    assert(notices.some(n=>n.includes('重新选择删除方式')));
  }
  f=fixture({shared:true});await f.init();const selected=f.view.rows[0];
  f.setCollections(C.change(f.collections(),[selected.path],null,{from:{scope:'projects',name:'Work'}}));
  await assert.rejects(f.manager.changeMembership([selected],null,{scope:'library',name:'A'}),/唯一归属/);
  assert.equal(f.library(),original);assert(C.parse(f.collections()).groups.find(g=>g.name==='A').members.some(m=>m.path===selected.path));
  // A move adds a destination, so a unique membership may still move without becoming unassigned.
  await f.manager.changeMembership([selected],{scope:'library',name:'B'},{scope:'library',name:'A'},true);
  assert.deepEqual([...f.manager.snapshot.library[0].categories],['B']);
  // The native checkbox and keyboard remove entry points use the same last-membership prompt.
  f=fixture();await f.init();const picker=new context.module.exports.MembershipMenu(f.manager,[f.view.rows[0]],{x:0,y:0},{hidden:false});picker.show();
  pending=picker.menu.items.find(i=>i.title==='A').action();await tick();modal=modals.at(-1);assert.equal(modal.titleEl.textContent,'仅有一个归属');
  button(modal,'整篇移至回收站').events.click();await pending;assert(picker.closed);assert.equal(f.removed.length,1);
  f=fixture();await f.init();f.view.selectedPath=f.view.rows[0].path;f.view.listKeydown({key:'Delete',preventDefault(){}});await tick();
  assert.equal(modals.at(-1).titleEl.textContent,'仅有一个归属');modals.at(-1).close();await tick();assert.equal(f.library(),original);
  f=fixture({shared:true});await f.init();f.view.selectedPath=f.view.rows[0].path;f.view.listKeydown({key:'Backspace',preventDefault(){}});await tick();
  assert.equal(modals.at(-1).titleEl.textContent,'选择删除范围');assert(button(modals.at(-1),'仅从当前集合移除'));modals.at(-1).close();await tick();assert.equal(f.library(),original);
  // Existing single-membership trash remains immediate; only unlinking that membership needs a prompt.
  f=fixture();await f.init();const prior=modals.length;await f.view.requestDelete(f.view.rows[0]);assert.equal(modals.length,prior);assert.equal(f.removed.length,1);
  // Project context counts categories too; English copy does not change stored text.
  f=fixture({shared:true});await f.init();f.view.scope='projects';f.view.filters.category='Work';context.module.exports.i18n.setLanguage('en');
  pending=f.view.requestDelete(f.view.rows[0]);await tick();modal=modals.at(-1);assert.equal(modal.titleEl.textContent,'Choose removal scope');
  button(modal,'Remove only from this collection').events.click();await pending;assert.equal(f.library(),original);assert.equal(f.manager.snapshot.library[0].projects.length,0);assert.equal(f.manager.snapshot.library[0].categories[0],'A');
  context.module.exports.i18n.setLanguage('zh');
  // Closing the plugin while a prompt is open cancels without writing.
  f=fixture({shared:true});await f.init();pending=f.view.requestDelete(f.view.rows[0]);await tick();f.manager.onunload();await pending;assert.equal(f.library(),original);assert.equal(f.removed.length,0);
  console.log('PASS: last-membership cancel/trash, shared local/global choice, mixed and shared batches, smart views, stale membership/note guards, moves, native checkboxes, keyboard, project scope, localization and unload cancellation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
