const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const E=require('./dashboard');
const table=E.TRACKING_HEADERS;
const section=name=>'## '+name+'\r\n截止时间：2026-11-01 23:59 -12:00\r\n\r\n| '+table.join(' | ')+' |\r\n| '+table.map(()=> '---').join(' | ')+' |\r\n| [Same.pdf](reviews/Venue/Same.pdf) | 待审 | 2026-11-01 23:59 -12:00 | Next step | Original &#124; notes<br>中文笔记 |\r\n';
const original=section('Venue A')+'\r\n'+section('Venue B')+'\r\n<!-- tracking:end -->\r\nUSER FOOTER';
class Element{
  constructor(options={}){this.children=[];this.events={};this.dataset={};this.scrollTop=0;this.value=options.value||'';this.textContent=options.text||'';this.attributes=options.attr||{};this.hidden=false;}
  get selectedOptions(){return this.children.filter(e=>e.tag==='option'&&e.value===this.value);}
  createEl(tag,o){const e=new Element(o);e.tag=tag;this.children.push(e);return e;}createDiv(o){return this.createEl('div',o);}createSpan(o){return this.createEl('span',o);}
  addEventListener(n,f){this.events[n]=f;}toggleClass(){}removeAttribute(k){delete this.attributes[k];}addClass(name){(this.classes??=new Set()).add(name);}setAttribute(k,v){this.attributes[k]=v;}setText(t){this.textContent=t;}empty(){this.children=[];}
}
class ItemView{constructor(leaf){this.leaf=leaf;this.contentEl=new Element();this.app={workspace:{requestSaveLayout(){}}};}registerDomEvent(){}}
const notices=[];
const context={module:{exports:{}},require:n=>n==='obsidian'?{Plugin:class{},ItemView,Modal:class{},Platform:{isDesktopApp:true,isMacOS:true},setIcon(){},Notice:class{constructor(m){notices.push(m);}}}:require(n)};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+'\nmodule.exports.Browser=LiteratureBrowser;module.exports.i18n=LdbI18n;',context);

