const {Plugin,Notice,TFile,loadPdfJs,requestUrl}=require('obsidian');
module.exports=class LiteratureManager extends Plugin {
  async onload(){
    this.stopped=false;this.snapshot=null;this.navigation={scope:'library',category:'Robotics Policies',status:''};this.lastError='';this.timer=null;this.loading=null;
    this.citationQueue=Promise.resolve();this.citationErrors=new Map();this.citationKnown=null;
    this.trashStore=new TrashStore.RecordTrash(this,Engine);
    this.registerView(LIBRARY_VIEW,leaf=>new LiteratureBrowser(leaf,this));
    this.registerView(NAV_VIEW,leaf=>new LibraryNavigation(leaf,this));
    this.addRibbonIcon('library','打开文献管理器',()=>this.openLibrary());
    this.addCommand({id:'open-library',name:'打开文献管理器',callback:()=>this.openLibrary()});
    this.addCommand({id:'open-inbox',name:'打开收件箱',callback:()=>this.openLibrary({scope:'inbox'})});
    this.addCommand({id:'new-category',name:'新建分类',callback:()=>new CategoryModal(this).open()});
    this.addCommand({id:'agent-inbox',name:'复制 Agent 整理指令',callback:()=>new AgentHandoffModal(this).open()});
    this.addCommand({id:'refresh-citations',name:'重新识别缺失引用',callback:()=>this.ensureCitationRows(this.snapshot?.library||[]).then(rows=>new Notice('引用识别完成：'+rows.filter(r=>r.bibtex).length+' / '+rows.length)).catch(e=>new Notice(e.message,8000))});
    this.addCommand({id:'refresh',name:'重新读取本地数据',callback:()=>this.refresh(true)});
    this.registerObsidianProtocolHandler('literature-database',params=>this.openLibrary(params.category?{scope:'library',category:params.category}:undefined));
    const relevant=p=>['文献库.md','审稿.md','投稿.md','集合.md'].includes(p)||p.startsWith('temp/');
    const changed=(file,old)=>{if(relevant(file.path)||(old&&relevant(old)))this.schedule();};
    for(const event of ['modify','create','delete','rename'])this.registerEvent(this.app.vault.on(event,changed));
    this.registerEvent(this.app.workspace.on('file-open',file=>{if(file&&this.ready)this.redirectLegacy(file.path);}));
    this.app.workspace.onLayoutReady(async()=>{
      if(this.stopped)return;
      await this.refresh();
      if(this.stopped)return;
      // Source documents are retained as agent data, but never act as daily landing pages.
      const old=this.app.workspace.getLeavesOfType('markdown').filter(l=>this.legacyRoute(l.getViewState().state?.file));
      let leaf=this.app.workspace.getLeavesOfType(LIBRARY_VIEW)[0];
      if(!leaf){leaf=old.shift()||this.app.workspace.getLeaf('tab');await leaf.setViewState({type:LIBRARY_VIEW,state:{scope:'library',category:this.snapshot?.categories[0]||''},active:true});}
      for(const other of old)other.detach();
      this.ready=true;await this.openLibrary();
    });
  }
  legacyRoute(path){
    if(path==='文献库.md'||path==='首页.md')return {scope:'library',category:this.snapshot?.categories[0]||''};
    if(path==='阅读队列.md')return {scope:'library',status:'待读'};
    if(path==='审稿.md')return {scope:'reviews'};
    if(path==='投稿.md')return {scope:'submissions'};
    if(path==='集合.md')return {scope:'projects'};
    return null;
  }
  async redirectLegacy(path){
    const nav=this.legacyRoute(path);if(!nav||this.redirecting)return;
    this.redirecting=true;
    try{
      const sourceLeaf=this.app.workspace.getMostRecentLeaf();
      await this.openLibrary(nav);
      if(sourceLeaf?.getViewState().type==='markdown'&&sourceLeaf.getViewState().state?.file===path)sourceLeaf.detach();
    }catch(e){new Notice(e.message);}finally{this.redirecting=false;}
  }
  async showNavigation(){
    let leaf=this.app.workspace.getLeavesOfType(NAV_VIEW)[0];
    if(!leaf){leaf=this.app.workspace.getLeftLeaf(false);if(!leaf)return;await leaf.setViewState({type:NAV_VIEW,active:true});}
    this.app.workspace.leftSplit?.expand();await this.app.workspace.revealLeaf(leaf);this.renderNavigation();
  }
  async openLibrary(nav){
    let leaf=this.app.workspace.getLeavesOfType(LIBRARY_VIEW)[0];
    if(!leaf){leaf=this.app.workspace.getLeaf('tab');await leaf.setViewState({type:LIBRARY_VIEW,state:{scope:'library',category:this.snapshot?.categories[0]||''},active:true});}
    if(leaf.isDeferred)await leaf.loadIfDeferred();
    if(nav&&leaf.view instanceof LiteratureBrowser)await leaf.view.navigate(nav);
    await this.showNavigation();await this.app.workspace.revealLeaf(leaf);
  }
  renderNavigation(){for(const leaf of this.app.workspace.getLeavesOfType(NAV_VIEW))if(leaf.view instanceof LibraryNavigation)leaf.view.render();}
  stagingGroup(scope){const groups=this.snapshot?.groups[scope]||[];return groups.includes('暂存区')?'暂存区':groups.includes('待确定 venue')?'待确定 venue':'暂存区';}
  async remapGroup(scope,from,to){
    if(this.navigation?.scope===scope&&this.navigation.category===from)this.navigation.category=to;
    for(const leaf of this.app.workspace.getLeavesOfType(LIBRARY_VIEW)){
      const view=leaf.view;if(!(view instanceof LiteratureBrowser)||view.scope!==scope)continue;
      if(view.filters.category===from){view.filters.category=to;view.selectedPath='';}
      await view.reload();view.remember();
    }
    this.renderNavigation();
  }
  async renameGroup(scope,from,to){
    if(!['library','projects'].includes(scope)&&!TRACK_FILES[scope])throw new Error('无效分类类型');
    return this.recordAction(async()=>{
      to=to.trim();
      if(this.snapshot.collections&&['library','projects'].includes(scope))await this.mutate(COLLECTION_SOURCE,text=>Collections.rename(text,scope,from,to));
      else await this.mutate(scope==='library'?LIBRARY_SOURCE:TRACK_FILES[scope],text=>scope==='library'?Engine.renameCategory(text,from,to):Engine.renameTrackerGroup(text,TRACK_FILES[scope],from,to));
      await this.remapGroup(scope,from,to);
    });
  }
  async deleteLibraryCategory(name){
    return this.recordAction(async()=>{
      if(this.snapshot.collections)await this.mutate(COLLECTION_SOURCE,text=>Collections.remove(text,'library',name));
      else await this.mutate(LIBRARY_SOURCE,text=>Engine.deleteCategory(text,name));
      await this.remapGroup('library',name,this.snapshot.categories.includes(Engine.UNFILED_CATEGORY)?Engine.UNFILED_CATEGORY:'');
    });
  }
  groupNames(scope){return scope==='library'?this.snapshot?.categories?.filter(n=>n!==Engine.UNFILED_CATEGORY):scope==='projects'?this.snapshot?.groups.projects:TRACK_FILES[scope]?this.snapshot?.groups[scope]:null;}
  beginGroupDrag(event,scope,name){
    const names=this.groupNames(scope),editing=this.app.workspace.getLeavesOfType(NAV_VIEW).some(leaf=>leaf.view?.renaming);
    if(this.hasPendingEdit()||this.importing||this.lastError||editing){new Notice('请先保存或取消编辑，并等待当前操作结束');return false;}
    if(!event.dataTransfer||!names?.includes(name)||(scope!=='library'&&Engine.isStagingGroup(name)))return false;
    this.endPaperDrag();const token=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    this.groupDrag={token,scope,name,names:[...names]};event.dataTransfer.setData(GROUP_DRAG,token);event.dataTransfer.effectAllowed='move';return true;
  }
  clearGroupDropIndicators(){
    for(const leaf of this.app.workspace.getLeavesOfType(NAV_VIEW))for(const el of leaf.view?.contentEl?.querySelectorAll('.is-order-before, .is-order-after')||[])el.classList.remove('is-order-before','is-order-after');
  }
  endGroupDrag(){
    if(this.groupDrag)this.suppressGroupClickUntil=Date.now()+250;
    this.groupDrag=null;this.clearGroupDropIndicators();
    for(const leaf of this.app.workspace.getLeavesOfType(NAV_VIEW))for(const el of leaf.view?.contentEl?.querySelectorAll('.is-group-dragging')||[])el.classList.remove('is-group-dragging');
    if(!this.stopped)this.renderNavigation();
  }
  async moveDraggedGroup(token,scope,target,after){
    const drag=this.groupDrag;this.endGroupDrag();
    if(!drag||drag.token!==token)throw new Error('排序拖拽已失效，请重新拖动');
    if(drag.scope!==scope)throw new Error('请在分类、审稿或投稿各自的区域内排序');
    return this.recordAction(()=>this.snapshot.collections&&['library','projects'].includes(scope)?this.mutate(COLLECTION_SOURCE,text=>Collections.reorder(text,scope,drag.name,target,after,drag.names)):this.mutate(scope==='library'?LIBRARY_SOURCE:TRACK_FILES[scope],text=>Engine.reorderGroups(text,scope,drag.name,target,after,drag.names)));
  }
  async deleteVenue(scope,name){
    if(!TRACK_FILES[scope])throw new Error('无效 Venue 类型');
    return this.recordAction(async()=>{
      await this.mutate(TRACK_FILES[scope],text=>Engine.deleteTrackerGroup(text,TRACK_FILES[scope],name));
      await this.remapGroup(scope,name,this.stagingGroup(scope));
    });
  }
  async setVenueDeadline(scope,name,value,expected,expectedKey){
    if(['projects','submissions'].includes(scope)&&this.snapshot.collections){
      return this.recordAction(()=>this.mutateDeadlineSources(texts=>DeadlineSharing.update(texts,scope,name,value,expected,expectedKey)));
    }
    if(!TRACK_FILES[scope]||Engine.isStagingGroup(name))throw new Error('请为具体 Venue 设置截止时间');
    return this.recordAction(()=>this.mutate(TRACK_FILES[scope],text=>Engine.setTrackerDeadline(text,TRACK_FILES[scope],name,value,expected)));
  }
  hasPendingEdit(){return this.recordBusy||this.app.workspace.getLeavesOfType(LIBRARY_VIEW).some(leaf=>leaf.view?.dirty?.()||leaf.getViewState?.().state?.draft);}
  async recordAction(action){
    if(this.hasPendingEdit()||this.importing)throw new Error('请先保存或取消编辑，并等待当前操作结束');
    this.recordBusy=true;try{return await action();}finally{this.recordBusy=false;}
  }
  async deleteRecord(scope,row){return this.recordAction(()=>this.trashStore.remove(scope,row));}
  async deleteRecords(scope,rows){
    return this.recordAction(async()=>{
      let done=0;
      try{for(const row of rows){await this.trashStore.remove(scope,row);done++;}return done;}
      catch(error){throw new Error((done?'已移入 '+done+' 篇，其余保留。':'')+error.message);}
    });
  }
  async restoreRecord(folder){return this.recordAction(()=>this.trashStore.restore(folder));}
  async purgeRecord(receipt){return this.recordAction(()=>this.trashStore.purge(receipt.folder,receipt));}
  async runTrashBatch(action,receipts,onProgress=()=>{}){
    if(!['restore','purge'].includes(action))throw new Error('无效回收站操作');
    // One lock for the whole batch; duplicate filenames are distinct receipts, duplicate selections are not.
    const selected=[...new Map(receipts.map(r=>[r.folder,r])).values()];
    return this.recordAction(async()=>{
      const result={succeeded:[],failed:[]};let done=0;
      const progress=()=>{try{onProgress(done,selected.length);}catch(_){};};progress();
      for(const receipt of selected){
        try{
          if(action==='restore')await this.trashStore.restore(receipt.folder,receipt);
          else await this.trashStore.purge(receipt.folder,receipt);
          result.succeeded.push(receipt.folder);
        }catch(error){result.failed.push({receipt,error:error.message});}
        done++;progress();
      }
      return result;
    });
  }
  async forgetTrashedMembership(receipt){
    if(receipt.scope!=='library')return;
    const file=this.app.vault.getAbstractFileByPath(LIBRARY_SOURCE),text=await this.app.vault.read(file);
    if(Engine.parseLibrary(text).some(r=>r.path===receipt.row.path)||!text.includes('<!-- library:collections -->'))return;
    if((await this.trashStore.list()).some(r=>r.folder!==receipt.folder&&r.scope==='library'&&r.row.path===receipt.row.path))return;
    await this.mutate(COLLECTION_SOURCE,text=>{
      const groups=Collections.parse(text).groups.filter(g=>g.members.some(m=>m.path===receipt.row.path));
      for(const group of groups)text=Collections.change(text,[receipt.row.path],null,{from:{scope:group.scope,name:group.name}});
      return text;
    });
  }
  beginPaperDrag(event,row,scope='library',selected=[row],sourceCategory=''){
    if(scope==='projects'&&!this.snapshot?.collections)return false;
    if(this.hasPendingEdit()||this.lastError){new Notice('请先保存或取消编辑，并等待源数据同步完整');return false;}
    if(!['library','projects','reviews','submissions'].includes(scope)||!event.dataTransfer||!this.snapshot?.[scope==='projects'?'library':scope].some(r=>r.path===row.path))return false;
    const token=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    this.dragState={token,scope,row:{...row,cells:[...row.cells]},rows:selected.map(r=>({...r,cells:[...r.cells]})),from:sourceCategory?{scope,name:sourceCategory}:null};
    event.dataTransfer.setData(PAPER_DRAG,token);event.dataTransfer.effectAllowed=this.snapshot.collections&&['library','projects'].includes(scope)?'copyMove':'move';return true;
  }
  endPaperDrag(){
    this.dragState=null;
    for(const type of [NAV_VIEW,LIBRARY_VIEW])for(const leaf of this.app.workspace.getLeavesOfType(type))
      for(const el of leaf.view?.contentEl?.querySelectorAll('.is-drop-target, .is-dragging')||[])el.classList.remove('is-drop-target','is-dragging');
  }
  async moveDraggedPaper(token,category,scope='library',move=false){
    const drag=this.dragState;this.endPaperDrag();
    if(!drag||drag.token!==token)throw new Error('拖拽已失效，请从当前列表重新拖动');
    if(this.snapshot.collections&&['library','projects'].includes(drag.scope)&&['library','projects'].includes(scope)){
      await this.changeMembership(drag.rows||[drag.row],{scope,name:category},move?drag.from:null,move);new Notice(move?'已移动到 '+category:'已加入 '+category);return;
    }
    if(drag.scope!==scope)throw new Error('请在同一类型内移动，审稿和投稿不混入文献库');
    if(this.hasPendingEdit())throw new Error('请先保存或取消右侧编辑，草稿已保留');
    if(!(scope==='library'?this.snapshot?.categories:this.snapshot?.groups[scope]).includes(category)&&!(scope!=='library'&&category===this.stagingGroup(scope)))throw new Error('目标分类已改变，请刷新后重试');
    if(drag.row.category===category)return;
    if(scope==='library')await this.mutate(LIBRARY_SOURCE,text=>Engine.updateLibraryEntry(text,drag.row,{category}));
    else {const r=drag.row;await this.mutate(TRACK_FILES[scope],text=>Engine.updateTracker(text,TRACK_FILES[scope],r,{title:r.filename,pdfPath:r.pdfPath,category,status:r.status,due:r.published,next:r.tldr,notes:r.notes}));}
    new Notice('已移至 '+(scope!=='library'&&category===this.stagingGroup(scope)?'暂存区':category));
  }
  async pasteInboxFiles(){
    if(this.importing||this.recordBusy)throw new Error('请等待当前操作完成');
    if(!Platform.isDesktopApp||!Platform.isMacOS)throw new Error('粘贴本地 PDF 目前支持 Mac；其他设备可将文件放入 temp');
    const files=await InboxImport.readClipboardFiles(require('electron').clipboard);
    if(this.stopped)return;
    return this.importDroppedFiles(files,{scope:'inbox'});
  }
  async importDroppedFiles(files,nav={scope:'inbox'}){
    if(this.importing)throw new Error('正在导入上一批 PDF，请稍候');
    if(this.recordBusy)throw new Error('请等待当前操作完成');
    const scope=nav.scope;if(!['inbox','reviews','submissions'].includes(scope))throw new Error('无效导入位置');
    if(scope!=='inbox'&&this.lastError)throw new Error('源数据不完整，请等待同步');
    if(!Platform.isDesktopApp||!Platform.isMacOS)throw new Error('保留 Skim 批注的拖拽导入目前支持 Mac；其他设备可将文件放入 temp');
    const base=this.app.vault.adapter.getBasePath?.();if(!base)throw new Error('无法读取本机仓库路径');
    const pdfs=files.filter(f=>/\.pdf$/i.test(f.name));
    if(!pdfs.length)throw new Error('请拖入本地 PDF 文件；链接和单独批注文件不会导入');
    const inputs=pdfs.map(file=>{
      let source='';try{source=require('electron').webUtils?.getPathForFile(file)||'';}catch(_){}
      source=source||file.path||'';
      return {name:file.name,path:source};
    });
    if(inputs.some(f=>!f.path))throw new Error('未取得本地 PDF 路径，请先保存文件，再从 Finder 拖入');
    const category=scope==='inbox'?'':nav.category||this.stagingGroup(scope);
    if(scope!=='inbox'){
      const file=this.app.vault.getAbstractFileByPath(TRACK_FILES[scope]);if(!file)throw new Error('源表尚未同步');
      Engine.updateTracker(await this.app.vault.read(file),TRACK_FILES[scope],null,{title:'Validation',pdfPath:'',category,status:'待整理',due:'—',next:'',notes:''});
    }
    let folder=scope==='inbox'?'temp':scope+'/'+(category===this.stagingGroup(scope)?'_staging':category.replace(/[\\/:*?"<>|.]/g,'-').replace(/\s+/g,'-').slice(0,60)||'venue');
    this.importing=true;const progress=new Notice('正在导入 '+inputs.length+' 篇 PDF…',0);
    try{
      const results=await InboxImport.importInboxFiles(base,inputs,{folder});
      const added=results.filter(r=>r.path),skipped=results.filter(r=>r.skipped),failed=results.filter(r=>r.error);
      if(scope!=='inbox'&&added.length){
        try{await this.mutate(TRACK_FILES[scope],text=>{
          for(const r of added)text=Engine.updateTracker(text,TRACK_FILES[scope],null,{title:r.path.split('/').pop(),pdfPath:r.path,category,status:scope==='reviews'?'待审':'准备中',due:'—',next:'',notes:''});return text;
        });}catch(error){throw new Error('附件保留在 '+folder+'；记录写入失败：'+error.message);}
      }
      await this.refresh();
      if(added.length&&!this.hasPendingEdit())await this.openLibrary({scope,category,status:''});
      const summary=[`已导入 ${added.length} 篇 PDF`];
      const attached=added.reduce((n,r)=>n+r.attachments,0);if(attached)summary.push(`保留 ${attached} 个批注附件`);
      if(added.some(r=>r.renamed))summary.push('重名文件已加后缀，原件未覆盖');
      if(skipped.length)summary.push(`${skipped.length} 篇已在本库，保留原位置`);
      if(failed.length)summary.push(...failed.map(r=>r.name+'：'+r.error));
      if(files.some(f=>!/\.(pdf|skim|fdf|xfdf)$/i.test(f.name)))summary.push('已忽略非 PDF 文件');
      new Notice(summary.join('\n'),failed.length?15000:8000);return results;
    }finally{progress.hide();this.importing=false;}
  }
  schedule(){if(this.stopped)return;clearTimeout(this.timer);this.timer=setTimeout(()=>this.refresh(),300);}
  async refresh(notify=false){
    if(this.stopped||this.ddlWriting)return;
    if(this.loading){this.again=true;return this.loading;}
    this.loading=this.loadSnapshot();
    try{await this.loading;if(notify&&!this.lastError)new Notice('本地列表已更新');}finally{this.loading=null;if(this.again){this.again=false;this.schedule();}}
  }
  async loadSnapshot(){
    try{
      const names=['文献库.md','审稿.md','投稿.md'],files=names.map(n=>this.app.vault.getAbstractFileByPath(n));
      if(files.some(f=>!(f instanceof TFile)))throw new Error('源文件尚未同步齐全');
      const texts=await Promise.all(files.map(f=>this.app.vault.read(f)));
      let library=Engine.parseLibrary(texts[0]);
      let collections=null,collectionText='';
      if(texts[0].includes('<!-- library:collections -->')){
        const file=this.app.vault.getAbstractFileByPath(COLLECTION_SOURCE);if(!(file instanceof TFile))throw new Error('集合尚未同步齐全');
        collectionText=await this.app.vault.read(file);collections=Collections.parse(collectionText).groups;library=Collections.decorate(library,collections);
      }
      const reviews=Engine.parseTracker(texts[1],'审稿'),submissions=Engine.parseTracker(texts[2],'投稿');
      const inbox=this.app.vault.getFiles().filter(f=>f.path.startsWith('temp/')&&f.extension.toLowerCase()==='pdf').map(f=>({path:f.path,filename:f.name,category:'',published:new Date(f.stat.ctime).toLocaleDateString('sv-SE'),mtime:f.stat.ctime,fileMtime:f.stat.mtime,fileSize:f.stat.size,status:'待整理',priority:(f.stat.size/1024/1024).toFixed(1)+' MB',tags:'',notes:'',tldr:''}));
      const deadlines={reviews:Object.fromEntries(Engine.trackerGroups(texts[1]).map(name=>[name,Engine.trackerDeadline(texts[1],name)])),submissions:Object.fromEntries(Engine.trackerGroups(texts[2]).map(name=>[name,Engine.trackerDeadline(texts[2],name)]))};
      const deadlineEntries=collections?DeadlineSharing.entries({[COLLECTION_SOURCE]:collectionText,[TRACK_FILES.submissions]:texts[2]}):[];
      deadlines.projects=Object.fromEntries(deadlineEntries.filter(g=>g.scope==='projects').map(g=>[g.name,g.deadline]));
      if(this.stopped)return;
      this.snapshot={library,reviews,submissions,inbox,collections,deadlineEntries,categories:collections?[...collections.filter(g=>g.scope==='library').map(g=>g.name),...(library.some(r=>!r.categories.length)?[Engine.UNFILED_CATEGORY]:[])]:Engine.getCategories(texts[0]),groups:{projects:collections?.filter(g=>g.scope==='projects').map(g=>g.name)||[],reviews:Engine.trackerGroups(texts[1]),submissions:Engine.trackerGroups(texts[2])},deadlines};this.lastError='';
      const added=this.citationKnown?library.filter(r=>!this.citationKnown.has(r.path)):[];this.citationKnown=new Set(library.map(r=>r.path));
      if(added.length&&typeof loadPdfJs==='function')this.ensureCitationRows(added).catch(e=>new Notice(e.message,8000));
    }catch(e){const message='保留上次列表：'+e.message;if(message!==this.lastError)new Notice(message,8000);this.lastError=message;}
    this.renderNavigation();for(const leaf of this.app.workspace.getLeavesOfType(LIBRARY_VIEW))if(leaf.view instanceof LiteratureBrowser)await leaf.view.reload();
  }
  async mutate(name,transform){
    if(this.lastError)throw new Error('源数据不完整，暂不能保存');
    const vault=this.app.vault,file=vault.getAbstractFileByPath(name);if(!(file instanceof TFile))throw new Error('源文件尚未同步');
    const before=await vault.read(file),after=transform(before);if(after===before)return;
    const folder='.maintenance-backups';if(!await vault.adapter.exists(folder))await vault.adapter.mkdir(folder);
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    await vault.adapter.write(`${folder}/${name.replace(/\.md$/,'')}-edit-${stamp}-${Math.random().toString(36).slice(2,8)}.md`,before);
    await vault.process(file,current=>{if(current!==before)throw new Error('备份期间文件发生变化，请重试；草稿已保留');return after;});
    await this.refresh();
  }
  async mutateDeadlineSources(transform){
    if(this.lastError)throw new Error('源数据不完整，暂不能保存');
    const vault=this.app.vault,names=[COLLECTION_SOURCE,TRACK_FILES.submissions],files=names.map(n=>vault.getAbstractFileByPath(n));
    if(files.some(f=>!(f instanceof TFile)))throw new Error('源文件尚未同步');
    const before=Object.fromEntries(await Promise.all(names.map(async(n,i)=>[n,await vault.read(files[i])]))),after=transform(before);
    const changed=names.filter(n=>before[n]!==after[n]);if(!changed.length)return;
    const folder='.maintenance-backups';if(!await vault.adapter.exists(folder))await vault.adapter.mkdir(folder);
    const stamp=new Date().toISOString().replace(/[:.]/g,'-')+'-'+Math.random().toString(36).slice(2,8);
    for(const n of changed)await vault.adapter.write(folder+'/'+n.replace(/\.md$/,'')+'-ddl-'+stamp+'.md',before[n]);
    const written=[];this.ddlWriting=true;
    try{
      // Guard both files, including a read-only source used by a selection.
      for(let i=0;i<names.length;i++)if(await vault.read(files[i])!==before[names[i]])throw new Error('备份期间源表发生变化，请重试');
      for(const n of changed){await vault.process(files[names.indexOf(n)],current=>{if(current!==before[n])throw new Error('源表发生并发修改，请重试');return after[n];});written.push(n);}
      for(let i=0;i<names.length;i++)if(await vault.read(files[i])!==after[names[i]])throw new Error('保存期间源表发生变化，请重新检查 DDL');
    }catch(error){
      const failed=[];for(const n of written.reverse())try{await vault.process(files[names.indexOf(n)],current=>{if(current!==after[n])throw new Error('已有外部修改');return before[n];});}catch(_){failed.push(n);}
      if(failed.length)throw new Error(error.message+'；'+failed.join('、')+' 已有外部修改，未覆盖，原件在维护备份中');
      throw error;
    }finally{this.ddlWriting=false;await this.refresh();}
  }
  deadlineChoices(scope){return (this.snapshot?.deadlineEntries||[]).filter(g=>g.scope!==(scope==='projects'?'projects':'submissions'));}
  async newCollection(scope,name,selection=null){
    return this.recordAction(async()=>{
      if(this.snapshot.collections&&scope==='projects')await this.mutateDeadlineSources(texts=>DeadlineSharing.create(texts,scope,name,selection,Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2)));
      else if(this.snapshot.collections)await this.mutate(COLLECTION_SOURCE,text=>Collections.add(text,scope,name));
      else if(scope==='library')await this.mutate(LIBRARY_SOURCE,text=>Engine.addCategory(text,name));
      else throw new Error('集合数据尚未迁移');
    });
  }
  async newVenue(scope,name,selection=null){
    if(!TRACK_FILES[scope]||Engine.isStagingGroup(name))throw new Error('请输入具体 Venue 名称');
    return this.recordAction(()=>scope==='submissions'&&this.snapshot.collections?this.mutateDeadlineSources(texts=>DeadlineSharing.create(texts,scope,name,selection,Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2))):this.mutate(TRACK_FILES[scope],text=>Engine.addTrackerGroup(text,TRACK_FILES[scope],name)));
  }
  async deleteProject(name){
    return this.recordAction(async()=>{await this.mutate(COLLECTION_SOURCE,text=>Collections.remove(text,'projects',name));await this.remapGroup('projects',name,'');});
  }
  async changeMembership(rows,target,from=null,move=false,expected=null){
    return this.recordAction(async()=>{
      if(!rows.length)throw new Error('请选择文献');
      if(target?.scope==='library'&&target.name===Engine.UNFILED_CATEGORY)throw new Error('未分类自动显示没有分类的文献');
      // Refuse stale drags before changing collection membership; unrelated papers can change.
      const source=this.app.vault.getAbstractFileByPath(LIBRARY_SOURCE),current=Engine.parseLibrary(await this.app.vault.read(source));
      for(const row of rows){const found=current.find(r=>r.path===row.path);if(!found||JSON.stringify(found.cells)!==JSON.stringify(row.cells))throw new Error('文献已在其他窗口或设备中修改，请刷新后重试');}
      await this.mutate(COLLECTION_SOURCE,text=>{
        if(expected){
          const group=Collections.parse(text).groups.find(g=>g.scope===expected.target.scope&&g.name===expected.target.name);
          const actual=group&&rows.map(row=>{const m=group.members.find(m=>m.path===row.path);return m?m.notes:null;});
          if(!group||JSON.stringify(actual)!==JSON.stringify(expected.members))throw new Error('集合归属或项目备注已被修改，请重新打开勾选菜单');
        }
        return Collections.change(text,rows.map(r=>r.path),target,{from,move});
      });
    });
  }
  async ensureCitationRows(rows,onProgress=()=>{},options={}){
    const run=async()=>{
      const output=[],unique=[...new Map(rows.map(r=>[r.path,r])).values()];
      this.citationTransport??=CitationMetadata.transport(url=>requestUrl({url,throw:false}));
      for(const [index,selected] of unique.entries()){
        if(this.stopped||options.cancelled?.())break;
        let row=this.snapshot?.library.find(r=>r.path===selected.path);if(!row)continue;
        let changes={},error='';
        try{
          // Existing bibliography and keys are never overwritten by automatic retrieval.
          if(row.bibtex){const entry=getCitations().parseEntry(row.bibtex);if(!row.title&&CitationMetadata.validTitle(entry.data.title))changes.title=entry.data.title;if(entry.issues.length)error='既有引用缺少'+entry.issues.join('、');}
          else if(!(options.titleOnly&&row.title)){
            if(!row.path.startsWith('papers/'))throw new Error('只识别公开文献');
            const file=this.app.vault.getAbstractFileByPath(row.path);if(!(file instanceof TFile))throw new Error('PDF 尚未同步到本机');
            if(file.stat.size>150*1024*1024)throw new Error('PDF 超过 150 MB，未自动解析');
            const bytes=await this.app.vault.readBinary(file),evidence=await CitationMetadata.readPdf(await loadPdfJs(),bytes);
            if(this.stopped||options.cancelled?.())break;
            const result=options.titleOnly?{title:CitationMetadata.pdfTitle(evidence,row)}:await CitationMetadata.resolve(row,evidence,{request:this.citationTransport,fromCsl:getCitations().fromCsl});
            if(!row.title&&result.title)changes.title=result.title;
            if(result.bibtex){changes.bibtex=result.bibtex;changes.citationSource=result.citationSource;}
            error=result.citationError||(!result.title&&!row.title?'尚未取得论文篇名':'');
          }
          if(Object.keys(changes).length){
            if(this.stopped||options.cancelled?.())break;
            if(this.hasPendingEdit()||this.importing)throw new Error('存在未保存编辑，引用暂未写入；保存后再次导出即可');
            await this.mutate(LIBRARY_SOURCE,text=>{
              const current=Engine.parseLibrary(text).find(r=>r.path===row.path);
              if(!current||['title','bibtex','citationSource'].some(k=>current[k]!==row[k]))throw new Error('引用或篇名已被其他窗口修改，请重试');
              if(changes.bibtex){const key=getCitations().parseEntry(changes.bibtex).key;for(const other of Engine.parseLibrary(text))if(other.path!==row.path&&other.bibtex){let existing;try{existing=getCitations().parseEntry(other.bibtex).key;}catch(_){}if(existing===key)throw new Error('引用键冲突，未覆盖已有引用');}}
              return Engine.updateLibraryEntry(text,current,changes);
            });
            row=this.snapshot.library.find(r=>r.path===row.path)||row;
          }
        }catch(e){error=e.message;}
        if(error)this.citationErrors.set(row.path,error);else this.citationErrors.delete(row.path);
        output.push({...row,citationError:error});onProgress(index+1,unique.length);
      }
      return output;
    };
    const task=(this.citationQueue||Promise.resolve()).then(run,run);this.citationQueue=task.catch(()=>{});return task;
  }
  async saveExport(name,extension,content){
    const folder='exports';if(!await this.app.vault.adapter.exists(folder))await this.app.vault.adapter.mkdir(folder);
    const stem=(name||'references').replace(/[\\/:*?"<>|\x00-\x1f]/g,'-').replace(/^\.+/,'').slice(0,70)||'references';
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const path=folder+'/'+stem+'-'+stamp+'-'+Math.random().toString(36).slice(2,6)+'.'+extension;
    await this.app.vault.create(path,content);return path;
  }
  async openPDF(path){
    try{
      const file=this.app.vault.getAbstractFileByPath(path);if(!(file instanceof TFile)||file.extension.toLowerCase()!=='pdf')throw new Error('PDF 尚未下载或路径无效');
      if(Platform.isDesktopApp&&Platform.isMacOS){
        const base=this.app.vault.adapter.getBasePath?.();if(!base)throw new Error('无法读取本机 PDF 路径');
        // Follow macOS's per-file/default association, with no shell expansion.
        await new Promise((resolve,reject)=>require('child_process').execFile('/usr/bin/open',[require('path').join(base,file.path)],error=>error?reject(new Error('无法通过系统默认应用打开 PDF，请检查文件和默认应用设置')):resolve()));
      }else if(Platform.isDesktopApp&&typeof this.app.openWithDefaultApp==='function')await this.app.openWithDefaultApp(file.path);
      else await this.app.workspace.getLeaf('tab').openFile(file);
    }catch(e){new Notice(e.message,8000);}
  }
  onunload(){this.stopped=true;this.membershipMenu?.close();clearTimeout(this.timer);for(const leaf of this.app.workspace.getLeavesOfType(NAV_VIEW))leaf.view.stopCountdowns?.();this.endPaperDrag();this.endGroupDrag();}
};
