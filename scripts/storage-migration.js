'use strict';
const {t:tr}=require('./i18n');
const RENAMES=Object.freeze({'文献库.md':'library.md','集合.md':'collections.md','审稿.md':'reviews.md','投稿.md':'submissions.md'});
const canonicalPath=path=>RENAMES[path]||path;
// Rename only source tables. Their bytes, PDF paths and historical trash receipts stay intact.
async function migrateVault(vault){
  const plans=[];
  for(const [from,to] of Object.entries(RENAMES)){
    const file=vault.getAbstractFileByPath(from),target=vault.getAbstractFileByPath(to);
    if(file&&target)throw new Error(tr`同时存在旧文件和英文文件，未覆盖：${from} / ${to}`);
    if(file)plans.push({from,to,file,before:await vault.read(file)});
  }
  if(!plans.length)return [];
  const root='.maintenance-backups';
  if(!await vault.adapter.exists(root))await vault.adapter.mkdir(root);
  const folder=root+'/english-filenames-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+Math.random().toString(36).slice(2,8);
  await vault.adapter.mkdir(folder);
  for(const plan of plans)await vault.adapter.write(folder+'/'+plan.to,plan.before);
  const completed=[];
  try{
    // Preflight every file before the first rename; check again just before each operation.
    const check=async plan=>{
      if(vault.getAbstractFileByPath(plan.from)!==plan.file||vault.getAbstractFileByPath(plan.to)||await vault.read(plan.file)!==plan.before)
        throw new Error(tr`迁移期间文件发生变化，已停止：${plan.from}`);
    };
    for(const plan of plans)await check(plan);
    for(const plan of plans){await check(plan);await vault.rename(plan.file,plan.to);completed.push(plan);}
    return completed.map(({from,to})=>({from,to}));
  }catch(error){
    // Never roll back over another window/device's new file or edit.
    for(const plan of completed.reverse()){
      try{if(!vault.getAbstractFileByPath(plan.from)&&vault.getAbstractFileByPath(plan.to)===plan.file&&await vault.read(plan.file)===plan.before)await vault.rename(plan.file,plan.from);}catch(_){}
    }
    throw new Error(tr`文件名迁移未完成，请检查备份后重试：${error.message}`+' ('+folder+')');
  }
}
module.exports={RENAMES,canonicalPath,migrateVault};
