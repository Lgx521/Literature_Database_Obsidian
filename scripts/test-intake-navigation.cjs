const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Element{
 constructor(){this.events={};this.classes=new Set();this.dataset={};}
 addEventListener(n,fn){(this.events[n]??=[]).push(fn);}removeEventListener(n,fn){this.events[n]=(this.events[n]||[]).filter(f=>f!==fn);}
 async emit(n,e={}){for(const f of this.events[n]||[])await f(e);}
 addClass(n){this.classes.add(n);}removeClass(n){this.classes.delete(n);}toggleClass(n,on){on?this.addClass(n):this.removeClass(n);}
 contains(e){return e===this||e?.parent===this;}
}
const ctx={module:{exports:{}},require:n=>n==='obsidian'?{Plugin:class{},ItemView:class{},Modal:class{},Notice:class{},Platform:{isDesktopApp:true,isMacOS:true}}:require(n)};
vm.runInNewContext(fs.readFileSync('main.js','utf8')+'\nmodule.exports.listDrop=ldbListDropTarget;',ctx);
(async()=>{
 const win=new Element(),doc=new Element(),pane=new Element(),list=new Element(),frames=new Map();let next=0,time=0,position=0;
 win.requestAnimationFrame=fn=>{frames.set(++next,fn);return next;};win.cancelAnimationFrame=id=>frames.delete(id);
 doc.defaultView=win;list.ownerDocument=doc;list.clientHeight=150;Object.defineProperty(list,'scrollTop',{get:()=>position,set:y=>position=Math.max(0,Math.min(500,y))});
 list.getBoundingClientRect=()=>({top:20,bottom:170,left:0,right:300,height:150});
 const groups=[['RL',0,200],['Framework',200,400],['Empty',400,426],['',426,650]].map(([name,top,bottom])=>{const g=new Element();g.dataset.dropSubgroup=name;g.getBoundingClientRect=()=>({top:20+top-position,bottom:20+bottom-position});return g;});
 list.querySelectorAll=()=>groups;let dirty=false;const calls=[];
 const plugin={snapshot:{collections:[]},hasPendingEdit:()=>dirty,importDroppedFiles:async(files,nav)=>calls.push({files,nav})};
 const view={scope:'library',filters:{category:'Robotics',subgroup:null},listEl:list,plugin,isPublic:()=>true,groupingCollection:()=>({}),dirty:()=>dirty};
 const controller=ctx.module.exports.listDrop(pane,view);
 const drag=(y,types=['Files'])=>({clientX:100,clientY:y,dataTransfer:{types,files:[{name:'New.pdf'}]},preventDefault(){this.prevented=true;},stopPropagation(){}});
 const tick=()=>{const callbacks=[...frames.values()];frames.clear();time+=16.67;callbacks.forEach(fn=>fn(time));};
 await pane.emit('dragover',drag(80));assert(groups[0].classes.has('is-drop-target'));assert.equal(frames.size,0);
 await pane.emit('dragover',drag(165));assert(frames.size);for(let i=0;i<20;i++)tick();
 assert(position>200,'Dragging near the middle-list edge scrolls without moving the pointer');assert(groups[1].classes.has('is-drop-target'));assert(!groups[0].classes.has('is-drop-target'));
 const wheel={deltaY:-240,deltaMode:0,preventDefault(){this.prevented=true;}};await pane.emit('wheel',wheel);assert(wheel.prevented);assert(groups[0].classes.has('is-drop-target'));
 position=220;await list.emit('scroll');assert(groups[1].classes.has('is-drop-target'));
 // Native document capture cleanup runs before the pane's drop, but the actual coordinates still choose Framework.
 const dropped=drag(80);await doc.emit('drop',dropped);await pane.emit('drop',dropped);
 assert.equal(calls[0].nav.subgroup,'Framework');assert.equal(calls[0].nav.stayInParent,true);assert.equal(calls[0].files[0].name,'New.pdf');
 assert(!groups.some(g=>g.classes.has('is-drop-target')));assert.equal(frames.size,0);assert(!list.classes.has('is-paper-drag-over'));
 position=350;await pane.emit('dragover',drag(80));assert(groups[2].classes.has('is-drop-target'),'An empty child remains a real drop destination');
 await pane.emit('drop',drag(80));assert.equal(calls.at(-1).nav.subgroup,'Empty');
 position=500;await pane.emit('dragover',drag(80));assert(groups[3].classes.has('is-drop-target'));await pane.emit('drop',drag(80));assert.equal(calls.at(-1).nav.subgroup,'');
 position=200;await pane.emit('dragover',drag(25));tick();assert(position<200);await doc.emit('keydown',{key:'Escape'});assert.equal(frames.size,0);assert(!groups.some(g=>g.classes.has('is-drop-target')));
 await pane.emit('dragover',drag(165));await pane.emit('dragleave',{relatedTarget:null});assert.equal(frames.size,0);
 dirty=true;await pane.emit('dragover',drag(165));assert.equal(frames.size,0);assert(!groups.some(g=>g.classes.has('is-drop-target')));dirty=false;
 plugin.importing=true;await pane.emit('dragover',drag(165));assert.equal(frames.size,0);plugin.importing=false;
 await pane.emit('dragover',drag(165,['text/uri-list']));assert.equal(frames.size,0);
 await pane.emit('dragover',drag(165));await win.emit('blur');assert.equal(frames.size,0);
 controller.destroy();assert(Object.values(doc.events).every(f=>!f.length));assert(Object.values(win.events).every(f=>!f.length));
 console.log('PASS: whole-child drop routing, pointer-following highlight during edge/wheel scrolling, empty children, cleanup and draft/busy guards.');
})().catch(e=>{console.error(e);process.exitCode=1;});
