// Recoverable deletions live under maintenance backups, never in the active tables.
const TRASH_ROOT='.maintenance-backups/deleted';
const SOURCES={library:'文献库.md',reviews:'审稿.md',submissions:'投稿.md'};
class RecordTrash {
  constructor(manager,engine){this.manager=manager;this.engine=engine;this.adapter=manager.app.vault.adapter;}
  async mkdir(path){let current='';for(const bit of path.split('/')){current+=(current?'/':'')+bit;if(!await this.adapter.exists(current))await this.adapter.mkdir(current);}}
  async readSource(scope){const file=this.manager.app.vault.getAbstractFileByPath(SOURCES[scope]);if(!file)throw new Error('源表尚未同步');return this.manager.app.vault.read(file);}
  validPath(scope,path){
    const prefix={library:'papers/',inbox:'temp/',reviews:'reviews/',submissions:'submissions/'}[scope];
    return !!prefix&&path.startsWith(prefix)&&!path.includes('\\')&&!path.split('/').some(s=>!s||s==='.'||s==='..')&&/\.pdf$/i.test(path);
  }
  async referenced(path){
    for(const scope of Object.keys(SOURCES)){
      const text=await this.readSource(scope),rows=scope==='library'?this.engine.parseLibrary(text):this.engine.parseTracker(text,SOURCES[scope]);
      if(rows.some(r=>(scope==='library'?r.path:r.pdfPath)===path))return true;
    }
    return false;
  }
  async save(receipt){await this.adapter.write(receipt.folder+'/record.json',JSON.stringify(receipt,null,2));}
  async read(folder){
    if(!new RegExp('^'+TRASH_ROOT+'/[a-zA-Z0-9-]+$').test(folder))throw new Error('无效回收记录');
    const receipt=JSON.parse(await this.adapter.read(folder+'/record.json'));
    if(receipt.folder!==folder||!['library','inbox','reviews','submissions'].includes(receipt.scope)||!Array.isArray(receipt.files))throw new Error('回收记录不完整');
    const pdf=receipt.scope==='library'||receipt.scope==='inbox'?receipt.row.path:receipt.row.pdfPath;
    if(pdf&&!this.validPath(receipt.scope,pdf))throw new Error('无效附件路径');
    for(const f of receipt.files){
      if(!pdf||f.from.replace(/\.(pdf|skim|fdf|xfdf)$/i,'')!==pdf.slice(0,-4)||! /\.(pdf|skim|fdf|xfdf)$/i.test(f.from)||f.to!==folder+'/files/'+f.from.split('/').pop())throw new Error('无效回收附件');
    }
    return receipt;
  }
  async list(){
    if(!await this.adapter.exists(TRASH_ROOT))return [];
    const result=[];
    for(const folder of (await this.adapter.list(TRASH_ROOT)).folders){
      try{const r=await this.read(folder);if(['deleted','pending','failed','purging','purge-failed'].includes(r.state))result.push(r);}catch(_){}
    }
    return result.sort((a,b)=>b.deletedAt.localeCompare(a.deletedAt));
  }
  restoreText(text,receipt){
    const {scope,row}=receipt,rows=scope==='library'?this.engine.parseLibrary(text):this.engine.parseTracker(text,SOURCES[scope]);
    if(rows.some(r=>r.category===row.category&&(scope==='library'?JSON.stringify(r.cells)===JSON.stringify(row.cells):this.engine.sameTrackerContent(r.cells,row.cells))))return text;
    return this.engine.restoreRecord(text,scope,row);
  }
  async remove(scope,row){
    if(scope!=='inbox')this.engine.removeRecord(await this.readSource(scope),scope,row);
    const pdf=scope==='library'||scope==='inbox'?row.path:row.pdfPath;
    if(pdf&&!this.validPath(scope,pdf))throw new Error('无效附件路径');
    const folder=TRASH_ROOT+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,10);
    const receipt={folder,scope,row,deletedAt:new Date().toISOString(),state:'pending',files:[]};
    if(pdf){
      const parent=pdf.slice(0,pdf.lastIndexOf('/')),stem=pdf.slice(0,-4);
      if(await this.adapter.exists(parent))for(const from of (await this.adapter.list(parent)).files){
        if(from.replace(/\.(pdf|skim|fdf|xfdf)$/i,'')===stem&&/\.(pdf|skim|fdf|xfdf)$/i.test(from))receipt.files.push({from,to:folder+'/files/'+from.split('/').pop(),stat:await this.adapter.stat(from)});
      }
      if(scope==='inbox'){
        const current=await this.adapter.stat(pdf);if(!current)throw new Error('文件已移走，请刷新');
        if(row.fileMtime!==undefined&&(current.mtime!==row.fileMtime||current.size!==row.fileSize))throw new Error('文件已修改，请刷新后重试');
      }
    }
    await this.mkdir(folder+'/files');await this.save(receipt);let removed=false;
    try{
      if(scope!=='inbox'){await this.manager.mutate(SOURCES[scope],t=>this.engine.removeRecord(t,scope,row));removed=true;}
      if(pdf&&await this.referenced(pdf)){receipt.files=[];await this.save(receipt);}
      for(const f of receipt.files){
        const now=await this.adapter.stat(f.from);
        if(!now||now.mtime!==f.stat.mtime||now.size!==f.stat.size)throw new Error('附件已修改，删除已停止');
        await this.adapter.rename(f.from,f.to);
      }
      receipt.state='deleted';await this.save(receipt);await this.manager.refresh();return receipt;
    }catch(error){
      try{
        await this.restoreFiles(receipt);
        if(removed)await this.manager.mutate(SOURCES[scope],t=>this.restoreText(t,receipt));
        receipt.state='cancelled';await this.save(receipt);
      }catch(recovery){receipt.state='failed';receipt.error=recovery.message;await this.save(receipt).catch(()=>{});}
      await this.manager.refresh();throw new Error('删除未完成：'+error.message+(receipt.state==='failed'?'；请在回收站恢复':'；原记录已保留'));
    }
  }
  async restoreFiles(receipt){
    const available=[];
    for(const f of receipt.files)if(await this.adapter.exists(f.to)){
      if(await this.adapter.exists(f.from))throw new Error('原位置已有同名附件，未覆盖：'+f.from.split('/').pop());available.push(f);
    }
    const restored=[];
    try{
      for(const f of available){await this.mkdir(f.from.slice(0,f.from.lastIndexOf('/')));await this.adapter.rename(f.to,f.from);restored.push(f);}
    }catch(error){for(const f of restored.reverse())await this.adapter.rename(f.from,f.to);throw error;}
    return restored;
  }
  identity(receipt){return JSON.stringify([receipt.folder,receipt.scope,receipt.row,receipt.files,receipt.deletedAt]);}
  async restore(folder,expected){
    const receipt=await this.read(folder);if(receipt.state==='restored'||receipt.state==='cancelled')throw new Error('该记录已恢复');
    if(expected&&this.identity(receipt)!==this.identity(expected))throw new Error('回收记录已被修改，请重新选择');
    if(!['deleted','pending','failed'].includes(receipt.state))throw new Error('彻底删除已开始，不能再恢复此记录');
    if(receipt.scope!=='inbox')this.restoreText(await this.readSource(receipt.scope),receipt);
    for(const f of receipt.files)if(!await this.adapter.exists(f.to)&&!await this.adapter.exists(f.from))throw new Error('附件尚未同步完整，请稍后恢复');
    const restored=await this.restoreFiles(receipt);
    try{if(receipt.scope!=='inbox')await this.manager.mutate(SOURCES[receipt.scope],t=>this.restoreText(t,receipt));}
    catch(error){for(const f of restored.reverse())await this.adapter.rename(f.from,f.to);throw error;}
    receipt.state='restored';await this.save(receipt);await this.manager.refresh();return receipt;
  }
  async purge(folder,expected){
    const receipt=await this.read(folder);
    if(!['deleted','purging','purge-failed'].includes(receipt.state))throw new Error('记录已恢复或尚未完成移入回收站，请刷新后处理');
    const identity=r=>this.identity(r);
    if(!expected||identity(receipt)!==identity(expected))throw new Error('回收记录已被修改，请重新确认');
    // Never recursively remove arbitrary backup contents or follow paths outside this receipt.
    const contents=await this.adapter.list(folder),filesFolder=folder+'/files';
    if(contents.files.some(p=>p!==folder+'/record.json')||contents.folders.some(p=>p!==filesFolder))throw new Error('回收目录包含额外文件，已停止彻底删除');
    if(await this.adapter.exists(filesFolder)){
      const stored=await this.adapter.list(filesFolder),allowed=new Set(receipt.files.map(f=>f.to));
      if(stored.folders.length||stored.files.some(p=>!allowed.has(p)))throw new Error('回收附件发生变化，已停止彻底删除');
    }
    receipt.state='purging';delete receipt.error;await this.save(receipt);
    try{
      for(const f of receipt.files){
        const current=await this.read(folder);
        if(current.state!=='purging'||identity(current)!==identity(receipt))throw new Error('回收记录已被另一窗口修改');
        if(!await this.adapter.exists(f.to))continue;
        // Only the archived copy is removed. Active/shared files at f.from are never touched.
        await this.adapter.remove(f.to);
      }
      await this.manager.forgetTrashedMembership(receipt);
      const latest=await this.read(folder);
      if(latest.state!=='purging'||identity(latest)!==identity(receipt))throw new Error('彻底删除期间回收记录发生变化');
      await this.adapter.remove(folder+'/record.json');
    }catch(error){
      // A partially deleted receipt remains visible and can be retried, but cannot claim to restore.
      const current=await this.read(folder).catch(()=>null);
      if(current?.state==='purging'&&identity(current)===identity(receipt)){
        receipt.state='purge-failed';receipt.error=error.message;await this.save(receipt);
      }
      throw new Error('彻底删除未完成，可在回收站重试：'+error.message);
    }
    if(await this.adapter.exists(filesFolder))await this.adapter.rmdir(filesFolder,false).catch(()=>{});
    await this.adapter.rmdir(folder,false).catch(()=>{});
    await this.manager.refresh();return receipt;
  }
}
module.exports={RecordTrash};
