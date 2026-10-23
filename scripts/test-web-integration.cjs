'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const E=require('./dashboard'),C=require('./collections');
class TFile{constructor(path){this.path=path;}}
const store=new Map(['library.md','collections.md','reviews.md','submissions.md'].map(n=>[n,fs.readFileSync('templates/empty-vault/'+n,'utf8')]));
store.set('collections.md',C.add(C.add(store.get('collections.md'),'library','Research'),'projects','Writing'));
const files=new Map([...store.keys()].map(n=>[n,new TFile(n)])),folders=new Set(['temp','.maintenance-backups']);
let fail=false;const notices=[],opened=[],navigations=[],forbidden=[];
const adapter={
 exists:async p=>store.has(p)||folders.has(p),mkdir:async p=>folders.add(p),
 read:async p=>store.get(p),write:async(p,t)=>store.set(p,t),
 list:async p=>({files:[...store.keys()].filter(x=>x.startsWith(p+'/')&&!x.slice(p.length+1).includes('/')),folders:[...folders].filter(x=>x.startsWith(p+'/')&&!x.slice(p.length+1).includes('/'))}),
 remove:async p=>store.delete(p),rmdir:async p=>folders.delete(p),
 stat:async p=>{forbidden.push('stat '+p);throw Error('No web attachment IO');},
 rename:async()=>{throw Error('No web attachment IO');}
};
const vault={adapter,getAbstractFileByPath:p=>p==='temp'?{children:[]}:files.get(p),getFiles(){throw Error('No vault enumeration');},read:async f=>store.get(f.path),process:async(f,fn)=>{if(fail&&f.path==='collections.md')throw Error('Injected collection write failure');store.set(f.path,fn(store.get(f.path)));}};
const workspace={getLeavesOfType:()=>[]},platform={isDesktopApp:true,isMacOS:true};
const ctx={module:{exports:{}},URL,crypto,console,setTimeout,clearTimeout,window:{open:(url,...args)=>opened.push({url,args})},require:n=>n==='obsidian'?{Plugin:class{},TFile,ItemView:class{},Modal:class{},Platform:platform,Notice:class{constructor(t){notices.push(t);}}}:n==='electron'?{shell:{openExternal:async url=>opened.push({url})},clipboard:{readText:()=> 'https://paste.test/post'}}:(forbidden.push(n),require(n))};
vm.runInNewContext(fs.readFileSync('main.js','utf8')+'\nmodule.exports.deepseekBatch=DeepSeekBetaModal.prototype.batch;module.exports.deepseekNeedsPlan=DeepSeekBetaModal.prototype.needsPlan;',ctx);
(async()=>{
 const p=new ctx.module.exports();p.app={vault,workspace};p.openLibrary=async nav=>navigations.push(nav);p.renderNavigation=()=>{};
 await p.refresh();await p.importWebLinks([{url:'https://example.test/post',title:'A blog'}]);
 let row=p.snapshot.inbox[0];assert.equal(row.kind,'web');assert.equal(p.snapshot.library.length,1);assert.equal(p.snapshot.filedLibrary.length,0);
 assert.equal(navigations.at(-1).scope,'inbox');assert.equal(navigations.at(-1).revealPaths[0],row.path);
 const transfer={setData(){},effectAllowed:''};assert(p.beginPaperDrag({dataTransfer:transfer},row,'inbox'));assert.equal(transfer.effectAllowed,'copyMove');p.endPaperDrag();
 assert.equal((await p.ensureCitationRows([row]))[0].path,row.path,'Citation export leaves web resources untouched');
 await p.openPDF(row.path);assert.equal(opened[0].url,'https://example.test/post');
 platform.isMobile=true;platform.isDesktopApp=false;await p.openPDF(row.path);assert.equal(opened.length,2);assert.equal(opened[1].args[1],'noopener,noreferrer');platform.isMobile=false;platform.isDesktopApp=true;
 const original=store.get('library.md');fail=true;
 await assert.rejects(p.changeMembership([row],{scope:'library',name:'Research'}),/Injected/);fail=false;
 assert.equal(store.get('library.md'),original,'Failed paired write must restore Inbox flag');
 await p.changeMembership([row],{scope:'library',name:'Research'});
 assert.equal(p.snapshot.inbox.length,0);row=p.snapshot.library[0];assert.equal(row.inbox,false);assert.equal(p.snapshot.filedLibrary.length,1);
 await p.importWebLinks([{url:row.url}],{scope:'projects',category:'Writing'});assert.equal(p.snapshot.library.length,1);assert.deepEqual([...p.snapshot.library[0].projects],['Writing']);
 await p.pasteInboxFiles();assert.equal(p.snapshot.inbox.length,1);
 const batch=ctx.module.exports.deepseekBatch.call({plugin:p,paths:[row.path,'papers/Test.pdf'],mode:{value:'selection'}},'selection');
 assert.deepEqual([...batch],[row.path,'papers/Test.pdf'],'Selected public web links enter AI organization');
 const modal={plugin:p,paths:[p.snapshot.inbox[0].path],mode:{value:'selection'},batch:ctx.module.exports.deepseekBatch};
 assert(ctx.module.exports.deepseekNeedsPlan.call(modal),'Selecting Inbox web links requires taxonomy planning');
 modal.paths=[row.path];modal.batchCache=null;
 assert(!ctx.module.exports.deepseekNeedsPlan.call(modal),'Filed web links use ordinary enrichment');
 const {RecordTrash}=require('./record-trash');p.trashStore=new RecordTrash(p,E);
 const receipt=await p.trashStore.remove('library',p.snapshot.library.find(r=>r.path===row.path));assert.deepEqual(receipt.files,[]);assert(!p.snapshot.library.some(r=>r.path===row.path));
 await p.trashStore.restore(receipt.folder);assert(p.snapshot.library.some(r=>r.path===row.path));assert.equal(p.snapshot.collections[0].members[0].path,row.path);
 const inboxRow=p.snapshot.inbox[0],inboxReceipt=await p.trashStore.remove('inbox',inboxRow);assert.equal(inboxReceipt.scope,'library');assert.equal(p.snapshot.inbox.length,0);
 await p.trashStore.restore(inboxReceipt.folder);assert.equal(p.snapshot.inbox.length,1);
 const purged=await p.trashStore.remove('library',p.snapshot.library.find(r=>r.path===row.path));
 await p.trashStore.purge(purged.folder,purged);assert(p.snapshot.collections.every(g=>g.members.every(m=>m.path!==row.path)));
 assert.equal(forbidden.length,0,'No PDF IO, filesystem modules or network dependencies');
 await assert.rejects(p.importWebLinks([{url:'https://private.test'}],{scope:'reviews'}),/网页/);
 p.onunload();console.log('PASS: production web intake, snapshot cache, desktop/mobile Open, paired rollback, deduplication, paste, web AI selection, attachment-free trash/restore/purge and private-manuscript isolation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
