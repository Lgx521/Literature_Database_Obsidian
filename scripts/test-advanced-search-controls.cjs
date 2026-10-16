'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),A=require('./advanced-search'),I=require('./i18n');
let focused;
class Element{
 constructor(o={}){this.children=[];this.events={};this.value=o?.value||'';this.textContent=o?.text||'';this.attributes={...o?.attr};this.scrollTop=0;}
 createEl(tag,o){const e=new Element(o);e.tagName=tag.toUpperCase();this.children.push(e);return e;}createDiv(o){return this.createEl('div',o);}createSpan(o){return this.createEl('span',o);}
 addEventListener(k,f){this.events[k]=f;}addClass(){}setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];}setText(t){this.textContent=t;}focus(){focused=this;}empty(){this.children=[];}emit(k){this.events[k]?.({target:this});}
}
class Scope{register(){return {};}unregister(){}}
class Modal{constructor(app){this.app=app;this.contentEl=new Element();this.modalEl=new Element();this.titleEl=new Element();}open(){this.onOpen();}close(){this.onClose();}}
const ctx={module:{exports:{}},setTimeout,clearTimeout,require:n=>{assert.equal(n,'obsidian');return {Plugin:class{},ItemView:class{},Modal,Scope,setIcon(){},Platform:{}};}};
vm.runInNewContext(fs.readFileSync('main.js','utf8')+'\nmodule.exports.Search=AdvancedSearchModal;module.exports.TagMap=TagMapModal;',ctx);
const plugin={snapshot:{library:[]}},initial={match:'all',conditions:[{field:'title',op:'contains',value:'original'}]};let applies=0;
const view={app:{},plugin,filters:{advanced:initial},applyAdvancedSearch(state){this.filters.advanced=state;applies++;return true;}};
const open=()=>{const m=new ctx.module.exports.Search(view);view.advancedSearchModal=plugin.advancedSearchModal=m;m.open();return m;};
(async()=>{
 let m=open();const input=m.rowsEl.children[0].children[2].children[0];input.value='changed';input.emit('input');assert.equal(view.filters.advanced.conditions[0].value,'original');m.close();assert.equal(applies,0);assert.equal(m.state,null);assert.equal(view.advancedSearchModal,null);
 m=open();const field=m.rowsEl.children[0].children[0];field.value='published';field.emit('change');assert.equal(m.state.conditions[0].op,'on');assert.equal(focused,m.rowsEl.children[0].children[0],'Native field selection retains keyboard focus');
 m.state.conditions[0].value='2026.13';m.apply();assert.equal(applies,0);assert(!m.errorEl.hidden);assert(!m.closed);m.state.conditions[0].value='2026.5';m.apply();assert.equal(applies,1);assert(m.closed);assert.equal(view.filters.advanced.conditions[0].value,'2026.5');
 m=open();m.rowsEl.children[0].children[3].emit('click');assert.equal(m.state.conditions.length,0);m.apply();assert.equal(applies,2);assert.equal(view.filters.advanced.conditions.length,0);
 m=open();m.state.conditions=[{field:'tags',op:'any',tags:[]}];m.renderRows();m.apply();assert.equal(applies,2);assert(!m.closed);m.close();
 // A selection-only graph must not save a new catalog even if tags.md does not exist.
 let writes=0,toggles=0;const mapView={app:{},plugin,detailRow:{tags:''},saveMapTag(tag,checked){toggles++;this.detailRow.tags=checked?tag:'';return true;}};
 const map=new ctx.module.exports.TagMap(mapView,{selectionOnly:true,isHuman:()=>false,store(){writes++;throw Error('Search must never store a catalog');}});
 map.model={groups:[{name:'Methods',tags:['#research/rl']}]};map.catalogText=null;map.syncChecked=()=>{};map.error=new Element();
 await map.toggle({tag:'#research/rl',group:'Methods'},true);assert.equal(toggles,1);assert.equal(writes,0);assert.equal(mapView.detailRow.tags,'#research/rl');
 for(const file of ['advanced-search-view.js','advanced-search.js']){
  for(const match of fs.readFileSync('scripts/'+file,'utf8').matchAll(/tr\('([^']+)'\)/g))if(/[\u3400-\u9fff]/.test(match[1]))assert(I.english[match[1]],'Missing translation: '+match[1]);
 }
 for(const label of [...Object.values(A.FIELDS),...Object.values(A.OPS)])if(/[\u3400-\u9fff]/.test(label))assert(I.english[label],label);
 console.log('PASS: staged edits, cancel/apply, date/tag validation, clear conditions, keyboard focus, dialog teardown, bilingual controls and selection-only graph without writes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
