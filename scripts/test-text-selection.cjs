'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={};vm.runInNewContext(fs.readFileSync('scripts/text-selection.js','utf8')+'\nthis.Controller=LdbTextSelection;',context);
const listeners=new Map(),documentListeners=new Map();
const title={start:10,end:20,isConnected:true,contains:n=>n===title,focus(){doc.activeElement=this;},closest(){return this;}},summary={...title,start:50,end:80,contains:n=>n===summary};
const outside={closest:()=>null};
// Range coordinates model sibling text around each independently selectable field.
class Range {
  selectNodeContents(el){this.setStart(el,0);this.setEnd(el,el.end-el.start);}
  setStart(node,offset){this.startContainer=node;this.startOffset=offset;}
  setEnd(node,offset){this.endContainer=node;this.endOffset=offset;}
  comparePoint(node,offset){const point=node.start+offset;return point<this.startContainer.start+this.startOffset?-1:point>this.endContainer.start+this.endOffset?1:0;}
  cloneRange(){return Object.assign(new Range(),this);}
}
const selection={rangeCount:0,isCollapsed:false,removeAllRanges(){this.rangeCount=0;},addRange(r){this.range=r;this.rangeCount=1;this.anchorNode=r.startContainer;},getRangeAt(){return this.range;}};
const doc={defaultView:{getSelection:()=>selection},createRange:()=>new Range(),addEventListener:(k,f)=>documentListeners.set(k,f),removeEventListener:k=>documentListeners.delete(k)};
const root={ownerDocument:doc,contains:el=>el===title||el===summary,addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k)};
const controller=new context.Controller(root),event=target=>({target,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}});
for(const field of [title,summary]){
  const double=event(field);listeners.get('dblclick')(double);assert(double.prevented&&double.stopped);assert.equal(doc.activeElement,field);assert.equal(selection.range.endContainer,field);assert.equal(selection.range.endOffset,field.end-field.start);
  const key={...event(field),metaKey:true,key:'a'};listeners.get('keydown')(key);assert(key.prevented);assert.equal(selection.range.startContainer,field);
}
listeners.get('pointerdown')(event(title));
const spanning=new Range();spanning.setStart(title,2);spanning.setEnd(summary,5);selection.addRange(spanning);documentListeners.get('selectionchange')();assert.equal(selection.range.startOffset,2);assert.equal(selection.range.endContainer,title,'Selecting the title cannot include lower controls');assert.equal(selection.range.endOffset,10);
const reverse=new Range();reverse.setStart({start:0},0);reverse.setEnd(title,8);selection.addRange(reverse);selection.anchorNode=title;documentListeners.get('selectionchange')();assert.equal(selection.range.startContainer,title);assert.equal(selection.range.startOffset,0);assert.equal(selection.range.endOffset,8);
selection.addRange(spanning);selection.anchorNode=summary;controller.constrain();assert.equal(selection.range,spanning,'Do not intercept a selection started elsewhere');
const normal=event(outside);listeners.get('pointerdown')(normal);assert(!normal.stopped);assert.equal(controller.active,null);
controller.destroy();assert.equal(listeners.size,0);assert.equal(documentListeners.size,0);assert.equal(controller.active,null);
console.log('PASS: isolated double-click/select-all, forward/reverse drag boundaries, unrelated selections and listener teardown.');
