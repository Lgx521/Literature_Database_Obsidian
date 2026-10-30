// The view owns only DOM and subscriptions. DeepSeekWork owns the bounded job.
function ldbDeepSeekAvailable(plugin){return plugin.settings?.deepSeekBetaEnabled!==false;}
function ldbOpenDeepSeek(plugin,paths=[]){if(!ldbDeepSeekAvailable(plugin))return;if(plugin.deepSeekModal){plugin.deepSeekModal.modalEl.focus();return;}new DeepSeekBetaModal(plugin,paths).open();}
function ldbDeepSeekText(el,text){if(el.textContent!==text)el.setText(text);}
function ldbDeepSeekProps(el,props){for(const key in props)if(el[key]!==props[key])el[key]=props[key];}
function ldbDeepSeekClass(el,name,on){if(el.classList.contains(name)!==on)el.toggleClass(name,on);}
function ldbSyncDeepSeekAccess(plugin){
 const enabled=ldbDeepSeekAvailable(plugin);
 for(const leaf of plugin.app.workspace.getLeavesOfType(NAV_VIEW))for(const el of leaf.view.containerEl.querySelectorAll('.ldb-deepseek-nav,.ldb-deepseek-heading'))el.hidden=!enabled;
 for(const leaf of plugin.app.workspace.getLeavesOfType(LIBRARY_VIEW))leaf.view.syncDeepSeekAccess?.();
}
function ldbDeepSeekWork(plugin){
 if(!plugin.deepSeekWork)plugin.deepSeekWork=new (getDeepSeekWork())(ldbDeepSeek(plugin),{tr,language:()=>LdbI18n.getLanguage(),changed:()=>ldbUpdateDeepSeekStatus(plugin),completed:()=>{if(!plugin.deepSeekModal)new Notice('DeepSeek · '+ldbDeepSeekLabel(plugin));}});
 return plugin.deepSeekWork;
}
function ldbDeepSeekLabel(plugin){
 const w=plugin.deepSeekWork;
 if(w?.running)return tr(w.stopping?'正在停止…':w.phase==='reading'?'读取内容':w.phase==='applying'?'正在应用':'DeepSeek 分析中')+' '+Math.min(w.done+1,w.total)+' / '+w.total;
 if(w?.plan)return tr('分类方案待确认');
 if(w?.pending.length)return w.pending.length+' '+tr('项待确认');
 if(w?.phase==='error')return tr('需要处理');
 if(w?.phase==='stopped')return tr('已停止');
 if(w?.queuedCount)return tr('待继续下一批');
 if(w?.phase==='done')return tr('已完成');
 return tr(plugin.deepSeek?.enabled?'已就绪':plugin.settings?.deepSeekEncrypted?'待解锁':'未启用');
}
function ldbUpdateDeepSeekStatus(plugin){
 const label=ldbDeepSeekLabel(plugin),working=!!plugin.deepSeekWork?.running,results=!!plugin.deepSeekWork?.pending.length||!!plugin.deepSeekWork?.plan;
 for(const leaf of plugin.app.workspace.getLeavesOfType(NAV_VIEW))for(const el of leaf.view.containerEl.querySelectorAll('.ldb-deepseek-nav')){
  const status=el.querySelector('.ldb-deepseek-nav-status');if(status)ldbDeepSeekText(status,label);ldbDeepSeekClass(el,'is-working',working);ldbDeepSeekClass(el,'has-results',results);
 }
}
function ldbDeepSeekNav(parent,plugin){
 const b=ldbButton(parent,'',()=>ldbOpenDeepSeek(plugin),'ldb-nav-item ldb-deepseek-nav');b.hidden=!ldbDeepSeekAvailable(plugin);setIcon(b.createSpan('ldb-nav-icon'),'sparkles');const text=b.createSpan('ldb-deepseek-nav-text');text.createSpan({text:'DeepSeek Beta'});text.createSpan({cls:'ldb-deepseek-nav-status',text:ldbDeepSeekLabel(plugin)});b.toggleClass('is-working',!!plugin.deepSeekWork?.running);b.toggleClass('has-results',!!plugin.deepSeekWork?.pending.length);
}
class DeepSeekBetaModal extends Modal{
 constructor(plugin,paths=[]){super(plugin.app);this.plugin=plugin;this.paths=[...new Set(paths)];this.work=ldbDeepSeekWork(plugin);this.service=this.work.service;this.closed=false;this.localBusy=false;this.itemViews=new Map();this.proposalViews=new WeakMap();}
 get working(){return this.work.running||this.localBusy;}
 open(){if(!ldbDeepSeekAvailable(this.plugin))return;if(this.plugin.deepSeekModal){this.plugin.deepSeekModal.modalEl.focus();return;}this.plugin.deepSeekModal=this;super.open();}
 button(parent,label,fn,cls=''){return ldbButton(parent,tr(label),()=>this.perform(fn),cls);}
 taskButton(parent,label,fn,cls=''){const plugin=this.plugin;return ldbButton(parent,tr(label),()=>{if(this.working)return;this.error.setText('');Promise.resolve().then(fn).catch(error=>{const w=plugin.deepSeekWork;if(!w||w.closed)return;w.error=error.message;w.phase='error';w.emit();});},cls);}
 async perform(fn){if(this.working)return;this.error.setText('');this.localBusy=true;this.requestSync();try{await fn();}catch(error){if(!this.closed)this.error.setText(error.message);}finally{this.localBusy=false;this.work.emit();}}
 onOpen(){
  this.modalEl.addClass('ldb-deepseek-modal','ldb-dialog');this.titleEl.empty();this.titleEl.createSpan({text:'DeepSeek'});this.titleEl.createSpan({cls:'ldb-deepseek-beta-badge',text:'BETA'});
  const el=this.contentEl;this.motion=new LdbMotion(el,{disclosures:true,prepareDisclosure:(root,open)=>{if(open)this.mountProposal(this.proposalViews.get(root));},finishDisclosure:(root,open)=>{if(!open)this.unmountProposal(this.proposalViews.get(root));}});this.scroll=el.createDiv('ldb-deepseek-scroll');this.buildConfig(this.scroll);this.error=this.scroll.createDiv({cls:'ldb-form-error',attr:{role:'alert'}});
  const source=this.scroll.createDiv('ldb-deepseek-scope');const field=source.createDiv('ldb-deepseek-field');field.createEl('label',{text:tr('整理范围')});this.mode=field.createEl('select',{attr:{'aria-label':tr('整理范围')}});this.scopeOptions={};
  if(this.paths.length)this.scopeOptions.selection=this.mode.createEl('option',{value:'selection'});this.scopeOptions.inbox=this.mode.createEl('option',{value:'inbox'});this.scopeOptions.pending=this.mode.createEl('option',{value:'pending'});this.mode.value=this.paths.length?'selection':this.work.draft.mode==='selection'?'inbox':this.work.draft.mode;this.mode.addEventListener('change',()=>{this.work.draft.mode=this.mode.value;this.sync();});
  const modelRow=this.scroll.createDiv('ldb-deepseek-model-row');source.before(modelRow);const modelField=this.field(modelRow,'模型');this.modelSelect=modelField.createEl('select',{attr:{'aria-label':tr('模型')}});this.modelSelect.addEventListener('change',()=>this.perform(()=>this.changeModel(this.modelSelect.value)));this.modelsButton=this.button(modelRow,'刷新模型',()=>this.loadModels(true));
  this.generate=this.taskButton(source,'开始整理',()=>this.needsPlan()?this.work.planInbox(this.batch()):this.work.organize(this.batch()),'mod-cta');
  this.task=this.scroll.createDiv({cls:'ldb-deepseek-task',attr:{role:'status','aria-live':'polite'}});const taskTop=this.task.createDiv('ldb-deepseek-task-heading');this.taskIcon=taskTop.createSpan('ldb-deepseek-task-icon');this.taskTitle=taskTop.createEl('strong');this.filename=this.task.createDiv('ldb-deepseek-current');this.track=this.task.createDiv('ldb-deepseek-track');this.bar=this.track.createDiv('ldb-deepseek-bar');
  this.batchBar=this.scroll.createDiv('ldb-deepseek-result-heading');this.batchStatus=this.batchBar.createEl('strong');this.nextBatchButton=this.taskButton(this.batchBar,'继续下一批',()=>this.work.nextBatch(),'mod-cta');this.discardQueueButton=this.button(this.batchBar,'取消剩余批次',()=>this.work.discardQueue());
  this.planPanel=this.scroll.createDiv('ldb-deepseek-plan');
  this.preview=this.scroll.createDiv();const resultTop=this.preview.createDiv('ldb-deepseek-result-heading');this.resultTitle=resultTop.createEl('strong');this.applyAll=this.taskButton(resultTop,'全部应用',()=>this.work.apply(this.work.ready),'mod-cta');this.clearButton=this.button(resultTop,'清除结果',()=>this.work.clearResults(),'ldb-deepseek-text-button');this.results=this.preview.createDiv('ldb-deepseek-results');
  this.empty=this.scroll.createDiv({cls:'ldb-deepseek-empty',text:tr('生成篇名、TL;DR、标签和分类，修改后应用。')});
  const footer=el.createDiv('ldb-deepseek-footer');this.footerHint=footer.createSpan();this.planActions=footer.createDiv('ldb-actions ldb-deepseek-plan-actions');this.cancelButton=ldbButton(footer,tr('停止处理'),()=>this.work.stop(),'ldb-deepseek-stop');this.closeButton=ldbButton(footer,tr('关闭'),()=>this.close());
  this.renderDoc=this.modalEl.ownerDocument;this.renderWin=this.renderDoc.defaultView;
  this.onVisibility=()=>{if(this.renderDoc.hidden){this.cancelSync();this.pendingSync=true;}else if(this.pendingSync)this.requestSync();};this.renderDoc.addEventListener('visibilitychange',this.onVisibility);
  this.unsubscribe=this.work.subscribe(()=>this.requestSync());this.sync();if(!this.service.enabled)this.perform(()=>this.restoreDeviceKey());
 }
 buildConfig(parent){
  const saved=!!this.plugin.settings.deepSeekEncrypted;this.refreshDeviceState();
  this.config=parent.createEl('details',{cls:'ldb-deepseek-config'});this.config.open=!this.service.enabled;
  const summary=this.config.createEl('summary');summary.createSpan({text:tr('密钥设置')});this.keyStatus=summary.createSpan('ldb-deepseek-key-status');
  const actions=this.config.createDiv('ldb-actions ldb-deepseek-key-actions');
  this.lockButton=this.button(actions,'锁定',()=>this.lockKey());
  this.changeKeyButton=this.button(actions,'更换密钥',()=>{this.editingKey=true;this.editingSync=false;this.motion.setOpen(this.keyEditor,true);});
  this.changeSyncButton=this.button(actions,saved?'更改同步口令':'设置加密同步',()=>{this.editingSync=true;this.editingKey=false;});
  this.cancelKeyButton=this.button(actions,'取消修改',()=>{this.editingKey=this.editingSync=false;this.keyInput.value=this.passInput.value='';this.rememberInput.checked=this.deviceState.remembered;});
  const remember=this.config.createEl('label',{cls:'ldb-deepseek-remember'});this.rememberInput=remember.createEl('input',{type:'checkbox'});this.rememberInput.checked=this.deviceState.remembered||getDeepSeekSecret().deviceAvailable(this.app);
  this.rememberInput.addEventListener('change',()=>{if(this.service.enabled&&!this.editingKey)this.perform(()=>{try{if(this.rememberInput.checked)getDeepSeekSecret().rememberDevice(this.app,this.service.key,this.plugin.settings.deepSeekEncrypted);else getDeepSeekSecret().forgetDevice(this.app);}catch(e){this.rememberInput.checked=this.deviceState.remembered;throw this.secretError(e);}this.refreshDeviceState();});});remember.appendText(tr('在此设备记住密钥'));
  this.keyEditor=this.config.createEl('details',{cls:'ldb-deepseek-key-editor'});this.keyEditor.open=!saved&&!this.service.enabled;this.keyEditor.createEl('summary',{text:'API Key'});
  this.keyInput=this.keyEditor.createEl('input',{type:'password',attr:{placeholder:'DeepSeek API Key','aria-label':'DeepSeek API Key',autocomplete:'off',spellcheck:'false'}});
  const session=this.keyEditor.createDiv('ldb-actions');this.enableButton=this.button(session,'启用密钥',async()=>{this.enableKey(this.keyInput.value.trim());await this.loadModels();});
  this.passInput=this.config.createEl('input',{type:'password',attr:{placeholder:tr('同步口令（至少 12 个字符）'),'aria-label':tr('同步口令（至少 12 个字符）'),autocomplete:'off'}});
  for(const input of [this.keyInput,this.passInput])input.addEventListener('input',()=>this.syncKeyControls());
  const sync=this.config.createDiv('ldb-actions');this.unlockButton=this.button(sync,'解锁同步密钥',()=>this.unlockSecret(),'mod-cta');this.saveButton=this.button(sync,'加密保存到 iCloud',()=>this.saveSecret());
  const more=this.config.createEl('details',{cls:'ldb-deepseek-secret-more'});more.createEl('summary',{text:tr('同步说明与密钥管理')});more.createEl('p',{cls:'ldb-deepseek-caption',text:tr('勾选记住后，API Key 保存在此设备的 Obsidian 密钥存储，重开插件无需解锁。同步口令不会保存；iCloud 仅同步加密密钥，其他设备需先解锁一次。忘记口令可重新配置密钥。')});more.createEl('p',{cls:'ldb-deepseek-caption',text:tr('锁定后需重新输入同步口令或 API Key，不会自动解锁；保留同步配置和整理结果。')});more.createEl('p',{text:tr('整理会将选中 PDF 或网页的正文、分类和标签发送给 DeepSeek，不发送 Notes 或审稿材料。网页优先使用 DeepSeek Fetch，失败时直接读取原网址。每批最多 20 篇，每篇最多 48,000 字符；PDF 最多 50 MB、12 页。关闭面板后继续，退出 Obsidian 后停止。')});
  const extra=more.createDiv('ldb-actions');this.disableButton=this.button(extra,'关闭并清除本机密钥',()=>{try{getDeepSeekSecret().forgetDevice(this.app);}catch(e){throw this.secretError(e);}this.service.disable();this.service.locked=true;this.resetKeyEditor();this.motion.setOpen(this.config,true);});this.forgetButton=this.button(extra,'移除同步密钥',()=>this.forgetSecret());
 }
 refreshDeviceState(){this.deviceState=getDeepSeekSecret().deviceState(this.app,this.plugin.settings.deepSeekEncrypted);}
 syncKeyControls(){
  if(!this.keyInput||this.closed)return;
  const enabled=this.service.enabled,saved=!!this.plugin.settings.deepSeekEncrypted,blocked=this.working||!!this.service.wire,editing=!!this.editingKey||!!this.editingSync,available=getDeepSeekSecret().deviceAvailable(this.app);
  const validKey=/^[A-Za-z0-9_-]{12,256}$/.test(this.keyInput.value.trim()),validPass=this.passInput.value.length>=12&&this.passInput.value.length<=1024;
  ldbDeepSeekText(this.keyStatus,tr(enabled?this.deviceState.remembered?'已解锁 · 本机已记住':'已解锁':this.service.locked||this.deviceState.locked?'已锁定':saved?'待解锁':'未设置密钥'));
  ldbDeepSeekProps(this.keyInput,{disabled:blocked||enabled&&!this.editingKey,placeholder:enabled&&!this.editingKey?tr('API Key 已启用'):'DeepSeek API Key'});
  ldbDeepSeekProps(this.passInput,{disabled:blocked||enabled&&!editing,placeholder:enabled&&!editing?tr('API Key 已启用'):tr('同步口令（至少 12 个字符）')});
  ldbDeepSeekProps(this.rememberInput,{disabled:blocked||!available||enabled&&this.deviceState.remembered&&!this.editingKey});
  ldbDeepSeekProps(this.enableButton,{disabled:blocked||!validKey||enabled&&!this.editingKey});
  ldbDeepSeekProps(this.unlockButton,{hidden:!saved,disabled:blocked||enabled||!validPass});ldbDeepSeekText(this.unlockButton,tr(enabled?'已解锁':'解锁同步密钥'));
  ldbDeepSeekProps(this.saveButton,{disabled:blocked||!validPass||!(this.editingKey?validKey:validKey||enabled)||enabled&&!editing});
  ldbDeepSeekProps(this.lockButton,{hidden:!enabled,disabled:blocked});
  ldbDeepSeekProps(this.changeKeyButton,{hidden:!enabled||editing,disabled:blocked});
  ldbDeepSeekProps(this.changeSyncButton,{hidden:!enabled||editing,disabled:blocked});ldbDeepSeekText(this.changeSyncButton,tr(saved?'更改同步口令':'设置加密同步'));
  ldbDeepSeekProps(this.cancelKeyButton,{hidden:!editing,disabled:blocked});
  ldbDeepSeekProps(this.disableButton,{disabled:blocked||!enabled&&!this.deviceState.remembered});ldbDeepSeekProps(this.forgetButton,{hidden:!saved,disabled:blocked});
 }
 resetKeyEditor(){this.keyInput.value=this.passInput.value='';this.editingKey=this.editingSync=false;this.refreshDeviceState();this.rememberInput.checked=this.deviceState.remembered||getDeepSeekSecret().deviceAvailable(this.app);}
 lockKey(){
  try{getDeepSeekSecret().lockDevice(this.app,this.plugin.settings.deepSeekEncrypted);}catch(e){throw this.secretError(e);}
  this.service.disable();this.service.locked=true;this.resetKeyEditor();this.motion.setOpen(this.config,true);
 }
 needsPlan(){
  if(this.mode.value==='inbox')return true;
  const paths=this.batch(),inbox=new Set(this.batch('inbox'));
  return paths.length>0&&paths.every(p=>p.startsWith('temp/')||inbox.has(p));
 }
 refreshSources(){if(!this.closed&&!this.working)this.requestSync();}
 batch(mode=this.mode.value){
  const s=this.plugin.snapshot||{};
  if(!this.batchCache||this.batchCache.library!==s.library||this.batchCache.inbox!==s.inbox||this.batchCache.collections!==s.collections)this.batchCache={library:s.library,inbox:s.inbox,collections:s.collections,batches:{}};
  const cache=this.batchCache.batches;if(cache[mode])return cache[mode];
  if(mode==='selection'){
   const web=new Set((s.library||[]).filter(r=>r.kind==='web').map(r=>r.path));
   return cache[mode]=this.paths.filter(path=>/^(papers|temp)\/.*\.pdf$/i.test(path)||web.has(path));
  }
  const filed=mode==='pending'?new Set((s.collections||[]).filter(g=>g.scope==='library').flatMap(g=>g.members.map(m=>m.path))):null,paths=new Set();
  for(const r of (mode==='inbox'?s.inbox:s.library)||[]){
   if(r.organizing==='人工完成'||mode==='pending'&&r.inbox)continue;
   if(mode==='pending'&&(r.organizing==='人工完成'||!Organization.temporaryTitle(r)&&r.tags?.trim()&&r.tldr?.trim()&&r.tldr!=='待整理'&&filed.has(r.path)))continue;
   paths.add(r.path);
  }
  return cache[mode]=[...paths];
 }
 cancelSync(){if(this.syncFrame)this.renderWin?.cancelAnimationFrame(this.syncFrame);this.syncFrame=null;}
 requestSync(){
  if(this.closed)return;this.pendingSync=true;if(this.renderDoc?.hidden||this.syncFrame)return;
  if(!this.renderWin?.requestAnimationFrame){this.sync();return;}
  this.syncFrame=this.renderWin.requestAnimationFrame(()=>{this.syncFrame=null;this.sync();});
 }
 sync(){
  if(this.closed||!this.task)return;if(this.renderDoc?.hidden){this.pendingSync=true;return;}this.cancelSync();this.pendingSync=false;const w=this.work,busy=this.working,ready=this.service.enabled&&!this.service.wire,pending=w.pending.length;
  this.syncKeyControls();ldbDeepSeekProps(this.mode,{disabled:busy||!!w.plan||!!w.queuedCount});ldbDeepSeekProps(this.generate,{disabled:busy||!!w.queuedCount||!ready||!this.service.selectedModel()||!this.batch().length||!!pending||!!w.plan,title:pending?tr('请先应用或清除当前结果'):''});
  ldbDeepSeekText(this.generate,tr(this.needsPlan()?'规划收件箱':'开始整理'));
  this.syncBatches();
  this.syncModels();
  for(const [mode,opt] of Object.entries(this.scopeOptions))ldbDeepSeekText(opt,tr(mode==='selection'?'当前选择':mode==='inbox'?'收件箱':'文献库中信息不完整的论文')+' · '+this.batch(mode).length);
  ldbDeepSeekProps(this.task,{hidden:['idle','ready','done','plan'].includes(w.phase)});ldbDeepSeekClass(this.task,'is-working',w.running);ldbDeepSeekClass(this.task,'is-error',w.phase==='error');ldbDeepSeekText(this.taskTitle,ldbDeepSeekLabel(this.plugin));ldbDeepSeekText(this.filename,w.filename||w.error||'');ldbDeepSeekProps(this.filename,{hidden:!w.filename&&!w.error,title:w.filename||w.error});ldbDeepSeekProps(this.track,{hidden:!w.running});ldbDeepSeekProps(this.bar.style,{width:(w.total?100*w.done/w.total:0)+'%'});const icon=w.running?'loader-circle':w.phase==='error'?'circle-alert':w.phase==='stopped'?'pause':'check';if(icon!==this.taskIconName){this.taskIconName=icon;setIcon(this.taskIcon,icon);}
  ldbDeepSeekProps(this.cancelButton,{hidden:!w.running,disabled:!!w.stopping});ldbDeepSeekText(this.closeButton,tr(w.running?'后台继续':'关闭'));ldbDeepSeekText(this.footerHint,w.running?tr('关闭面板后继续整理'):'');
  ldbDeepSeekProps(this.preview,{hidden:!w.items.length});ldbDeepSeekProps(this.empty,{hidden:w.items.length>0||w.running||!!w.plan});ldbDeepSeekText(this.resultTitle,tr('整理结果')+' · '+pending);ldbDeepSeekProps(this.applyAll,{disabled:busy||!ready||!w.ready.length});ldbDeepSeekProps(this.clearButton,{disabled:busy});
  this.syncPlan();
  ldbDeepSeekText(this.empty,tr(this.needsPlan()?'先规划分类与子类，确认后再整理摘要和标签。':'生成篇名、TL;DR、标签和分类，修改后应用。'));
  if(this.renderedRevision!==w.revision&&this.renderResults()!==false)this.renderedRevision=w.revision;
  for(const [item,view] of this.itemViews){
   const review=w.review(item);ldbDeepSeekText(view.state,item.applied?tr('已应用'):item.error?tr('需要处理'):review.pending?.length?tr('待确认'):'');
   if(!view.body)continue;
   view.syncPlacementReview?.();const disabled=busy||!!item.applied;
   if(view.controlsDisabled!==disabled){view.controlsDisabled=disabled;for(const input of view.body.querySelectorAll('input,textarea,select,button'))input.disabled=disabled;for(const select of view.body.querySelectorAll('[data-child]'))select.disabled=disabled||!select.dataset.parent;}
   ldbDeepSeekProps(view.apply,{disabled:disabled||!ready||!!item.tagInput?.trim()||!!review.error});ldbDeepSeekProps(view.ignore,{disabled:busy});ldbDeepSeekText(view.validation,item.tagError||review.error||'');
  }
 }
 syncBatches(){
  const w=this.work,q=w.queue,busy=this.working,queued=w.queuedCount;
  ldbDeepSeekProps(this.batchBar,{hidden:!q||q.count===1&&!queued});
  ldbDeepSeekText(this.batchStatus,q?tr('第 {0} / {1} 批',q.index,q.count):'');
  const waiting=busy||!!w.plan;ldbDeepSeekProps(this.nextBatchButton,{hidden:!queued||waiting,disabled:!!w.pending.length||!this.service.enabled||!!this.service.wire||!this.service.selectedModel(),title:w.pending.length?tr('应用或忽略本批结果后，继续下一批'):''});
  ldbDeepSeekText(this.nextBatchButton,tr(q?.active.length?'重试本批':'继续下一批'));
  ldbDeepSeekProps(this.discardQueueButton,{hidden:!queued||waiting,disabled:busy});
 }
 syncPlan(){
  const w=this.work,plan=w.plan;this.planPanel.hidden=!plan;this.planActions.hidden=!plan;
  if(this.renderedPlan!==plan){this.planPanel.empty();this.planActions.empty();this.renderedPlan=plan;this.planControls=[];this.refreshPlanChoices=null;if(plan)this.renderPlan(plan);}
  for(const input of this.planControls||[])input.disabled=this.working||!this.service.enabled;
 }
 renderPlan(plan){
  const root=this.planPanel,w=this.work,heading=root.createDiv('ldb-deepseek-result-heading');heading.createEl('strong',{text:tr('分类与子类')+' · '+plan.papers.length});
  root.createEl('p',{cls:'ldb-deepseek-plan-intro',text:tr('先确认归属；下一步生成摘要和标签，可逐篇修改后应用。')});
  const rows=[];const fill=(list,values)=>{const key=JSON.stringify(values);if(list.dataset.options===key)return;list.dataset.options=key;list.empty();for(const value of values)list.createEl('option',{value});};
  this.refreshPlanChoices=()=>{
   const choices=this.service.planChoices(plan,w.planEdits),fold=s=>s.normalize('NFKC').trim().toLocaleLowerCase();
   for(const {p,child,categories,children,note} of rows){
    const target=w.planEdits.placements?.[p.path]||p,group=choices.find(c=>fold(c.name)===fold(target.category));fill(categories,choices.map(c=>c.name));fill(children,group?.subgroups||[]);if(child.value!==target.subgroup)child.value=target.subgroup;
    const existing=plan.base.categories.find(c=>fold(c.name)===fold(target.category)),proposed=plan.categories.find(c=>fold(c.name)===fold(target.category)),fresh=[];
    if(target.category.trim()&&!existing)fresh.push({label:target.category,reason:proposed?.reason||''});
    if(target.subgroup.trim()&&!existing?.subgroups.some(s=>fold(s)===fold(target.subgroup)))fresh.push({label:target.subgroup,reason:proposed?.subgroups.find(s=>fold(s.name)===fold(target.subgroup))?.reason||''});
    const key=JSON.stringify(fresh);if(note.dataset.value!==key){note.dataset.value=key;note.empty();note.hidden=!fresh.length;if(fresh.length){note.createSpan({text:tr('新建')+' · '+fresh.map(x=>x.label).join(' / ')});const reasons=fresh.filter(x=>x.reason);if(reasons.length){const details=note.createEl('details');details.createEl('summary',{text:tr('新建理由')});for(const x of reasons)details.createEl('p',{text:x.reason});}}}
   }
  };
  for(const p of plan.papers){
   const row=root.createDiv('ldb-deepseek-plan-paper');row.createDiv({cls:'ldb-deepseek-plan-title',text:p.title,attr:{title:p.filename}});
   const inputs=row.createDiv('ldb-deepseek-plan-placement'),target=w.planEdits.placements?.[p.path]||p;
   const combo=(label,value)=>{const id='ldb-plan-'+Math.random().toString(36).slice(2),field=this.field(inputs,label),input=field.createEl('input',{type:'text',attr:{'aria-label':tr(label)+' · '+p.title,list:id,maxlength:'80',placeholder:tr(label==='子类'?'未分组':'选择分类')}}),options=field.createEl('datalist',{attr:{id}});input.value=value;this.planControls.push(input);return {input,options};};
   const category=combo('分类',target.category),child=combo('子类',target.subgroup);
   category.input.addEventListener('input',()=>this.setPlanPlacement(p,'category',category.input.value));child.input.addEventListener('input',()=>this.setPlanPlacement(p,'subgroup',child.input.value));
   const note=inputs.createDiv({cls:'ldb-deepseek-plan-new'});rows.push({p,category:category.input,child:child.input,categories:category.options,children:child.options,note});
  }
  this.refreshPlanChoices();const actions=this.planActions;
  this.planControls.push(this.taskButton(actions,'确认归属并继续',()=>w.confirmPlan(),'mod-cta'),this.button(actions,'放弃方案',()=>w.clear()));
 }
 setPlanPlacement(p,field,value){
  if(this.working||!this.work.plan?.papers.includes(p)||!['category','subgroup'].includes(field))return;
  const edits=this.work.planEdits,previous=edits.placements?.[p.path]||{category:p.category,subgroup:p.subgroup},next={...previous,[field]:value};
  if(field==='category'&&previous.category.normalize('NFKC').trim().toLocaleLowerCase()!==value.normalize('NFKC').trim().toLocaleLowerCase())next.subgroup='';
  this.work.planEdits={...edits,placements:{...edits.placements,[p.path]:next}};this.refreshPlanChoices?.();
 }
 renderResults(){
  if(!this.plugin.snapshot)return false;const w=this.work;for(const [item,view] of this.itemViews)if(!w.items.includes(item)||item.ignored){view.root.remove();this.itemViews.delete(item);}
  for(const item of w.items){
   if(item.ignored)continue;
   if(!item.proposal){if(!this.results.querySelector('[data-error-path="'+CSS.escape(item.path)+'"]'))this.results.createDiv({cls:'ldb-form-error',text:item.filename+': '+item.error,attr:{'data-error-path':item.path}});continue;}
   let view=this.itemViews.get(item);if(!view){view=this.renderProposal(item);this.itemViews.set(item,view);}
   view.root.hidden=!!item.ignored;view.state.setText(item.applied?tr('已应用'):item.error?tr('需要处理'):'');view.error?.setText(item.error||'');if(item.applied){this.motion.setOpen(view.root,false);if(!this.motion.disclosures.has(view.root))this.unmountProposal(view);}
  }
  for(const el of this.results.querySelectorAll('[data-error-path]'))if(!w.items.some(i=>!i.proposal&&i.path===el.dataset.errorPath))el.remove();
 }
 values(item){return {...item.proposal.preview,...item.edits};}
 edit(item,field,value){if(this.working||item.applied)return;const equal=(a,b)=>a===b||typeof a==='object'&&typeof b==='object'&&JSON.stringify(a)===JSON.stringify(b);if(equal(this.values(item)[field],value))return;const edits={...item.edits};if(equal(value,item.proposal.preview[field]))delete edits[field];else edits[field]=value;item.edits=edits;this.requestSync();}
 field(parent,label){const box=parent.createDiv('ldb-deepseek-field');box.createEl('label',{text:tr(label)});return box;}
 renderProposal(item){
  const p=item.proposal,root=this.results.createEl('details',{cls:'ldb-deepseek-proposal'});root.open=this.itemViews.size===0&&!item.applied;const summary=root.createEl('summary');summary.title=p.filename;const icon=summary.createSpan();setIcon(icon,'file-text');const title=summary.createSpan({cls:'ldb-deepseek-proposal-title',text:this.values(item).title});const state=summary.createSpan('ldb-deepseek-item-state'),view={item,root,title,state};
  this.proposalViews.set(root,view);
  root.addEventListener('toggle',()=>{if(this.closed||this.itemViews.get(item)!==view||this.motion.disclosures.has(root))return;if(root.open)this.mountProposal(view);else this.unmountProposal(view);this.requestSync();});
  if(root.open)this.mountProposal(view);return view;
 }
 unmountProposal(view){
  if(!view?.body)return;view.body.remove();for(const key of ['body','apply','ignore','error','validation','controlsDisabled','syncPlacementReview'])view[key]=null;
 }
 mountProposal(view){
  if(!view||view.body||view.item.applied||this.closed)return;
  const {item,root,title}=view,p=item.proposal,body=view.body=root.createDiv('ldb-deepseek-proposal-body');
  const titleInput=this.field(body,'篇名').createEl('input',{type:'text',attr:{'aria-label':tr('篇名'),maxlength:'600'}});titleInput.value=this.values(item).title;titleInput.addEventListener('input',()=>{this.edit(item,'title',titleInput.value);title.setText(titleInput.value||p.filename);});
  const tldr=this.field(body,'TL;DR').createEl('textarea',{attr:{rows:'4',maxlength:'1500','aria-label':'TL;DR'}});tldr.value=this.values(item).tldr;tldr.addEventListener('input',()=>this.edit(item,'tldr',tldr.value));
  this.buildTags(this.field(body,'标签'),item);this.buildPlacements(this.field(body,'分类'),item,view);
  const novelties=(p.taxonomy?.tags||[]).map(t=>TagTree.label(t.tag)+': '+t.reason);if(novelties.length){const notes=body.createEl('details',{cls:'ldb-deepseek-novelty'});notes.createEl('summary',{text:tr('新建标签建议')});for(const text of novelties)notes.createEl('p',{text});}
  if(p.uncertainty)body.createEl('p',{cls:'ldb-deepseek-uncertainty',text:p.uncertainty});
  const validation=body.createDiv({cls:'ldb-deepseek-validation',attr:{role:'status'}}),error=body.createDiv({cls:'ldb-form-error',attr:{role:'alert'}}),actions=body.createDiv('ldb-actions');const apply=this.taskButton(actions,'应用到文献库',()=>this.work.apply([item]),'mod-cta'),ignore=this.button(actions,'忽略',()=>this.work.ignore(item),'ldb-deepseek-text-button');Object.assign(view,{apply,ignore,error,validation});this.requestSync();
 }
 tagHuman(item,tag){const base=new Set(item.proposal.preview.tags.split(/\s+/)),row=this.plugin.snapshot.library.find(r=>r.path===item.path);return !base.has(tag)||!!row&&Organization.source(row,tag,true).kind==='human';}
 buildTags(parent,item){
  parent.addClass('ldb-deepseek-tag-field');const chips=parent.createDiv('ldb-deepseek-tags');
  const selected=()=>this.values(item).tags.split(/\s+/).filter(Boolean);
  const draw=()=>{chips.empty();for(const tag of selected()){const addition=item.proposal.taxonomy?.tags?.find(t=>t.tag===tag),chip=chips.createSpan({cls:'ldb-deepseek-tag',text:TagTree.label(tag)+(addition?' · '+tr('新建'):'')});if(addition)chip.title=addition.reason;chip.toggleClass('is-human',this.tagHuman(item,tag));const remove=ldbButton(chip,'',()=>{this.edit(item,'tags',selected().filter(t=>t!==tag).join(' '));draw();},'ldb-deepseek-tag-remove');setIcon(remove,'x');remove.setAttribute('aria-label',tr('移除标签')+' '+TagTree.label(tag));remove.disabled=this.working;}};
  const add=ldbButton(parent,'',()=>this.openDraftTagMap(item,draw),'ldb-deepseek-icon-button');setIcon(add,'plus');add.setAttribute('aria-label',tr('打开标签思维导图'));draw();
 }
 openDraftTagMap(item,draw){
  if(this.working||this.tagMap)return;const owner=this;
  let original=null,base=null,model=null,active=true;
  const view={app:this.app,plugin:this.plugin,get detailRow(){return {tags:owner.values(item).tags};},detailTitle:()=>owner.values(item).title,tagMapState:item.tagMapState,dirty:()=>false,lockFilters(){},reload(){item.tagMapState=view.tagMapState;owner.tagMap=null;if(!owner.closed){draw();owner.sync();}},
   async saveMapTag(tag,checked){const tags=owner.values(item).tags.split(/\s+/).filter(Boolean),next=checked?[...new Set([...tags,tag])]:tags.filter(t=>TagTree.fold(t)!==TagTree.fold(tag));owner.edit(item,'tags',next.join(' '));return true;}};
  const draft={expandAll:true,
   async read(){
    if(!model){
     const source=await TagTree.read(owner.app.vault);if(!active||owner.closed)return {text:null,model:{groups:[]}};
     original=TagTree.effective(source.model,owner.plugin.snapshot.library);base=TagTree.effective(original,[{tags:item.proposal.preview.tags}]);
     const removed=item.tagDraftRemoved||{},known=new Set(original.groups.flatMap(g=>g.tags.map(TagTree.fold)));
     model={groups:base.groups.filter(g=>!removed.groups?.includes(g.name)||original.groups.some(o=>o.name===g.name)).map(g=>({name:g.name,tags:g.tags.filter(t=>!removed.tags?.includes(t)||known.has(TagTree.fold(t)))}))};
     model=TagTree.mergeAdditions(model,item.edits.tagAdditions);model=TagTree.effective(model,[{tags:owner.values(item).tags}]);
    }
    return {text:TagTree.serialize(model),model};
   },
   async store(next){
    if(!active||owner.closed)return null;TagTree.validate(next);
    const groups=next.groups.map(g=>{const before=base.groups.find(b=>b.name===g.name);return {name:g.name,tags:g.tags.filter(t=>!before?.tags.includes(t)),fresh:!before};}).filter(g=>g.fresh||g.tags.length).map(({name,tags})=>({name,tags}));
    const present=new Set(next.groups.flatMap(g=>g.tags));item.tagDraftRemoved={tags:base.groups.flatMap(g=>g.tags.filter(t=>!present.has(t))),groups:base.groups.filter(g=>!next.groups.some(n=>n.name===g.name)).map(g=>g.name)};
    model=next;owner.edit(item,'tagAdditions',{groups});return TagTree.serialize(model);
   },
   close(){active=false;original=base=model=null;},
   canRemove(node){if(!original)return false;if(node.kind==='group')return !original.groups.some(g=>g.name===node.group);const prefix=TagTree.fold(node.tag);return !original.groups.some(g=>g.tags.some(t=>TagTree.fold(t)===prefix||TagTree.fold(t).startsWith(prefix+'/')));},
   async remove(change){const removed=new Set(change.removed.map(TagTree.fold));owner.edit(item,'tags',owner.values(item).tags.split(/\s+/).filter(t=>!removed.has(TagTree.fold(t))).join(' '));await this.store(change.model);},
   isHuman:tag=>owner.tagHuman(item,tag)
  };
  const map=new TagMapModal(view,draft);this.tagMap=view.tagMap=this.plugin.tagMap=map;map.open();
 }
 acceptPlacements(item){
  if(this.working||item.applied||item.ignored)return;const pending=this.work.review(item).pending||[];
  this.edit(item,'acceptedPlacements',[...new Set([...(item.edits.acceptedPlacements||[]),...pending.map(p=>p.key)])]);
 }
 buildPlacements(parent,item,view){
  const rows=parent.createDiv('ldb-deepseek-placements');
  const draw=()=>{rows.empty();const saved=this.values(item).placements,current=saved.length?saved:[{scope:'library',name:'',subgroup:''}],groups=(this.plugin.snapshot.collections||[]).filter(g=>g.scope==='library').map(g=>({name:g.name,subgroups:[...(g.subgroups||[])]}));const novelty=item.proposal.taxonomy;if(novelty?.category&&!groups.some(g=>g.name===novelty.category.name))groups.push({name:novelty.category.name,subgroups:[],fresh:true});if(novelty?.subgroup){const g=groups.find(g=>g.name===novelty.subgroup.category);if(g&&!g.subgroups.includes(novelty.subgroup.name))g.subgroups.push(novelty.subgroup.name);}
   current.forEach((placement,index)=>{const row=rows.createDiv('ldb-deepseek-placement'),category=row.createEl('select',{attr:{'aria-label':tr('分类')}}),child=row.createEl('select',{attr:{'aria-label':tr('子类'),'data-child':'true','data-parent':placement.name}});
    category.createEl('option',{value:'',text:tr('选择分类')});for(const g of groups)category.createEl('option',{value:g.name,text:g.name+(g.fresh?' · '+tr('新建'):'')});category.value=placement.name;
    const children=()=>{const group=groups.find(g=>g.name===category.value);child.empty();child.createEl('option',{value:'',text:tr('未分组')});for(const s of group?.subgroups||[])child.createEl('option',{value:s,text:s+(novelty?.subgroup?.category===group.name&&novelty.subgroup.name===s?' · '+tr('新建'):'')});child.value=(group?.subgroups||[]).includes(placement.subgroup)?placement.subgroup:'';child.dataset.parent=category.value;child.disabled=!category.value;};children();
    category.addEventListener('change',()=>{const next=this.values(item).placements.map(t=>({...t}));next[index]={scope:'library',name:category.value,subgroup:''};this.edit(item,'placements',next);placement=next[index];children();});child.addEventListener('change',()=>{const next=this.values(item).placements.map(t=>({...t}));next[index].subgroup=child.value;this.edit(item,'placements',next);});
    const remove=ldbButton(row,'',()=>{this.edit(item,'placements',this.values(item).placements.filter((_,i)=>i!==index));draw();},'ldb-deepseek-icon-button');setIcon(remove,'x');remove.setAttribute('aria-label',tr('移除分类'));
   });
  };
  const add=ldbButton(parent,'',()=>{const current=this.values(item).placements,group=[...(this.plugin.snapshot.collections||[]),...(item.proposal.taxonomy?.category?[{scope:'library',name:item.proposal.taxonomy.category.name}]:[])].find(g=>g.scope==='library'&&!current.some(t=>t.name===g.name));if(!group){new Notice(tr('没有其他分类，请先在侧栏新建'));return;}this.edit(item,'placements',[...current,{scope:'library',name:'',subgroup:''}]);draw();},'ldb-deepseek-icon-button');setIcon(add,'plus');add.setAttribute('aria-label',tr('添加分类'));draw();
  const confirmation=parent.createDiv({cls:'ldb-deepseek-placement-review',attr:{role:'status'}});let previous;
  view.syncPlacementReview=()=>{
   const pending=this.work.review(item).pending||[],issue=!this.values(item).placements.length?item.proposal.placementIssue:'',key=JSON.stringify([pending,issue]);if(key===previous)return;previous=key;confirmation.empty();confirmation.hidden=!pending.length&&!issue;if(issue)confirmation.createEl('p',{text:issue});
   if(pending.length){confirmation.createEl('p',{text:tr('待确认')+' · '+pending.map(p=>p.label).join('、')});const reasons=pending.filter(p=>p.reason);if(reasons.length){const details=confirmation.createEl('details');details.createEl('summary',{text:tr('新建理由')});for(const p of reasons)details.createEl('p',{text:p.label+': '+p.reason});}ldbButton(confirmation,tr('接受新建'),()=>this.acceptPlacements(item));}
  };view.syncPlacementReview();
 }
 syncModels(){
  if(!this.modelSelect)return;if(this.modelOptions!==this.service.models||this.modelOptionId!==this.service.modelId){this.modelOptions=this.service.models;this.modelOptionId=this.service.modelId;this.modelSelect.empty();if(!this.service.selectedModel())this.modelSelect.createEl('option',{value:'',text:tr(this.service.models.length?'请选择模型':'先获取模型列表')});for(const m of this.service.models)this.modelSelect.createEl('option',{value:m.id,text:m.name,attr:{title:m.id}});this.modelSelect.value=this.service.selectedModel()?.id||'';}
  ldbDeepSeekProps(this.modelSelect,{disabled:this.working||!this.service.enabled||!this.service.models.length});ldbDeepSeekProps(this.modelsButton,{disabled:this.working||!this.service.enabled||!!this.service.wire});ldbDeepSeekText(this.modelsButton,tr(this.loadingModels?'获取中…':this.service.models.length?'刷新模型':'获取模型'));
 }
 async loadModels(force=false){this.loadingModels=true;this.syncModels();try{await this.service.listModels(force);}finally{this.loadingModels=false;if(!this.closed)this.syncModels();}}
 async changeModel(id){const previous=this.service.modelId;this.service.selectModel(id);try{const saved=await this.plugin.loadData()||{};if(this.closed)return;const next={...saved,deepSeekModel:id};await this.plugin.saveData(next);this.plugin.settings={...this.plugin.settings,...next};}catch(e){this.service.modelId=previous;throw e;}}
 secretError(error){return Error(tr(error.message==='DEVICE_STORAGE_UNAVAILABLE'?'此设备暂不支持安全记忆密钥，仅本次启用':error.message==='DEVICE_STORAGE_FAILED'?'本机密钥存储失败，请重试或取消记住密钥':error.message==='PASSPHRASE_LENGTH'?'同步口令需为 12–1024 个字符':error.message==='CRYPTO_UNAVAILABLE'?'此设备不支持加密同步，请使用本次运行的密钥':error.message==='UNLOCK_FAILED'?'口令错误或同步密钥损坏，未解锁':'密钥或加密数据无效'));}
 enableKey(key){
  if(!/^[A-Za-z0-9_-]{12,256}$/.test(key))throw Error(tr('请输入有效的 DeepSeek API Key'));
  try{if(this.rememberInput.checked)getDeepSeekSecret().rememberDevice(this.app,key,this.plugin.settings.deepSeekEncrypted);else getDeepSeekSecret().forgetDevice(this.app);}catch(e){throw this.secretError(e);}
  this.service.enable(key);this.resetKeyEditor();this.motion.setOpen(this.config,false);
 }
 async restoreDeviceKey(){
  const saved=await this.plugin.loadData()||{};if(this.closed||this.plugin.stopped)return;
  this.plugin.settings.deepSeekEncrypted=saved.deepSeekEncrypted;
  this.refreshDeviceState();if(this.service.locked||this.deviceState.locked){this.service.locked=true;return;}
  let key=getDeepSeekSecret().restoreDevice(this.app,saved.deepSeekEncrypted);
  if(key){this.service.enable(key);this.rememberInput.checked=true;this.motion.setOpen(this.config,false);}key=null;
 }
 async writeSecret(value){const saved=await this.plugin.loadData()||{};if(this.closed)return;const next={...saved};if(value)next.deepSeekEncrypted=value;else delete next.deepSeekEncrypted;await this.plugin.saveData(next);this.plugin.settings={...this.plugin.settings,...next};if(!value)delete this.plugin.settings.deepSeekEncrypted;}
 async saveSecret(){const key=this.keyInput.value.trim()||this.service.key;let encrypted;try{encrypted=await getDeepSeekSecret().encrypt(key,this.passInput.value);}catch(e){throw this.secretError(e);}if(this.closed)return;await this.writeSecret(encrypted);if(this.closed)return;this.enableKey(key);await this.loadModels();}
 async unlockSecret(){const saved=await this.plugin.loadData()||{};if(this.closed)return;this.plugin.settings.deepSeekEncrypted=saved.deepSeekEncrypted;let key;try{key=await getDeepSeekSecret().decrypt(saved.deepSeekEncrypted,this.passInput.value);}catch(e){throw this.secretError(e);}if(this.closed)return;this.enableKey(key);await this.loadModels();}
 async forgetSecret(){try{getDeepSeekSecret().forgetDevice(this.app);}catch(e){throw this.secretError(e);}await this.writeSecret(null);if(this.closed)return;this.service.disable();this.service.locked=true;this.resetKeyEditor();}
 onClose(){
  this.closed=true;this.motion?.destroy();this.motion=null;this.cancelSync();this.renderDoc?.removeEventListener('visibilitychange',this.onVisibility);this.renderDoc=this.renderWin=this.onVisibility=null;
  this.tagMap?.close(true);this.tagMap=null;this.unsubscribe?.();this.unsubscribe=null;if(this.plugin.deepSeekModal===this)this.plugin.deepSeekModal=null;if(this.keyInput)this.keyInput.value=this.passInput.value='';
  this.itemViews.clear();this.proposalViews=new WeakMap();this.planControls=[];this.renderedPlan=this.refreshPlanChoices=null;this.batchCache=this.modelOptions=null;this.paths=[];this.scopeOptions={};this.contentEl.empty();
  for(const key of ['batchBar','batchStatus','nextBatchButton','discardQueueButton','planPanel','planActions','scroll','error','mode','modelSelect','modelsButton','generate','task','taskIcon','taskTitle','filename','track','bar','preview','resultTitle','applyAll','clearButton','results','empty','footerHint','cancelButton','closeButton','keyStatus','keyEditor','enableButton','lockButton','changeKeyButton','changeSyncButton','cancelKeyButton','config','rememberInput','keyInput','passInput','unlockButton','saveButton','disableButton','forgetButton'])this[key]=null;
 }
}
