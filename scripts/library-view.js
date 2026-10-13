// Zotero-style workspace. Markdown is the only canonical data store.
const LIBRARY_VIEW='literature-database-browser', NAV_VIEW='literature-database-navigation';
const LIBRARY_SOURCE='library.md', COLLECTION_SOURCE='collections.md';
const {ItemView, Platform, setIcon, Modal, Menu}=require('obsidian');
const libraryText=Engine.decodeText;
const SCOPES=Object.fromEntries(Object.entries({library:'文献库',inbox:'收件箱',reviews:'审稿',submissions:'投稿',projects:'写作项目'}).map(([key,value])=>[key,()=>tr(value)]));
for(const key of Object.keys(SCOPES)){const label=SCOPES[key];Object.defineProperty(SCOPES,key,{get:label});}
const TRACK_FILES={reviews:'reviews.md',submissions:'submissions.md'};
const PAPER_DRAG='application/x-literature-database-row';
const GROUP_DRAG='application/x-literature-database-group';
function ldbDropTarget(element,plugin,target=null,enabled=()=>true){
  const types=e=>Array.from(e.dataTransfer?.types||[]);
  const destination=()=>typeof target==='function'?target():typeof target==='string'?{scope:'library',category:target}:target||{scope:'inbox'};
  const mode=e=>{
    const nav=destination();if(!enabled()||!nav)return null;
    if(types(e).includes(PAPER_DRAG)){
      const drag=plugin.dragState;if(!drag||!nav.category||plugin.hasPendingEdit())return null;
      if(plugin.snapshot?.collections&&['library','projects'].includes(drag.scope)&&['library','projects'].includes(nav.scope)){
        if(nav.category===Engine.UNFILED_CATEGORY)return null;
        return e.metaKey&&drag.from&&drag.from.scope===nav.scope?'move':'copy';
      }
      return (drag.scope||'library')===nav.scope?'move':null;
    }
    return types(e).includes('Files')&&!plugin.hasPendingEdit()&&(['inbox','reviews','submissions'].includes(nav.scope)||(plugin.snapshot?.collections&&['library','projects'].includes(nav.scope)&&nav.category&&nav.category!==Engine.UNFILED_CATEGORY))?'copy':null;
  };
  const over=e=>{
    if(!enabled()||!types(e).some(t=>t==='Files'||t===PAPER_DRAG))return;
    e.preventDefault();e.stopPropagation();const effect=mode(e);
    e.dataTransfer.dropEffect=effect||'none';element.toggleClass('is-drop-target',!!effect);
  };
  element.addEventListener('dragenter',over);element.addEventListener('dragover',over);
  element.addEventListener('dragleave',e=>{if(!element.contains(e.relatedTarget))element.removeClass('is-drop-target');});
  element.addEventListener('drop',async e=>{
    if(!enabled()||!types(e).some(t=>t==='Files'||t===PAPER_DRAG))return;
    e.preventDefault();e.stopPropagation();element.removeClass('is-drop-target');const nav=destination(),effect=mode(e);
    try{
      if(effect&&types(e).includes(PAPER_DRAG))await plugin.moveDraggedPaper(e.dataTransfer.getData(PAPER_DRAG),nav.category,nav.scope,effect==='move');
      else if(effect==='copy')await plugin.importDroppedFiles(Array.from(e.dataTransfer.files),nav);
      else new Notice(tr('PDF 请拖到收件箱、具体分类或项目、审稿或投稿'));
    }catch(error){new Notice(error.message,8000);}
  });
}
function ldbGroupReorderTarget(element,plugin,scope,name){
  element.draggable=true;element.addClass('ldb-sortable-group');
  const isGroup=e=>Array.from(e.dataTransfer?.types||[]).includes(GROUP_DRAG);
  const allowed=()=>plugin.groupDrag?.scope===scope&&!plugin.hasPendingEdit();
  const position=e=>e.clientY>=element.getBoundingClientRect().top+element.getBoundingClientRect().height/2;
  element.addEventListener('click',e=>{if(Date.now()<(plugin.suppressGroupClickUntil||0)){e.preventDefault();e.stopImmediatePropagation();}},true);
  element.addEventListener('dragstart',e=>{
    e.stopPropagation();if(!plugin.beginGroupDrag(e,scope,name)){e.preventDefault();return;}element.addClass('is-group-dragging');
  });
  const over=e=>{
    if(!isGroup(e))return;e.preventDefault();e.stopPropagation();plugin.clearGroupDropIndicators();
    const valid=allowed();e.dataTransfer.dropEffect=valid?'move':'none';if(valid&&plugin.groupDrag.name!==name)element.addClass(position(e)?'is-order-after':'is-order-before');
  };
  element.addEventListener('dragenter',over);element.addEventListener('dragover',over);
  element.addEventListener('dragleave',e=>{if(!element.contains(e.relatedTarget)){element.removeClass('is-order-before');element.removeClass('is-order-after');}});
  element.addEventListener('drop',async e=>{
    if(!isGroup(e))return;e.preventDefault();e.stopPropagation();plugin.clearGroupDropIndicators();
    try{if(!allowed())throw new Error(tr('请在分类、审稿或投稿各自的区域内排序'));await plugin.moveDraggedGroup(e.dataTransfer.getData(GROUP_DRAG),scope,name,position(e));}
    catch(error){new Notice(error.message,8000);}finally{plugin.endGroupDrag();}
  });
  element.addEventListener('dragend',()=>plugin.endGroupDrag());
}
function ldbButton(parent,text,action,cls='') {
  const b=parent.createEl('button',{text,cls,attr:{type:'button'}}); b.addEventListener('click',action); return b;
}
class LibraryNavigation extends ItemView {
  constructor(leaf,plugin){super(leaf);this.plugin=plugin;}
  getViewType(){return NAV_VIEW;}
  getDisplayText(){return tr('文献分类');}
  getIcon(){return 'library';}
  async onOpen(){
    this.closed=false;
    this.contentEl.addClass('ldb-navigation');
    const doc=this.contentEl.ownerDocument;
    this.registerDomEvent(doc,'visibilitychange',()=>this.updateCountdowns());
    this.registerDomEvent(doc.defaultView,'focus',()=>this.updateCountdowns());
    this.register(()=>this.stopCountdowns());
    const isGroup=e=>Array.from(e.dataTransfer?.types||[]).includes(GROUP_DRAG);
    this.contentEl.addEventListener('dragover',e=>{if(isGroup(e)){e.preventDefault();e.dataTransfer.dropEffect='none';this.plugin.clearGroupDropIndicators();}});
    this.contentEl.addEventListener('drop',e=>{if(isGroup(e)){e.preventDefault();this.plugin.endGroupDrag();}});
    this.render();
  }
  render(){
    if(this.closed||this.plugin.stopped||this.renaming||this.plugin.groupDrag)return;
    this.stopCountdowns();this.countdowns=[];
    const root=this.contentEl;root.empty(); const data=this.plugin.snapshot;
    const top=root.createDiv('ldb-nav-heading');top.createEl('strong',{text:'Literature Database'});
    const language=ldbButton(top,'',event=>this.plugin.showLanguageMenu(event),'ldb-language-button');setIcon(language,'languages');language.setAttribute('aria-label',tr('切换界面语言…'));language.title=tr('切换界面语言…');
    const active=this.plugin.navigation||{};
    const add=(label,icon,nav,count,child=false)=>{
      const b=ldbButton(root,'',()=>this.plugin.openLibrary(nav),'ldb-nav-item'+(child?' is-child':''));
      b.setAttribute('aria-label',label);setIcon(b.createSpan('ldb-nav-icon'),icon);
      b.createSpan({cls:'ldb-nav-label',text:label});if(count!==undefined)b.createSpan({cls:'ldb-nav-count',text:String(count)});
      const selected=active.scope===nav.scope&&(active.category||'')===(nav.category||'')&&(active.status||'')===(nav.status||'');
      b.toggleClass('is-active',selected);b.setAttribute('aria-current',selected?'page':'false');return b;
    };
    add(tr('全部文献'),'library',{scope:'library',category:'',status:''},data?.library.length||0);
    const inbox=add(tr('收件箱'),'inbox',{scope:'inbox',category:'',status:''},data?.inbox.length||0);
    inbox.title=tr('将本地 PDF 拖到这里导入');ldbDropTarget(inbox,this.plugin);
    add(tr('在读'),'book-open',{scope:'library',category:'',status:'在读'},data?.library.filter(r=>r.status==='在读').length||0);
    add(tr('待读'),'bookmark',{scope:'library',category:'',status:'待读'},data?.library.filter(r=>r.status==='待读').length||0);
    const heading=root.createDiv('ldb-nav-section');heading.createSpan({text:tr('分类')});
    ldbButton(heading,'＋',()=>new CategoryModal(this.plugin).open(),'ldb-nav-add').setAttribute('aria-label',tr('新建分类'));
    for(const name of data?.categories||[]){
      add(name===Engine.UNFILED_CATEGORY?tr(name):name,'folder',{scope:'library',category:name,status:''},Engine.filterLibrary(data.library,{category:name}).length,true);
      const button=root.lastElementChild;
      if(name!==Engine.UNFILED_CATEGORY)this.groupMenu(button,'library',name);
      if(name!==Engine.UNFILED_CATEGORY)ldbGroupReorderTarget(button,this.plugin,'library',name);
      ldbDropTarget(button,this.plugin,name);button.title=name+tr(' · 拖动排序 · 拖入论文加入分类');
    }
    if(data?.collections){
      const heading=root.createDiv('ldb-nav-section');heading.createSpan({text:tr('写作项目')});
      ldbButton(heading,'＋',()=>new CategoryModal(this.plugin,'projects').open(),'ldb-nav-add').setAttribute('aria-label',tr('新建写作项目'));
      for(const name of data.groups.projects){
        const button=add(name,'notebook-pen',{scope:'projects',category:name,status:''},data.library.filter(r=>r.projects.includes(name)).length,true);
        this.addCountdown(button,name,data.deadlines?.projects?.[name]);
        this.groupMenu(button,'projects',name);ldbGroupReorderTarget(button,this.plugin,'projects',name);ldbDropTarget(button,this.plugin,{scope:'projects',category:name});button.title=name+tr(' · 拖入参考文献');
      }
    }
    root.createDiv({cls:'ldb-nav-section',text:tr('稿件管理')});
    for(const scope of ['reviews','submissions']){
      const button=add(SCOPES[scope],scope==='reviews'?'clipboard-check':'send',{scope,category:'',status:''},data?.[scope].length||0);
      const heading=root.createDiv('ldb-role-heading');heading.appendChild(button);
      const plus=ldbButton(heading,'＋',()=>new VenueModal(this.plugin,scope).open(),'ldb-nav-add');plus.setAttribute('aria-label',tr(scope==='reviews'?'新增审稿 Venue':'新增投稿 Venue'));
      button.title=tr('拖入 PDF');ldbDropTarget(button,this.plugin,{scope});
      const staging=this.plugin.stagingGroup(scope),groups=[staging,...(data?.groups[scope]||[]).filter(g=>g!==staging)];
      for(const group of groups){
        const child=add(group===staging?tr('暂存区'):group,group===staging?'inbox':'folder',{scope,category:group,status:''},data?.[scope].filter(r=>r.category===group).length||0,true);
        ldbDropTarget(child,this.plugin,{scope,category:group});
        if(!Engine.isStagingGroup(group)){
          this.groupMenu(child,scope,group);ldbGroupReorderTarget(child,this.plugin,scope,group);child.title=group+tr(' · 拖动排序');
          this.addCountdown(child,group,data?.deadlines?.[scope]?.[group]);
        }
      }
    }
    const footer=root.createDiv('ldb-nav-bottom');
    ldbButton(footer,tr('交给 Agent 整理…'),()=>new AgentHandoffModal(this.plugin).open());
    ldbButton(footer,tr('回收站'),()=>new TrashModal(this.plugin).open(),'ldb-trash-link');
    if(this.plugin.lastError)root.createDiv({cls:'ldb-form-error',text:this.plugin.lastError});
    this.updateCountdowns();
  }
  addCountdown(button,name,due){
    if(!due||due==='—')return;
    const badge=button.querySelector('.ldb-nav-label').createSpan('ldb-venue-countdown');
    this.countdowns.push({badge,button,name,due});
  }
  stopCountdowns(){clearTimeout(this.countdownTimer);this.countdownTimer=null;}
  updateCountdowns(){
    this.stopCountdowns();
    if(this.closed||this.plugin.stopped||this.contentEl.ownerDocument.hidden)return;
    const now=Date.now();let pending=false;
    for(const {badge,button,name,due} of this.countdowns||[]){
      if(!badge.isConnected)continue;
      const raw=Engine.deadlineCountdown(due,now),text=tr(raw),description=raw==='已截止'?text:tr('剩余 ')+text;
      if(badge.textContent!==text)badge.setText(text);
      badge.title=tr('截止：')+Engine.displayDeadline(due);
      button.setAttribute('aria-label',name+' · '+description);
      button.title=name+' · '+description+' · '+badge.title+tr(' · 拖动排序');
      pending ||= Engine.deadline(due)>now;
    }
    // Only update visible countdown text; never reload metadata or redraw an editor.
    if(pending)this.countdownTimer=setTimeout(()=>this.updateCountdowns(),60000);
  }
  async onClose(){this.closed=true;this.stopCountdowns();this.countdowns=[];}
  groupMenu(button,scope,name){
    button.addEventListener('contextmenu',e=>{
      e.preventDefault();e.stopPropagation();if(this.renaming)return;
      const menu=new Menu();
      menu.addItem(item=>item.setTitle(tr('重命名')).setIcon('pencil').onClick(()=>this.beginRename(button,scope,name)));
      if(scope==='library')menu.addItem(item=>item.setTitle(tr('删除分类，保留文献')).setIcon('trash-2').onClick(async()=>{
        try{await this.plugin.deleteLibraryCategory(name);new Notice(tr('分类已删除，文献仍保留在库中'));}catch(error){new Notice(error.message,8000);}
      }));
      if(scope==='projects'){
        menu.addItem(item=>item.setTitle(tr('设置截止时间')).setIcon('calendar').onClick(()=>new VenueDeadlineModal(this.plugin,scope,name).open()));
        menu.addItem(item=>item.setTitle(tr('导出参考文献…')).setIcon('download').onClick(()=>new CitationExportModal(this.plugin,this.plugin.snapshot.library.filter(r=>r.projects.includes(name)),name).open()));
        menu.addItem(item=>item.setTitle(tr('删除项目，保留文献')).setIcon('trash-2').onClick(async()=>{try{await this.plugin.deleteProject(name);new Notice(tr('项目已删除，文献仍保留在库中'));}catch(e){new Notice(e.message,8000);}}));
      }
      if(TRACK_FILES[scope]){
        menu.addItem(item=>item.setTitle(tr('设置截止时间')).setIcon('calendar').onClick(()=>new VenueDeadlineModal(this.plugin,scope,name).open()));
        menu.addItem(item=>item.setTitle(tr('删除 Venue，稿件移回暂存区')).setIcon('trash-2').onClick(async()=>{
          try{await this.plugin.deleteVenue(scope,name);new Notice(tr('Venue 已删除，稿件已移回暂存区'));}catch(error){new Notice(error.message,8000);}
        }));
      }
      menu.showAtMouseEvent(e);
    });
  }
  beginRename(button,scope,name){
    if(this.plugin.hasPendingEdit()||this.plugin.importing){new Notice(tr('请先保存或取消编辑，并等待当前操作结束'));return;}
    if(!button.isConnected){this.render();new Notice(tr('列表已更新，请重新右键重命名'));return;}
    this.renaming={scope,name};
    const editor=button.ownerDocument.createElement('div');editor.className='ldb-nav-item is-child ldb-nav-renaming';
    setIcon(editor.createSpan('ldb-nav-icon'),'folder');
    const input=editor.createEl('input',{type:'text',cls:'ldb-nav-rename-input',attr:{'aria-label':scope==='library'?tr('重命名分类'):scope==='projects'?tr('重命名项目'):tr('重命名 Venue')}});input.value=name;
    button.replaceWith(editor);let saving=false,finished=false;
    const finish=()=>{if(finished)return;finished=true;this.renaming=null;this.render();};
    const save=async()=>{
      if(saving||finished)return;
      const to=input.value.trim();if(to===name){finish();return;}
      saving=true;input.readOnly=true;
      try{await this.plugin.renameGroup(scope,name,to);finish();}
      catch(error){input.readOnly=false;saving=false;input.setAttribute('aria-invalid','true');input.title=error.message;new Notice(error.message,8000);input.focus();}
    };
    input.addEventListener('keydown',e=>{
      e.stopPropagation();if(e.isComposing||e.keyCode===229)return;
      if(e.key==='Enter'){e.preventDefault();save();}
      else if(e.key==='Escape'&&!saving){e.preventDefault();finish();}
    });
    input.addEventListener('blur',save);
    input.addEventListener('input',()=>{input.removeAttribute('aria-invalid');input.title='';});
    input.focus();input.select();
  }

}
class CategoryModal extends Modal {
  constructor(plugin,scope='library'){super(plugin.app);this.plugin=plugin;this.scope=scope;}
  onOpen(){
    this.titleEl.setText(this.scope==='projects'?tr('新建写作项目'):tr('新建分类'));
    const input=this.contentEl.createEl('input',{type:'text',attr:{placeholder:tr('例如：具身评测'),'aria-label':tr('分类名称')}});
    input.addClass('ldb-full-width');
    const choice=this.scope==='projects'?ldbSharedDeadlineChoice(this.plugin,this.scope,this.contentEl,input):()=>null;
    const error=this.contentEl.createDiv('ldb-form-error');
    const save=ldbButton(this.contentEl,tr('创建'),async()=>{
      save.disabled=true;try{
        const name=input.value.trim();
        await this.plugin.newCollection(this.scope,name,choice());
        this.close(); await this.plugin.openLibrary({scope:this.scope,category:name,status:''});
      }catch(e){error.setText(e.message);save.disabled=false;}
    },'mod-cta');
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229)save.click();});input.focus();
  }
  onClose(){this.contentEl.empty();}
}
class VenueModal extends Modal {
  constructor(plugin,scope){super(plugin.app);this.plugin=plugin;this.scope=scope;}
  onOpen(){
    this.titleEl.setText(tr(this.scope==='reviews'?'新增审稿 Venue':'新增投稿 Venue'));
    const input=this.contentEl.createEl('input',{type:'text',attr:{placeholder:tr('例如 CoRL 2027'),'aria-label':tr('Venue 名称')}});input.addClass('ldb-full-width');
    const choice=this.scope==='submissions'?ldbSharedDeadlineChoice(this.plugin,this.scope,this.contentEl,input):()=>null;
    const error=this.contentEl.createDiv('ldb-form-error');const save=ldbButton(this.contentEl,tr('创建'),async()=>{
      save.disabled=true;try{const name=input.value.trim();if(['暂存区','待确定 venue'].includes(name))throw new Error(tr('暂存区已存在'));await this.plugin.newVenue(this.scope,name,choice());this.close();await this.plugin.openLibrary({scope:this.scope,category:name});}catch(e){error.setText(e.message);save.disabled=false;}
    },'mod-cta');input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229)save.click();});input.focus();
  }
  onClose(){this.contentEl.empty();}
}
function ldbDeadlineFields(form,value){
    const fields={};
    const makeSelect=(parent,label,options)=>{const select=parent.createEl('select',{attr:{'aria-label':label}});for(const [value,text] of options)select.createEl('option',{value,text});return select;};
    const parts=Engine.deadlineParts(value),wrap=form.createDiv('ldb-deadline');
    const dateLabel=wrap.createEl('label',{cls:'ldb-field'});dateLabel.createSpan({text:tr('截止日期')});
    const date=dateLabel.createEl('input',{type:'date',attr:{'aria-label':tr('截止日期')}});date.lang=LdbI18n.getLanguage()==='zh'?'zh-CN':'en';date.value=parts.date;fields.dueDate=date;
    const timeLabel=wrap.createDiv('ldb-field');timeLabel.createSpan({text:tr('时间')});const timeRow=timeLabel.createDiv('ldb-deadline-time');
    const hour=makeSelect(timeRow,tr('截止小时'),Array.from({length:24},(_,i)=>{const v=String(i).padStart(2,'0');return [v,v];}));
    timeRow.createSpan({text:':'});const minute=makeSelect(timeRow,tr('截止分钟'),Array.from({length:60},(_,i)=>{const v=String(i).padStart(2,'0');return [v,v];}));
    hour.value=parts.time.slice(0,2);minute.value=parts.time.slice(3);fields.dueHour=hour;fields.dueMinute=minute;
    const options=[['',tr('选择时区')],['-12:00','AoE · UTC−12:00'],['+08:00',tr('北京时间 · UTC+08:00')],['+00:00','UTC']];
    const extra=['-09:30','-03:30','+03:30','+04:30','+05:30','+05:45','+06:30','+08:45','+09:30','+10:30','+12:45'];
    for(let i=-12;i<=14;i++)extra.push((i<0?'-':'+')+String(Math.abs(i)).padStart(2,'0')+':00');
    if(parts.zone)extra.push(parts.zone);
    for(const zone of [...new Set(extra)].sort())if(!options.some(o=>o[0]===zone))options.push([zone,'UTC'+zone]);
    const zoneLabel=wrap.createEl('label',{cls:'ldb-field ldb-deadline-zone'});zoneLabel.createSpan({text:tr('时区')});
    const zone=makeSelect(zoneLabel,tr('截止时区'),options);zone.value=parts.zone;fields.dueZone=zone;
    const syncDeadline=()=>{hour.disabled=minute.disabled=zone.disabled=!date.value;};
    for(const input of [date,hour,minute,zone]){input.addEventListener('input',()=>{syncDeadline();});input.addEventListener('change',()=>{syncDeadline();});}
    syncDeadline();
    return ()=>Engine.composeDeadline(date.value,`${hour.value}:${minute.value}`,zone.value);
  }
