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
const context={TextEncoder,TextDecoder,URL,setTimeout,clearTimeout,module:{exports:{}},require:n=>n==='obsidian'?{Plugin:class{},ItemView,Modal:class{},Platform:{isDesktopApp:true,isMacOS:true},setIcon(){},Notice:class{constructor(m){notices.push(m);}}}:require(n)};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+'\nmodule.exports.Browser=LiteratureBrowser;module.exports.i18n=LdbI18n;module.exports.citations=getCitations;',context);
let stored=source,writes=0,fail=false,wait=null;
const plugin={snapshot:{categories:['ML']},mutate:async(name,transform)=>{assert.equal(name,'library.md');if(wait)await wait;if(fail)throw new Error('write failed');stored=transform(stored);writes++;}};
function browser(){
  const view=new context.module.exports.Browser({},plugin);view.detailEl=new Element();view.rows=E.parseLibrary(stored);view.selectedPath=view.rows[0].path;view.sortButtons=[];view.lockFilters=locked=>{view.filtersLocked=locked;};view.reload=async()=>{view.rows=E.parseLibrary(stored);if(!view.dirty())view.renderDetail();};view.renderDetail();return view;
}
const descendants=element=>element.children.flatMap(e=>[e,...descendants(e)]);
(async()=>{
 const I=context.module.exports.i18n;
 assert.equal(I.resolveLanguage('auto','zh-TW'),'zh');assert.equal(I.resolveLanguage('auto','en'),'en');assert.equal(I.resolveLanguage('auto','fr'),'en');assert.equal(I.resolveLanguage('zh','en'),'zh');
 I.setLanguage('en');
 assert.equal(I.t`已导入 ${5} 篇 PDF`,'Imported 5 PDFs');
 const literal='{0} 中文 title <script>';assert.equal(I.t`截止时间需含时区：${literal}`,'Deadline must include a time zone: '+literal);
 const v=browser(),all=()=>descendants(v.detailEl);
 assert.equal(v.getDisplayText(),'Library');assert.equal(v.venueMenuButton.textContent,'Add venue…');
 assert(all().some(e=>e.textContent==='Reading status'));assert(all().some(e=>e.textContent==='Save notes'));
 const statuses=v.quickFields[0].select.children;assert(statuses.some(e=>e.value==='在读'&&e.textContent==='Reading'));assert.equal(v.quickFields[0].select.value,'待读');
 assert(all().some(e=>e.textContent==='User summary'));
 const before=stored;v.quickFields[0].select.value='在读';await v.quickFields[0].select.events.change();
 assert.equal(E.parseLibrary(stored)[0].status,'在读');assert.equal(E.parseLibrary(stored)[0].notes,'Stored<br>notes');
 const after=stored;I.setLanguage('zh');v.renderDetail();assert.equal(v.venueMenuButton.textContent,'添加 Venue…');assert.equal(stored,after);
 I.setLanguage('en');
 const manager=new context.module.exports();manager.settings={language:'en',other:'preserve'};
 manager.app={workspace:{getLeavesOfType:()=>[],requestSaveLayout(){}}};manager.hasPendingEdit=()=>true;
 let saved;manager.saveData=async data=>{saved=data;};manager.registerCommands=()=>{};manager.renderNavigation=()=>{};
 await assert.rejects(manager.changeLanguage('zh'),/Save or cancel/);assert.equal(I.getLanguage(),'en');assert.equal(saved,undefined);
 manager.hasPendingEdit=()=>false;manager.saveData=async()=>{throw new Error('WRITE FAILED');};await assert.rejects(manager.changeLanguage('zh'),/WRITE FAILED/);assert.equal(I.getLanguage(),'en');
 let editing=false;manager.hasPendingEdit=()=>editing;manager.saveData=async data=>{saved=data;if(data.language==='zh')editing=true;};
 await assert.rejects(manager.changeLanguage('zh'),/Save or cancel/);assert.equal(I.getLanguage(),'en');assert.equal(saved.language,'en');
 editing=false;manager.hasPendingEdit=()=>false;manager.saveData=async data=>{saved=data;};await manager.changeLanguage('zh');assert.equal(saved.other,'preserve');assert.equal(I.getLanguage(),'zh');
 I.setLanguage('en');const missing=context.module.exports.citations().exportRows([{path:'papers/A.pdf',filename:'A.pdf'}],'bibtex');assert.equal(missing.missing[0].reason,'No complete reference was identified.');
 manager.migrationFailed=true;manager.loadSnapshot=()=>{throw new Error('Must not bypass migration conflict');};await manager.refresh(true);
 I.setLanguage('zh');assert.equal(context.module.exports.citations().exportRows([{path:'papers/A.pdf',filename:'A.pdf'}],'bibtex').missing[0].reason,'未识别到完整引用资料');
 console.log('PASS: bilingual detail controls, exact stored values and user content, safe interpolation, citation diagnostics, locale preference persistence and unsaved-edit guards.');
})().catch(error=>{console.error(error);process.exitCode=1;});
