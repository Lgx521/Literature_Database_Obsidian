const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),os=require('node:os');
const E=require('./dashboard'),{RecordTrash}=require('./record-trash');
const vm=require('node:vm'),context={module:{exports:{}},require:n=>n==='obsidian'?{Plugin:class{},ItemView:class{},Modal:class{}}:require(n)};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8'),context);
const table='| '+E.NOTES_HEADERS.join(' | ')+' |\n| '+E.NOTES_HEADERS.map(()=> '---').join(' | ')+' |\n';
const library='USER HEADER\n'+['Robotics Policies', 'Agentic/RSI', 'ML', '3DV', 'Generative'].map((c,i)=>`## ${c}\n\n`+table+(i===0?'| [Paper.pdf](papers/Paper.pdf) | 2026.10 | #research/vla | Human summary | 在读 | 高 | Personal<br>notes &#124; &#91;x&#93; |\n':'')).join('\n')+'\n<!-- library:end -->\nUSER FOOTER';
const empty='## 待确定 venue\n\n| '+E.TRACKING_HEADERS.join(' | ')+' |\n| '+E.TRACKING_HEADERS.map(()=> '---').join(' | ')+' |\n\n<!-- tracking:end -->\nUSER FOOTER';
const original=E.parseLibrary(library)[0],removed=E.removeRecord(library,'library',original);
assert.equal(E.parseLibrary(removed).length,0);assert(removed.includes('USER FOOTER'));
assert.deepEqual(E.parseLibrary(E.restoreRecord(removed,'library',original))[0].cells,original.cells);
assert.throws(()=>E.removeRecord(E.updateLibraryEntry(library,original,{notes:'new user note'}),'library',original),/修改/);
assert.throws(()=>E.restoreRecord(library,'library',original),/已存在/);
const venue=E.addTrackerGroup(empty,'审稿','CoRL 2027');assert(E.trackerGroups(venue).includes('CoRL 2027'));assert.equal(E.parseTracker(venue,'审稿').length,0);
assert.throws(()=>E.addTrackerGroup(venue,'审稿','corl 2027'),/已存在/);
assert.equal(E.composeDeadline('2026-11-01','23:59','-12:00'),'2026-11-01 23:59 -12:00');
assert.equal(E.deadline('2026-11-01 23:59 -12:00'),Date.parse('2026-11-02T11:59:00Z'));
assert.equal(E.displayDeadline('2026-11-01 23:59 -12:00'),'2026-11-01 23:59 AoE');
assert.deepEqual(E.deadlineParts('2028-02-29 12:30 +05:45'),{date:'2028-02-29',time:'12:30',zone:'+05:45'});
assert.equal(E.composeDeadline('','23:59',''),'—');assert.throws(()=>E.composeDeadline('2026-10-12','23:59',''),/时区/);
for(const value of ['2026-02-29 23:59 +08:00','2026-04-31 23:59 +08:00','2026-10-12 24:00 +08:00','2026-10-12 20:00 +14:01','2026-10-12 20:00 -12:30'])assert.throws(()=>E.deadline(value));
(async()=>{
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'literature-record-test-'));
 const absolute=p=>path.join(root,p);let failMove=false,failPurge=false;
 const adapter={
  exists:async p=>fs.existsSync(absolute(p)),mkdir:async p=>fsp.mkdir(absolute(p)),read:async p=>fsp.readFile(absolute(p),'utf8'),write:async(p,t)=>fsp.writeFile(absolute(p),t),
  stat:async p=>{try{const s=await fsp.stat(absolute(p));return {mtime:s.mtimeMs,size:s.size};}catch(e){if(e.code==='ENOENT')return null;throw e;}},
  list:async p=>{const entries=await fsp.readdir(absolute(p),{withFileTypes:true});return {files:entries.filter(e=>e.isFile()).map(e=>p+'/'+e.name),folders:entries.filter(e=>e.isDirectory()).map(e=>p+'/'+e.name)};},
  rename:async(a,b)=>{if(failMove&&a==='papers/Paper.skim'){failMove=false;throw new Error('injected move failure');}if(fs.existsSync(absolute(b)))throw new Error('exists');return fsp.rename(absolute(a),absolute(b));}
 };
 adapter.remove=async p=>{if(failPurge&&p.endsWith('.xfdf')){failPurge=false;throw new Error('injected purge failure');}return fsp.unlink(absolute(p));};
 adapter.rmdir=async(p,recursive)=>{assert.equal(recursive,false);return fsp.rmdir(absolute(p));};
 const manager={app:{vault:{adapter,getAbstractFileByPath:p=>({path:p}),read:f=>adapter.read(f.path)}},mutate:async(p,fn)=>adapter.write(p,fn(await adapter.read(p))),refresh:async()=>{},forgetTrashedMembership:async()=>{}};
 const trash=new RecordTrash(manager,E);
 manager.trashStore=trash;manager.recordAction=async action=>action();manager.runTrashBatch=context.module.exports.prototype.runTrashBatch;
 try{
  for(const dir of ['papers','reviews','temp'])await fsp.mkdir(absolute(dir));
  await adapter.write('library.md',library);await adapter.write('reviews.md',empty);await adapter.write('submissions.md',empty);
  await adapter.write('papers/Paper.pdf','PDF');await adapter.write('papers/Paper.skim','annotations');
  await assert.rejects(trash.remove('library',original,async()=>{throw Error('Membership changed during archive preparation');}),/Membership changed/);
  assert.equal(await adapter.read('library.md'),library);assert.equal(await adapter.read('papers/Paper.skim'),'annotations');assert.equal((await trash.list()).length,0);
  const deleted=await trash.remove('library',original);assert.equal((await trash.list()).length,1);assert(!await adapter.exists('papers/Paper.pdf'));assert(!await adapter.exists('papers/Paper.skim'));
  assert.equal(E.parseLibrary(await adapter.read('library.md')).length,0);
  await adapter.write('papers/Paper.pdf','new concurrent file');await assert.rejects(trash.restore(deleted.folder),/同名/);assert.equal(await adapter.read('papers/Paper.pdf'),'new concurrent file');await fsp.unlink(absolute('papers/Paper.pdf'));
  await trash.restore(deleted.folder);assert.equal(await adapter.read('papers/Paper.skim'),'annotations');assert.deepEqual(E.parseLibrary(await adapter.read('library.md'))[0].cells,original.cells);assert.equal((await trash.list()).length,0);
  // Partial attachment failure rolls back the PDF move and restores the row.
  failMove=true;await assert.rejects(trash.remove('library',E.parseLibrary(await adapter.read('library.md'))[0]),/删除未完成/);
  assert.equal(await adapter.read('papers/Paper.pdf'),'PDF');assert.equal(await adapter.read('papers/Paper.skim'),'annotations');assert.equal(E.parseLibrary(await adapter.read('library.md')).length,1);
  // Shared review attachments remain active until the last reference is removed.
  const reviewValues={title:'Shared',pdfPath:'reviews/Shared.pdf',category:'CoRL 2027',status:'待审',due:'—',next:'Read',notes:'private notes'};
  let reviews=E.updateTracker(empty,'审稿',null,reviewValues);reviews=E.updateTracker(reviews,'审稿',null,{...reviewValues,category:'CoRL 2027 / R2'});
  await adapter.write('reviews.md',reviews);await adapter.write('reviews/Shared.pdf','private PDF');await adapter.write('reviews/Shared.skim','private annotations');
  const shared=await trash.remove('reviews',E.parseTracker(reviews,'审稿')[0]);assert.equal(shared.files.length,0);assert(await adapter.exists('reviews/Shared.pdf'));await trash.restore(shared.folder);
  assert.equal(E.parseTracker(await adapter.read('reviews.md'),'审稿').length,2);
  // Inbox deletion and restoration preserve sidecars without adding source-table rows.
  await adapter.write('temp/Inbox.pdf','inbox');await adapter.write('temp/Inbox.xfdf','notes');const stat=await adapter.stat('temp/Inbox.pdf');
  const inbox=await trash.remove('inbox',{path:'temp/Inbox.pdf',filename:'Inbox.pdf',fileMtime:stat.mtime,fileSize:stat.size});assert(!await adapter.exists('temp/Inbox.pdf'));await trash.restore(inbox.folder);assert.equal(await adapter.read('temp/Inbox.xfdf'),'notes');
  await assert.rejects(trash.read('../../etc'),/无效/);
  // Permanent deletion is restricted to this receipt, never active or shared attachments.
  const permanent=await trash.remove('library',E.parseLibrary(await adapter.read('library.md'))[0]);
  await assert.rejects(trash.purge(permanent.folder,{...permanent,row:{...permanent.row,filename:'changed.pdf'}}),/重新确认/);
  assert(await adapter.exists(permanent.files[0].to));
  await adapter.write(permanent.folder+'/files/unexpected.txt','do not touch');await assert.rejects(trash.purge(permanent.folder,permanent),/发生变化/);assert(await adapter.exists(permanent.folder+'/files/unexpected.txt'));await fsp.unlink(absolute(permanent.folder+'/files/unexpected.txt'));
  await adapter.write('papers/Paper.pdf','new active copy');await trash.purge(permanent.folder,permanent);
  assert(!await adapter.exists(permanent.folder));assert.equal(await adapter.read('papers/Paper.pdf'),'new active copy');assert(!await adapter.exists(permanent.files[0].to));
  const secondShared=await trash.remove('reviews',E.parseTracker(await adapter.read('reviews.md'),'审稿')[0]);assert.equal(secondShared.files.length,0);await trash.purge(secondShared.folder,secondShared);assert.equal(await adapter.read('reviews/Shared.pdf'),'private PDF');assert.equal(await adapter.read('reviews/Shared.skim'),'private annotations');
  await assert.rejects(trash.purge(inbox.folder,inbox),/已恢复/);
  const current=await adapter.stat('temp/Inbox.pdf'),partial=await trash.remove('inbox',{path:'temp/Inbox.pdf',filename:'Inbox.pdf',fileMtime:current.mtime,fileSize:current.size});
  failPurge=true;await assert.rejects(trash.purge(partial.folder,partial),/未完成/);
  assert.equal((await trash.read(partial.folder)).state,'purge-failed');assert((await trash.list()).some(r=>r.folder===partial.folder));await assert.rejects(trash.restore(partial.folder),/不能再恢复/);
  await trash.purge(partial.folder,partial);assert(!await adapter.exists(partial.folder));
  // Batch restore preserves the first copy when two receipts restore to the same path, then continues.
  const makeInbox=async(name,content)=>{
    await adapter.write('temp/'+name+'.pdf',content);await adapter.write('temp/'+name+'.skim',content+' notes');
    return trash.remove('inbox',{path:'temp/'+name+'.pdf',filename:name+'.pdf'});
  };
  const batchA=await makeInbox('Batch','first'),batchB=await makeInbox('Batch','second'),batchC=await makeInbox('Other','third');
  await assert.rejects(trash.restore(batchA.folder,{...batchA,row:{...batchA.row,filename:'Changed.pdf'}}),/重新选择/);
  const restoredBatch=await manager.runTrashBatch('restore',[batchA,batchB,batchC]);
  assert.equal(restoredBatch.succeeded.length,2);assert.equal(restoredBatch.failed.length,1);assert.equal(restoredBatch.failed[0].receipt.folder,batchB.folder);
  assert.equal(await adapter.read('temp/Batch.pdf'),'first');assert.equal(await adapter.read('temp/Batch.skim'),'first notes');assert.equal(await adapter.read('temp/Other.skim'),'third notes');
  assert.equal(await adapter.read(batchB.files.find(f=>f.to.endsWith('.pdf')).to),'second');
  const purgedBatch=await manager.runTrashBatch('purge',[batchB]);assert.equal(purgedBatch.succeeded.length,1);assert(!await adapter.exists(batchB.folder));assert.equal(await adapter.read('temp/Batch.pdf'),'first');
  // A partial purge failure keeps its receipt retryable and does not stop the next selected receipt.
  const batchD=await makeInbox('Partial','partial');await adapter.write(batchD.folder+'/files/Partial.xfdf','annotation');
  batchD.files.push({from:'temp/Partial.xfdf',to:batchD.folder+'/files/Partial.xfdf'});await trash.save(batchD);
  const batchE=await makeInbox('Success','success');failPurge=true;
  const failedBatch=await manager.runTrashBatch('purge',[batchD,batchE]);assert.equal(failedBatch.failed.length,1);assert.equal(failedBatch.succeeded.length,1);
  assert.equal((await trash.read(batchD.folder)).state,'purge-failed');assert(!await adapter.exists(batchE.folder));
  const retryBatch=await manager.runTrashBatch('purge',[failedBatch.failed[0].receipt]);assert.equal(retryBatch.succeeded.length,1);assert(!await adapter.exists(batchD.folder));
  console.log('PASS: record/Notes restoration, stale-delete refusal, venue creation, AoE and leap-date validation, recoverable file groups, restore collision refusal, partial failure rollback, shared attachments and inbox recovery.');
  console.log('PASS: permanent purge, confirmation identity, unknown-file refusal, active/shared attachment retention, restored receipt refusal, visible partial failures and retry.');
  console.log('PASS: batch file restoration, same-name collision preservation, continued processing, stale restore refusal, archived-only purge and partial batch purge retry.');
 }finally{await fsp.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
