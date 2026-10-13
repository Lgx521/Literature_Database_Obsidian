const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
class Element{
 constructor(options={}){this.children=[];this.events={};this.textContent=options.text||'';}
 createEl(tag,o){const e=new Element(o);e.tag=tag;this.children.push(e);return e;}createDiv(o){return this.createEl('div',o);}createSpan(o){return this.createEl('span',o);}
 addEventListener(n,f){this.events[n]=f;}setText(t){this.textContent=t;}empty(){this.children=[];}addClass(){}
 all(){return this.children.flatMap(e=>[e,...e.all()]);}querySelectorAll(){return this.all().filter(e=>['button','input','select','textarea'].includes(e.tag));}
}
const notices=[],modals=[];
class Modal{constructor(app){this.app=app;this.titleEl=new Element();this.contentEl=new Element();}open(){modals.push(this);return this.onOpen();}close(){this.closed=true;this.onClose();}}
class ItemView{constructor(){this.contentEl=new Element();}}
class Notice{constructor(text){this.text=text;notices.push(this);}hide(){this.hidden=true;}}
const ctx={module:{exports:{}},require:n=>n==='obsidian'?{Plugin:class{},ItemView,Modal,Notice,Platform:{isDesktopApp:true,isMacOS:true}}:require(n)};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+'\nmodule.exports.Browser=LiteratureBrowser;module.exports.TrashModal=TrashModal;module.exports.PurgeRecordModal=PurgeRecordModal;',ctx);
const tick=()=>new Promise(resolve=>setImmediate(resolve)),find=(modal,text)=>modal.contentEl.all().find(e=>e.tag==='button'&&e.textContent===text);
(async()=>{
 const manager=new ctx.module.exports(),view=new ctx.module.exports.Browser({},manager),one={path:'papers/One.pdf'},two={path:'papers/Two.pdf'};
 manager.app={workspace:{getLeavesOfType:()=>[{view}]}};view.scope='library';view.detailEl=new Element();const control=view.detailEl.createEl('button');
 view.rows=view.visibleRows=[one,two];view.selectedPaths=new Set([one.path,two.path]);let reloads=0;const locks=[];
 view.lockFilters=value=>locks.push(value);view.reload=async()=>{reloads++;};
 const removed=[];let release;manager.trashStore={remove:async(scope,row)=>{removed.push({scope,row});if(removed.length===1)await new Promise(resolve=>release=resolve);}};
 const deletion=view.requestDelete(one);assert.equal(removed.length,1);assert.equal(modals.length,0,'Recoverable delete starts without any modal.');assert(manager.recordBusy&&view.deleting&&view.dirty());assert(control.disabled);
 await view.requestDelete(one);assert.equal(removed.length,1,'Second click does not start another delete.');
 await assert.rejects(manager.deleteRecords('library',[two]),/等待当前操作/);release();await deletion;
 assert.equal(removed.length,2);assert(!manager.recordBusy&&!view.deleting);assert.deepEqual(locks,[true,false]);assert.equal(reloads,1);assert(notices.some(n=>n.text.includes('正在移至')&&n.hidden));assert(notices.some(n=>n.text==='已移至回收站 · 2 篇'));
 view.notesDirty=true;await view.requestDelete(one);assert.equal(removed.length,2);view.notesDirty=false;
 let attempts=0;manager.trashStore.remove=async()=>{attempts++;if(attempts===2)throw Error('模拟并发修改');};
 await view.requestDelete(one);assert.equal(attempts,2);assert(notices.some(n=>n.text.includes('已移入 1 篇，其余保留。模拟并发修改')));assert(!manager.recordBusy&&!view.deleting);assert.equal(reloads,2);
 // A single inbox/tracker item does not inherit a public multi-selection.
 view.scope='inbox';attempts=0;await view.requestDelete({path:'temp/Inbox.pdf'});assert.equal(attempts,1);
 // Purge requires the explicit irreversible action; opening or cancelling never deletes.
 const receipt={folder:'test-receipt',state:'deleted',scope:'library',row:{filename:'One.pdf',title:'Actual Title'}},purgePlugin={app:{},trashStore:{list:async()=>[receipt]}};
 let purges=0,done=0,finish;purgePlugin.runTrashBatch=async(action,rows)=>{assert.equal(action,'purge');assert.equal(rows[0],receipt);purges++;await new Promise(resolve=>finish=resolve);return {succeeded:[receipt.folder],failed:[]};};
 const trash=new ctx.module.exports.TrashModal(purgePlugin);await trash.onOpen();assert(find(trash,'恢复'));assert(find(trash,'彻底删除'));assert.equal(purges,0);
 await find(trash,'彻底删除').events.click();const cancelled=modals.at(-1);assert.equal(purges,0);assert(cancelled.contentEl.all().some(e=>e.textContent==='Actual Title'));await find(cancelled,'取消').events.click();assert(cancelled.closed);assert.equal(purges,0);
 const modal=new ctx.module.exports.PurgeRecordModal(purgePlugin,receipt,async()=>done++);modal.onOpen();const confirm=find(modal,'彻底删除'),cancel=find(modal,'取消');
 const pending=confirm.events.click();await tick();assert.equal(purges,1);assert(confirm.disabled&&cancel.disabled);finish();await pending;assert(modal.closed);assert.equal(done,1);
 purgePlugin.runTrashBatch=async()=>{throw Error('模拟删除失败');};const failure=new ctx.module.exports.PurgeRecordModal(purgePlugin,receipt,async()=>done++);failure.onOpen();await find(failure,'彻底删除').events.click();assert(!failure.closed);assert(!find(failure,'彻底删除').disabled);assert(failure.contentEl.all().some(e=>e.textContent==='模拟删除失败'));assert.equal(done,1);
 purgePlugin.trashStore.list=async()=>[{...receipt,state:'purge-failed'}];await trash.onOpen();assert(find(trash,'恢复').disabled);assert(!find(trash,'彻底删除').disabled);
 // Multi-selection is keyed by receipt, not filename. All/none and mixed state track it accurately.
 const a={...receipt,folder:'a'},b={...receipt,folder:'b'},c={...receipt,folder:'c'};
 let records=[a,b,c],calls=[],resume;
 const bulkPlugin=new ctx.module.exports();bulkPlugin.app={workspace:{getLeavesOfType:()=>[]}};
 bulkPlugin.trashStore={list:async()=>records,restore:async(folder,expected)=>{
   assert(bulkPlugin.recordBusy,'Lock covers each item, including after earlier refreshes.');assert.equal(folder,expected.folder);calls.push(folder);
   if(folder==='a')await new Promise(resolve=>resume=resolve);
   if(folder==='b')throw Error('同名附件保留');records=records.filter(r=>r.folder!==folder);
 }};
 const bulk=new ctx.module.exports.TrashModal(bulkPlugin);await bulk.onOpen();assert(bulk.restoreSelected.disabled&&bulk.purgeSelected.disabled);
 const select=folder=>{const checkbox=bulk.rowControls.get(folder).checkbox;checkbox.checked=!checkbox.checked;checkbox.events.change();};
 select('a');assert.equal(bulk.selected.size,1);assert(bulk.allBox.indeterminate&&!bulk.allBox.checked);
 select('b');assert.equal(bulk.selected.size,2,'Same filename can select two different deleted copies.');
 bulk.allBox.checked=true;bulk.allBox.events.change();assert.equal(bulk.selected.size,3);assert(bulk.allBox.checked&&!bulk.allBox.indeterminate);
 bulk.allBox.checked=false;bulk.allBox.events.change();assert.equal(bulk.selected.size,0);assert(bulk.restoreSelected.disabled);
 bulk.allBox.checked=true;bulk.allBox.events.change();
 const modalCount=modals.length,restoreBatch=bulk.restoreSelected.events.click();await tick();
 assert.equal(modals.length,modalCount,'Batch restore does not show a confirmation.');assert(bulk.busy&&bulkPlugin.recordBusy);assert(bulk.allBox.disabled&&bulk.purgeSelected.disabled);assert([...bulk.rowControls.values()].every(v=>v.checkbox.disabled&&v.restore.disabled&&v.purge.disabled));
 await bulk.restoreRows([a]);assert.deepEqual(calls,['a'],'Repeated clicks cannot interleave with a batch.');
 await assert.rejects(bulkPlugin.runTrashBatch('purge',[c]),/等待当前操作/);resume();await restoreBatch;
 assert.deepEqual(calls,['a','b','c'],'A failed item does not prevent later selected items from being processed.');
 assert(!bulk.busy&&!bulkPlugin.recordBusy);assert.equal(bulk.records.length,1);assert.deepEqual([...bulk.selected],['b']);assert.equal(bulk.message,'已恢复 2 项，1 项未完成');assert.equal(bulk.failures[0].error,'同名附件保留');assert(!bulk.restoreSelected.disabled);
 // One confirmation fixes the selected receipts; files added later are never swept into the batch.
 records=[a,b,c];await bulk.render();bulk.allBox.checked=true;bulk.allBox.events.change();
 calls=[];const progress=[];bulkPlugin.trashStore.purge=async(folder,expected)=>{assert(bulkPlugin.recordBusy);assert.equal(expected.folder,folder);calls.push(folder);records=records.filter(r=>r.folder!==folder);};
 await bulk.purgeSelected.events.click();assert.equal(modals.length,modalCount+1);assert.equal(calls.length,0);
 const confirmation=modals.at(-1),late={...receipt,folder:'late'};records.push(late);assert.equal(confirmation.receipts.length,3);
 await find(confirmation,'彻底删除').events.click();assert.deepEqual(calls,['a','b','c']);assert.equal(bulk.records.length,1);assert.equal(bulk.records[0].folder,'late');assert.equal(bulk.selected.size,0);assert(bulk.restoreSelected.disabled&&bulk.purgeSelected.disabled);
 calls=[];const duplicateResult=await bulkPlugin.runTrashBatch('purge',[late,late],(done,total)=>progress.push([done,total]));assert.deepEqual(calls,['late']);assert.equal(duplicateResult.succeeded.length,1);assert.deepEqual(progress,[[0,1],[1,1]]);
 await bulk.render();assert.equal(bulk.records.length,0);assert(bulk.allBox.disabled&&bulk.restoreSelected.disabled&&bulk.purgeSelected.disabled);
 await assert.rejects(bulkPlugin.runTrashBatch('unknown',[a]),/无效/);
 console.log('PASS: immediate recoverable delete, real manager lock ordering, duplicate-click guard, multi-selection, draft preservation, partial failure feedback, busy reset, inbox scope, explicit purge confirmation/cancel, retry and restore disabling.');
 console.log('PASS: trash multi-selection, distinct same-name receipts, select all/none/mixed, batch locking/progress/deduplication, failure continuation and reselection, single batch confirmation, fixed selection snapshot and empty state.');
})().catch(e=>{console.error(e);process.exitCode=1;});
