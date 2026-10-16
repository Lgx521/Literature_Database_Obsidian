const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),C=require('./collections');
class Element{
 constructor(o={}){this.textContent=o.text||'';this.value=o.value||'';this.attributes=o.attr||{};this.children=[];this.events={};this.style={};}
 createEl(tag,o){const e=new Element(o);e.tag=tag;this.children.push(e);return e;}createDiv(o){return this.createEl('div',o);}createSpan(o){return this.createEl('span',o);}
 setText(t){this.textContent=t;}addEventListener(n,f){this.events[n]=f;}focus(){this.focused=true;}click(){return this.events.click?.();}empty(){this.children=[];}getBoundingClientRect(){return {left:12,bottom:34};}
}
class Modal{constructor(){this.contentEl=new Element();this.titleEl=new Element();}close(){this.closed=true;}}
class MenuItem{
 setSubmenu(){return this.submenu=new Menu();}
 setTitle(t){this.title=t;return this;}setChecked(v){this.checked=v;return this;}setIsLabel(v){this.label=v;return this;}setDisabled(v){this.disabled=v;return this;}onClick(f){this.action=f;return this;}
}
class Menu{
 constructor(){this.items=[];Menu.last=this;}setUseNativeMenu(v){this.native=v;return this;}addSeparator(){this.items.push({separator:true});return this;}addItem(f){const item=new MenuItem();f(item);this.items.push(item);return this;}
 onHide(callback){this.hiddenCallback=callback;}showAtPosition(p,doc){this.position=p;this.doc=doc;this.shown=true;}hide(){this.shown=false;const callback=this.hiddenCallback;this.hiddenCallback=null;callback?.();}
}
const notices=[],ctx={module:{exports:{}},setTimeout,clearTimeout,require:n=>n==='obsidian'?{Plugin:class{},ItemView:class{},Modal,Menu,Notice:class{constructor(t){notices.push(t);}}}:require(n)};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+'\nmodule.exports.Controls={CollectionMembershipMenu,CollectionMoveMenu,ldbPaperVenueMenu,ldbSharedDeadlineChoice,CategoryModal,VenueModal,ldbOpenCollectionMenu,ldbChildMenu};',ctx);
const {CollectionMembershipMenu,CollectionMoveMenu,ldbPaperVenueMenu,ldbSharedDeadlineChoice,CategoryModal,VenueModal,ldbOpenCollectionMenu,ldbChildMenu}=ctx.module.exports.Controls;
const children=e=>e.children.flatMap(x=>[x,...children(x)]),get=(modal,label)=>children(modal.contentEl).find(e=>e.attributes['aria-label']===label),button=(modal,label)=>children(modal.contentEl).find(e=>e.tag==='button'&&e.textContent===label);
(async()=>{
 let text=C.add(C.add(C.add(C.empty(),'library','A'),'library','B'),'projects','Work');
 text=C.change(text,['papers/One.pdf'],{scope:'library',name:'A'});text=C.change(text,['papers/One.pdf','papers/Two.pdf'],{scope:'library',name:'B'});
 const plugin={snapshot:{collections:C.parse(text).groups},hasPendingEdit:()=>false,async changeMembership(rows,target,from,move,expected){
   assert(expected);text=C.change(text,rows.map(r=>r.path),target,{from,move});this.snapshot.collections=C.parse(text).groups;
 }};
 const rows=[{path:'papers/One.pdf'},{path:'papers/Two.pdf'}],position={x:120,y:220},doc={hidden:false};
 const picker=new CollectionMembershipMenu(plugin,rows,position,doc);picker.show();
 assert.equal(picker.menu.native,true);assert.equal(picker.menu.items.find(i=>i.title==='A（部分）').checked,false);assert.equal(picker.menu.items.find(i=>i.title==='B').checked,true);
 assert.equal(picker.menu.items.find(i=>i.title==='Work').checked,false);assert.deepEqual(picker.menu.position,position);
 await picker.menu.items.find(i=>i.title==='A（部分）').action();assert.equal(picker.menu.items.find(i=>i.title==='A').checked,true);
 await picker.menu.items.find(i=>i.title==='A').action();assert.equal(picker.menu.items.find(i=>i.title==='A').checked,false);
 assert.equal(C.parse(text).groups.find(g=>g.name==='B').members.length,2,'Other memberships are untouched.');
 plugin.changeMembership=async()=>{throw Error('Concurrent edit');};await picker.menu.items.find(i=>i.title==='Work').action();assert(picker.closed);assert(notices.includes('Concurrent edit'));
 const before=plugin.snapshot.collections;plugin.hasPendingEdit=()=>true;ldbOpenCollectionMenu(plugin,rows,position,doc);assert.equal(plugin.snapshot.collections,before);assert(notices.some(t=>t.includes('先保存')));
 plugin.hasPendingEdit=()=>false;ldbOpenCollectionMenu(plugin,rows,position,doc);const scheduled=plugin.membershipMenu;scheduled.close();await new Promise(r=>setTimeout(r,5));assert(!scheduled.menu,'Closing cancels a deferred native popup.');
 // Explicit moves use the same native menu; only same-type destinations, with no extra modal.
 plugin.changeMembership=async(rows,target,from,move,expected)=>{assert.equal(move,true);assert(expected);text=C.change(text,rows.map(r=>r.path),target,{from,move});plugin.snapshot.collections=C.parse(text).groups;};
 const mover=new CollectionMoveMenu(plugin,rows,{scope:'library',name:'B'},position,doc);mover.show();
 assert(mover.menu.native);assert(mover.menu.items.find(i=>i.title==='B').checked);assert(mover.menu.items.find(i=>i.title==='B').disabled);assert(!mover.menu.items.some(i=>i.title==='Work'));
 await mover.menu.items.find(i=>i.title==='A').action();assert(mover.closed);assert.equal(C.parse(text).groups.find(g=>g.name==='A').members.length,2);assert.equal(C.parse(text).groups.find(g=>g.name==='B').members.length,0);
 // Child menus change the placement, not parent membership. Stale choices cannot overwrite another edit.
 text=C.addChild(text,'library','A','Methods');text=C.addChild(text,'library','A','Experiments');plugin.snapshot.collections=C.parse(text).groups;
 plugin.changeMembership=async(rows,target,from,move,expected)=>{assert(expected.placements);const actual=C.placementState(C.parse(text).groups,rows.map(r=>r.path),target);if(JSON.stringify(actual)!==JSON.stringify(expected.placements))throw Error('Stale placement');text=C.change(text,rows.map(r=>r.path),target);plugin.snapshot.collections=C.parse(text).groups;};
 let childMenu=ldbChildMenu(plugin,rows,{scope:'library',name:'A'},position,doc);assert(childMenu.native);assert(childMenu.items.find(i=>i.title==='未分组').checked);
 await childMenu.items.find(i=>i.title==='Methods').action();assert(C.parse(text).groups.find(g=>g.name==='A').members.every(m=>m.subgroup==='Methods'));
 childMenu=ldbChildMenu(plugin,rows,{scope:'library',name:'A'},position,doc);text=C.change(text,[rows[0].path],{scope:'library',name:'A',subgroup:'Experiments'});plugin.snapshot.collections=C.parse(text).groups;
 await childMenu.items.find(i=>i.title==='未分组').action();assert(notices.includes('Stale placement'));assert.equal(C.parse(text).groups.find(g=>g.name==='A').members[0].subgroup,'Experiments');
 // Native parent -> child menus, including movement within the current parent.
 plugin.changeMembership=async(rows,target,from,move,expected)=>{
   assert(expected);const groups=C.parse(text).groups,result=C.transferSummary(groups,rows.map(r=>r.path),target,{from,move});
   text=C.change(text,rows.map(r=>r.path),target,{from,move});plugin.snapshot.collections=C.parse(text).groups;return result;
 };
 const nested=new CollectionMembershipMenu(plugin,rows,position,doc);plugin.membershipMenu=nested;nested.show();
 assert(nested.menu.items.find(i=>i.title==='A').submenu);assert(!nested.menu.items.find(i=>i.title==='B').submenu,'Flat parents have no submenu');
 await nested.menu.items.find(i=>i.title==='A').submenu.items.find(i=>i.title==='Methods').action();
 assert(plugin.snapshot.collections.find(g=>g.name==='A').members.every(m=>m.subgroup==='Methods'));
 const toggleOff=nested.menu.items.find(i=>i.title==='A').submenu.items.find(i=>i.title==='属于此分类');assert(toggleOff.checked);
 const nativeCallback=toggleOff.action;nested.menu.hide();await new Promise(r=>setTimeout(r,5));
 assert(nested.closed);assert.equal(nested.rows.length,0);assert.equal(nested.actions.length,0);assert.equal(plugin.membershipMenu,null);
 const dismissed=text;await nativeCallback();assert.equal(text,dismissed,'A callback retained by the native host is inert after dismissal');
 const within=new CollectionMoveMenu(plugin,rows,{scope:'library',name:'A'},position,doc);within.show();
 const childrenA=within.menu.items.find(i=>i.title==='A').submenu;
 assert(childrenA.items.find(i=>i.title==='Methods').disabled);assert(!childrenA.items.find(i=>i.title==='Experiments').disabled);
 await childrenA.items.find(i=>i.title==='Experiments').action();assert(within.closed);
 assert(plugin.snapshot.collections.find(g=>g.name==='A').members.every(m=>m.subgroup==='Experiments'));
 text=C.addChild(text,'library','B','Target child');plugin.snapshot.collections=C.parse(text).groups;
 const across=new CollectionMoveMenu(plugin,rows,{scope:'library',name:'A'},position,doc);across.show();
 await across.menu.items.find(i=>i.title==='B').submenu.items.find(i=>i.title==='Target child').action();
 assert.equal(plugin.snapshot.collections.find(g=>g.name==='A').members.length,0);assert(plugin.snapshot.collections.find(g=>g.name==='B').members.every(m=>m.subgroup==='Target child'));
 assert(notices.at(-1).includes('已移动 2 篇至 B / Target child'));
 // Publication Venue: native checkmarks plus explicit new-name input, without preset metadata.
 const view={detailRow:{path:'papers/One.pdf',venues:['arXiv']},plugin:{snapshot:{library:[{venues:['arXiv','CoRL 2027']}]}},contentEl:{ownerDocument:doc},venueInput:new Element(),async saveQuickField(key,value){assert.equal(key,'venues');this.detailRow.venues=value;return true;}};
 const anchor=new Element();let menu=ldbPaperVenueMenu(view,anchor);assert(menu.native);assert(menu.items.find(i=>i.title==='arXiv').checked);assert(!menu.items.find(i=>i.title==='CoRL 2027').checked);
 await menu.items.find(i=>i.title==='CoRL 2027').action();assert.deepEqual([...view.detailRow.venues],['arXiv','CoRL 2027']);
 menu=ldbPaperVenueMenu(view,anchor);await menu.items.find(i=>i.title==='arXiv').action();assert.deepEqual([...view.detailRow.venues],['CoRL 2027']);
 menu=ldbPaperVenueMenu(view,anchor);menu.items.find(i=>i.title==='新建 Venue…').action();assert(view.venueInput.focused);assert.equal(view.venueInput.hidden,false);
 menu=ldbPaperVenueMenu(view,anchor);view.detailRow={path:'papers/Two.pdf',venues:[]};await menu.items.find(i=>i.title==='arXiv').action();assert.deepEqual(view.detailRow.venues,[]);assert(notices.some(t=>t.includes('重新打开 Venue')));
 view.plugin.snapshot.library=[];menu=ldbPaperVenueMenu(view,anchor);assert.equal(menu.items.length,1);assert.equal(menu.items[0].title,'新建 Venue…');
 // Creation starts independent. Choosing a source is explicit, can be undone, and preserves a typed name.
 const candidate={scope:'submissions',name:'CoRL 2027',deadline:'2027-01-05 23:59 -12:00',key:''};
 const creationPlugin={deadlineChoices:()=>[candidate]},parent=new Element(),nameInput=new Element();
 const choice=ldbSharedDeadlineChoice(creationPlugin,'projects',parent,nameInput);assert.equal(choice(),null);
 const control=parent.children[0];control.events.click({currentTarget:control});assert(Menu.last.native);assert(Menu.last.items[0].checked);
 Menu.last.items.find(i=>i.title?.startsWith('CoRL')).action();assert.equal(choice().name,'CoRL 2027');assert.equal(nameInput.value,'CoRL 2027');
 control.events.click({currentTarget:control});Menu.last.items[0].action();assert.equal(choice(),null);
 nameInput.value='My Work';control.events.click({currentTarget:control});Menu.last.items.find(i=>i.title?.startsWith('CoRL')).action();assert.equal(nameInput.value,'My Work');
 console.log('PASS: native membership and move menus, checkmarks, partial selection, repeated toggles, stale errors; native publication Venue choices/add/remove/new-name entry; optional DDL selection defaults to independent and preserves typed names.');
})().catch(e=>{console.error(e);process.exitCode=1;});