let stored=original,writes=0,fail=false,wait=null;
const plugin={snapshot:{groups:{reviews:['Venue A','Venue B']}},mutate:async(name,fn)=>{assert.equal(name,'reviews.md');if(wait)await wait;if(fail)throw new Error('write failed');stored=fn(stored);writes++;}};
function browser(){
 const view=new context.module.exports.Browser({},plugin);view.scope='reviews';view.filters.category='Venue B';view.detailEl=new Element();view.rows=E.parseTracker(stored,'reviews.md');view.selectedPath=view.rows[1].path;view.sortButtons=[];view.lockFilters=()=>{};
 view.reload=async()=>{view.rows=E.parseTracker(stored,'reviews.md');if(!view.dirty())view.renderDetail();};view.renderDetail();return view;
}
(async()=>{
 const view=browser(),select=view.quickFields[0].select;
 assert(select.classes.has('ldb-inline-select'));assert.deepEqual(select.children.map(c=>c.value),['待审','在审','完成']);assert.equal(view.quickFields.length,1);assert.equal(view.editing,false);
 const first=E.parseTracker(stored,'reviews.md')[0].cells,notesInput=view.notesInput;
 notesInput.value='UNSAVED | personal notes';notesInput.events.input();
 select.value='在审';await select.events.change();
 let rows=E.parseTracker(stored,'reviews.md');assert.deepEqual(rows[0].cells,first);assert.equal(rows[1].status,'在审');assert.equal(rows[1].notes,'Original | notes\n中文笔记');
 assert.equal(view.selectedPath,rows[1].path);assert.equal(view.notesInput,notesInput);assert.equal(view.notesInput.value,'UNSAVED | personal notes');assert(view.notesDirty);
 assert.deepEqual(original.split('\n').filter((s,i)=>s!==stored.split('\n')[i]).length,1);assert.equal(stored.split('\r\n').length,original.split('\r\n').length);assert(stored.endsWith('USER FOOTER'));
 await view.saveQuickField('status','完成');assert.equal(E.parseTracker(stored,'reviews.md')[1].status,'完成');assert.equal(view.notesInput.value,'UNSAVED | personal notes');
 await view.saveNotes();assert.equal(E.parseTracker(stored,'reviews.md')[1].notes,'UNSAVED | personal notes');assert.equal(E.parseTracker(stored,'reviews.md')[1].status,'完成');assert(!view.notesDirty);
 const beforeInvalid=stored;assert.equal(await view.saveQuickField('status','bad'),false);assert.equal(stored,beforeInvalid);
 fail=true;await view.saveQuickField('status','待审');fail=false;assert.equal(view.quickFields[0].select.value,'完成');assert.equal(E.parseTracker(stored,'reviews.md')[1].status,'完成');
 view.notesInput.value='KEEP DRAFT';view.notesInput.events.input();
 const current=E.parseTracker(stored,'reviews.md')[1];stored=E.updateTracker(stored,'reviews.md',current,{title:current.filename,pdfPath:current.pdfPath,category:current.category,status:current.status,due:current.published,next:current.tldr,notes:'EXTERNAL NOTES'});
 assert.equal(await view.saveQuickField('status','在审'),false);assert.equal(view.notesInput.value,'KEEP DRAFT');assert.equal(E.parseTracker(stored,'reviews.md')[1].notes,'EXTERNAL NOTES');assert.equal(E.parseTracker(stored,'reviews.md')[1].status,'完成');
 const next=browser();let release;wait=new Promise(r=>release=r);const pending=next.saveQuickField('status','在审');assert(next.quickFields[0].select.disabled);const count=writes;await next.saveQuickField('status','待审');assert.equal(writes,count);release();await pending;wait=null;
 next.readError=true;const beforeReadError=stored;await next.saveQuickField('status','待审');assert.equal(stored,beforeReadError);
 context.module.exports.i18n.setLanguage('en');const english=browser();assert.deepEqual(english.quickFields[0].select.children.map(c=>c.textContent),['To review','Reviewing','Completed']);assert.equal(english.quickFields[0].select.value,'在审');
 const historical=E.updateTracker(stored,'reviews.md',E.parseTracker(stored,'reviews.md')[1],{title:'Same.pdf',pdfPath:'reviews/Venue/Same.pdf',category:'Venue B',status:'已提交意见',due:'2026-11-01 23:59 -12:00',next:'Next',notes:'Keep'});stored=historical;const old=browser();assert.equal(old.quickFields[0].select.value,'已提交意见');assert.equal(stored,historical);

 // Integration with the real reload/renderList path, including the refresh inside mutate.
 stored=original;context.module.exports.i18n.setLanguage('zh');
 const livePlugin={snapshot:{reviews:E.parseTracker(stored,'reviews.md'),groups:{reviews:['Venue A','Venue B']},deadlines:{reviews:{'Venue A':'2026-11-01 23:59 -12:00','Venue B':'2026-11-01 23:59 -12:00'}},categories:[]},renderNavigation(){},stagingGroup:()=> '暂存区'};
 const live=new context.module.exports.Browser({id:'integration'},livePlugin);live.scope='reviews';live.selectedPath=livePlugin.snapshot.reviews[1].path;
 livePlugin.mutate=async(name,transform)=>{stored=transform(stored);livePlugin.snapshot.reviews=E.parseTracker(stored,'reviews.md');await live.reload();};
 await live.onOpen();assert.equal(live.detailRow.category,'Venue B');
 live.notesInput.value='Saved note on second paper';live.notesInput.events.input();await live.saveNotes();
 assert.equal(live.selectedPath,livePlugin.snapshot.reviews[1].path);assert.equal(live.detailRow.category,'Venue B');assert.equal(live.notesInput.value,'Saved note on second paper');assert(live.rowEls.get(live.selectedPath));
 live.notesInput.value='Another note';live.notesInput.events.input();await live.saveNotes();assert.equal(live.detailRow.category,'Venue B');assert.equal(live.notesInput.value,'Another note');
 await live.saveQuickField('status','完成');assert.equal(live.detailRow.category,'Venue B');assert.equal(live.notesInput.value,'Another note');
 // Deleting an earlier row changes the numeric path, but must retain the same selected paper.
 stored=E.removeRecord(stored,'reviews',E.parseTracker(stored,'reviews.md')[0]);livePlugin.snapshot.reviews=E.parseTracker(stored,'reviews.md');await live.reload();assert.equal(live.detailRow.category,'Venue B');assert.equal(live.selectedPath,livePlugin.snapshot.reviews[0].path);
 console.log('PASS: selection remains on the same review after repeated Notes/status saves and earlier-row removal.');
 console.log('PASS: direct review status control; three bilingual choices; exact single-cell update; duplicate filenames in separate venues; CRLF, notes draft, error rollback, concurrent writes and serialized saves.');
})().catch(error=>{console.error(error);process.exitCode=1;});
