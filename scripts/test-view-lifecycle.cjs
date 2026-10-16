const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Events{
 constructor(){this.events=new Map();}
 addEventListener(n,f){if(!this.events.has(n))this.events.set(n,new Set());this.events.get(n).add(f);}
 removeEventListener(n,f){this.events.get(n)?.delete(f);}
 count(){return [...this.events.values()].reduce((n,s)=>n+s.size,0);}
}
const win=new Events(),doc=new Events();doc.defaultView=win;doc.hidden=false;
class Element extends Events{
 constructor(tag='div',o={}){super();this.tag=tag;this.children=[];this.dataset={};this.ownerDocument=doc;this.attributes={...o?.attr};this.value=o?.value||'';this.textContent=o?.text||'';}
 createEl(tag,o){const e=new Element(tag,o);e.parentElement=this;this.children.push(e);return e;}
 createDiv(o){return this.createEl('div',o);}createSpan(o){return this.createEl('span',o);}
 addClass(){}removeClass(){}toggleClass(){}setAttribute(k,v){this.attributes[k]=v;}empty(){this.children=[];}setText(t){this.textContent=t;}
}
class ItemView{
 constructor(leaf){this.leaf=leaf;this.contentEl=new Element();this.hooks=[];this.app={workspace:{requestSaveLayout(){}}};}
 registerDomEvent(el,name,fn){el.addEventListener(name,fn);this.hooks.push(()=>el.removeEventListener(name,fn));}
}
const ctx={module:{exports:{}},require:n=>n==='obsidian'?{Plugin:class{},ItemView,Modal:class{},Platform:{},setIcon(){}}:require(n)};
vm.runInNewContext(fs.readFileSync('main.js','utf8')+'\nmodule.exports.Browser=LiteratureBrowser;',ctx);
(async()=>{
 const v=new ctx.module.exports.Browser({id:'lifecycle'},{});v.reload=async()=>{};
 await v.onOpen();const hooks=v.hooks.length,docListeners=doc.count(),winListeners=win.count();let destroyed=0;
 for(let i=0;i<40;i++){
  const old=v.detailEl;v.detailMotion={root:old,destroy(){destroyed++;}};
  await v.onOpen();assert.equal(v.detailMotion,null,'Rebuilt details must not reuse the previous motion root');assert.notEqual(v.detailEl,old);
  assert.equal(v.hooks.length,hooks);assert.equal(doc.count(),docListeners);assert.equal(win.count(),winListeners);
 }
 assert.equal(destroyed,40);await v.onClose();for(const off of v.hooks)off();assert.equal(doc.count(),0);assert.equal(win.count(),0);
 console.log('PASS: repeated panel reconstruction releases old detail motion and keeps document/window listener counts bounded; close removes global listeners.');
})().catch(e=>{console.error(e);process.exitCode=1;});