class VenueDeadlineModal extends Modal {
  constructor(plugin,scope,name){super(plugin.app);this.plugin=plugin;this.scope=scope;this.name=name;}
  onOpen(){
    if(this.plugin.hasPendingEdit()){new Notice(tr('请先保存或取消编辑'));this.close();return;}
    const scope=this.scope,name=this.name;
    if(!Object.hasOwn(this.plugin.snapshot.deadlines[scope]||{},name)){new Notice(tr('项目或 Venue 已被修改，请刷新'));this.close();return;}
    const entry=this.plugin.snapshot.deadlineEntries?.find(g=>g.scope===scope&&g.name===name);
    const peers=entry?.key?this.plugin.snapshot.deadlineEntries.filter(g=>g.key===entry.key&&g!==entry):[];
    if(peers.length)this.contentEl.createEl('p',{text:tr('共享 DDL：')+peers.map(g=>(g.scope==='projects'?tr('写作项目'):tr('投稿'))+'「'+g.name+'」').join('、')+tr('。修改后同步生效。')});
    this.titleEl.setText(name+tr(' · 截止时间'));
    const before=this.plugin.snapshot.deadlines[scope][name]||'—';
    const readValue=ldbDeadlineFields(this.contentEl,before);
    const error=this.contentEl.createDiv('ldb-form-error'),actions=this.contentEl.createDiv('ldb-actions');
    const save=ldbButton(actions,tr('保存'),async()=>{
      save.disabled=true;try{await this.plugin.setVenueDeadline(scope,name,readValue(),before,entry?.key||'');this.close();new Notice(tr('截止时间已更新'));}catch(e){error.setText(e.message);save.disabled=false;}
    },'mod-cta');ldbButton(actions,tr('取消'),()=>this.close());
  }
  onClose(){this.contentEl.empty();}
}
class AgentHandoffModal extends Modal {
  constructor(plugin){super(plugin.app);this.plugin=plugin;}
  onOpen(){
    this.titleEl.setText(tr('手动交给 Agent 整理'));
    this.contentEl.createEl('p',{text:tr('复制指令，粘贴到 Codex 执行。')});
    const base=this.app.vault.adapter.getBasePath?.()||this.app.vault.getName();
    const prompt=tr`请整理论文库 ${base}。先读根目录 AGENTS.md。处理 temp 收件箱，以及 library.md 中待整理或元信息不完整且未标为人工完成的文献。PDF 原文件名永远不改；同名文件放不同子目录，保留 PDF、Skim 批注和扩展属性。核实真实篇名后写入篇名列，保留已选集合。补齐空缺的篇名、标签、TL;DR；保留人工及未知来源的已有内容、Notes、阅读状态、优先级和项目备注。人工完成的条目跳过；通过带 actor 的 updateLibraryEntry 记录每个字段和标签来源（kind: ai，name: 实际 Agent 名，如 Codex），读取 PDF 后标为 AI 已整理，无法确认的字段留空并报告。核实重复与版本，不擅自合并。严禁生成或修改 BibTeX、引用来源、引用键、作者、DOI 等引用字段；新条目这些字段留空。只处理公开文献，不搜索或上传审稿、投稿材料。先备份，检查并发修改，最后验证源表、集合和附件。仅执行本次手动整理，不创建定时任务。`;
    const area=this.contentEl.createEl('textarea',{attr:{rows:'10','aria-label':tr('Agent 整理指令')}});area.value=prompt;area.addClass('ldb-full-width');
    ldbButton(this.contentEl,tr('复制整理指令'),async()=>{try{await navigator.clipboard.writeText(area.value);new Notice(tr('已复制，请粘贴到 Codex 执行'));this.close();}catch(e){area.focus();area.select();new Notice(tr('请按 ⌘C 复制'));}},'mod-cta');
  }
  onClose(){this.contentEl.empty();}
}
function ldbTrashResult(action,result){
  return (action==='restore'?tr('已恢复'):tr('已彻底删除'))+' '+result.succeeded.length+tr(' 项')+(result.failed.length?'，'+result.failed.length+tr(' 项未完成'):'');
}
class PurgeRecordModal extends Modal {
  constructor(plugin,receipts,done,onBusy=()=>{}){super(plugin.app);Object.assign(this,{plugin,receipts:Array.isArray(receipts)?[...receipts]:[receipts],done,onBusy,busy:false});}
  onOpen(){
    this.titleEl.setText(tr('彻底删除'));
    this.contentEl.createEl('p',{text:tr('将永久删除所选 ')+this.receipts.length+tr(' 项及其中的 PDF 和批注，此操作不可恢复。')});
    const names=this.contentEl.createDiv('ldb-trash-confirm-list');
    for(const receipt of this.receipts)names.createDiv({text:receipt.row.title||receipt.row.filename});
    const status=this.contentEl.createDiv({cls:'ldb-trash-status',attr:{role:'status'}});
    const error=this.contentEl.createDiv('ldb-form-error'),actions=this.contentEl.createDiv('ldb-actions');
    const remove=ldbButton(actions,tr('彻底删除'),async()=>{
      if(this.busy)return;this.busy=true;this.onBusy(true);remove.disabled=true;cancel.disabled=true;
      try{
        const result=await this.plugin.runTrashBatch('purge',this.receipts,(done,total)=>status.setText(tr('正在彻底删除 ')+done+' / '+total+'…'));
        this.close();await this.done(result);new Notice(ldbTrashResult('purge',result),result.failed.length?10000:4000);
      }
      catch(e){error.setText(e.message);remove.disabled=false;cancel.disabled=false;}
      finally{this.busy=false;this.onBusy(false);}
    },'mod-warning');
    const cancel=ldbButton(actions,tr('取消'),()=>this.close());
  }
  onClose(){this.contentEl.empty();}
}
class TrashModal extends Modal {
  constructor(plugin){super(plugin.app);Object.assign(this,{plugin,selected:new Set(),records:[],busy:false,closed:false,renderVersion:0,message:'',failures:[]});}
  async onOpen(){this.closed=false;this.titleEl.setText(tr('回收站'));await this.render();}
  selectedRecords(){return this.records.filter(r=>this.selected.has(r.folder));}
  updateSelection(){
    const rows=this.selectedRecords(),count=rows.length;
    if(!this.allBox)return;
    this.allBox.checked=!!this.records.length&&count===this.records.length;this.allBox.indeterminate=count>0&&count<this.records.length;this.allBox.disabled=this.busy||!this.records.length;
    this.selectionCount.setText(tr('已选 ')+count+' / '+this.records.length);
    this.restoreSelected.disabled=this.busy||!count||rows.every(r=>['purging','purge-failed'].includes(r.state));
    this.purgeSelected.disabled=this.busy||!count||rows.every(r=>!['deleted','purging','purge-failed'].includes(r.state));
    for(const [folder,controls] of this.rowControls){
      controls.checkbox.checked=this.selected.has(folder);controls.checkbox.disabled=this.busy;
      controls.restore.disabled=this.busy||['purging','purge-failed'].includes(controls.record.state);
      controls.purge.disabled=this.busy||!['deleted','purging','purge-failed'].includes(controls.record.state);
    }
  }
  async finish(result,action){
    for(const folder of result.succeeded)this.selected.delete(folder);
    for(const {receipt} of result.failed)this.selected.add(receipt.folder);
    this.message=ldbTrashResult(action,result);this.failures=result.failed;
    await this.render();
  }
  async restoreRows(rows){
    if(this.busy||!rows.length)return;this.busy=true;this.updateSelection();
    try{
      const result=await this.plugin.runTrashBatch('restore',[...rows],(done,total)=>this.statusEl.setText(tr('正在恢复 ')+done+' / '+total+'…'));
      await this.finish(result,'restore');new Notice(ldbTrashResult('restore',result),result.failed.length?10000:4000);
    }catch(error){this.statusEl.setText(error.message);new Notice(error.message,10000);}
    finally{this.busy=false;this.updateSelection();}
  }
  purgeRows(rows){
    if(this.busy||!rows.length)return;
    new PurgeRecordModal(this.plugin,rows,result=>this.finish(result,'purge'),busy=>{this.busy=busy;this.updateSelection();}).open();
  }
  async render(){
    if(this.closed)return;const version=++this.renderVersion;
    try{
      const records=await this.plugin.trashStore.list();if(this.closed||version!==this.renderVersion)return;
      this.records=records;this.selected=new Set([...this.selected].filter(folder=>records.some(r=>r.folder===folder)));
      this.contentEl.empty();const toolbar=this.contentEl.createDiv('ldb-trash-toolbar'),label=toolbar.createEl('label',{cls:'ldb-trash-select-all'});
      this.allBox=label.createEl('input',{attr:{type:'checkbox','aria-label':tr('全选回收站记录')}});label.createSpan({text:tr('全选')});
      this.allBox.addEventListener('change',()=>{if(this.busy)return;this.selected=new Set(this.allBox.checked?this.records.map(r=>r.folder):[]);this.updateSelection();});
      this.selectionCount=toolbar.createSpan({cls:'ldb-trash-count'});
      this.restoreSelected=ldbButton(toolbar,tr('恢复所选'),()=>this.restoreRows(this.selectedRecords()));
      this.purgeSelected=ldbButton(toolbar,tr('彻底删除所选'),()=>this.purgeRows(this.selectedRecords()),'mod-warning');
      this.statusEl=this.contentEl.createDiv({cls:'ldb-trash-status',text:this.message,attr:{role:'status'}});
      if(this.failures.length){const errors=this.contentEl.createDiv('ldb-form-error ldb-trash-errors');for(const f of this.failures)errors.createDiv({text:(f.receipt.row.filename||f.receipt.row.title)+'：'+f.error});}
      const list=this.contentEl.createDiv('ldb-trash-list');this.rowControls=new Map();
      if(!records.length)list.createEl('p',{text:tr('回收站为空')});
      for(const r of records){
        const item=list.createDiv('ldb-trash-row');
        const checkbox=item.createEl('input',{attr:{type:'checkbox','aria-label':tr('选择 ')+(r.row.filename||r.row.title)}});
        checkbox.addEventListener('change',()=>{if(this.busy)return;if(checkbox.checked)this.selected.add(r.folder);else this.selected.delete(r.folder);this.updateSelection();});
        const name=item.createDiv('ldb-trash-name');name.createDiv({text:r.row.filename||r.row.title});name.createSpan({cls:'ldb-trash-scope',text:SCOPES[r.scope]});
        const irreversible=['purging','purge-failed'].includes(r.state);
        const restore=ldbButton(item,tr('恢复'),()=>this.restoreRows([r]));
        const purge=ldbButton(item,tr('彻底删除'),()=>this.purgeRows([r]),'mod-warning');
        this.rowControls.set(r.folder,{record:r,checkbox,restore,purge});
        if(irreversible)name.createDiv({cls:'ldb-form-error',text:tr('彻底删除尚未完成，可重试')});
      }
      this.updateSelection();
    }catch(e){if(!this.closed)this.contentEl.createDiv({cls:'ldb-form-error',text:e.message});}
  }
  onClose(){this.closed=true;this.renderVersion++;this.contentEl.empty();}
}
class LiteratureBrowser extends ItemView {
  constructor(leaf,plugin){
    super(leaf);this.plugin=plugin;this.rows=[];this.visibleRows=[];this.selectedPath='';this.selectedPaths=new Set();this.scope='library';
    this.filters={query:'',category:'',status:'',tag:'',sort:'title',descending:false,organizing:''};
    this.editing=false;this.notesDirty=false;this.venueDraft='';this.saving=false;this.deleting=false;this.closed=false;
  }
  getViewType(){return LIBRARY_VIEW;}
  getDisplayText(){return tr('文献库');}
  isPublic(){return this.scope==='library'||this.scope==='projects';}
  sourceLabel(row,key,tag=false){const source=Organization.source({...row,tldr:libraryText(row.tldr||'')},key,tag);return source.kind==='human'?tr('人工填写'):source.kind==='ai'?tr('AI 填写')+' · '+source.name:source.kind==='import'?tr('临时篇名，待核实'):source.kind==='system'?tr('PDF 或官方元数据'):tr('来源未记录');}
  detailTitle(row){return this.isPublic()?(row.title?.trim()||row.filename):(row.filename||tr('新任务'));}
  selectedRows(){return this.visibleRows.filter(r=>this.selectedPaths.has(r.path));}
  getIcon(){return 'library';}
  getState(){
    let draft=null;
    if(this.editing&&this.fields)draft={mode:'metadata',base:this.editBase,values:Object.fromEntries(Object.entries(this.fields).map(([k,v])=>[k,v.value]))};
    if(this.notesDirty)draft={mode:'notes',base:this.notesBase,value:this.notesInput.value};
    const venueDraft=this.venueDraft?{base:this.detailRow,value:this.venueDraft}:null;
    return {...this.filters,scope:this.scope,selectedPath:this.selectedPath,draft,venueDraft};
  }
  async setState(state={},result){
    if(!this.dirty()){
      for(const k of ['query','category','status','tag','sort','organizing'])if(typeof state[k]==='string')this.filters[k]=state[k];
      if(SCOPES[state.scope])this.scope=state.scope;
      if(this.isPublic()&&this.filters.sort==='filename')this.filters.sort='title';
      this.filters.descending=state.descending===true;
      this.selectedPath=typeof state.selectedPath==='string'?state.selectedPath:'';
      this.pendingDraft=state.draft||null;
      this.pendingVenueDraft=state.venueDraft||null;
      if(this.searchEl)this.reload();
    }
    await super.setState(state,result);
  }
  dirty(){return this.editing||this.notesDirty||!!this.venueDraft||this.saving||this.deleting||!!this.plugin.removalModal;}
  remember(){this.app.workspace.requestSaveLayout();}
  button(...args){return ldbButton(...args);}
  async navigate(nav){
    if(this.dirty()){new Notice(tr('请先保存或取消右侧编辑；草稿已保留'));return false;}
    this.scope=nav.scope||'library';
    Object.assign(this.filters,{query:'',tag:'',organizing:'',category:nav.category||'',status:nav.status||'',sort:this.isPublic()?'title':'published',descending:this.scope==='inbox'});
    this.selectedPath='';this.selectedPaths.clear();await this.reload();return true;
  }
  async onOpen(){
    this.closed=false;const root=this.contentEl;root.empty();root.addClass('ldb-browser');root.lang=LdbI18n.getLanguage();
    const toolbar=root.createDiv('ldb-toolbar');
    const brand=toolbar.createDiv('ldb-brand');this.headingEl=brand.createEl('strong',{text:tr('文献库')});this.countEl=brand.createSpan('ldb-count');
    const search=toolbar.createDiv('ldb-search');setIcon(search.createSpan(),'search');
    this.searchEl=search.createEl('input',{type:'search',attr:{placeholder:tr('搜索篇名、文件名、标签、TL;DR、Notes…'),'aria-label':tr('搜索文献')}});
    this.searchEl.addEventListener('input',()=>{this.filters.query=this.searchEl.value;this.renderList(true);});
    this.venueDeadlineEl=this.button(toolbar,'',()=>new VenueDeadlineModal(this.plugin,this.scope,this.filters.category).open(),'ldb-venue-deadline');this.venueDeadlineEl.hidden=true;
    this.actionEl=this.button(toolbar,'',()=>this.primaryAction());
    this.exportEl=this.button(toolbar,tr('导出…'),()=>new CitationExportModal(this.plugin,this.visibleRows,this.filters.category||tr('文献库'),this.selectedRows()).open());
    const filterbar=root.createDiv('ldb-filterbar');this.filterbar=filterbar;
    this.statusEl=this.makeSelect(filterbar,tr('阅读状态'),[['',tr('全部阅读状态')],...Engine.STATUSES.map(s=>[s,tr(s)])]);
    this.organizingEl=this.makeSelect(filterbar,tr('整理状态'),[['',tr('全部整理状态')],['pending',tr('待补充元信息')],...Organization.STATES.map(s=>[s,tr(s)])]);
    this.organizingEl.addEventListener('change',()=>{this.filters.organizing=this.organizingEl.value;this.renderList(true);});
    this.tagEl=this.makeSelect(filterbar,tr('标签'),[['',tr('全部标签')]]);
    this.statusEl.addEventListener('change',()=>{this.filters.status=this.statusEl.value;this.renderList(true);});
    this.tagEl.addEventListener('change',()=>{this.filters.tag=this.tagEl.value;this.renderList(true);});
    this.clearEl=this.button(filterbar,tr('清除筛选'),()=>{Object.assign(this.filters,{query:'',status:'',tag:'',organizing:''});this.syncControls();this.renderList(true);},'ldb-clear');
    this.errorEl=root.createDiv('ldb-error');this.errorEl.hidden=true;
    const body=root.createDiv('ldb-body'),list=body.createDiv('ldb-list-pane');this.headerEl=list.createDiv('ldb-columns');this.sortButtons=[];
    ldbDropTarget(list,this.plugin,()=>({scope:this.scope,category:this.filters.category}),()=>this.scope!=='library'||!!this.filters.category);
    for(const [key,label] of [['title',tr('篇名')],['published',tr('发表')],['status',tr('阅读')],['priority',tr('优先')]]){
      const b=this.button(this.headerEl,label,()=>{this.filters.descending=this.filters.sort===key?!this.filters.descending:key==='published';this.filters.sort=key;this.renderList();},'ldb-column-'+key);
      b.dataset.sort=key;b.dataset.label=label;this.sortButtons.push(b);
    }
    this.listEl=list.createDiv({cls:'ldb-list',attr:{role:'listbox',tabindex:'0','aria-label':tr('论文列表'),'aria-multiselectable':'true'}});
    this.listEl.addEventListener('click',e=>{const t=e.target.closest('[data-paper-path]');if(t)this.select(t.dataset.paperPath,e);});
    this.listEl.addEventListener('dblclick',e=>{const t=e.target.closest('[data-paper-path]');if(t&&!this.dirty())this.openPDF(this.rows.find(r=>r.path===t.dataset.paperPath));});
    this.listEl.addEventListener('keydown',e=>this.listKeydown(e));
    this.listEl.addEventListener('contextmenu',e=>{
      const target=e.target.closest('[data-paper-path]'),row=target&&this.rows.find(r=>r.path===target.dataset.paperPath);
      if(!row){
        if(this.scope!=='inbox')return;
        e.preventDefault();e.stopPropagation();
        const menu=new Menu().setUseNativeMenu(true);
        menu.addItem(item=>item.setTitle(tr('粘贴')).setIcon('clipboard-paste').setDisabled(!!this.plugin.importing||!!this.plugin.recordBusy).onClick(async()=>{
          try{await this.plugin.pasteInboxFiles();}catch(error){new Notice(error.message,8000);}
        }));menu.showAtMouseEvent(e);return;
      }
      e.preventDefault();if(!this.selectedPaths.has(row.path)&&!this.dirty())this.select(row.path);
      const menu=new Menu(),rows=this.selectedRows();
      if(this.isPublic()&&this.plugin.snapshot.collections){
        menu.addItem(item=>item.setTitle(tr('加入分类／项目…')).setIcon('folder-plus').onClick(()=>ldbOpenCollectionMenu(this.plugin,rows,{x:e.clientX,y:e.clientY},this.contentEl.ownerDocument)));
        if(this.filters.category&&this.filters.category!==Engine.UNFILED_CATEGORY){
          menu.addItem(item=>item.setTitle(tr('移到…')).setIcon('folder-input').onClick(()=>ldbOpenMoveMenu(this.plugin,rows,{scope:this.scope,name:this.filters.category},{x:e.clientX,y:e.clientY},this.contentEl.ownerDocument)));
          menu.addItem(item=>item.setTitle(tr(this.scope==='projects'?'从当前项目移除':'从当前分类移除')).setIcon('minus').onClick(()=>this.removeMembership(rows)));
        }
        menu.addItem(item=>item.setTitle(tr('导出选中文献…')).setIcon('download').onClick(()=>new CitationExportModal(this.plugin,rows,tr('选中文献')).open()));
      }
      menu.addItem(item=>item.setTitle(tr('移至回收站')).setIcon('trash-2').onClick(()=>this.requestDelete(row)));menu.showAtMouseEvent(e);
    });
    this.listEl.addEventListener('dragstart',e=>{
      const target=e.target.closest('[data-paper-path]'),row=target&&this.rows.find(r=>r.path===target.dataset.paperPath);
      if(row&&!this.selectedPaths.has(row.path)&&!this.dirty())this.select(row.path);
      if(this.scope==='inbox'||!row||!this.plugin.beginPaperDrag(e,row,this.scope,this.isPublic()?this.selectedRows():[row],this.filters.category===Engine.UNFILED_CATEGORY?'':this.filters.category)){e.preventDefault();return;}
      target.addClass('is-dragging');
    });
    this.listEl.addEventListener('dragend',()=>{this.plugin.endPaperDrag();for(const el of this.rowEls.values())el.removeClass('is-dragging');});
    this.detailEl=body.createEl('aside',{cls:'ldb-details',attr:{'aria-label':tr('论文详情')}});

    if(!this.shortcutRegistered)this.registerDomEvent(root,'keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='f'&&!this.dirty()){e.preventDefault();e.stopPropagation();this.searchEl.focus();this.searchEl.select();}});
    this.shortcutRegistered=true;
    await this.reload();
  }
  makeSelect(parent,label,options){const s=parent.createEl('select',{attr:{'aria-label':label,title:label}});for(const [value,text]of options)s.createEl('option',{value,text});return s;}
  syncControls(){if(!this.searchEl)return;this.searchEl.value=this.filters.query;this.statusEl.value=this.filters.status;this.tagEl.value=this.filters.tag;if(this.organizingEl)this.organizingEl.value=this.filters.organizing;}
  findTrackerSelection(rows,previous){
    // Notes/status/DDL are editable content, not the identity of the selected paper.
    // Scope is already fixed by the caller; venue distinguishes a PDF reused across rounds.
    const candidates=rows.filter(r=>r.category===previous.category&&r.pdfPath===previous.pdfPath&&(r.pdfPath||r.filename===previous.filename));
    if(candidates.length===1)return candidates[0];
    const exact=candidates.filter(r=>Engine.sameTrackerContent(r.cells,previous.cells));
    return exact.length===1?exact[0]:null;
  }
  async reload(){
    if(this.closed||!this.listEl)return;
    const data=this.plugin.snapshot;
    if(!data){this.errorEl.hidden=false;this.errorEl.setText(this.plugin.lastError||tr('正在读取本地文献…'));return;}
    this.errorEl.hidden=!this.plugin.lastError;this.errorEl.setText(this.plugin.lastError||'');this.readError=!!this.plugin.lastError;
    const previous=TRACK_FILES[this.scope]&&this.rowsScope===this.scope?this.rows.find(r=>r.path===this.selectedPath):null;
    this.rows=this.scope==='projects'?data.library.filter(r=>!this.filters.category||r.projects.includes(this.filters.category)):data[this.scope]||[];this.rowsScope=this.scope;
    if(previous){const same=this.findTrackerSelection(this.rows,previous);this.selectedPath=same?.path||'';if(same)this.selectedPaths=new Set([same.path]);}
    this.headingEl.setText(TRACK_FILES[this.scope]&&this.filters.category===this.plugin.stagingGroup(this.scope)?tr('暂存区'):(this.filters.category===Engine.UNFILED_CATEGORY?tr(this.filters.category):this.filters.category)||tr(this.filters.status)||(this.scope==='library'?tr('全部文献'):SCOPES[this.scope]));this.countEl.setText(tr`${this.rows.filter(r=>!this.filters.category||r.category===this.filters.category).length} 篇`);
    this.contentEl.toggleClass('ldb-tracking',!!TRACK_FILES[this.scope]);
    this.contentEl.toggleClass('ldb-venue-view',!!TRACK_FILES[this.scope]&&!!this.filters.category);
    const tags=[...new Set(this.rows.flatMap(r=>(r.tags||'').split(/\s+/).filter(t=>t.startsWith('#'))))].sort();
    this.tagEl.empty();this.tagEl.createEl('option',{value:'',text:tr('全部标签')});for(const tag of tags)this.tagEl.createEl('option',{value:tag,text:tag.replace(/^#research\//,'')});
    this.statusEl.hidden=this.tagEl.hidden=!this.isPublic();
    this.filterbar.hidden=!this.isPublic();this.exportEl.hidden=!this.isPublic();
    this.venueDeadlineEl.hidden=!(TRACK_FILES[this.scope]||this.scope==='projects')||!this.filters.category||(!!TRACK_FILES[this.scope]&&Engine.isStagingGroup(this.filters.category));
    if(!this.venueDeadlineEl.hidden)this.venueDeadlineEl.setText('DDL '+Engine.displayDeadline(data.deadlines?.[this.scope]?.[this.filters.category]||'—'));
    this.actionEl.setText(this.scope==='library'?tr('新建分类'):this.scope==='projects'?tr('新建项目'):this.scope==='inbox'?tr('交给 Agent 整理…'):'＋ Venue');
    const labels=this.isPublic()?[tr('篇名'),tr('发表'),tr('阅读'),tr('优先')]:this.scope==='inbox'?[tr('待整理 PDF'),tr('放入日期'),tr('状态'),tr('大小')]:[tr('稿件 / 文件名'),tr('截止时间'),tr('状态'),tr('venue / 轮次')];
    this.sortButtons.forEach((b,i)=>b.dataset.label=labels[i]);this.syncControls();this.renderList();
    if(this.pendingDraft&&!this.dirty()){
      const draft=this.pendingDraft;this.pendingDraft=null;this.selectedPath=draft.base.path;
      if(draft.mode==='metadata'){this.startEditing(draft.base);for(const [k,v]of Object.entries(draft.values||{}))if(this.fields[k])this.fields[k].value=v;else if(k==='due'&&this.fields.dueDate){const d=Engine.deadlineParts(v);this.fields.dueDate.value=d.date;this.fields.dueHour.value=d.time.slice(0,2);this.fields.dueMinute.value=d.time.slice(3);this.fields.dueZone.value=d.zone;}this.syncDeadline?.();}
      else if(draft.mode==='notes'){this.renderDetail(draft.base);this.notesInput.value=draft.value;this.markNotesDirty(draft.base);}
    }
    if(this.pendingVenueDraft&&!this.editing&&!this.saving){
      const draft=this.pendingVenueDraft;this.pendingVenueDraft=null;
      if(!this.notesDirty){this.selectedPath=draft.base.path;this.renderDetail(draft.base);}
      if(this.venueInput){this.venueInput.hidden=false;this.venueInput.value=this.venueDraft=draft.value;this.lockFilters(true);this.remember();}
    }
    this.plugin.navigation={scope:this.scope,category:this.filters.category,status:this.filters.status};this.plugin.renderNavigation();
  }
  primaryAction(){if(this.dirty()){new Notice(tr('请先保存或取消编辑'));return;}if(this.isPublic())new CategoryModal(this.plugin,this.scope).open();else if(this.scope==='inbox')new AgentHandoffModal(this.plugin).open();else new VenueModal(this.plugin,this.scope).open();}
  renderList(reset=false){
    if(!this.listEl)return;const scroll=reset?0:this.listEl.scrollTop;
    if(this.isPublic())this.visibleRows=Engine.filterLibrary(this.rows,{...this.filters,category:this.scope==='projects'?'':this.filters.category});
    else{
      const tokens=this.filters.query.toLowerCase().split(/\s+/).filter(Boolean);
      this.visibleRows=this.rows.filter(r=>(!this.filters.category||r.category===this.filters.category)&&tokens.every(t=>[r.filename,r.category,r.status,r.tldr,r.notes].join(' ').toLowerCase().includes(t)));
      const sort=this.filters.sort;this.visibleRows.sort((a,b)=>{
        let n=sort==='published'?(this.scope==='inbox'?a.mtime-b.mtime:(a.due===b.due?0:a.due-b.due)):String(a[sort==='title'?'filename':sort]||'').localeCompare(String(b[sort==='title'?'filename':sort]||''),'en',{numeric:true});return (this.filters.descending?-n:n)||a.filename.localeCompare(b.filename);
      });
    }
    if(!this.dirty()&&!this.visibleRows.some(r=>r.path===this.selectedPath))this.selectedPath=this.visibleRows[0]?.path||'';
    this.selectedPaths=new Set([...this.selectedPaths].filter(path=>this.visibleRows.some(r=>r.path===path)));if(!this.selectedPaths.size&&this.selectedPath)this.selectedPaths.add(this.selectedPath);
    this.countEl.setText(tr`${this.visibleRows.length} 篇`);this.clearEl.hidden=!['query','status','tag','organizing'].some(k=>this.filters[k]);
    for(const b of this.sortButtons){const on=b.dataset.sort===this.filters.sort;b.setText(b.dataset.label+(on?(this.filters.descending?' ↓':' ↑'):''));}
    this.listEl.empty();this.rowEls=new Map();
    this.visibleRows.forEach((r,i)=>{
      const row=this.listEl.createDiv({cls:'ldb-row',attr:{role:'option','aria-selected':String(r.path===this.selectedPath),id:`ldb-${this.leaf.id}-${i}`}});row.dataset.paperPath=r.path;row.title=this.detailTitle(r);
      row.draggable=this.scope!=='inbox';
      const name=row.createSpan('ldb-filename');setIcon(name.createSpan('ldb-pdf-icon'),'file-text');name.createSpan({cls:'ldb-filename-text',text:this.detailTitle(r)});
      row.createSpan({cls:'ldb-date',text:TRACK_FILES[this.scope]?Engine.displayDeadline(r.published):tr(r.published),attr:{title:TRACK_FILES[this.scope]?Engine.displayDeadline(r.published):tr(r.published)}});row.createSpan({cls:'ldb-reading',text:tr(r.status),attr:{'data-status':r.status}});row.createSpan({cls:'ldb-priority',text:TRACK_FILES[this.scope]?(r.category===this.plugin.stagingGroup(this.scope)?tr('暂存区'):r.priority):tr(r.priority),attr:{'data-priority':r.priority}});this.rowEls.set(r.path,row);
    });
    if(!this.visibleRows.length)this.listEl.createDiv({cls:'ldb-empty',text:this.scope==='inbox'||TRACK_FILES[this.scope]?tr('拖入 PDF'):tr('暂无文献')});
    this.listEl.scrollTop=scroll;this.updateSelection();if(!this.dirty()){this.renderDetail();}this.remember();
  }
  select(path,event={}){
    if(this.dirty()){new Notice(tr('请先保存或取消右侧编辑'));return;}
    if(this.isPublic()&&event.shiftKey&&this.selectedPath){
      const a=this.visibleRows.findIndex(r=>r.path===(this.selectionAnchor||this.selectedPath)),b=this.visibleRows.findIndex(r=>r.path===path);
      if(!event.metaKey&&!event.ctrlKey)this.selectedPaths.clear();for(let i=Math.min(a,b);i<=Math.max(a,b);i++)if(this.visibleRows[i])this.selectedPaths.add(this.visibleRows[i].path);
    }else if(this.isPublic()&&(event.metaKey||event.ctrlKey)){
      if(this.selectedPaths.has(path)){this.selectedPaths.delete(path);if(!this.selectedPaths.size)this.selectedPaths.add(path);}else this.selectedPaths.add(path);this.selectionAnchor=path;
    }else{this.selectedPaths=new Set([path]);this.selectionAnchor=path;}
    this.selectedPath=path;this.updateSelection();this.renderDetail();this.remember();
  }
  async removeMembership(rows=this.selectedRows(),askScope=false){
    if(!this.filters.category||this.filters.category===Engine.UNFILED_CATEGORY)return;
    if(!rows.length)return;
    try{
      const shared=askScope&&Collections.removalPlan(this.plugin.snapshot?.collections||[],rows.map(r=>r.path)).shared;
      const decision=await ldbPlanPaperRemoval(this.plugin,rows,{scope:this.scope,name:this.filters.category},shared?'trash':'remove');
      await this.applyRemoval(rows,decision);
    }catch(e){new Notice(e.message,8000);}
  }
  updateSelection(){for(const [p,el]of this.rowEls||[]){el.toggleClass('is-selected',this.selectedPaths.has(p));el.setAttribute('aria-selected',String(this.selectedPaths.has(p)));}const el=this.rowEls?.get(this.selectedPath);if(el)this.listEl.setAttribute('aria-activedescendant',el.id);else this.listEl.removeAttribute('aria-activedescendant');}
  listKeydown(e){
    if(this.dirty()||!this.visibleRows.length)return;
    if(this.isPublic()&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='a'){e.preventDefault();this.selectedPaths=new Set(this.visibleRows.map(r=>r.path));this.updateSelection();return;}
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    let i=this.visibleRows.findIndex(r=>r.path===this.selectedPath);
    if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();if(this.isPublic()&&this.filters.category&&this.filters.category!==Engine.UNFILED_CATEGORY)this.removeMembership(this.selectedRows(),true);else this.requestDelete(this.visibleRows[i]);return;}
    if(e.key==='Enter'){e.preventDefault();this.openPDF(this.visibleRows[i]);return;}
    if(e.key==='ArrowDown')i=Math.min(this.visibleRows.length-1,i+1);else if(e.key==='ArrowUp')i=Math.max(0,i-1);else if(e.key==='Home')i=0;else if(e.key==='End')i=this.visibleRows.length-1;else return;
    e.preventDefault();this.select(this.visibleRows[i].path,e);this.rowEls.get(this.selectedPath)?.scrollIntoView({block:'nearest'});
  }
  async requestDelete(row){
    if(!row||this.deleting)return;
    if(this.dirty()||this.plugin.hasPendingEdit()){new Notice(tr('请先保存或取消编辑'));return;}
    const rows=this.isPublic()&&this.selectedPaths.has(row.path)?this.selectedRows():[row];if(!rows.length)return;
    try{
      const from=this.isPublic()&&this.filters.category&&this.filters.category!==Engine.UNFILED_CATEGORY?{scope:this.scope,name:this.filters.category}:null;
      const decision=this.isPublic()?await ldbPlanPaperRemoval(this.plugin,rows,from,'trash'):{action:'trash',memberships:null};
      await this.applyRemoval(rows,decision);
    }catch(error){new Notice(error.message,8000);}
  }
  async applyRemoval(rows,decision){
    if(!decision.action||this.closed)return;
    if(this.dirty()||this.plugin.hasPendingEdit())throw new Error(tr('请先保存或取消编辑，并等待当前操作结束'));
    if(decision.action==='remove'){
      await this.plugin.changeMembership(rows,null,decision.from,false,{allMemberships:decision.memberships});
      new Notice(tr('已从当前集合移除，文献仍在库中'));return;
    }
    const progress=new Notice(tr('正在移至回收站…'),0);
    // Start the manager lock before marking this view busy, so its own busy flag is not a draft.
    const pending=this.plugin.deleteRecords(this.isPublic()?'library':this.scope,[...rows],decision.memberships);
    this.deleting=true;this.lockFilters(true);
    for(const element of this.detailEl.querySelectorAll?.('button,input,select,textarea')||[])element.disabled=true;
    try{const count=await pending;new Notice(tr('已移至回收站')+(count>1?' · '+count+tr(' 篇'):''));}
    catch(error){new Notice(error.message,10000);}
    finally{this.deleting=false;progress.hide();this.lockFilters(false);if(!this.closed)await this.reload();}
  }
  renderDetail(override){
    this.detailEl.empty();const row=override||this.rows.find(r=>r.path===this.selectedPath);
    this.detailRow=row;this.quickFields=[];this.venueInput=null;this.venueMenuButton=null;this.venueRemoveButtons=[];
    if(!row){this.detailEl.createDiv({cls:'ldb-empty',text:tr('选择一篇论文查看详情')});return;}
    const top=this.detailEl.createDiv('ldb-detail-top');
    if(this.scope!=='inbox')this.button(top,tr('编辑'),()=>this.dirty()?new Notice(tr('请先保存或取消 Notes')):this.startEditing(row),'ldb-edit-button');
    const remove=this.button(top,'',()=>this.requestDelete(row),'ldb-delete-button');setIcon(remove,'trash-2');remove.setAttribute('aria-label',tr('移至回收站'));remove.title=tr('移至回收站');
    const title=this.detailEl.createEl('h2',{cls:'ldb-title',text:this.detailTitle(row)});
    if(this.isPublic()){title.title=this.sourceLabel(row,'title');this.detailEl.createDiv({cls:'ldb-original-filename',text:row.filename,attr:{title:tr('文件名')}});}
    if(this.scope==='inbox'||this.isPublic()||row.pdfPath)this.button(this.detailEl,'Open ↗',()=>this.openPDF(row),'mod-cta');
    if(this.scope==='inbox'){
      this.button(this.detailEl,tr('复制 Agent 整理指令'),()=>new AgentHandoffModal(this.plugin).open());return;
    }
    const meta=this.detailEl.createEl('dl',{cls:'ldb-metadata'});
    const pairs=this.isPublic()?[[tr('发表时间'),tr(row.published)]]:[...(this.scope==='reviews'?[]:[[tr('状态'),tr(row.status)]]),...(!this.filters.category?[[tr('截止时间'),Engine.displayDeadline(row.published)]]:[])];
    for(const [label,value]of pairs){meta.createEl('dt',{text:label});meta.createEl('dd',{text:value});}
    const quick=this.isPublic()?[['status',tr('阅读状态'),Engine.STATUSES],['organizing',tr('整理状态'),Organization.STATES],['priority',tr('优先级'),Engine.PRIORITIES]]:this.scope==='reviews'?[['status',tr('状态'),[...new Set([...Engine.REVIEW_STATUSES,row.status])]]]:[];
    for(const [key,label,options] of quick){
      meta.createEl('dt',{text:label});const field=meta.createEl('dd');
      const select=this.makeSelect(field,label,options.map(value=>[value,tr(value)]));select.addClass('ldb-inline-select');select.value=row[key];select.disabled=this.readError;
      this.quickFields.push({key,select});select.addEventListener('change',()=>this.saveQuickField(key,select.value));
    }
    this.quickError=this.detailEl.createDiv({cls:'ldb-form-error',attr:{role:'alert'}});this.quickError.hidden=true;
    this.detailEl.createEl('h3',{text:this.isPublic()?'TL;DR':tr('下一步'),cls:'ldb-section-label'});this.detailEl.createEl('p',{text:libraryText(row.tldr),cls:'ldb-tldr',attr:{title:this.isPublic()?this.sourceLabel(row,'tldr'):''}});
    if(this.isPublic()){
      this.detailEl.createEl('h3',{text:tr('标签'),cls:'ldb-section-label'});const tags=this.detailEl.createDiv('ldb-tags');
      for(const tag of row.tags.split(/\s+/).filter(t=>t.startsWith('#'))){const source=Organization.source(row,tag,true);const chip=this.button(tags,tag.replace(/^#research\//,''),()=>{if(this.dirty()){new Notice(tr('请先保存或取消 Notes'));return;}this.filters.tag=tag;this.syncControls();this.renderList(true);},'ldb-tag'+(source.kind==='human'?' ldb-tag-human':''));chip.title=this.sourceLabel(row,tag,true);}
      this.detailEl.createEl('h3',{text:'Venue',cls:'ldb-section-label'});
      const venues=this.detailEl.createDiv('ldb-paper-venues');this.venueTags=venues.createDiv('ldb-venue-tags');
      this.venueMenuButton=this.button(venues,tr('添加 Venue…'),e=>ldbPaperVenueMenu(this,e.currentTarget),'ldb-venue-picker');
      this.venueInput=venues.createEl('input',{type:'text',cls:'ldb-venue-input',attr:{placeholder:tr('输入新 Venue，按 Enter 添加'),'aria-label':tr('新 Venue 名称'),title:tr('输入名称后按 Enter，Esc 取消'),autocomplete:'off'}});
      this.venueInput.hidden=true;this.renderPaperVenues();
      this.venueInput.addEventListener('input',()=>{this.venueDraft=this.venueInput.value;this.syncQuickFields();this.lockFilters(this.notesDirty||!!this.venueDraft);this.remember();});
      this.venueInput.addEventListener('change',()=>this.addPaperVenue());
      this.venueInput.addEventListener('keydown',e=>{
        e.stopPropagation();if(e.isComposing||e.keyCode===229)return;
        if(e.key==='Enter'){e.preventDefault();this.addPaperVenue();}
        else if(e.key==='Escape'&&!this.saving){e.preventDefault();this.venueInput.value=this.venueDraft='';this.venueInput.hidden=true;this.quickError.hidden=true;this.syncQuickFields();this.lockFilters(this.notesDirty);this.remember();}
      });
    }
    if(this.isPublic()&&this.plugin.snapshot.collections){
      const groups=this.detailEl.createDiv('ldb-memberships');
      for(const category of row.categories||[])this.button(groups,category,()=>this.plugin.openLibrary({scope:'library',category}),'ldb-tag');
      this.button(groups,tr('＋ 集合'),e=>{const rect=e.currentTarget.getBoundingClientRect();ldbOpenCollectionMenu(this.plugin,[row],{x:rect.left,y:rect.bottom},this.contentEl.ownerDocument);},'ldb-edit-button');
      if(this.scope==='projects'&&this.filters.category){
        const project=this.plugin.snapshot.collections.find(g=>g.scope==='projects'&&g.name===this.filters.category),note=project?.members.find(m=>m.path===row.path)?.notes||'';
        this.detailEl.createEl('h3',{text:tr('项目备注'),cls:'ldb-section-label'});
        this.button(this.detailEl,note||tr('添加项目备注…'),()=>new ProjectNoteModal(this.plugin,this.filters.category,row,note).open(),'ldb-project-note');
      }

    }
    this.detailEl.createEl('h3',{text:'Notes',cls:'ldb-section-label'});
    this.notesInput=this.detailEl.createEl('textarea',{cls:'ldb-notes-input',attr:{rows:'7',placeholder:tr('添加笔记…'),'aria-label':tr('个人 Notes')}});this.notesInput.value=this.isPublic()?libraryText(row.notes):row.notes;
    this.notesBase=row;this.notesInput.addEventListener('input',()=>this.markNotesDirty(this.detailRow));
    this.notesError=this.detailEl.createDiv('ldb-form-error');const actions=this.detailEl.createDiv('ldb-actions');
    this.notesSave=this.button(actions,tr('保存 Notes'),()=>this.saveNotes(),'mod-cta');this.notesSave.disabled=true;
    this.notesCancel=this.button(actions,tr('撤销修改'),()=>{this.notesDirty=false;this.notesInput.value=this.isPublic()?libraryText(this.notesBase.notes):this.notesBase.notes;this.notesSave.disabled=true;this.notesCancel.hidden=true;this.lockFilters(!!this.venueDraft);this.renderList();});this.notesCancel.hidden=true;
  }
  markNotesDirty(row){
    this.notesBase=row;this.notesDirty=this.notesInput.value!==(this.isPublic()?libraryText(row.notes):row.notes);
    this.notesSave.disabled=!this.notesDirty;this.notesCancel.hidden=!this.notesDirty;this.lockFilters(this.notesDirty||!!this.venueDraft);this.remember();
  }
  renderPaperVenues(){
    if(!this.venueInput)return;
    this.venueTags.empty();this.venueRemoveButtons=[];
    const venues=this.detailRow.venues||[];
    for(const name of venues){
      const chip=this.venueTags.createSpan('ldb-venue-tag');chip.createSpan({text:name});
      const remove=this.button(chip,'×',()=>this.saveQuickField('venues',(this.detailRow.venues||[]).filter(v=>v!==name)),'ldb-venue-remove');remove.setAttribute('aria-label',tr('移除 Venue ')+name);this.venueRemoveButtons.push(remove);
    }
    this.syncQuickFields();
  }
  async addPaperVenue(){
    if(this.saving||!this.venueInput)return false;
    const value=this.venueInput.value.trim();if(!value){this.venueInput.value=this.venueDraft='';this.venueInput.hidden=true;this.syncQuickFields();this.lockFilters(this.notesDirty);this.remember();return true;}
    try{
      const name=Engine.normalizeVenues([value])[0],options=Engine.venueOptions(this.plugin.snapshot?.library||this.rows);
      const existing=options.find(v=>v.toLocaleLowerCase()===name.toLocaleLowerCase());
      const saved=await this.saveQuickField('venues',Engine.normalizeVenues([...(this.detailRow.venues||[]),existing||name]));
      if(saved){this.venueInput.value=this.venueDraft='';this.venueInput.hidden=true;this.lockFilters(this.notesDirty);this.renderPaperVenues();this.remember();if(!this.dirty())await this.reload();}
      return saved;
    }catch(error){this.quickError.setText(error.message);this.quickError.hidden=false;return false;}
  }
  async saveQuickField(key,value){
    const row=this.detailRow;
    const review=this.scope==='reviews'&&key==='status';
    if(!row||!(review||(this.isPublic()&&['status','priority','venues','organizing'].includes(key))))return false;
    if(this.saving||this.editing||this.readError){for(const field of this.quickFields)field.select.value=row[field.key];return false;}
    if(JSON.stringify(row[key])===JSON.stringify(value))return true;
    this.saving=true;this.lockFilters(true);this.syncQuickFields();this.notesInput.readOnly=true;
    this.notesSave.disabled=this.notesCancel.disabled=true;this.quickError.hidden=true;
    try{
      let updated;
      await this.plugin.mutate(review?TRACK_FILES.reviews:LIBRARY_SOURCE,text=>{
        const next=review?Engine.updateReviewStatus(text,row,value):Engine.updateLibraryEntry(text,row,{[key]:value},{kind:'human',name:'user'});
        updated=review?Engine.parseTracker(next,TRACK_FILES.reviews)[row.index]:Engine.parseLibrary(next).find(item=>item.path===row.path);return next;
      });
      if(review){this.selectedPath=updated.path;this.selectedPaths=new Set([updated.path]);}
      // Rebase only onto our exact write, so a later external Notes change still conflicts.
      this.detailRow=this.notesBase=updated;
    }catch(error){this.quickError.setText(error.message);this.quickError.hidden=false;}
    finally{
      this.saving=false;this.notesInput.readOnly=false;this.notesSave.disabled=!this.notesDirty;this.notesCancel.disabled=false;
      this.lockFilters(this.notesDirty||!!this.venueDraft);this.syncQuickFields();this.remember();
    }
    const saved=this.quickError.hidden;
    if(saved){this.renderPaperVenues();if(!this.dirty())await this.reload();}
    return saved;
  }
  syncQuickFields(){
    const disabled=this.saving||this.editing||this.readError;
    for(const {key,select} of this.quickFields||[]){select.value=this.detailRow[key];select.disabled=disabled;}
    if(this.venueInput)this.venueInput.disabled=disabled;
    if(this.venueMenuButton)this.venueMenuButton.disabled=disabled||!!this.venueDraft;
    for(const button of this.venueRemoveButtons||[])button.disabled=disabled;
  }
  async saveNotes(){
    if(!this.notesDirty||this.saving)return;
    if(this.venueDraft&&!await this.addPaperVenue())return;
    this.saving=true;this.notesSave.disabled=this.notesCancel.disabled=true;
    this.syncQuickFields();
    const value=this.notesInput.value;
    try{
      if(this.readError)throw new Error(tr('源数据尚未同步完整，请稍后保存'));
      if(this.isPublic())await this.plugin.mutate(LIBRARY_SOURCE,t=>Engine.updateLibraryEntry(t,this.notesBase,{notes:value}));
      else {const r=this.notesBase;await this.plugin.mutate(TRACK_FILES[this.scope],t=>Engine.updateTracker(t,TRACK_FILES[this.scope],r,{title:r.filename,pdfPath:r.pdfPath,category:r.category,status:r.status,due:r.published,next:r.tldr,notes:value}));}
      this.saving=false;this.notesDirty=false;this.lockFilters(false);await this.reload();new Notice(tr('Notes 已保存'));
    }catch(e){this.saving=false;this.notesSave.disabled=this.notesCancel.disabled=false;this.notesError.setText(e.message);this.syncQuickFields();}
  }
  lockFilters(locked){for(const el of [this.searchEl,this.statusEl,this.tagEl,this.organizingEl,this.clearEl,this.actionEl,this.venueDeadlineEl,this.exportEl,...this.sortButtons].filter(Boolean))el.disabled=locked;}
  startEditing(row){if(TRACK_FILES[this.scope])return this.startTrackingEditor(row);this.startForm(row,[['title',tr('篇名')],['published',tr('发表时间')],['status',tr('阅读状态'),Engine.STATUSES],['priority',tr('优先级'),Engine.PRIORITIES],['tags',tr('标签'),'area'],['tldr','TL;DR','area']]);}
  startTrackingEditor(row){
    const base=row||{path:'',filename:'',pdfPath:'',category:this.filters.category||this.plugin.stagingGroup(this.scope),status:this.scope==='reviews'?'待审':'准备中',published:'—',tldr:'',notes:''};
    const data={...base,title:base.filename,due:base.published,next:base.tldr};
    this.startForm(data,[...(!base.pdfPath?[['title',tr('稿件名称')]]:[]),['category','Venue','venue'],['status',tr('状态'),this.scope==='reviews'?[...new Set([...Engine.REVIEW_STATUSES,base.status])]:undefined],['next',tr('下一步'),'area'],['notes','Notes','area']]);
  }
  startForm(row,spec){
    if(this.readError){new Notice(tr('请等待源数据同步完成'));return;}
    this.editing=true;this.editBase=row;this.lockFilters(true);this.detailEl.empty();
    this.detailEl.createDiv({cls:'ldb-eyebrow',text:row.path?tr('编辑详情'):tr('新增')+SCOPES[this.scope]});this.detailEl.createEl('h2',{cls:'ldb-title',text:this.detailTitle(row)});
    const form=this.detailEl.createEl('form',{cls:'ldb-editor'});this.fields={};this.initialInputs={};
    for(const [key,label,type]of spec){
      const field=form.createEl('label',{cls:'ldb-field'});field.createSpan({text:label});let input;
      if(Array.isArray(type))input=this.makeSelect(field,label,type.map(v=>[v,tr(v)]));
      else if(type==='venue'){const staging=this.plugin.stagingGroup(this.scope);input=this.makeSelect(field,label,[...new Set([staging,...this.plugin.snapshot.groups[this.scope]])].map(v=>[v,v===staging?tr('暂存区'):v]));}
      else if(type==='area')input=field.createEl('textarea',{attr:{rows:key==='tldr'?'5':'3','aria-label':label}});
      else input=field.createEl('input',{type:'text',attr:{'aria-label':label}});
      input.value=this.isPublic()?libraryText(row[key]||''):row[key]||'';this.fields[key]=input;this.initialInputs[key]=input.value;input.addEventListener('input',()=>this.remember());input.addEventListener('change',()=>this.remember());
    }
    this.formError=form.createDiv({cls:'ldb-form-error',attr:{role:'alert'}});const actions=form.createDiv('ldb-actions');this.saveEl=actions.createEl('button',{text:tr('保存'),cls:'mod-cta',attr:{type:'submit'}});this.cancelEl=this.button(actions,tr('取消'),()=>this.stopEditing());
    form.addEventListener('submit',e=>{e.preventDefault();this.saveEdit();});this.remember();
  }
  stopEditing(){if(this.saving)return;this.editing=false;this.lockFilters(false);this.renderList();}
  async saveEdit(){
    if(this.saving||!this.editing)return;this.saving=true;this.saveEl.disabled=this.cancelEl.disabled=true;
    try{
      if(this.readError)throw new Error(tr('源数据暂时不可用'));
      const values=Object.fromEntries(Object.entries(this.fields).map(([k,v])=>[k,v.value]));
      if(this.isPublic()){
        const changes=Object.fromEntries(Object.entries(values).filter(([k,v])=>v!==this.initialInputs[k]));
        await this.plugin.mutate(LIBRARY_SOURCE,t=>Engine.updateLibraryEntry(t,this.editBase,changes,{kind:'human',name:'user'}));
        if(changes.category)this.filters.category=changes.category;
      }else {values.title=values.title||this.editBase.filename;values.pdfPath=this.editBase.pdfPath||'';values.due=this.editBase.published||'—';await this.plugin.mutate(TRACK_FILES[this.scope],t=>Engine.updateTracker(t,TRACK_FILES[this.scope],this.editBase.path?this.editBase:null,values));if(values.category)this.filters.category=values.category;}
      this.saving=false;this.editing=false;this.lockFilters(false);await this.reload();new Notice(tr('已保存'));
    }catch(e){this.saving=false;this.saveEl.disabled=this.cancelEl.disabled=false;this.formError.setText(e.message);}
  }
  async openPDF(row){if(row)await this.plugin.openPDF(row.pdfPath||row.path);}
  async onClose(){this.closed=true;}
}

class LanguageModal extends Modal {
  constructor(plugin){super(plugin.app);this.plugin=plugin;}
  onOpen(){
    this.titleEl.setText(tr('界面语言'));
    const select=this.contentEl.createEl('select',{attr:{'aria-label':tr('语言')}});
    for(const [value,text]of [['auto',tr('跟随 Obsidian')],['zh','中文'],['en','English']])select.createEl('option',{value,text});
    select.value=this.plugin.settings.language;
    const error=this.contentEl.createDiv('ldb-form-error');
    ldbButton(this.contentEl,tr('保存'),async()=>{try{await this.plugin.changeLanguage(select.value);this.close();}catch(e){error.setText(e.message);}},'mod-cta');
  }
  onClose(){this.contentEl.empty();}
}
