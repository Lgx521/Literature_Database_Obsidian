const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const E=require('./dashboard');
const source='## ML\n\n| '+E.NOTES_HEADERS.join(' | ')+' |\n| '+E.NOTES_HEADERS.map(()=> '---').join(' | ')+' |\n| [One.pdf](papers/One.pdf) | 2026.10 | #research/rl | User summary | 待读 | — | Stored<br>notes |\n<!-- library:end -->\nUSER FOOTER';
class Element{
  constructor(options={}){this.children=[];this.events={};this.value=options.value||'';this.textContent=options.text||'';this.attributes=options.attr||{};this.hidden=false;}
  createEl(tag,o){const e=new Element(o);e.tag=tag;this.children.push(e);return e;}createDiv(o){return this.createEl('div',o);}createSpan(o){return this.createEl('span',o);}
  addEventListener(n,f){this.events[n]=f;}addClass(){}setAttribute(k,v){this.attributes[k]=v;}setText(t){this.textContent=t;}empty(){this.children=[];}
}
class ItemView{constructor(leaf){this.leaf=leaf;this.app={workspace:{requestSaveLayout(){}}};}}
const notices=[];
const context={module:{exports:{}},require:n=>n==='obsidian'?{Plugin:class{},ItemView,Modal:class{},Platform:{isDesktopApp:true,isMacOS:true},setIcon(){},Notice:class{constructor(m){notices.push(m);}}}:require(n)};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+'\nmodule.exports.Browser=LiteratureBrowser;',context);
let stored=source,writes=0,fail=false,wait=null;
const plugin={snapshot:{categories:['ML']},mutate:async(name,transform)=>{assert.equal(name,'library.md');if(wait)await wait;if(fail)throw new Error('write failed');stored=transform(stored);writes++;}};
function browser(){
  const view=new context.module.exports.Browser({},plugin);view.detailEl=new Element();view.rows=E.parseLibrary(stored);view.selectedPath=view.rows[0].path;view.sortButtons=[];view.lockFilters=locked=>{view.filtersLocked=locked;};view.reload=async()=>{view.rows=E.parseLibrary(stored);if(!view.dirty())view.renderDetail();};view.renderDetail();return view;
}
const descendants=element=>element.children.flatMap(e=>[e,...descendants(e)]);
(async()=>{
  const view=browser();
  assert.equal(view.venueInput.hidden,true);assert.equal(view.venueMenuButton.textContent,'添加 Venue…');assert(!descendants(view.detailEl).some(e=>e.tag==='datalist'));
  assert.equal(view.quickFields.length,2);assert.equal(view.editing,false);
  assert(descendants(view.detailEl).some(e=>e.tag==='button'&&e.textContent==='Open ↗'));
  assert(!descendants(view.detailEl).some(e=>e.textContent.includes('Skim')));
  view.quickFields[0].select.value='在读';await view.quickFields[0].select.events.change();
  assert.equal(E.parseLibrary(stored)[0].status,'在读');assert.equal(view.editing,false);
  assert.equal(E.parseLibrary(stored)[0].notes,'Stored<br>notes');assert(stored.endsWith('USER FOOTER'));
  // Keep a draft throughout two successive immediate saves, then explicitly save it.
  const input=view.notesInput;input.value='Unsaved | draft\n第二行';input.events.input();
  await view.saveQuickField('priority','高');await view.saveQuickField('status','已读');
  assert.equal(view.notesInput,input);assert.equal(view.notesDirty,true);assert.equal(view.notesBase.priority,'高');assert.equal(view.notesBase.status,'已读');
  assert.equal(E.parseLibrary(stored)[0].notes,'Stored<br>notes','Quick saves never submit the draft.');
  await view.saveNotes();assert.equal(E.decodeText(E.parseLibrary(stored)[0].notes),'Unsaved | draft\n第二行');assert.equal(view.notesDirty,false);
  // Stored selections roll back on write failure while Notes remain untouched.
  view.notesInput.value='Keep this draft';view.notesInput.events.input();fail=true;
  await view.saveQuickField('priority','低');fail=false;
  assert.equal(view.quickFields[1].select.value,'高');assert.equal(view.quickError.hidden,false);assert.equal(view.quickError.textContent,'write failed');assert.equal(view.notesInput.value,'Keep this draft');assert.equal(view.saving,false);
  // A concurrent edit of this row refuses the quick save rather than absorbing new Notes.
  stored=E.updateLibraryEntry(stored,E.parseLibrary(stored)[0],{notes:'External notes'});
  await view.saveQuickField('priority','低');assert.equal(E.parseLibrary(stored)[0].priority,'高');assert.equal(view.notesInput.value,'Keep this draft');
  await view.saveNotes();assert.equal(E.parseLibrary(stored)[0].notes,'External notes');assert.equal(view.notesDirty,true);
  // A user cannot start a second save while the first write is pending.
  const next=browser();let release;wait=new Promise(resolve=>{release=resolve;});const pending=next.saveQuickField('priority','中');
  assert(next.quickFields.every(f=>f.select.disabled));assert.equal(next.notesInput.readOnly,true);
  const before=writes;await next.saveQuickField('status','待读');assert.equal(writes,before);release();await pending;wait=null;
  assert.equal(E.parseLibrary(stored)[0].priority,'中');assert.equal(E.parseLibrary(stored)[0].status,'已读');assert.equal(next.saving,false);
  // A stale or malformed source is not writable from the quick controls.
  next.readError=true;const current=writes;await next.saveQuickField('priority','低');assert.equal(writes,current);
  next.readError=false;
  next.notesInput.value='Personal draft';next.notesInput.events.input();
  next.venueInput.value='arXiv';next.venueInput.events.input();assert.equal(next.getState().venueDraft.value,'arXiv');
  await next.venueInput.events.change();assert.equal(next.venueDraft,'');assert.equal(next.notesInput.value,'Personal draft');assert.equal(next.notesDirty,true);
  assert.deepEqual(E.parseLibrary(stored)[0].venues,['arXiv']);
  next.venueInput.value='CoRL 2026';next.venueInput.events.input();await next.addPaperVenue();
  assert.deepEqual(E.parseLibrary(stored)[0].venues,['arXiv','CoRL 2026']);
  const beforeDuplicate=writes;next.venueInput.value='ARXIV';next.venueInput.events.input();await next.addPaperVenue();assert.equal(writes,beforeDuplicate);
  await next.venueRemoveButtons[0].events.click();assert.deepEqual(E.parseLibrary(stored)[0].venues,['CoRL 2026']);assert.equal(next.notesInput.value,'Personal draft');
  fail=true;next.venueInput.value='ICLR';next.venueInput.events.input();await next.addPaperVenue();fail=false;
  assert.equal(next.venueInput.value,'ICLR');assert.equal(next.venueDraft,'ICLR');assert.equal(next.quickError.hidden,false);
  next.venueInput.events.keydown({key:'Escape',stopPropagation(){},preventDefault(){}});assert.equal(next.venueDraft,'');
  await next.saveNotes();assert.equal(E.parseLibrary(stored)[0].notes,'Personal draft');assert.deepEqual(E.parseLibrary(stored)[0].venues,['CoRL 2026']);
  plugin.snapshot.library=[{venues:['CoRL 2026','ICLR']}];const reused=browser();assert(reused.venueMenuButton);assert.equal(reused.venueInput.hidden,true);
  reused.venueInput.value='iclr';reused.venueInput.events.input();await reused.addPaperVenue();assert.deepEqual(E.parseLibrary(stored)[0].venues,['CoRL 2026','ICLR']);
  console.log('PASS: directly editable selectors; Open label; single-field writes; Notes draft/rebase; explicit Notes save; write failures and concurrent edits; serialization; incomplete-source refusal.');
})().catch(error=>{console.error(error);process.exitCode=1;});
