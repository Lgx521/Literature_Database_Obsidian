const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const notices=[],api={module:{exports:{}},require:name=>name==='obsidian'?{Plugin:class{},ItemView:class{},Modal:class{},Notice:class{constructor(s){notices.push(s);}},Platform:{isDesktopApp:true,isMacOS:true}}:require(name)};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+'\nmodule.exports.dropTarget=ldbDropTarget;module.exports.dragMime=PAPER_DRAG;',api);
const {dropTarget,dragMime}=api.module.exports;
class Target{
 constructor(){this.events={};this.classes=new Set();}
 addEventListener(name,fn){this.events[name]=fn;}
 toggleClass(name,on){if(on)this.classes.add(name);else this.classes.delete(name);}
 removeClass(name){this.classes.delete(name);}
 contains(node){return node===this;}
}
const event=(types,files=[])=>({dataTransfer:{types,files,dropEffect:'none',getData:()=> 'token'},preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}});
(async()=>{
 const calls=[],plugin={dragState:{token:'token'},hasPendingEdit:()=>false,importDroppedFiles:async files=>calls.push(['import',...files]),moveDraggedPaper:async(token,category)=>calls.push(['move',token,category])};
 const inbox=new Target();dropTarget(inbox,plugin);
 const pdf={name:'2601.12345.pdf'},drag=event(['Files'],[pdf]);inbox.events.dragover(drag);
 assert.equal(drag.dataTransfer.dropEffect,'copy');assert(drag.prevented&&drag.stopped);assert(inbox.classes.has('is-drop-target'));
 inbox.events.dragleave({relatedTarget:inbox});assert(inbox.classes.has('is-drop-target'));
 await inbox.events.drop(drag);assert.deepEqual(calls.pop(),['import',pdf]);assert(!inbox.classes.has('is-drop-target'));
 const category=new Target();dropTarget(category,plugin,'ML');const internal=event([dragMime]);category.events.dragover(internal);
 assert.equal(internal.dataTransfer.dropEffect,'move');await category.events.drop(internal);assert.deepEqual(calls.pop(),['move','token','ML']);
 const external=event(['Files'],[pdf]);category.events.dragover(external);assert.equal(external.dataTransfer.dropEffect,'none');await category.events.drop(external);assert.equal(calls.length,0);
 plugin.hasPendingEdit=()=>true;const dirty=event([dragMime]);category.events.dragover(dirty);assert.equal(dirty.dataTransfer.dropEffect,'none');assert(!category.classes.has('is-drop-target'));
 // Only inbox list accepts external files; URLs never become downloads.
 let enabled=false;const list=new Target();dropTarget(list,plugin,null,()=>enabled);
 const otherScope=event(['Files'],[pdf]);await list.events.drop(otherScope);assert(!otherScope.prevented);assert.equal(calls.length,0);
 enabled=true;const link=event(['text/uri-list']);await list.events.drop(link);assert.equal(calls.length,0);
 const internalToInbox=event([dragMime]);inbox.events.dragover(internalToInbox);assert.equal(internalToInbox.dataTransfer.dropEffect,'none');
 plugin.hasPendingEdit=()=>false;plugin.importDroppedFiles=async()=>{throw new Error('copy failed');};await inbox.events.drop(event(['Files'],[pdf]));assert(notices.includes('copy failed'));
 plugin.importDroppedFiles=async(files,nav)=>calls.push([nav.scope,nav.category,files[0].name]);
 plugin.hasPendingEdit=()=>false;plugin.dragState={token:'token',scope:'reviews'};
 const review=new Target();dropTarget(review,plugin,{scope:'reviews',category:'CoRL 2027'});await review.events.drop(event(['Files'],[pdf]));assert.deepEqual(calls.pop(),['reviews','CoRL 2027',pdf.name]);
 const moveReview=event([dragMime]);review.events.dragover(moveReview);assert.equal(moveReview.dataTransfer.dropEffect,'move');await review.events.drop(moveReview);assert.deepEqual(calls.pop(),['move','token','CoRL 2027']);
 const wrongRole=new Target();dropTarget(wrongRole,plugin,{scope:'submissions',category:'CoRL 2027'});const wrong=event([dragMime]);wrongRole.events.dragover(wrong);assert.equal(wrong.dataTransfer.dropEffect,'none');await wrongRole.events.drop(wrong);assert.equal(calls.length,0);
 plugin.snapshot={collections:[]};plugin.dragState={token:'token',scope:'library',from:{scope:'library',name:'A'}};
 plugin.moveDraggedPaper=async(token,category,scope,move)=>calls.push([scope,category,move]);
 const publicCopy=event([dragMime]);category.events.dragover(publicCopy);assert.equal(publicCopy.dataTransfer.dropEffect,'copy');await category.events.drop(publicCopy);assert.deepEqual(calls.pop(),['library','ML',false]);
 const publicMove=event([dragMime]);publicMove.metaKey=true;category.events.dragover(publicMove);assert.equal(publicMove.dataTransfer.dropEffect,'move');await category.events.drop(publicMove);assert.deepEqual(calls.pop(),['library','ML',true]);
 const project=new Target();dropTarget(project,plugin,{scope:'projects',category:'Work'});const intoProject=event([dragMime]);intoProject.metaKey=true;project.events.dragover(intoProject);assert.equal(intoProject.dataTransfer.dropEffect,'copy');await project.events.drop(intoProject);assert.deepEqual(calls.pop(),['projects','Work',false]);
 await category.events.drop(event(['Files'],[pdf]));assert.deepEqual(calls.pop(),['library','ML',pdf.name]);
 await project.events.drop(event(['Files'],[pdf]));assert.deepEqual(calls.pop(),['projects','Work',pdf.name]);
 const unfiled=new Target();dropTarget(unfiled,plugin,{scope:'library',category:'未分类'});const denied=event(['Files'],[pdf]);unfiled.events.dragover(denied);assert.equal(denied.dataTransfer.dropEffect,'none');
 const child=new Target();dropTarget(child,plugin,{scope:'library',category:'A',subgroup:'Methods'});
 plugin.moveDraggedPaper=async(...args)=>calls.push(args);const within=event([dragMime]);child.events.dragover(within);assert.equal(within.dataTransfer.dropEffect,'move');await child.events.drop(within);assert.deepEqual(calls.pop(),['token','A','library',true,'Methods']);
 const foreign=new Target();dropTarget(foreign,plugin,{scope:'library',category:'B',subgroup:'Methods'});const across=event([dragMime]);across.metaKey=true;foreign.events.dragover(across);assert.equal(across.dataTransfer.dropEffect,'move');await foreign.events.drop(across);assert.deepEqual(calls.pop(),['token','B','library',true,'Methods']);
 const acrossCopy=event([dragMime]);foreign.events.dragover(acrossCopy);assert.equal(acrossCopy.dataTransfer.dropEffect,'copy');await foreign.events.drop(acrossCopy);assert.deepEqual(calls.pop(),['token','B','library',false,'Methods']);
 plugin.importDroppedFiles=async(files,nav)=>calls.push(nav);await child.events.drop(event(['Files'],[pdf]));assert.equal(calls.pop().subgroup,'Methods');
 plugin.dragState.scope='reviews';project.events.dragover(event([dragMime]));assert(!project.classes.has('is-drop-target'));
 console.log('PASS: external PDF and internal row drop routing, copy/move effects, highlight cleanup, dirty-state rejection, wrong-target and URL refusal, error feedback.');
})().catch(error=>{console.error(error);process.exitCode=1;});
