'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('./dashboard');
const rows=[['One','#research/rl #research/vla'],['Two','#research/rl'],['Three','#research/vla'],['Four','#research/rl/online']].map(([name,tags],i)=>({path:'papers/'+name+'.pdf',filename:name+'.pdf',title:name,tags,category:'ML',categories:['ML'],published:'2026.10',status:i===0?'在读':'待读',priority:'—',tldr:'Summary',notes:'',bookmarked:i===0,organizing:'待整理'}));
assert.equal(E.filterLibrary(rows,{tags:['#research/rl','#research/vla']}).length,1);
assert.equal(E.filterLibrary(rows,{tags:['#research/rl']}).length,2,'Parent names must not match child paths implicitly');
assert.equal(E.filterLibrary(rows,{tags:['#research/rl','#research/missing']}).length,0);
assert.equal(E.filterLibrary(rows,{tags:[]}).length,4);
assert.equal(E.filterLibrary(rows,{tag:'#research/vla'}).length,2,'Keep compatibility with a stored single-tag filter');
assert.equal(E.filterLibrary(rows,{tags:['#research/RL','#research/rl']}).length,2,'Case-insensitive duplicate selections are normalized');
assert.equal(E.filterLibrary(rows,{tags:['#research/rl','#research/vla'],category:'ML',status:'在读',bookmarked:true,query:'One'}).length,1);
assert.deepEqual(E.normalizeTagFilter(['#research/rl',null,5,{},'','#bad space','#research/RL']),['#research/rl']);
class Target{constructor(){this.listeners={};}addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}removeEventListener(k,fn){this.listeners[k]=(this.listeners[k]||[]).filter(f=>f!==fn);}emit(k,e={}){for(const fn of [...(this.listeners[k]||[])])fn(e);}}
class Element extends Target{
 constructor(o={}){super();if(typeof o==='string')o={cls:o};this.children=[];this.attributes={...o.attr};this.textContent=o.text||'';this.value='';this.hidden=false;this.classes=new Set((o.cls||'').split(' '));this.style={};this.scrollTop=0;this.ownerDocument=doc;this.isConnected=true;this.offsetWidth=320;this.offsetHeight=240;}
 createEl(tag,o){const el=new Element(o);el.tag=tag;el.type=o?.type;this.appendChild(el);return el;}createDiv(o){return this.createEl('div',o);}createSpan(o){return this.createEl('span',o);}
 appendChild(el){el.remove();el.parentElement=this;el.isConnected=true;this.children.push(el);}remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(e=>e!==this);this.isConnected=false;}
 setText(s){this.textContent=s;}setAttribute(k,v){this.attributes[k]=v;}addClass(c){this.classes.add(c);}toggleClass(c,v){v?this.classes.add(c):this.classes.delete(c);}contains(el){return el===this||this.children.some(c=>c.contains(el));}focus(){doc.activeElement=this;}getBoundingClientRect(){return {left:20,right:180,top:50,bottom:80};}
 click(){if(this.disabled)return;if(this.type==='checkbox'){this.checked=!this.checked;this.emit('change',{target:this});}this.emit('click',{target:this,currentTarget:this});}
}
const doc=new Target(),win=new Target();doc.defaultView=win;doc.body=new Element();win.innerWidth=500;win.innerHeight=800;
class ItemView{constructor(){this.app={workspace:{requestSaveLayout(){}}};this.contentEl=new Element();}async setState(){}}
const ctx={module:{exports:{}},require:n=>{assert.equal(n,'obsidian');return {Plugin:class{},ItemView,Modal:class{},Platform:{isMobile:true},setIcon(){},Notice:class{}};}};
vm.runInNewContext(fs.readFileSync('main.js','utf8')+'\nmodule.exports.Browser=LiteratureBrowser;',ctx);
const plugin={snapshot:{library:rows},mutate(){throw Error('Filtering must never mutate paper metadata');}},view=new ctx.module.exports.Browser({},plugin);
view.rows=rows;view.tagEl=new Element();view.remember=()=>{};view.syncControls=()=>view.syncFilterControls();view.renderList=()=>{view.visibleRows=E.filterLibrary(view.rows,view.filters);};
(async()=>{
 await view.setState({scope:'library',tag:'#research/rl'});assert.deepEqual([...view.filters.tags],['#research/rl']);
 const oldState=view.getState();oldState.tags.push('#extra');assert.equal(view.filters.tags.length,1,'Workspace snapshots do not share a mutable filter array');
 await view.setState({scope:'library',tag:'#research/vla',tags:[]});assert.equal(view.filters.tags.length,0,'An explicit empty multi-filter wins over stale legacy state');
 view.openTagFilter();const menu=view.tagFilterMenu;assert(menu);assert.equal(view.tagEl.attributes['aria-expanded'],'true');
 const rl=menu.entries.get('#research/rl'),vla=menu.entries.get('#research/vla');rl.box.click();assert.equal(view.visibleRows.length,2);
 menu.list.scrollTop=60;vla.box.focus();vla.box.click();assert.equal(view.visibleRows.length,1);assert.equal(view.visibleRows[0].title,'One');assert.equal(menu.list.scrollTop,60);assert.equal(doc.activeElement,vla.box);assert.equal(view.tagFilterMenu,menu);assert.equal(menu.entries.get('#research/rl').box,rl.box);
 assert.equal(view.tagEl.textContent,'rl · vla');const state=view.getState();await view.setState(state);assert.equal(view.filters.tags.length,2);
 menu.search.value='vla';menu.search.emit('input');assert(rl.el.hidden);assert(!vla.el.hidden);assert.equal(view.filters.tags.length,2,'Searching the chooser does not clear selected tags');
 menu.search.value='';menu.search.emit('input');vla.box.click();assert.equal(view.visibleRows.length,2);assert.equal(menu.clear.disabled,false);
 menu.clear.click();assert.equal(view.filters.tags.length,0);assert.equal(view.visibleRows.length,4);assert.equal(menu.clear.disabled,true);assert.equal(view.tagEl.textContent,'全部标签');
 view.setTagFilters(['#research/missing']);assert(menu.entries.has('#research/missing'),'Retain a selected missing option so it can be unchecked');
 menu.clear.click();view.notesDirty=true;assert.equal(view.setTagFilters(['#research/rl']),false);assert.equal(view.filters.tags.length,0);view.notesDirty=false;
 doc.emit('keydown',{key:'Escape',preventDefault(){},stopPropagation(){}});assert.equal(view.tagFilterMenu,null);assert.equal(plugin.tagFilterMenu,null);assert.equal(doc.activeElement,view.tagEl);assert.equal(doc.listeners.pointerdown.length,0);assert.equal(win.listeners.resize.length,0);
 view.openTagFilter();doc.emit('pointerdown',{target:new Element()});assert.equal(view.tagFilterMenu,null);
 view.setTagFilters(['#research/rl','#research/vla']);view.clearFilters();assert.equal(view.filters.tags.length,0);
 view.notesDirty=true;view.openTagFilter();assert.equal(view.tagFilterMenu,null);
 console.log('PASS: exact multi-tag intersections, combined filters, old-state migration, stable checkbox menu/scroll/focus, search/clear, draft guards, cleanup and no metadata writes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
