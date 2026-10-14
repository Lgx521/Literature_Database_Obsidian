'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Target{
 constructor(){this.listeners={};this.options={};}
 addEventListener(k,fn,options){(this.listeners[k]??=[]).push(fn);this.options[k]=options;}removeEventListener(k,fn){this.listeners[k]=(this.listeners[k]||[]).filter(f=>f!==fn);}
 emit(k,data={}){const e={target:this,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...data};for(const f of [...(this.listeners[k]||[])])f(e);return e;}
}
const doc=new Target(),win=new Target();doc.defaultView=win;
let nextFrame=0;const frames=new Map();win.requestAnimationFrame=f=>{frames.set(++nextFrame,f);return nextFrame;};win.cancelAnimationFrame=id=>frames.delete(id);const frame=()=>{const work=[...frames.values()];frames.clear();for(const f of work)f();};
win.getComputedStyle=el=>({getPropertyValue:()=>el.axis});
win.ResizeObserver=class{constructor(fn){this.fn=fn;}observe(){}disconnect(){this.disconnected=true;}};
class Element extends Target{
 constructor(){super();this.attributes={};this.ownerDocument=doc;this.classes=new Set();this.values={};this.style={setProperty:(k,v)=>this.values[k]=v,removeProperty:k=>delete this.values[k]};}
 createDiv(o){const e=new Element();e.attributes={...o.attr};return e;}setAttribute(k,v){this.attributes[k]=v;}addClass(c){this.classes.add(c);}removeClass(c){this.classes.delete(c);}focus(){doc.activeElement=this;}blur(){if(doc.activeElement===this)doc.activeElement=null;}remove(){this.removed=true;}
 setPointerCapture(id){this.pointer=id;}hasPointerCapture(id){return this.pointer===id;}releasePointerCapture(id){this.pointer=null;this.emit('lostpointercapture',{pointerId:id});}
 getBoundingClientRect(){return {width:1000,height:600};}
}
const api={tr:s=>s};vm.runInNewContext(fs.readFileSync('scripts/pane-splitter.js','utf8')+'\nthis.Splitter=LdbPaneSplitter;',api);const S=api.Splitter;
assert.deepEqual({...S.sizes({width:NaN,rows:3})},{});assert.deepEqual({...S.sizes({width:420,rows:.4,unknown:1})},{width:420,rows:.4});
let remembered=0;const view={leaf:{id:'test'},paneSizes:{},remember(){remembered++;},notesInput:{value:'Unsaved Notes'},selectedPath:'papers/One.pdf'},body=new Element(),list=new Element(),detail=new Element();body.axis='columns';body.width=1000;body.height=600;body.getBoundingClientRect=()=>({width:body.width,height:body.height});
list.getBoundingClientRect=()=>{
 const rows=body.axis==='rows',total=rows?body.height:body.width,bounds=S.bounds(body.axis,total);
 const intended=rows?(parseFloat(body.values['--ldb-pane-rows'])||45)/100*total:total-(parseFloat(body.values['--ldb-pane-width'])||300);
 const first=view.mobileExpanded?0:Math.max(bounds.min,Math.min(bounds.max,intended));return {width:rows?body.width:first,height:rows?first:body.height};
};
const splitter=new S(view,body,list,detail),h=splitter.handle;
const point=(value,id=1)=>({pointerId:id,button:0,isPrimary:true,pointerType:'mouse',clientX:value,clientY:value});
const start=()=>{const m=splitter.metrics();h.emit('pointerdown',point(m.first));return m.first;};
let at=start();assert(body.classes.has('is-resizing'));doc.emit('pointerup',point(at));assert.equal(remembered,0,'A plain press must not freeze the default adaptive size');
at=start();doc.emit('pointermove',point(at-100));doc.emit('pointermove',point(at-120));assert.equal(frames.size,1,'Coalesce pointer moves');frame();assert.equal(body.values['--ldb-pane-width'],'420px');assert.equal(view.paneSizes.width,undefined,'Persist only on release');doc.emit('pointerup',point(at-120));assert.equal(view.paneSizes.width,420);assert.equal(remembered,1);assert(!body.classes.has('is-resizing'));assert.equal(h.attributes['aria-orientation'],'vertical');
at=start();doc.emit('pointermove',point(-1000));frame();assert.equal(body.values['--ldb-pane-width'],'720px','Reserve 280px for the list');doc.emit('pointercancel',point(-1000));assert.equal(body.values['--ldb-pane-width'],'420px');assert.equal(remembered,1);
at=start();doc.emit('pointermove',point(5000));doc.emit('pointerup',point(5000));assert.equal(view.paneSizes.width,280,'Details have a minimum width');
at=start();doc.emit('pointermove',point(at-80,2));assert.equal(frames.size,0,'Ignore other fingers');h.emit('lostpointercapture',point(at,2));assert(splitter.drag);doc.emit('pointermove',point(at-80));doc.emit('keydown',{key:'Escape'});assert.equal(view.paneSizes.width,280);assert.equal(frames.size,0);assert(!splitter.drag);
h.emit('keydown',{key:'ArrowLeft'});assert.equal(view.paneSizes.width,290);h.emit('keydown',{key:'Home'});assert.equal(view.paneSizes.width,720);h.emit('keydown',{key:'End'});assert.equal(view.paneSizes.width,280);
body.axis='rows';splitter.observer.fn();assert.equal(h.attributes['aria-orientation'],'horizontal');at=start();doc.emit('pointermove',point(at+60));frame();doc.emit('pointerup',point(at+60));assert.equal(view.paneSizes.rows,.55);assert.equal(view.paneSizes.width,280,'Independent horizontal/vertical preferences');
at=start();doc.emit('pointermove',point(0));doc.emit('pointerup',point(0));assert.equal(Math.round(view.paneSizes.rows*600),140);h.emit('keydown',{key:'End'});assert.equal(Math.round(view.paneSizes.rows*600),420,'Reserve 180px for details');
const saved={...view.paneSizes};at=start();doc.emit('pointermove',point(at-50));frame();win.emit('blur');assert.deepEqual({...view.paneSizes},saved);assert(!splitter.drag);
body.height=200;splitter.observer.fn();const m=splitter.metrics();assert(m.first>=m.min&&m.first<=m.max&&m.min+m.total-m.max===200,'Fit both panes when the keyboard makes space scarce');assert.deepEqual({...view.paneSizes},saved,'Temporary viewport sizes do not overwrite preferences');
body.axis='columns';body.width=650;body.height=600;splitter.sync();at=start();doc.emit('pointermove',point(at-20));body.axis='rows';splitter.observer.fn();assert(!splitter.drag);assert.deepEqual({...view.paneSizes},saved,'Rotation cancels the old-axis gesture');
view.mobileExpanded=true;splitter.sync();assert.equal(h.tabIndex,-1);assert.equal(h.attributes['aria-hidden'],'true');h.emit('pointerdown',point(10));assert(!splitter.drag);h.emit('keydown',{key:'Home'});assert.deepEqual({...view.paneSizes},saved);view.mobileExpanded=false;splitter.sync();assert.equal(h.tabIndex,0);
assert.equal(h.attributes['data-ignore-swipe'],'true','Opt out of Obsidian drawer gestures at the original touch target');
for(const type of ['touchstart','touchmove']){
 const event=h.emit(type);assert(event.prevented&&event.stopped,'Claim the separate Touch Event stream before it reaches drawer handlers');assert.equal(h.options[type].passive,false);
}
assert.equal(doc.listeners.touchstart,undefined,'Do not disable swipes elsewhere in the workspace');
h.emit('pointerenter',{pointerType:'mouse'});assert(h.classes.has('is-pointer-hover'));h.emit('pointerleave');assert(!h.classes.has('is-pointer-hover'));
for(const end of ['pointerup','pointercancel','lostpointercapture']){
 h.emit('pointerenter',{pointerType:'mouse'});h.focus();at=splitter.metrics().first;
 h.emit('pointerdown',{...point(at),pointerType:'touch'});assert(!h.classes.has('is-pointer-hover'));
 doc.emit('pointermove',{...point(at-30),pointerType:'touch'});frame();
 (end==='lostpointercapture'?h:doc).emit(end,{...point(at-30),pointerType:'touch'});
 assert(!splitter.drag&&!body.classes.has('is-resizing'));assert(!h.classes.has('is-pointer-hover'));assert.notEqual(doc.activeElement,h,'Touch release/cancel must clear divider focus');
 view.paneSizes={...saved};splitter.sync();
}
const notesFocus=new Element();notesFocus.focus();h.emit('pointerdown',{...point(splitter.metrics().first),pointerType:'touch'});assert.equal(doc.activeElement,notesFocus,'Touch resizing must not steal Notes focus');doc.emit('pointerup',{...point(splitter.metrics().first),pointerType:'touch'});assert.equal(doc.activeElement,notesFocus);
h.emit('pointermove',{pointerType:'mouse'});assert(h.classes.has('is-pointer-hover'),'Mouse hover works again after a touch gesture');h.focus();h.emit('keydown',{key:'ArrowLeft'});assert.equal(doc.activeElement,h,'Keyboard resizing keeps focus');view.paneSizes={...saved};splitter.sync();
at=start();doc.emit('pointermove',point(at-20));splitter.destroy();assert.equal(frames.size,0);assert(splitter.observer.disconnected);assert(h.removed);assert.equal(doc.listeners.pointermove.length,0);assert.equal(win.listeners.blur.length,0);assert.deepEqual({...view.paneSizes},saved);assert.equal(view.notesInput.value,'Unsaved Notes');assert.equal(view.selectedPath,'papers/One.pdf');
for(const type of ['touchstart','touchmove','pointerenter','pointerleave'])assert.equal(h.listeners[type].length,0,'Clean up '+type);
console.log('PASS: pointer/touch resizing, adaptive limits, independent preferences, frame batching, keyboard/ARIA, no-click writes, cancel/rotation/expansion handling and teardown without touching paper data.');
