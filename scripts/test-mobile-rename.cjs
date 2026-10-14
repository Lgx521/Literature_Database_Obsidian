'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),C=require('./collections');
class Target{
 constructor(){this.listeners={};}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
 removeEventListener(k,fn){this.listeners[k]=(this.listeners[k]||[]).filter(f=>f!==fn);}
 emit(k,e={}){for(const fn of [...(this.listeners[k]||[])])fn({target:this,preventDefault(){},stopPropagation(){},...e});}
}
const doc=new Target();
class Element extends Target{
 constructor(){super();this.children=[];this.attributes={};this.ownerDocument=doc;this.value='';}
 get isConnected(){return this===root||!!this.parentElement?.isConnected;}
 createEl(){const e=new Element();e.parentElement=this;this.children.push(e);return e;}createSpan(){return this.createEl();}
 replaceWith(e){const p=this.parentElement;p.children.splice(p.children.indexOf(this),1,e);e.parentElement=p;this.parentElement=null;}
 after(e){const p=this.parentElement;p.children.splice(p.children.indexOf(this)+1,0,e);e.parentElement=p;}
 empty(){for(const e of this.children)e.parentElement=null;this.children=[];}
 setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];}
 contains(e){return e===this||this.children.some(c=>c.contains(e));}focus(){doc.activeElement=this;}select(){}
 blur(){if(doc.activeElement===this){doc.activeElement=null;this.emit('blur');}}
}
const root=new Element();doc.createElement=()=>new Element();
class ItemView{constructor(){this.contentEl=root;this.app={workspace:{requestSaveLayout(){}}};}}
const platform={isMobile:true},notices=[];
const ctx={module:{exports:{}},setTimeout,clearTimeout,require:name=>{assert.equal(name,'obsidian');return {Plugin:class{},ItemView,Modal:class{},Platform:platform,setIcon(){},Notice:class{constructor(message){notices.push(message);}}};}};
vm.runInNewContext(fs.readFileSync('main.js','utf8')+'\nmodule.exports.Navigation=LibraryNavigation;',ctx);
const tick=()=>new Promise(r=>setTimeout(r,5)),outside=()=>doc.emit('pointerdown',{target:root,button:0});
let writes=0,fail=false,hold=null,storedName='Original',text=C.add(C.empty(),'library','Parent');
text=C.addChild(text,'library','Parent','Child');text=C.change(text,['papers/One.pdf'],{scope:'library',name:'Parent',subgroup:'Child'});
const plugin={hasPendingEdit:()=>false,snapshot:{collections:C.parse(text).groups},
 async renameGroup(scope,from,to){writes++;if(hold)await hold;if(fail||to==='Duplicate')throw Error('Name conflict');storedName=to;},
 async editChild(action,scope,parent,child,to,expected){writes++;text=action==='add'?C.addChild(text,scope,parent,to,expected):C.renameChild(text,scope,parent,child,to,expected);this.snapshot.collections=C.parse(text).groups;}
};
const view=new ctx.module.exports.Navigation({},plugin);view.render=()=>root.empty();
const input=()=>root.children.at(-1).children.at(-1);
const begin=(scope='library',name='Original')=>{view.beginRename(root.createEl(),scope,name);return input();};
const cleaned=()=>{assert.equal(view.renaming,null);assert.equal((doc.listeners.pointerdown||[]).length,0);assert.equal(view.mobileRenameCleanup,null);};
(async()=>{
 for(const scope of ['library','projects','reviews','submissions']){
  const field=begin(scope);assert.equal(field.attributes.enterkeyhint,'done');field.value=scope+' renamed';
  const before=writes;doc.emit('pointerdown',{target:field,button:0});assert.equal(writes,before,'Tapping inside input keeps editing');
  outside();await tick();assert.equal(storedName,scope+' renamed');assert.equal(writes,before+1,'Blur and outside tap share one write');cleaned();
 }
 for(const value of ['Original','   ']){const field=begin(),before=writes;field.value=value;outside();await tick();assert.equal(writes,before,'Unchanged or empty mobile names exit without writing');cleaned();}
 let field=begin();field.value='Duplicate';outside();await tick();assert(view.renaming);assert.equal(field.readOnly,false);assert.equal(field.attributes['aria-invalid'],'true');assert.equal(field.value,'Duplicate');assert.equal(doc.activeElement,field);assert(notices.includes('Name conflict'));
 field.value='';outside();await tick();cleaned();
 // Composition can finish before its final input event: never save the partial spelling.
 field=begin();const beforeIme=writes;field.emit('compositionstart');field.value='zhong';outside();assert.equal(writes,beforeIme);field.emit('compositionend');field.emit('blur');field.value='中文分类';field.emit('input');await tick();assert.equal(storedName,'中文分类');assert.equal(writes,beforeIme+1);cleaned();
 // A pending async save stays single even with rapid taps, blur and Done.
 let release;hold=new Promise(r=>release=r);field=begin();field.value='Slow rename';const beforeSlow=writes;outside();outside();field.emit('blur');field.emit('keydown',{key:'Enter'});assert.equal(writes,beforeSlow+1);assert.equal(field.readOnly,true);release();await tick();hold=null;cleaned();
 // The same mobile behavior covers creating and renaming children; placement follows the name.
 view.beginChildEdit(root.createEl(),'library','Parent','Child');field=input();field.value='Renamed child';outside();await tick();cleaned();assert.equal(C.parse(text).groups[0].members[0].subgroup,'Renamed child');
 view.beginChildEdit(root.createEl(),'library','Parent');field=input();field.value='New child';outside();await tick();cleaned();assert(C.parse(text).groups[0].subgroups.includes('New child'));
 // Closing the view removes outside/IME listeners and cancels deferred saves.
 field=begin();const beforeClose=writes;field.emit('compositionstart');outside();field.emit('compositionend');field.value='Do not save';await view.onClose();await tick();outside();assert.equal(writes,beforeClose);cleaned();assert.equal(field.listeners.compositionend.length,0);
 // Desktop keeps its established Enter/Escape/blur behavior and adds no global listener.
 root.empty();view.closed=false;platform.isMobile=false;field=begin();assert.equal(doc.listeners.pointerdown.length,0);field.value='Desktop';const beforeDesktop=writes;outside();assert.equal(writes,beforeDesktop);field.emit('blur');await tick();assert.equal(storedName,'Desktop');
 field=begin();field.value='Cancelled';field.emit('keydown',{key:'Escape'});assert.equal(writes,beforeDesktop+1);assert.equal(view.renaming,null);
 console.log('PASS: mobile tap-away rename for collections/projects/venues/children, unchanged/empty exit, error recovery, IME final text, single async writes, listener cleanup and unchanged desktop controls.');
})().catch(e=>{console.error(e);process.exitCode=1;});
