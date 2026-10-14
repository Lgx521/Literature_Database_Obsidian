const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const E=require('./dashboard'),C=require('./collections');
const human={kind:'human',name:'user'},ai={kind:'ai',name:'Codex'};
const source='User header\r\n<!-- library:collections -->\r\n## 文献\r\n\r\n| '+E.ORGANIZATION_HEADERS.join(' | ')+' |\r\n| '+E.ORGANIZATION_HEADERS.map(()=> '---').join(' | ')+' |\r\n| [One.pdf](papers/One.pdf) | 2026.10 | #research/rl | User summary | 待读 | — | Stored<br>notes | arXiv | @article{one, title={One}} | Existing source | One | 待整理 |  |\r\n<!-- library:end -->\r\nUSER FOOTER';
let stored=source;
const original=E.parseLibrary(source)[0];assert.equal(original.bookmarked,false);
for(const actor of [null,ai,{kind:'system',name:'metadata'}])assert.throws(()=>E.updateLibraryEntry(source,original,{bookmarked:true},actor),/用户/);
assert.throws(()=>E.updateLibraryEntry(source,original,{bookmarked:'true'},human),/无效/);
stored=E.updateLibraryEntry(source,original,{bookmarked:true},human);
let row=E.parseLibrary(stored)[0];assert.equal(row.bookmarked,true);assert.equal(row.cells.length,14);
assert.deepEqual(row.cells.slice(0,13),original.cells,'bookmark-only writes preserve every previous metadata cell');
assert(!stored.replaceAll('\r\n','').includes('\n'));assert(stored.endsWith('USER FOOTER'));
assert.equal(E.updateLibraryEntry(stored,row,{bookmarked:true},human),stored);
assert.throws(()=>E.updateLibraryEntry(stored,original,{bookmarked:false},human),/其他窗口/);
assert.throws(()=>E.parseLibrary(stored.replace(' | 是 |',' | true |')),/书签/);
// Normal agent enrichment and personal field edits retain the marker.
stored=E.updateLibraryEntry(stored,row,{tags:'#research/rl #test'},ai);row=E.parseLibrary(stored)[0];assert(row.bookmarked);
stored=E.updateLibraryEntry(stored,row,{notes:'User updated notes'});row=E.parseLibrary(stored)[0];assert(row.bookmarked);
const receipt=row;stored=E.removeRecord(stored,'library',row);assert.equal(E.parseLibrary(stored).length,0);
stored=E.restoreRecord(stored,'library',receipt);assert.deepEqual(E.parseLibrary(stored)[0].cells,receipt.cells);
const legacyEmpty=E.removeRecord(source,'library',original);
assert.equal(E.parseLibrary(E.restoreRecord(legacyEmpty,'library',receipt))[0].bookmarked,true);
const legacyRestore=E.restoreRecord(E.removeRecord(stored,'library',receipt),'library',original);assert.equal(E.parseLibrary(legacyRestore)[0].bookmarked,false);
stored=E.addLibraryEntry(stored,'papers/Two.pdf');assert.equal(E.parseLibrary(stored)[1].cells.length,14);assert.equal(E.parseLibrary(stored)[1].bookmarked,false);
stored=E.updateLibraryEntry(stored,E.parseLibrary(stored)[1],{bookmarked:true},human);
stored=E.addLibraryEntry(stored,'papers/Three.pdf');stored=E.updateLibraryEntry(stored,E.parseLibrary(stored)[2],{bookmarked:true},human);
stored=E.addLibraryEntry(stored,'papers/Not-bookmarked.pdf');
let collections=C.empty();for(const name of ['ML','Robotics','Empty'])collections=C.add(collections,'library',name);
collections=C.add(collections,'projects','Writing');
for(const [name,pdf]of [['ML','One'],['Robotics','One'],['ML','Two'],['ML','Not-bookmarked']])collections=C.change(collections,['papers/'+pdf+'.pdf'],{scope:'library',name});
collections=C.change(collections,['papers/One.pdf','papers/Not-bookmarked.pdf'],{scope:'projects',name:'Writing'});
const rows=()=>C.decorate(E.parseLibrary(stored),C.parse(collections).groups);
const selected=E.filterLibrary(rows(),{bookmarked:true});assert.equal(selected.length,3);
assert.deepEqual(E.groupLibrary(selected,['Robotics','Empty','ML']).map(g=>[g.name,g.rows.map(r=>r.filename)]),[['Robotics',['One.pdf']],['ML',['One.pdf','Two.pdf']],['未分类',['Three.pdf']]]);
assert.equal(E.filterLibrary(rows(),{bookmarked:true,query:'One'}).length,1);
assert.deepEqual(E.groupLibrary([]),[]);
// Run the actual view with an in-memory DOM: repeated appearances must not duplicate actions.
class Element{
 constructor(o={}){if(typeof o==='string')o={cls:o};this.children=[];this.events={};this.value=o.value||'';this.textContent=o.text||'';this.attributes={...o.attr};this.classes=new Set((o.cls||'').split(' ').filter(Boolean));this.dataset={};this.scrollTop=0;this.id=o.attr?.id;}
 createEl(tag,o){const e=new Element(o);e.tag=tag;e.parentElement=this;this.children.push(e);return e;}createDiv(o){return this.createEl('div',o);}createSpan(o){return this.createEl('span',o);}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}querySelectorAll(s){const all=this.children.flatMap(e=>[e,...e.querySelectorAll('*')]);return s==='*'?all:all.filter(e=>s.startsWith('.')&&e.classes.has(s.slice(1)));}remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(e=>e!==this);}
 addEventListener(n,f){this.events[n]=f;}addClass(c){this.classes.add(c);}removeClass(c){this.classes.delete(c);}toggleClass(c,v){v?this.addClass(c):this.removeClass(c);}setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];}setText(t){this.textContent=t;}empty(){this.children=[];}scrollIntoView(){this.scrolled=true;}
}
class ItemView{constructor(leaf){this.leaf=leaf;this.app={workspace:{requestSaveLayout(){}}};}async setState(){}}
const api={module:{exports:{}},require:n=>n==='obsidian'?{Plugin:class{},ItemView,Modal:class{},Platform:{isDesktopApp:true,isMacOS:true},setIcon(el,icon){el.icon=icon;},Notice:class{}}:require(n)};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+'\nmodule.exports.Browser=LiteratureBrowser;',api);
const descendants=el=>el.children.flatMap(e=>[e,...descendants(e)]);
(async()=>{
 let fail=false,gate=null;
 const plugin={snapshot:{categories:['Robotics','ML','Empty'],library:rows(),collections:C.parse(collections).groups},mutate:async(name,transform)=>{assert.equal(name,'library.md');if(gate)await gate;if(fail)throw new Error('write failed');stored=transform(stored);plugin.snapshot.library=rows();}};
 const view=new api.module.exports.Browser({id:'bookmark-test'},plugin);view.rows=rows();view.filters.bookmarked=true;view.sortButtons=[];
 for(const k of ['detailEl','listEl','countEl','clearEl'])view[k]=new Element();view.lockFilters=()=>{};
 view.reload=async()=>{view.rows=rows();view.renderList();};view.renderList();
 assert.equal(view.visibleRows.length,3);assert.equal(view.renderedRows.length,4);assert.equal(view.countEl.textContent,'3 篇');
 assert.equal(new Set(view.renderedRows.map(r=>r.el.id)).size,4);
 assert.equal(descendants(view.listEl).filter(e=>e.classes.has('ldb-bookmark-badge')).length,4);
 assert.equal(descendants(view.listEl).filter(e=>e.classes.has('ldb-group-heading')).length,3);
 const copies=view.renderedRows.filter(r=>r.row.path==='papers/One.pdf');assert.equal(copies.length,2);
 view.select(copies[1].row.path,{},copies[1].el);
 assert(copies.every(r=>r.el.attributes['aria-selected']==='true'));assert.equal(view.listEl.attributes['aria-activedescendant'],copies[1].el.id);
 assert.equal(view.selectedRows().length,1);
 const event=key=>({key,preventDefault(){}});
 view.listKeydown(event('ArrowDown'));assert.equal(view.selectedPath,'papers/Two.pdf');
 view.select('papers/One.pdf',{},copies[0].el);view.listKeydown({...event('End'),shiftKey:true});assert.equal(view.selectedRows().length,3);
 view.listKeydown({...event('a'),metaKey:true});assert.equal(view.selectedRows().length,3);
 assert.equal(view.getState().bookmarked,true);
 const other=new api.module.exports.Browser({},plugin);await other.setState(view.getState());assert.equal(other.filters.bookmarked,true);
 // Bookmark toggle preserves the current paper and unsaved notes; a failed write rolls back visually.
 view.select('papers/One.pdf',{},copies[1].el);const input=view.notesInput;input.value='Unsaved personal notes';input.events.input();
 assert.equal(view.bookmarkButton.attributes['aria-pressed'],'true');
 await view.bookmarkButton.events.click();assert.equal(view.detailRow.bookmarked,false);assert.equal(view.bookmarkButton.attributes['aria-pressed'],'false');
 assert.equal(view.notesInput,input);assert.equal(view.notesInput.value,'Unsaved personal notes');assert.equal(view.selectedPath,'papers/One.pdf');assert.equal(view.notesDirty,true);
 assert.equal(E.parseLibrary(stored)[0].notes,'User updated notes');
 fail=true;await view.bookmarkButton.events.click();fail=false;
 assert.equal(view.quickError.hidden,false);assert.equal(view.bookmarkButton.attributes['aria-pressed'],'false');assert.equal(view.notesInput,input);
 await view.saveNotes();assert.equal(E.parseLibrary(stored)[0].notes,'Unsaved personal notes');assert.equal(view.visibleRows.length,2);assert.equal(view.renderedRows.length,2);
 await view.navigate({scope:'library'});assert.equal(view.filters.bookmarked,false);assert.equal(view.visibleRows.length,4);assert.equal(view.renderedRows.length,4);
 view.select('papers/One.pdf');
 const stable={button:view.bookmarkButton,input:view.notesInput,fields:view.quickFields.map(f=>f.select),rows:view.renderedRows.map(r=>r.el),title:descendants(view.detailEl).find(e=>e.tag==='h2')};
 let release;gate=new Promise(r=>{release=r;});const toggle=view.bookmarkButton.events.click();
 assert(view.quickFields.every(f=>!f.select.disabled),'Bookmark saving must not dim unrelated controls');assert.equal(view.notesInput.readOnly,undefined);
 await view.saveQuickField('bookmarked',false);release();await toggle;gate=null;
 assert.equal(view.selectedPath,'papers/One.pdf');assert.equal(view.detailRow.bookmarked,true);
 assert.equal(view.bookmarkButton,stable.button);assert.equal(view.notesInput,stable.input);assert.equal(descendants(view.detailEl).find(e=>e.tag==='h2'),stable.title);
 assert.deepEqual(view.renderedRows.map(r=>r.el),stable.rows,'Unchanged list rows stay mounted');assert.deepEqual(view.quickFields.map(f=>f.select),stable.fields);
 const edit=descendants(view.detailEl).find(e=>e.tag==='button'&&e.textContent==='编辑');edit.events.click();
 assert.deepEqual([...view.editBase.cells],E.parseLibrary(stored)[0].cells,'Retained buttons use the latest row after a bookmark write');view.stopEditing();
 assert.equal(descendants(view.listEl).filter(e=>e.classes.has('ldb-bookmark-badge')).length,3);
 // Local bookmark filtering is independent of the grouped global bookmark view.
 view.bookmarkFilterEl=new Element();view.filters.category='ML';view.renderList();assert.equal(view.visibleRows.length,3);
 view.toggleBookmarkFilter();assert.equal(view.filters.category,'ML');assert.equal(view.filters.bookmarked,false);
 assert.equal(view.visibleRows.length,2);assert(view.visibleRows.every(r=>r.bookmarked&&r.categories.includes('ML')));
 assert.equal(view.renderedRows.length,2);assert.equal(descendants(view.listEl).filter(e=>e.classes.has('ldb-group-heading')).length,0);
 assert.equal(view.bookmarkFilterEl.attributes['aria-pressed'],'true');assert.equal(view.clearEl.hidden,false);
 view.filters.query='One';view.filters.tag='#research/rl';view.renderList();assert.equal(view.visibleRows.length,1);
 const restored=new api.module.exports.Browser({},plugin);await restored.setState(view.getState());assert(restored.filters.bookmarkOnly);assert.equal(restored.filters.category,'ML');
 view.notesInput.value='Keep draft';view.notesInput.events.input();view.toggleBookmarkFilter();assert(view.filters.bookmarkOnly);view.clearFilters();assert.equal(view.filters.query,'One');
 view.notesCancel.events.click();view.clearFilters();assert(!view.filters.bookmarkOnly);assert.equal(view.filters.category,'ML');assert.equal(view.visibleRows.length,3);
 view.scope='projects';view.filters.category='Writing';view.rows=rows().filter(r=>r.projects.includes('Writing'));view.renderList();
 view.toggleBookmarkFilter();assert.equal(view.visibleRows.length,1);assert.equal(view.visibleRows[0].path,'papers/One.pdf');assert.equal(view.renderedRows.length,1);
 await restored.setState(view.getState());assert(restored.filters.bookmarkOnly);assert.equal(restored.scope,'projects');
 await view.navigate({scope:'library',bookmarked:true});assert(!view.filters.bookmarkOnly);assert(view.bookmarkFilterEl.hidden);
 view.clearFilters();assert(view.filters.bookmarked);assert.equal(view.visibleRows.length,3);assert.equal(view.renderedRows.length,4);
 await restored.setState({scope:'reviews',bookmarkOnly:true});assert(!restored.filters.bookmarkOnly);
 view.scope='inbox';view.renderDetail();assert.equal(view.bookmarkButton,null);
 console.log('PASS: lazy lossless bookmark schema, user-only edits, conflicts, intake/trash/restore, multi-category grouping, unique selection/actions, keyboard ranges, persistence, badge and details toggle, Notes drafts and failed saves.');
})().catch(e=>{console.error(e);process.exitCode=1;});
