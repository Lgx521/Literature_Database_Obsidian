const assert=require('node:assert/strict');
const {RENAMES,migrateVault,canonicalPath}=require('./storage-migration');
const I=require('./i18n');
function fixture(){
  const content=new Map(Object.keys(RENAMES).map((name,i)=>[name,'USER CONTENT '+i+'\r\nNotes | 个人笔记\r\n']));
  const files=new Map([...content.keys()].map(path=>[path,{path}])),backups=new Map(),renamed=[];
  const vault={
    getAbstractFileByPath:path=>files.get(path),read:async file=>content.get(file.path),
    adapter:{exists:async()=>false,mkdir:async()=>{},write:async(path,text)=>{backups.set(path,text);vault.afterBackup?.();}},
    rename:async(file,to)=>{vault.beforeRename?.(file,to);assert(!files.has(to));const from=file.path;files.delete(from);files.set(to,file);content.set(to,content.get(from));content.delete(from);file.path=to;renamed.push([from,to]);}
  };
  return {vault,content,files,backups,renamed};
}
(async()=>{
  const f=fixture(),before=new Map(f.content);
  assert.equal((await migrateVault(f.vault)).length,4);
  for(const [old,name]of Object.entries(RENAMES)){assert.equal(f.content.get(name),before.get(old));assert(!f.content.has(old));assert([...f.backups.entries()].some(([p,text])=>p.endsWith('/'+name)&&text===before.get(old)));assert.equal(canonicalPath(old),name);}
  assert.deepEqual(await migrateVault(f.vault),[]);assert.equal(f.renamed.length,4);
  // Already-renamed files coexist with legacy files from a partial sync, with no duplicate.
  const partial=fixture();await partial.vault.rename(partial.files.get('文献库.md'),'library.md');assert.equal((await migrateVault(partial.vault)).length,3);
  const collision=fixture();collision.files.set('library.md',{path:'library.md'});collision.content.set('library.md','OTHER DEVICE');
  await assert.rejects(migrateVault(collision.vault),/同时存在/);assert.equal(collision.renamed.length,0);assert.equal(collision.content.get('library.md'),'OTHER DEVICE');
  const race=fixture();race.vault.afterBackup=()=>race.content.set('集合.md','EXTERNAL EDIT');
  await assert.rejects(migrateVault(race.vault),/迁移期间文件发生变化/);assert.equal(race.renamed.length,0);assert.equal(race.content.get('集合.md'),'EXTERNAL EDIT');
  const failure=fixture();failure.vault.beforeRename=(f,to)=>{if(to==='reviews.md')throw new Error('DISK FAILURE');};
  await assert.rejects(migrateVault(failure.vault),/DISK FAILURE/);assert.deepEqual(failure.content,new Map(before));
  // A concurrent edit at the renamed path is preserved, never overwritten by rollback.
  const edited=fixture();edited.vault.beforeRename=(f,to)=>{if(to==='reviews.md'){edited.content.set('library.md','NEW NOTES');throw new Error('STOP');}};
  await assert.rejects(migrateVault(edited.vault),/STOP/);assert.equal(edited.content.get('library.md'),'NEW NOTES');assert(!edited.content.has('文献库.md'));
  I.setLanguage('en');await assert.rejects(migrateVault(collision.vault),/Both legacy and English files exist/);I.setLanguage('zh');
  console.log('PASS: English filename migration preserves bytes, backs up, resumes safely, rejects collisions/concurrency and rolls back without overwriting edits.');
})().catch(e=>{console.error(e);process.exitCode=1;});
