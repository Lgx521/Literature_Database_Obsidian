'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),T=require('./tag-tree');
class Scope{register(){return {};}unregister(){this.removed=true;}}
class Modal{constructor(){this.contentEl={empty(){}};}}
const frames=new Map();let serial=0,paints=0;
const win={requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id)};
class El{
 constructor(){this.style={};this.dataset={};this.attributes={};this.textContent='';this.children=[];this.classList={toggle(){},remove(){}};}
 setAttribute(k,v){this.attributes[k]=v;}setText(s){this.textContent=s;}appendChild(el){this.children.push(el);el.parent=this;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}contains(el){return el===this;}
}
const doc={hidden:false,activeElement:null,createElementNS:()=>new El()};
const context={module:{exports:{}},setTimeout,clearTimeout,require:n=>n==='obsidian'?{Plugin:class{},ItemView:class{},Scope,Modal,Platform:{},setIcon(el,value){el.icon=value;}}:require(n)};
vm.runInNewContext(fs.readFileSync('main.js','utf8')+'\nmodule.exports.Map=TagMapModal;module.exports.Browser=LiteratureBrowser;module.exports.Navigation=LibraryNavigation;module.exports.i18n=LdbI18n;',context);
const view={app:{scope:{}},plugin:{},detailRow:{tags:'#research/group-0/tag-0'},dirty:()=>true,lockFilters(){},reload(){throw Error('Do not reload a Notes draft');}};
const map=new context.module.exports.Map(view);view.tagMap=view.plugin.tagMap=map;
Object.assign(map,{mapDoc:doc,mapWin:win,stage:new El(),lines:new El(),zoomLabel:new El(),viewport:{clientWidth:800,clientHeight:600},search:{value:''},model:{groups:Array.from({length:10},(_,i)=>({name:'Group '+i,tags:Array.from({length:100},(_,j)=>`#research/group-${i}/tag-${j}`)}))}});
map.tree=T.tree(map.model);map.createNode=n=>{const el=new El();el.ldbLabel=new El();el.ldbFold=new El();el.ldbPlus={};if(n.kind==='tag')el.ldbCheck={};return el;};
map.render();assert.equal(map.layout.nodes.length,1021);assert(map.nodes.size>0&&map.nodes.size<200,'Large maps mount only viewport and buffer nodes');
const firstMounted=[...map.nodes.values()][0];doc.activeElement=firstMounted;map.pan.y=-10000;map.paint();assert([...map.nodes.values()].includes(firstMounted),'Keep the focused node mounted during pan');
const paint=map.paint.bind(map);map.paint=()=>{paints++;paint();};for(let i=0;i<100;i++){map.pan.x++;map.transform();}assert.equal(frames.size,1);assert.equal(paints,0);const frame=[...frames.values()][0];frames.clear();frame();assert.equal(paints,1);
map.transform();doc.hidden=true;assert.equal(frames.size,1);frame();assert.equal(paints,2); // paint itself refuses hidden work
map.frame=null;frames.clear();map.transform();assert.equal(frames.size,0,'No frames scheduled while hidden');doc.hidden=false;
let calls=0,hidden=0,cleaned=0;map.contextMenu={hide(){hidden++;}};const retainedCallback=map.menuAction(()=>calls++);map.cleanups.push(()=>cleaned++);map.observer={disconnect(){cleaned++;}};map.transform();map.onClose();retainedCallback();
assert.equal(calls,0,'Even a host-retained native menu cannot retain or invoke its old action');assert.equal(hidden,1);assert.equal(cleaned,2);assert.equal(map.cleanups.length,0);assert.equal(frames.size,0);assert.equal(map.nodes.size,0);assert.equal(map.positions.size,0);assert.equal(map.layout,null);assert.equal(map.tree,null);assert.equal(map.view,null);assert.equal(view.tagMap,null);assert.equal(view.plugin.tagMap,null);assert(view.tagMapState.pan);assert(!JSON.stringify(view.tagMapState).includes('children'));
const browser=new context.module.exports.Browser({},{});browser.listEl={};browser.contentEl={ownerDocument:{hidden:true}};browser.reload();assert(browser.pendingReload,'Hidden browser defers painting until activation');
const nav=new context.module.exports.Navigation({},{});nav.contentEl={ownerDocument:{hidden:false}};nav.renderKey=JSON.stringify([context.module.exports.i18n.getLanguage(),null,null,[],null]);let countdowns=0;nav.updateCountdowns=()=>countdowns++;nav.render();assert.equal(countdowns,1,'An unchanged visible sidebar resumes its countdown without recreating DOM');
console.log('PASS: map culling and focus pinning, frame coalescing, hidden pause, native menu revocation, full teardown and primitive-only view state.');
