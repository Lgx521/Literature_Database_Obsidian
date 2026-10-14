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
function ldbDropTarget(element,plugin,target=null,enabled=()=>true,feedback={}){
  const types=e=>Array.from(e.dataTransfer?.types||[]);
  const destination=e=>typeof target==='function'?target(e):typeof target==='string'?{scope:'library',category:target}:target||{scope:'inbox'};
  let highlighted=null;
  const clear=()=>{highlighted?.removeClass('is-drop-target');highlighted=null;};
  const highlight=(e,effect)=>{const next=effect?(feedback.element?.(e)||element):null;if(next!==highlighted){clear();highlighted=next;highlighted?.toggleClass('is-drop-target',true);}};
  const mode=e=>{
    const nav=destination(e);if(!enabled()||!nav||plugin.importing||plugin.recordBusy)return null;
    if(types(e).includes(PAPER_DRAG)){
      const drag=plugin.dragState;if(!drag||!nav.category||plugin.hasPendingEdit())return null;
      if(plugin.snapshot?.collections&&['library','projects'].includes(drag.scope)&&['library','projects'].includes(nav.scope)){
        if(nav.category===Engine.UNFILED_CATEGORY)return null;
        if(nav.subgroup!==undefined&&nav.subgroup!==null)return drag.from?.scope===nav.scope&&drag.from?.name===nav.category?'move':'copy';
        return e.metaKey&&drag.from&&drag.from.scope===nav.scope?'move':'copy';
      }
      return (drag.scope||'library')===nav.scope?'move':null;
    }
    return types(e).includes('Files')&&!plugin.hasPendingEdit()&&(['inbox','reviews','submissions'].includes(nav.scope)||(plugin.snapshot?.collections&&['library','projects'].includes(nav.scope)&&nav.category&&nav.category!==Engine.UNFILED_CATEGORY))?'copy':null;
  };
  const over=e=>{
    if(!enabled()||!types(e).some(t=>t==='Files'||t===PAPER_DRAG))return;
    e.preventDefault();e.stopPropagation();const effect=mode(e);
    e.dataTransfer.dropEffect=effect||'none';highlight(e,effect);feedback.over?.(e,effect);
  };
  element.addEventListener('dragenter',over);element.addEventListener('dragover',over);
  element.addEventListener('dragleave',e=>{if(!element.contains(e.relatedTarget)){clear();feedback.end?.();}});
  element.addEventListener('drop',async e=>{
    if(!enabled()||!types(e).some(t=>t==='Files'||t===PAPER_DRAG))return;
    e.preventDefault();e.stopPropagation();const nav=destination(e),effect=mode(e);clear();feedback.end?.();
    try{
      if(effect&&types(e).includes(PAPER_DRAG))await plugin.moveDraggedPaper(e.dataTransfer.getData(PAPER_DRAG),nav.category,nav.scope,effect==='move',nav.subgroup??undefined);
      else if(effect==='copy')await plugin.importDroppedFiles(Array.from(e.dataTransfer.files),nav);
      else new Notice(tr('PDF 请拖到收件箱、具体分类或项目、审稿或投稿'));
    }catch(error){new Notice(error.message,8000);}
  });
  return {clear,highlight,mode};
}
// One drop target owns the middle pane: the group under the pointer, not just its heading.
function ldbListDropTarget(pane,view){
  const list=view.listEl,win=list.ownerDocument.defaultView,doc=list.ownerDocument;
  let pointer=null,effect=null,frame=0,previousTime=0;
  const groupAt=e=>{
    if(!view.isPublic()||view.filters.subgroup!==null||!view.groupingCollection())return null;
    const bounds=list.getBoundingClientRect();if(e.clientY<bounds.top||e.clientY>=bounds.bottom||e.clientX<bounds.left||e.clientX>=bounds.right)return null;
    return Array.from(list.querySelectorAll('[data-drop-subgroup]')).find(el=>{const r=el.getBoundingClientRect();return e.clientY>=r.top&&e.clientY<r.bottom;})||null;
  };
  const destination=e=>{const group=groupAt(e);return {scope:view.scope,category:view.filters.category,subgroup:group?group.dataset.dropSubgroup:view.filters.subgroup,...(group?{stayInParent:true}:{})};};
  const stopFrame=()=>{if(frame)win.cancelAnimationFrame(frame);frame=0;previousTime=0;};
  const end=()=>{pointer=null;effect=null;stopFrame();api.clear();list.removeClass('is-paper-drag-over');};
  const speed=()=>{if(!pointer)return 0;const r=list.getBoundingClientRect(),edge=Math.min(48,r.height/4);if(pointer.clientX<r.left||pointer.clientX>=r.right||pointer.clientY<r.top||pointer.clientY>=r.bottom)return 0;return pointer.clientY<r.top+edge?-14*(1-(pointer.clientY-r.top)/edge):pointer.clientY>r.bottom-edge?14*(1-(r.bottom-pointer.clientY)/edge):0;};
  const refresh=()=>{if(!pointer)return;if(view.closed||view.dirty()||view.plugin.importing||view.plugin.recordBusy){end();return;}api.highlight(pointer,effect);};
  const tick=time=>{frame=0;if(!pointer)return;const delta=speed()*Math.min(2,previousTime?(time-previousTime)/16.67:1);previousTime=time;const before=list.scrollTop;list.scrollTop+=delta;refresh();if(pointer&&delta&&list.scrollTop!==before)frame=win.requestAnimationFrame(tick);else previousTime=0;};
  const api=ldbDropTarget(pane,view.plugin,destination,()=>view.scope!=='library'||!!view.filters.category,{
    element:e=>groupAt(e)||pane,end,
    over(e,allowed){if(!allowed){end();return;}pointer={clientX:e.clientX,clientY:e.clientY};effect=allowed;list.addClass('is-paper-drag-over');if(speed()){if(!frame)frame=win.requestAnimationFrame(tick);}else stopFrame();}
  });
  const wheel=e=>{if(!pointer)return;e.preventDefault();list.scrollTop+=e.deltaY*(e.deltaMode===1?20:e.deltaMode===2?list.clientHeight:1);refresh();};
  const key=e=>{if(e.key==='Escape')end();},hidden=()=>{if(doc.hidden)end();};
  pane.addEventListener('wheel',wheel,{passive:false});list.addEventListener('scroll',refresh);
  doc.addEventListener('drop',end,true);doc.addEventListener('dragend',end,true);doc.addEventListener('keydown',key,true);doc.addEventListener('visibilitychange',hidden);win.addEventListener('blur',end);
  return {end,destroy(){end();pane.removeEventListener('wheel',wheel);list.removeEventListener('scroll',refresh);doc.removeEventListener('drop',end,true);doc.removeEventListener('dragend',end,true);doc.removeEventListener('keydown',key,true);doc.removeEventListener('visibilitychange',hidden);win.removeEventListener('blur',end);}};
}
function ldbGroupReorderTarget(element,plugin,scope,name,parent){
  element.draggable=true;element.addClass('ldb-sortable-group');
  const isGroup=e=>Array.from(e.dataTransfer?.types||[]).includes(GROUP_DRAG);
  const allowed=()=>plugin.groupDrag?.scope===scope&&(plugin.groupDrag.parent||null)===(parent||null)&&!plugin.hasPendingEdit();
  const position=e=>e.clientY>=element.getBoundingClientRect().top+element.getBoundingClientRect().height/2;
  element.addEventListener('click',e=>{if(Date.now()<(plugin.suppressGroupClickUntil||0)){e.preventDefault();e.stopImmediatePropagation();}},true);
  element.addEventListener('dragstart',e=>{
    e.stopPropagation();if(!plugin.beginGroupDrag(e,scope,name,parent)){e.preventDefault();return;}element.addClass('is-group-dragging');
  });
  const over=e=>{
    if(!isGroup(e))return;e.preventDefault();e.stopPropagation();plugin.clearGroupDropIndicators();
    const valid=allowed();e.dataTransfer.dropEffect=valid?'move':'none';if(valid&&plugin.groupDrag.name!==name)element.addClass(position(e)?'is-order-after':'is-order-before');
  };
  element.addEventListener('dragenter',over);element.addEventListener('dragover',over);
  element.addEventListener('dragleave',e=>{if(!element.contains(e.relatedTarget)){element.removeClass('is-order-before');element.removeClass('is-order-after');}});
  element.addEventListener('drop',async e=>{
    if(!isGroup(e))return;e.preventDefault();e.stopPropagation();plugin.clearGroupDropIndicators();
    try{if(!allowed())throw new Error(tr('请在分类、审稿或投稿各自的区域内排序'));await plugin.moveDraggedGroup(e.dataTransfer.getData(GROUP_DRAG),scope,name,position(e),...(parent===undefined?[]:[parent]));}
    catch(error){new Notice(error.message,8000);}finally{plugin.endGroupDrag();}
  });
  element.addEventListener('dragend',()=>plugin.endGroupDrag());
}
function ldbButton(parent,text,action,cls='') {
  const b=parent.createEl('button',{text,cls,attr:{type:'button'}}); b.addEventListener('click',action); return b;
}
class LibraryNavigation extends ItemView {
  constructor(leaf,plugin){super(leaf);this.plugin=plugin;this.collapsed=new Set();}
  getState(){return {collapsed:[...this.collapsed]};}
  async setState(state={},result){this.collapsed=new Set(Array.isArray(state.collapsed)?state.collapsed.filter(k=>typeof k==='string'):[]);if(this.contentEl)this.render();await super.setState(state,result);}
  getViewType(){return NAV_VIEW;}
  getDisplayText(){return tr('文献分类');}
  getIcon(){return 'library';}
  async onOpen(){
    this.closed=false;
    this.contentEl.addClass('ldb-navigation');
    if(Platform?.isMobile)this.contentEl.addClass('ldb-mobile-navigation');
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
      const selected=active.scope===nav.scope&&(active.category||'')===(nav.category||'')&&(active.status||'')===(nav.status||'')&&!!active.bookmarked===!!nav.bookmarked&&(active.subgroup??null)===(nav.subgroup??null);
      b.toggleClass('is-active',selected);b.setAttribute('aria-current',selected?'page':'false');return b;
    };
    add(tr('全部文献'),'library',{scope:'library',category:'',status:''},data?.library.length||0);
    const inbox=add(tr('收件箱'),'inbox',{scope:'inbox',category:'',status:''},data?.inbox.length||0);
    inbox.title=tr('将本地 PDF 拖到这里导入');ldbDropTarget(inbox,this.plugin);
    add(tr('书签'),'bookmark',{scope:'library',bookmarked:true},data?.library.filter(r=>r.bookmarked).length||0);
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
      this.renderChildren(button,'library',name,add);
    }
    if(data?.collections){
      const heading=root.createDiv('ldb-nav-section');heading.createSpan({text:tr('写作项目')});
      ldbButton(heading,'＋',()=>new CategoryModal(this.plugin,'projects').open(),'ldb-nav-add').setAttribute('aria-label',tr('新建写作项目'));
      for(const name of data.groups.projects){
        const button=add(name,'notebook-pen',{scope:'projects',category:name,status:''},data.library.filter(r=>r.projects.includes(name)).length,true);
        this.addCountdown(button,name,data.deadlines?.projects?.[name]);
        this.groupMenu(button,'projects',name);ldbGroupReorderTarget(button,this.plugin,'projects',name);ldbDropTarget(button,this.plugin,{scope:'projects',category:name});button.title=name+tr(' · 拖入参考文献');this.renderChildren(button,'projects',name,add);
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
    const open=e=>{
      e.preventDefault();e.stopPropagation();if(this.renaming)return;
      const menu=new Menu();
      if(['library','projects'].includes(scope)&&this.plugin.snapshot.collections)menu.addItem(item=>item.setTitle(tr('新建子类')).setIcon('folder-plus').onClick(()=>this.beginChildEdit(button,scope,name)));
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
      const rect=button.getBoundingClientRect();
      if(Platform?.isMobile)menu.showAtPosition({x:rect.left,y:rect.bottom},button.ownerDocument);else menu.showAtMouseEvent(e);
    };
    button.addEventListener('contextmenu',open);
    if(Platform?.isMobile){
      const more=button.createSpan({cls:'ldb-nav-more',attr:{role:'button',tabindex:'0','aria-label':tr('更多操作')}});setIcon(more,'more-horizontal');
      more.addEventListener('click',open);more.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')open(e);});
    }
  }
  renderChildren(button,scope,parent,add){
    const group=this.plugin.snapshot?.collections?.find(g=>g.scope===scope&&g.name===parent);if(!group)return;
    const key=JSON.stringify([scope,parent]),children=group.subgroups||[];
    if(!children.length)return;
    const expanded=!this.collapsed.has(key),toggle=button.createSpan({cls:'ldb-tree-toggle',attr:{role:'button',tabindex:'0','aria-label':tr(expanded?'收起子类':'展开子类'),'aria-expanded':String(expanded)}});
    setIcon(toggle,expanded?'chevron-down':'chevron-right');button.prepend(toggle);
    const flip=e=>{e.preventDefault();e.stopPropagation();expanded?this.collapsed.add(key):this.collapsed.delete(key);this.app.workspace.requestSaveLayout();this.render();};
    toggle.addEventListener('click',flip);toggle.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')flip(e);});
    if(!expanded)return;
    const live=new Set(this.plugin.snapshot.library.map(r=>r.path));
    for(const subgroup of [...children,'']){
      const child=add(subgroup||tr('未分组'),subgroup?'folder':'inbox',{scope,category:parent,subgroup},group.members.filter(m=>(m.subgroup||'')===subgroup&&live.has(m.path)).length,true);child.addClass('is-subgroup');
      ldbDropTarget(child,this.plugin,{scope,category:parent,subgroup});
      if(!subgroup)continue;
      ldbGroupReorderTarget(child,this.plugin,scope,subgroup,parent);
      const open=e=>{e.preventDefault();e.stopPropagation();if(this.renaming)return;const menu=new Menu().setUseNativeMenu(!Platform?.isMobile),expected=Collections.childState(group);
        menu.addItem(item=>item.setTitle(tr('重命名')).setIcon('pencil').onClick(()=>this.beginChildEdit(child,scope,parent,subgroup)));
        menu.addItem(item=>item.setTitle(tr('删除子类，文献移回未分组')).setIcon('trash-2').onClick(()=>this.plugin.editChild('remove',scope,parent,subgroup,'',expected).catch(e=>new Notice(e.message,8000))));
        const rect=child.getBoundingClientRect();menu.showAtPosition({x:rect.left,y:rect.bottom},child.ownerDocument);
      };
      child.addEventListener('contextmenu',open);
      if(Platform?.isMobile){const more=child.createSpan({cls:'ldb-nav-more',attr:{role:'button',tabindex:'0','aria-label':tr('更多操作')}});setIcon(more,'more-horizontal');more.addEventListener('click',open);more.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')open(e);});}
    }
  }
  beginChildEdit(button,scope,parent,child=null){
    if(this.renaming||this.plugin.hasPendingEdit()||this.plugin.importing){new Notice(tr('请先保存或取消编辑，并等待当前操作结束'));return;}
    const group=this.plugin.snapshot?.collections?.find(g=>g.scope===scope&&g.name===parent);if(!group||!button.isConnected){this.render();return;}
    const expected=Collections.childState(group);this.renaming={scope,name:parent};
    const editor=button.ownerDocument.createElement('div');editor.className='ldb-nav-item is-subgroup ldb-nav-renaming';setIcon(editor.createSpan('ldb-nav-icon'),'folder');
    const input=editor.createEl('input',{type:'text',cls:'ldb-nav-rename-input',attr:{'aria-label':tr(child===null?'新建子类':'重命名子类'),placeholder:tr('子类名称')}});input.value=child||'';
    if(child===null)button.after(editor);else button.replaceWith(editor);
    let saving=false,finished=false;
    const finish=()=>{if(finished)return;finished=true;this.renaming=null;this.collapsed.delete(JSON.stringify([scope,parent]));this.render();};
    const save=async()=>{if(saving||finished)return;const to=input.value.trim();if(to===child||(child===null&&!to)){finish();return;}saving=true;input.readOnly=true;
      try{await this.plugin.editChild(child===null?'add':'rename',scope,parent,child,to,expected);finish();}
      catch(error){saving=false;input.readOnly=false;input.setAttribute('aria-invalid','true');input.title=error.message;new Notice(error.message,8000);input.focus();}
    };
    input.addEventListener('keydown',e=>{e.stopPropagation();if(e.isComposing||e.keyCode===229)return;if(e.key==='Enter'){e.preventDefault();save();}else if(e.key==='Escape'&&!saving){e.preventDefault();finish();}});
    input.addEventListener('blur',save);input.addEventListener('input',()=>input.removeAttribute('aria-invalid'));input.focus();input.select();
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
    const prompt=tr`请整理论文库 ${base}。先读根目录 AGENTS.md。处理 temp 收件箱，以及 library.md 中待整理、自动整理或元信息不完整且未标为人工完成的文献。PDF 原文件名永远不改；同名文件放不同子目录，保留 PDF、Skim 批注和扩展属性。核实真实篇名后写入篇名列，保留已选集合。补齐空缺的篇名、标签、TL;DR；保留人工及未知来源的已有内容、Notes、阅读状态、优先级、书签和项目备注。人工完成的条目跳过；通过带 actor 的 updateLibraryEntry 记录每个字段和标签来源（kind: ai，name: 实际 Agent 名，如 Codex），读取 PDF 后标为 AI 已整理，无法确认的字段留空并报告。核实重复与版本，不擅自合并。严禁生成或修改 BibTeX、引用来源、引用键、作者、DOI 等引用字段；新条目这些字段留空。只处理公开文献，不搜索或上传审稿、投稿材料。先备份，检查并发修改，最后验证源表、集合和附件。仅执行本次手动整理，不创建定时任务。`;
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
// One-shot feedback for changed detail controls. No timers, polling, or storage changes.
class LdbDetailMotion {
  constructor(root){
    this.root=root;this.win=root.ownerDocument.defaultView;this.items=new Map();this.animations=new Set();
    this.media=this.win.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.reduce=()=>{if(this.media.matches)this.cancelAnimations();};this.media?.addEventListener?.('change',this.reduce);
  }
  cancelAnimations(){for(const animation of this.animations){animation.cancel();animation.oncancel?.();}this.animations.clear();}
  pause(){if(this.frame)this.win.cancelAnimationFrame(this.frame);this.frame=0;this.cancelAnimations();for(const item of this.items.values())item.present=false;}
  capture(identity){
    if(identity!==this.identity){this.pause();this.identity=identity;this.items.clear();this.initialized=false;}
    for(const item of this.items.values())if(item.el.isConnected){item.rect=item.el.getBoundingClientRect();item.present=true;}
  }
  animate(el,kind,cleanup=()=>{}){
    if(this.media?.matches||!el.animate){cleanup();return;}
    const frames=kind==='out'?[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.9)'}]
      :kind==='in'?[{opacity:0,transform:'translateY(2px) scale(.92)'},{opacity:1,transform:'translateY(0) scale(1.035)',offset:.7},{opacity:1,transform:'scale(1)'}]
      :kind==='bookmark'?[{transform:'scale(.88)'},{transform:'scale(1.14)',offset:.6},{transform:'scale(1)'}]
      :[{opacity:.45},{opacity:1}];
    const animation=el.animate(frames,{duration:kind==='out'?130:kind==='change'?150:200,easing:'cubic-bezier(.2,.8,.2,1)'});
    this.animations.add(animation);let cleaned=false;const finish=()=>{if(cleaned)return;cleaned=true;this.animations.delete(animation);cleanup();};
    animation.onfinish=animation.oncancel=finish;animation.finished?.then(finish,finish);
  }
  fadeRemoved(item){
    if(!item.present||!item.rect||!item.key.startsWith('chip:'))return;
    const rect=item.rect,rootRect=this.root.getBoundingClientRect();
    if(!rect.width||rect.bottom<=rootRect.top||rect.top>=rootRect.bottom)return;
    const ghost=item.el.cloneNode(true);ghost.removeAttribute('data-ldb-motion');ghost.removeAttribute('id');
    // Keep the chip's parent class so a fading copy retains its typography and tag styling.
    const layer=this.root.ownerDocument.createElement('div');layer.className='ldb-motion-exit '+(item.el.parentElement?.className||'');
    layer.setAttribute('aria-hidden','true');layer.inert=true;
    Object.assign(layer.style,{left:(rect.left-rootRect.left-this.root.clientLeft+this.root.scrollLeft)+'px',top:(rect.top-rootRect.top-this.root.clientTop+this.root.scrollTop)+'px',width:rect.width+'px',height:rect.height+'px'});
    layer.appendChild(ghost);this.root.appendChild(layer);this.animate(layer,'out',()=>layer.remove());
  }
  schedule(identity){
    if(this.frame)this.win.cancelAnimationFrame(this.frame);
    this.frame=this.win.requestAnimationFrame(()=>{
      this.frame=0;if(this.identity!==identity||!this.root.isConnected)return;
      const next=new Map();
      for(const el of this.root.querySelectorAll('[data-ldb-motion]')){
        const key=el.getAttribute('data-ldb-motion');next.set(key,{key,el,value:el.getAttribute('data-ldb-motion-value')??el.value??el.textContent});
      }
      if(this.initialized&&!this.media?.matches){
        for(const [key,item]of next){const previous=this.items.get(key);if(!previous)this.animate(item.el,'in');else if(previous.value!==item.value)this.animate(item.el,key==='bookmark'?'bookmark':'change');}
        for(const [key,item]of this.items)if(!next.has(key))this.fadeRemoved(item);
      }
      this.items=next;this.initialized=true;
    });
  }
  destroy(){this.pause();this.items.clear();this.media?.removeEventListener?.('change',this.reduce);}
}

class LiteratureBrowser extends ItemView {
  constructor(leaf,plugin){
    super(leaf);this.plugin=plugin;this.rows=[];this.visibleRows=[];this.selectedPath='';this.selectedPaths=new Set();this.scope='library';
    this.filters={query:'',category:'',subgroup:null,status:'',tag:'',sort:'title',descending:false,organizing:'',bookmarked:false,bookmarkOnly:false};
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
      this.filters.subgroup=typeof state.subgroup==='string'?state.subgroup:null;
      if(SCOPES[state.scope])this.scope=state.scope;
      if(this.isPublic()&&this.filters.sort==='filename')this.filters.sort='title';
      this.filters.descending=state.descending===true;
      this.filters.bookmarked=this.scope==='library'&&state.bookmarked===true;
      this.filters.bookmarkOnly=this.isPublic()&&!this.filters.bookmarked&&state.bookmarkOnly===true;
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
    if(Platform?.isMobile)this.setMobileExpanded(false);
    const keepSort=nav.revealPaths?.length&&this.scope===(nav.scope||'library')?{sort:this.filters.sort,descending:this.filters.descending}:{};
    this.scope=nav.scope||'library';
    Object.assign(this.filters,{bookmarked:this.scope==='library'&&nav.bookmarked===true,bookmarkOnly:false,query:'',tag:'',organizing:'',category:nav.category||'',subgroup:typeof nav.subgroup==='string'?nav.subgroup:null,status:nav.status||'',sort:this.isPublic()?'title':'published',descending:this.scope==='inbox'},keepSort);
    this.selectedPath='';this.activeRowId=this.selectionAnchorId='';this.selectedPaths.clear();this.listDropController?.end();
    if(this.listEl&&!nav.revealPaths?.length)this.listEl.scrollTop=0;
    this.pendingRevealPaths=nav.revealPaths||[];
    try{await this.reload();if(this.pendingRevealPaths.length){this.revealSelection(true);this.listEl?.focus?.({preventScroll:true});}}finally{this.pendingRevealPaths=null;}
    return true;
  }
  async onOpen(){
    this.closed=false;this.detailRenderKey=this.listRenderKey=null;const root=this.contentEl;root.empty();root.addClass('ldb-browser');root.lang=LdbI18n.getLanguage();
    if(Platform?.isMobile)root.addClass('ldb-mobile');
    const toolbar=root.createDiv('ldb-toolbar');
    if(Platform?.isMobile)this.mobileIcon(toolbar,'panel-left',tr('文献分类'),()=>this.plugin.showNavigation());
    const brand=toolbar.createDiv('ldb-brand');this.headingEl=brand.createEl('strong',{text:tr('文献库')});this.countEl=brand.createSpan('ldb-count');
    if(Platform?.isMobile){
      this.mobileImportEl=this.mobileIcon(toolbar,'plus',tr('导入 PDF'),()=>this.plugin.choosePDFs({scope:this.scope,category:this.filters.category,subgroup:this.filters.subgroup},root.ownerDocument));
      this.mobileFilterEl=this.mobileIcon(toolbar,'list-filter',tr('筛选'),()=>{this.mobileFiltersOpen=!this.mobileFiltersOpen;this.syncMobileControls();});
      this.mobileIcon(toolbar,'more-horizontal',tr('更多操作'),e=>this.mobileMenu(e));
    }
    const search=toolbar.createDiv('ldb-search');setIcon(search.createSpan(),'search');
    this.searchEl=search.createEl('input',{type:'search',attr:{placeholder:tr('搜索篇名、文件名、标签、TL;DR、Notes…'),'aria-label':tr('搜索文献')}});
    this.searchEl.addEventListener('input',()=>{this.filters.query=this.searchEl.value;this.renderList(true);});
    this.venueDeadlineEl=this.button(toolbar,'',()=>new VenueDeadlineModal(this.plugin,this.scope,this.filters.category).open(),'ldb-venue-deadline');this.venueDeadlineEl.hidden=true;
    this.actionEl=this.button(toolbar,'',()=>this.primaryAction());
    this.exportEl=this.button(toolbar,tr('导出…'),()=>new CitationExportModal(this.plugin,this.visibleRows,this.filters.category||tr('文献库'),this.selectedRows()).open());
    const filterbar=root.createDiv('ldb-filterbar');this.filterbar=filterbar;
    this.statusEl=this.makeFilterSelect(filterbar,tr('阅读状态'),[['',tr('全部阅读状态')],...Engine.STATUSES.map(s=>[s,tr(s)])]);
    this.organizingEl=this.makeFilterSelect(filterbar,tr('整理状态'),[['',tr('全部整理状态')],['pending',tr('待补充元信息')],...Organization.STATES.map(s=>[s,tr(s)])]);
    this.organizingEl.addEventListener('change',()=>{this.filters.organizing=this.organizingEl.value;this.renderList(true);});
    this.tagEl=this.makeFilterSelect(filterbar,tr('标签'),[['',tr('全部标签')]]);
    this.statusEl.addEventListener('change',()=>{this.filters.status=this.statusEl.value;this.renderList(true);});
    this.tagEl.addEventListener('change',()=>{this.filters.tag=this.tagEl.value;this.renderList(true);});
    this.bookmarkFilterEl=this.button(filterbar,'',()=>this.toggleBookmarkFilter(),'ldb-bookmark-filter');
    setIcon(this.bookmarkFilterEl.createSpan(),'bookmark');this.bookmarkFilterEl.createSpan({text:tr('仅书签')});
    this.bookmarkFilterEl.setAttribute('aria-label',tr('仅书签'));
    this.clearEl=this.button(filterbar,tr('清除筛选'),()=>this.clearFilters(),'ldb-clear');
    this.errorEl=root.createDiv('ldb-error');this.errorEl.hidden=true;
    const body=root.createDiv('ldb-body'),list=body.createDiv('ldb-list-pane');this.headerEl=list.createDiv('ldb-columns');this.sortButtons=[];
    for(const [key,label] of [['title',tr('篇名')],['published',tr('发表')],['status',tr('阅读')],['priority',tr('优先')]]){
      const b=this.button(this.headerEl,label,()=>{this.filters.descending=this.filters.sort===key?!this.filters.descending:key==='published';this.filters.sort=key;this.renderList();},'ldb-column-'+key);
      b.dataset.sort=key;b.dataset.label=label;this.sortButtons.push(b);
    }
    this.listEl=list.createDiv({cls:'ldb-list',attr:{role:'listbox',tabindex:'0','aria-label':tr('论文列表'),'aria-multiselectable':'true'}});
    this.listDropController?.destroy();this.listDropController=ldbListDropTarget(list,this);
    this.listEl.addEventListener('click',e=>{const t=e.target.closest('[data-paper-path]');if(t)this.select(t.dataset.paperPath,e);});
    this.listEl.addEventListener('dblclick',e=>{const t=e.target.closest('[data-paper-path]');if(t&&!this.dirty())this.openPDF(this.rows.find(r=>r.path===t.dataset.paperPath));});
    this.listEl.addEventListener('keydown',e=>this.listKeydown(e));
    this.listEl.addEventListener('contextmenu',e=>{
      const target=e.target.closest('[data-paper-path]'),row=target&&this.rows.find(r=>r.path===target.dataset.paperPath);
      if(!row){
        if(this.scope!=='inbox')return;
        e.preventDefault();e.stopPropagation();
        const menu=new Menu().setUseNativeMenu(!Platform?.isMobile);
        menu.addItem(item=>item.setTitle(tr('粘贴')).setIcon('clipboard-paste').setDisabled(!!this.plugin.importing||!!this.plugin.recordBusy).onClick(async()=>{
          try{await this.plugin.pasteInboxFiles();}catch(error){new Notice(error.message,8000);}
        }));menu.showAtMouseEvent(e);return;
      }
      e.preventDefault();if(!this.selectedPaths.has(row.path)&&!this.dirty())this.select(row.path);
      const menu=new Menu(),rows=this.selectedRows();
      if(this.isPublic()&&this.plugin.snapshot.collections){
        if(this.groupingCollection())menu.addItem(item=>item.setTitle(tr('设置子类…')).setIcon('folder').onClick(()=>ldbChildMenu(this.plugin,rows,{scope:this.scope,name:this.filters.category},{x:e.clientX,y:e.clientY},this.contentEl.ownerDocument)));
        if(this.filters.subgroup)menu.addItem(item=>item.setTitle(tr('移出子类')).setIcon('minus').onClick(()=>this.moveOutOfChild(rows)));
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
    this.listEl.addEventListener('dragend',()=>{this.plugin.endPaperDrag();for(const {el} of this.renderedRows||[])el.removeClass('is-dragging');});
    this.detailEl=body.createEl('aside',{cls:'ldb-details',attr:{'aria-label':tr('论文详情')}});

    if(!this.shortcutRegistered)this.registerDomEvent(root,'keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='f'&&!this.dirty()){e.preventDefault();e.stopPropagation();this.searchEl.focus();this.searchEl.select();}});
    this.shortcutRegistered=true;
    await this.reload();
  }
  makeSelect(parent,label,options){const s=parent.createEl('select',{attr:{'aria-label':label,title:label}});for(const [value,text]of options)s.createEl('option',{value,text});return s;}
  makeFilterSelect(parent,label,options){
    const wrap=parent.createSpan('ldb-filter-select'),sizer=wrap.createSpan({cls:'ldb-filter-label',text:options[0]?.[1]||'',attr:{'aria-hidden':'true'}});
    const select=this.makeSelect(wrap,label,options);select.ldbSizer=sizer;return select;
  }
  syncFilterControls(){
    // Only the selected label sizes the native select, not its longest menu option.
    for(const select of [this.statusEl,this.organizingEl,this.tagEl])if(select?.ldbSizer)select.ldbSizer.setText(select.selectedOptions[0]?.textContent||'');
    if(this.bookmarkFilterEl){
      this.bookmarkFilterEl.hidden=!!this.filters.bookmarked;
      this.bookmarkFilterEl.toggleClass('is-active',this.filters.bookmarkOnly);
      this.bookmarkFilterEl.setAttribute('aria-pressed',String(this.filters.bookmarkOnly));
    }
  }
  groupingCollection(){
    if(!this.isPublic()||this.filters.bookmarked||!this.filters.category||this.filters.category===Engine.UNFILED_CATEGORY)return null;
    return this.plugin.snapshot?.collections?.find(g=>g.scope===this.scope&&g.name===this.filters.category)||null;
  }
  toggleBookmarkFilter(){
    if(this.dirty()||!this.isPublic()||this.filters.bookmarked)return;
    this.filters.bookmarkOnly=!this.filters.bookmarkOnly;this.renderList(true);
  }
  clearFilters(){
    if(this.dirty())return;
    Object.assign(this.filters,{query:'',status:'',tag:'',organizing:'',bookmarkOnly:false});this.syncControls();this.renderList(true);
  }
  syncControls(){if(!this.searchEl)return;this.searchEl.value=this.filters.query;this.statusEl.value=this.filters.status;this.tagEl.value=this.filters.tag;if(this.organizingEl)this.organizingEl.value=this.filters.organizing;this.syncFilterControls();this.syncMobileControls();}
  mobileIcon(parent,icon,label,action){const b=this.button(parent,'',action,'ldb-mobile-icon');setIcon(b,icon);b.setAttribute('aria-label',label);b.title=label;return b;}
  setMobileExpanded(expanded){
    this.mobileExpanded=expanded;this.contentEl.toggleClass('ldb-detail-expanded',expanded);
    // The animated-away list must not retain keyboard or assistive-technology focus.
    if(this.listEl?.parentElement)this.listEl.parentElement.inert=expanded;
  }
  syncMobileControls(){
    if(!this.mobileFilterEl)return;
    const filtered=['status','organizing','tag','bookmarkOnly'].some(k=>this.filters[k]);
    this.mobileFilterEl.hidden=!this.isPublic();this.mobileFilterEl.toggleClass('is-active',filtered);
    this.mobileFilterEl.setAttribute('aria-expanded',String(!!this.mobileFiltersOpen));
    this.contentEl.toggleClass('ldb-filters-open',!!this.mobileFiltersOpen);
    this.mobileImportEl.hidden=this.isPublic()&&(!this.filters.category||this.filters.category===Engine.UNFILED_CATEGORY);
  }
  mobileMenu(event){
    const menu=new Menu();
    menu.addItem(item=>item.setTitle(this.actionEl.textContent).setIcon('plus').onClick(()=>this.primaryAction()));
    if(this.isPublic())menu.addItem(item=>item.setTitle(tr('导出…')).setIcon('download').onClick(()=>new CitationExportModal(this.plugin,this.visibleRows,this.filters.category||tr('文献库'),this.selectedRows()).open()));
    if(!this.venueDeadlineEl.hidden)menu.addItem(item=>item.setTitle(this.venueDeadlineEl.textContent).setIcon('calendar').onClick(()=>new VenueDeadlineModal(this.plugin,this.scope,this.filters.category).open()));
    menu.addItem(item=>item.setTitle(tr('重新读取本地数据')).setIcon('refresh-cw').onClick(()=>this.plugin.refresh(true)));
    const rect=event.currentTarget.getBoundingClientRect();menu.showAtPosition({x:rect.left,y:rect.bottom},this.contentEl.ownerDocument);
  }
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
    const parent=this.groupingCollection();if(this.filters.subgroup!==null&&(!parent||(this.filters.subgroup&&!parent.subgroups?.includes(this.filters.subgroup))))this.filters.subgroup=null;
    this.headingEl.setText(this.filters.subgroup!==null?this.filters.category+' / '+(this.filters.subgroup||tr('未分组')):this.filters.bookmarked?tr('书签'):TRACK_FILES[this.scope]&&this.filters.category===this.plugin.stagingGroup(this.scope)?tr('暂存区'):(this.filters.category===Engine.UNFILED_CATEGORY?tr(this.filters.category):this.filters.category)||tr(this.filters.status)||(this.scope==='library'?tr('全部文献'):SCOPES[this.scope]));this.countEl.setText(tr`${this.rows.filter(r=>!this.filters.category||r.category===this.filters.category).length} 篇`);
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
    this.plugin.navigation={scope:this.scope,category:this.filters.category,status:this.filters.status,bookmarked:this.filters.bookmarked,subgroup:this.filters.subgroup};this.plugin.renderNavigation();
  }
  primaryAction(){if(this.dirty()){new Notice(tr('请先保存或取消编辑'));return;}if(this.isPublic())new CategoryModal(this.plugin,this.scope).open();else if(this.scope==='inbox')new AgentHandoffModal(this.plugin).open();else new VenueModal(this.plugin,this.scope).open();}
  renderList(reset=false){
    if(!this.listEl)return;const scroll=reset?0:this.listEl.scrollTop,keepVisible=!reset&&!this.dirty()&&this.selectionVisible();
    if(this.isPublic())this.visibleRows=Engine.filterLibrary(this.rows,{...this.filters,bookmarked:this.filters.bookmarked||this.filters.bookmarkOnly,category:this.scope==='projects'?'':this.filters.category});
    else{
      const tokens=this.filters.query.toLowerCase().split(/\s+/).filter(Boolean);
      this.visibleRows=this.rows.filter(r=>(!this.filters.category||r.category===this.filters.category)&&tokens.every(t=>[r.filename,r.category,r.status,r.tldr,r.notes].join(' ').toLowerCase().includes(t)));
      const sort=this.filters.sort;this.visibleRows.sort((a,b)=>{
        let n=sort==='published'?(this.scope==='inbox'?a.mtime-b.mtime:(a.due===b.due?0:a.due-b.due)):String(a[sort==='title'?'filename':sort]||'').localeCompare(String(b[sort==='title'?'filename':sort]||''),'en',{numeric:true});return (this.filters.descending?-n:n)||a.filename.localeCompare(b.filename);
      });
    }
    const collection=this.groupingCollection();
    if(collection&&this.filters.subgroup!==null){const paths=new Set(collection.members.filter(m=>(m.subgroup||'')===this.filters.subgroup).map(m=>m.path));this.visibleRows=this.visibleRows.filter(r=>paths.has(r.path));}
    if(this.pendingRevealPaths?.length){const reveal=this.pendingRevealPaths.flatMap(path=>this.visibleRows.filter(r=>(r.pdfPath||r.path)===path));if(reveal.length){this.selectedPath=reveal[0].path;this.selectedPaths=new Set(reveal.map(r=>r.path));}}
    if(!this.dirty()&&!this.visibleRows.some(r=>r.path===this.selectedPath))this.selectedPath=this.visibleRows[0]?.path||'';
    this.selectedPaths=new Set([...this.selectedPaths].filter(path=>this.visibleRows.some(r=>r.path===path)));if(!this.selectedPaths.size&&this.selectedPath)this.selectedPaths.add(this.selectedPath);
    this.countEl.setText(tr`${this.visibleRows.length} 篇`);this.clearEl.hidden=!['query','status','tag','organizing','bookmarkOnly'].some(k=>this.filters[k]);this.syncFilterControls();
    for(const b of this.sortButtons){const on=b.dataset.sort===this.filters.sort;b.setText(b.dataset.label+(on?(this.filters.descending?' ↓':' ↑'):''));}
    const childGrouped=!!collection&&this.filters.subgroup===null,grouped=this.filters.bookmarked||childGrouped;
    const groups=this.filters.bookmarked?Engine.groupLibrary(this.visibleRows,this.plugin.snapshot?.categories):childGrouped?Collections.groupRows(this.visibleRows,collection,{includeEmpty:true}):[{name:'',rows:this.visibleRows}];
    this.listEl.toggleClass('ldb-child-groups',childGrouped);
    // A bookmark write must not rebuild the unchanged list or its focus/scroll state.
    const listKey=JSON.stringify([LdbI18n.getLanguage(),this.scope,this.filters.bookmarked,childGrouped,groups.map(g=>[g.name,g.rows.map(r=>[r.path,this.detailTitle(r),r.published,r.status,r.priority])])]);
    if(listKey===this.listRenderKey&&this.listEl.querySelector){
      const current=new Map(this.visibleRows.map(row=>[row.path,row]));
      for(const item of this.renderedRows){
        item.row=current.get(item.row.path);const icon=item.el.querySelector('.ldb-pdf-icon'),badge=icon?.querySelector('.ldb-bookmark-badge');
        if(this.isPublic()&&item.row.bookmarked&&!badge){const marker=icon.createSpan({cls:'ldb-bookmark-badge',attr:{'aria-label':tr('已加书签')}});setIcon(marker,'bookmark');this.detailMotion?.animate(marker,'in');}
        else if(!item.row.bookmarked&&badge)badge.remove();
      }
      if(reset)this.listEl.scrollTop=0;this.syncMobileControls();this.updateSelection();if(!this.dirty())this.renderDetail();this.remember();return;
    }
    this.listDropController?.end();this.listRenderKey=listKey;this.listEl.empty();this.rowEls=new Map();this.renderedRows=[];
    for(const group of groups){
      let container=this.listEl;
      if(grouped){
        const label=group.kind==='ungrouped'||group.name===Engine.UNFILED_CATEGORY?tr(group.name):group.name;
        container=this.listEl.createDiv({cls:'ldb-bookmark-group',attr:{role:'group','aria-label':label}});
        const heading=container.createDiv({cls:'ldb-group-heading',attr:{role:'presentation'}});
        heading.createSpan({text:label});
        heading.createSpan({cls:'ldb-group-count',text:String(group.rows.length)});
        if(childGrouped)container.dataset.dropSubgroup=group.subgroup;
      }
      for(const r of group.rows){
        const i=this.renderedRows.length;
        const row=container.createDiv({cls:'ldb-row',attr:{role:'option','aria-selected':String(this.selectedPaths.has(r.path)),id:`ldb-${this.leaf.id}-${i}`}});row.dataset.paperPath=r.path;row.title=this.detailTitle(r);
        row.draggable=this.scope!=='inbox';
        const name=row.createSpan('ldb-filename'),icon=name.createSpan('ldb-pdf-icon');setIcon(icon,'file-text');
        if(this.isPublic()&&r.bookmarked){const badge=icon.createSpan({cls:'ldb-bookmark-badge',attr:{'aria-label':tr('已加书签')}});setIcon(badge,'bookmark');}
        name.createSpan({cls:'ldb-filename-text',text:this.detailTitle(r)});
        row.createSpan({cls:'ldb-date',text:TRACK_FILES[this.scope]?Engine.displayDeadline(r.published):tr(r.published),attr:{title:TRACK_FILES[this.scope]?Engine.displayDeadline(r.published):tr(r.published)}});row.createSpan({cls:'ldb-reading',text:tr(r.status),attr:{'data-status':r.status}});row.createSpan({cls:'ldb-priority',text:TRACK_FILES[this.scope]?(r.category===this.plugin.stagingGroup(this.scope)?tr('暂存区'):r.priority):tr(r.priority),attr:{'data-priority':r.priority}});
        if(!this.rowEls.has(r.path))this.rowEls.set(r.path,row);
        this.renderedRows.push({row:r,el:row});
      }
    }
    if(!this.visibleRows.length&&!childGrouped)this.listEl.createDiv({cls:'ldb-empty',text:this.scope==='inbox'||TRACK_FILES[this.scope]?tr(Platform?.isMobile?'点击 ＋ 导入 PDF':'拖入 PDF'):tr('暂无文献')});
    this.syncMobileControls();
    this.listEl.scrollTop=scroll;this.updateSelection();if(keepVisible)this.revealSelection();if(!this.dirty()){this.renderDetail();}this.remember();
  }
  selectionElement(){return this.renderedRows?.find(r=>r.el?.id===this.activeRowId&&r.row.path===this.selectedPath)?.el||this.rowEls?.get(this.selectedPath);}
  selectionVisible(){const row=this.selectionElement();if(!row?.getBoundingClientRect||!this.listEl?.getBoundingClientRect)return false;const r=row.getBoundingClientRect(),b=this.listEl.getBoundingClientRect();return r.bottom>b.top&&r.top<b.bottom;}
  revealSelection(center=false){
    const row=this.selectionElement();if(!row)return;
    if(!row.getBoundingClientRect||!this.listEl?.getBoundingClientRect){row.scrollIntoView?.({block:'nearest'});return;}
    const r=row.getBoundingClientRect(),b=this.listEl.getBoundingClientRect();if(r.top>=b.top&&r.bottom<=b.bottom)return;
    this.listEl.scrollTop+=center?(r.top+r.bottom-b.top-b.bottom)/2:r.top<b.top?r.top-b.top:r.bottom-b.bottom;
  }
  selectionRows(){return this.renderedRows?.length?this.renderedRows:this.visibleRows.map(row=>({row,el:this.rowEls?.get(row.path)}));}
  select(path,event={},element=null){
    if(this.dirty()){new Notice(tr('请先保存或取消右侧编辑'));return;}
    const rows=this.selectionRows(),target=element||event.target?.closest?.('[data-paper-path]')||this.rowEls?.get(path);
    if(this.isPublic()&&event.shiftKey&&this.selectedPath){
      let a=rows.findIndex(r=>r.el?.id===this.selectionAnchorId);if(a<0)a=rows.findIndex(r=>r.row.path===(this.selectionAnchor||this.selectedPath));
      let b=rows.findIndex(r=>r.el===target);if(b<0)b=rows.findIndex(r=>r.row.path===path);
      if(a<0)a=b;
      if(!event.metaKey&&!event.ctrlKey)this.selectedPaths.clear();for(let i=Math.min(a,b);i<=Math.max(a,b);i++)if(rows[i])this.selectedPaths.add(rows[i].row.path);
    }else if(this.isPublic()&&(event.metaKey||event.ctrlKey)){
      if(this.selectedPaths.has(path)){this.selectedPaths.delete(path);if(!this.selectedPaths.size)this.selectedPaths.add(path);}else this.selectedPaths.add(path);this.selectionAnchor=path;this.selectionAnchorId=target?.id;
    }else{this.selectedPaths=new Set([path]);this.selectionAnchor=path;this.selectionAnchorId=target?.id;}
    this.selectedPath=path;this.activeRowId=target?.id;this.updateSelection();this.renderDetail();this.remember();
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
  updateSelection(){
    const rows=this.selectionRows();
    for(const {row,el}of rows){el?.toggleClass('is-selected',this.selectedPaths.has(row.path));el?.setAttribute('aria-selected',String(this.selectedPaths.has(row.path)));}
    const active=rows.find(r=>r.el?.id===this.activeRowId&&r.row.path===this.selectedPath)||rows.find(r=>r.row.path===this.selectedPath);
    this.activeRowId=active?.el?.id;
    if(active?.el)this.listEl.setAttribute('aria-activedescendant',active.el.id);else this.listEl.removeAttribute('aria-activedescendant');
  }
  listKeydown(e){
    if(this.dirty()||!this.visibleRows.length)return;
    if(this.isPublic()&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='a'){e.preventDefault();this.selectedPaths=new Set(this.visibleRows.map(r=>r.path));this.updateSelection();return;}
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    const rows=this.selectionRows();let i=rows.findIndex(r=>r.el?.id===this.activeRowId&&r.row.path===this.selectedPath);
    if(i<0)i=rows.findIndex(r=>r.row.path===this.selectedPath);
    if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();if(this.isPublic()&&this.filters.subgroup)this.moveOutOfChild(this.selectedRows());else if(this.isPublic()&&this.filters.category&&this.filters.category!==Engine.UNFILED_CATEGORY)this.removeMembership(this.selectedRows(),true);else this.requestDelete(rows[i]?.row);return;}
    if(e.key==='Enter'){e.preventDefault();this.openPDF(rows[i]?.row);return;}
    if(e.key==='ArrowDown')i=Math.min(rows.length-1,i+1);else if(e.key==='ArrowUp')i=Math.max(0,i-1);else if(e.key==='Home')i=0;else if(e.key==='End')i=rows.length-1;else return;
    e.preventDefault();this.select(rows[i].row.path,e,rows[i].el);this.revealSelection();
  }
  async moveOutOfChild(rows){
    if(this.dirty())return;const target={scope:this.scope,name:this.filters.category,subgroup:''},expected={target,placements:Collections.placementState(this.plugin.snapshot.collections,rows.map(r=>r.path),target)};
    try{await this.plugin.changeMembership(rows,target,null,false,expected);}catch(e){new Notice(e.message,8000);}
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
  prepareDetailMotion(row=this.detailRow){
    if(!this.detailEl.ownerDocument?.defaultView?.requestAnimationFrame)return;
    this.detailMotion??=new LdbDetailMotion(this.detailEl);
    this.detailMotion.capture(this.scope+':'+(row?.path||''));
  }
  queueDetailMotion(){this.detailMotion?.schedule(this.scope+':'+(this.detailRow?.path||''));}
  renderDetail(override){
    const row=override||this.rows.find(r=>r.path===this.selectedPath);this.prepareDetailMotion(row);
    const project=this.scope==='projects'&&this.plugin.snapshot.collections?.find(g=>g.scope==='projects'&&g.name===this.filters.category);
    const detailKey=row&&this.isPublic()?JSON.stringify([LdbI18n.getLanguage(),this.scope,this.filters.category,row.path,Array.from({length:13},(_,i)=>row.cells?.[i]||''),row.categories,row.projects,this.plugin.snapshot.collections?.filter(g=>g.members.some(m=>m.path===row.path)).map(g=>[g.scope,g.name,g.members.find(m=>m.path===row.path).subgroup]),project?.members?.find(m=>m.path===row.path)?.notes]):null;
    if(!override&&detailKey&&detailKey===this.detailRenderKey){
      this.detailRow=this.notesBase=row;this.syncQuickFields();this.queueDetailMotion();return;
    }
    this.detailRenderKey=detailKey;this.detailEl.empty();
    this.detailRow=row;this.bookmarkButton=null;this.quickFields=[];this.venueInput=null;this.venueMenuButton=null;this.venueRemoveButtons=[];
    if(!row){if(Platform?.isMobile)this.setMobileExpanded(false);this.detailEl.createDiv({cls:'ldb-empty',text:tr('选择一篇论文查看详情')});return;}
    const top=this.detailEl.createDiv('ldb-detail-top');
    if(Platform?.isMobile){
      top.createSpan({cls:'ldb-mobile-detail-label',text:tr('详情')});
      const expand=this.mobileIcon(top,this.mobileExpanded?'minimize-2':'maximize-2',tr(this.mobileExpanded?'收起详情':'展开详情'),e=>{
        this.setMobileExpanded(!this.mobileExpanded);
        const label=tr(this.mobileExpanded?'收起详情':'展开详情');setIcon(e.currentTarget,this.mobileExpanded?'minimize-2':'maximize-2');e.currentTarget.title=label;e.currentTarget.setAttribute('aria-label',label);
        e.currentTarget.setAttribute('aria-expanded',String(this.mobileExpanded));
      });
      expand.setAttribute('aria-expanded',String(!!this.mobileExpanded));
    }
    if(this.scope!=='inbox')this.button(top,tr('编辑'),()=>this.dirty()?new Notice(tr('请先保存或取消 Notes')):this.startEditing(this.detailRow),'ldb-edit-button');
    if(this.isPublic()){this.bookmarkButton=this.button(top,'',()=>this.saveQuickField('bookmarked',!this.detailRow.bookmarked),'ldb-bookmark-button');setIcon(this.bookmarkButton,'bookmark');this.bookmarkButton.setAttribute('data-ldb-motion','bookmark');this.syncQuickFields();}
    const remove=this.button(top,'',()=>this.requestDelete(this.detailRow),'ldb-delete-button');setIcon(remove,'trash-2');remove.setAttribute('aria-label',tr('移至回收站'));remove.title=tr('移至回收站');
    const title=this.detailEl.createEl('h2',{cls:'ldb-title',text:this.detailTitle(row)});
    if(this.isPublic()){title.title=this.sourceLabel(row,'title');this.detailEl.createDiv({cls:'ldb-original-filename',text:row.filename,attr:{title:tr('文件名')}});}
    if(this.scope==='inbox'||this.isPublic()||row.pdfPath)this.button(this.detailEl,'Open ↗',()=>this.openPDF(this.detailRow),'mod-cta');
    if(this.scope==='inbox'){
      this.button(this.detailEl,tr('复制 Agent 整理指令'),()=>new AgentHandoffModal(this.plugin).open());return;
    }
    const meta=this.detailEl.createEl('dl',{cls:'ldb-metadata'});
    const pairs=this.isPublic()?[[tr('发表时间'),tr(row.published)]]:[...(this.scope==='reviews'?[]:[[tr('状态'),tr(row.status)]]),...(!this.filters.category?[[tr('截止时间'),Engine.displayDeadline(row.published)]]:[])];
    for(const [label,value]of pairs){meta.createEl('dt',{text:label});meta.createEl('dd',{text:value});}
    const quick=this.isPublic()?[['status',tr('阅读状态'),Engine.STATUSES],['organizing',tr('整理状态'),Organization.STATES],['priority',tr('优先级'),Engine.PRIORITIES]]:this.scope==='reviews'?[['status',tr('状态'),[...new Set([...Engine.REVIEW_STATUSES,row.status])]]]:[];
    for(const [key,label,options] of quick){
      meta.createEl('dt',{text:label});const field=meta.createEl('dd');
      const select=this.makeSelect(field,label,options.map(value=>[value,tr(value)]));select.addClass('ldb-inline-select');select.setAttribute('data-ldb-motion','field:'+key);select.value=row[key];select.disabled=this.readError;
      this.quickFields.push({key,select});select.addEventListener('change',()=>this.saveQuickField(key,select.value));
    }
    this.quickError=this.detailEl.createDiv({cls:'ldb-form-error',attr:{role:'alert'}});this.quickError.hidden=true;
    this.detailEl.createEl('h3',{text:this.isPublic()?'TL;DR':tr('下一步'),cls:'ldb-section-label'});this.detailEl.createEl('p',{text:libraryText(row.tldr),cls:'ldb-tldr',attr:{title:this.isPublic()?this.sourceLabel(row,'tldr'):''}});
    if(this.isPublic()&&this.plugin.snapshot.collections){
      this.detailEl.createEl('h3',{text:tr('分类'),cls:'ldb-section-label'});
      const groups=this.detailEl.createDiv('ldb-memberships');
      for(const group of this.plugin.snapshot.collections.filter(g=>g.members.some(m=>m.path===row.path))){
        const child=group.members.find(m=>m.path===row.path).subgroup||'',label=group.name+(child?' / '+child:''),chip=this.button(groups,label,e=>{const rect=e.currentTarget.getBoundingClientRect();ldbChildMenu(this.plugin,[this.detailRow],{scope:group.scope,name:group.name},{x:rect.left,y:rect.bottom},this.contentEl.ownerDocument);},'ldb-tag');
        chip.setAttribute('data-ldb-motion','chip:category:'+group.scope+':'+group.name);chip.title=tr('设置子类…');
      }
      this.button(groups,tr('＋ 集合'),e=>{const rect=e.currentTarget.getBoundingClientRect();ldbOpenCollectionMenu(this.plugin,[this.detailRow],{x:rect.left,y:rect.bottom},this.contentEl.ownerDocument);},'ldb-edit-button');
    }
    if(this.isPublic()){
      this.detailEl.createEl('h3',{text:tr('标签'),cls:'ldb-section-label'});const tags=this.detailEl.createDiv('ldb-tags');
      for(const tag of row.tags.split(/\s+/).filter(t=>t.startsWith('#'))){const source=Organization.source(row,tag,true);const chip=this.button(tags,tag.replace(/^#research\//,''),()=>{if(this.dirty()){new Notice(tr('请先保存或取消 Notes'));return;}this.filters.tag=tag;this.syncControls();this.renderList(true);},'ldb-tag'+(source.kind==='human'?' ldb-tag-human':''));chip.title=this.sourceLabel(row,tag,true);chip.setAttribute('data-ldb-motion','chip:tag:'+tag);}
      this.detailEl.createEl('h3',{text:'Venue',cls:'ldb-section-label'});
      const venues=this.detailEl.createDiv('ldb-paper-venues');this.venueTags=venues.createDiv('ldb-venue-tags');
      this.venueMenuButton=this.button(venues,tr('添加 Venue…'),e=>ldbPaperVenueMenu(this,e.currentTarget),'ldb-venue-picker');
      this.venueInput=venues.createEl('input',{type:'text',cls:'ldb-venue-input',attr:{placeholder:tr('输入新 Venue，按 Enter 添加'),'aria-label':tr('新 Venue 名称'),title:tr('输入名称后按 Enter，Esc 取消'),autocomplete:'off'}});
      this.venueInput.hidden=true;this.renderPaperVenues(false);
      this.venueInput.addEventListener('input',()=>{this.venueDraft=this.venueInput.value;this.syncQuickFields();this.lockFilters(this.notesDirty||!!this.venueDraft);this.remember();});
      this.venueInput.addEventListener('change',()=>this.addPaperVenue());
      this.venueInput.addEventListener('keydown',e=>{
        e.stopPropagation();if(e.isComposing||e.keyCode===229)return;
        if(e.key==='Enter'){e.preventDefault();this.addPaperVenue();}
        else if(e.key==='Escape'&&!this.saving){e.preventDefault();this.venueInput.value=this.venueDraft='';this.venueInput.hidden=true;this.quickError.hidden=true;this.syncQuickFields();this.lockFilters(this.notesDirty);this.remember();}
      });
    }
    this.detailEl.createEl('h3',{text:'Notes',cls:'ldb-section-label'});
    this.notesInput=this.detailEl.createEl('textarea',{cls:'ldb-notes-input',attr:{rows:'7',placeholder:tr('添加笔记…'),'aria-label':tr('个人 Notes')}});this.notesInput.value=this.isPublic()?libraryText(row.notes):row.notes;
    this.notesBase=row;this.notesInput.addEventListener('input',()=>this.markNotesDirty(this.detailRow));
    this.notesError=this.detailEl.createDiv('ldb-form-error');const actions=this.detailEl.createDiv('ldb-actions');
    this.notesSave=this.button(actions,tr('保存 Notes'),()=>this.saveNotes(),'mod-cta');this.notesSave.disabled=true;
    this.notesCancel=this.button(actions,tr('撤销修改'),()=>{this.notesDirty=false;this.notesInput.value=this.isPublic()?libraryText(this.notesBase.notes):this.notesBase.notes;this.notesSave.disabled=true;this.notesCancel.hidden=true;this.lockFilters(!!this.venueDraft);this.renderList();});this.notesCancel.hidden=true;
    if(project){
      const note=project.members.find(m=>m.path===row.path)?.notes||'',section=this.detailEl.createDiv('ldb-project-notes');
      section.createDiv({text:tr('项目备注'),cls:'ldb-eyebrow'});
      this.button(section,note||tr('添加项目备注…'),()=>new ProjectNoteModal(this.plugin,this.filters.category,this.detailRow,note).open(),'ldb-project-note');
    }
    this.queueDetailMotion();
  }
  markNotesDirty(row){
    this.notesBase=row;this.notesDirty=this.notesInput.value!==(this.isPublic()?libraryText(row.notes):row.notes);
    this.notesSave.disabled=!this.notesDirty;this.notesCancel.hidden=!this.notesDirty;this.lockFilters(this.notesDirty||!!this.venueDraft);this.remember();
  }
  renderPaperVenues(animate=true){
    if(!this.venueInput)return;
    if(animate)this.prepareDetailMotion();
    this.venueTags.empty();this.venueRemoveButtons=[];
    const venues=this.detailRow.venues||[];
    for(const name of venues){
      const chip=this.venueTags.createSpan('ldb-venue-tag');chip.setAttribute('data-ldb-motion','chip:venue:'+name);chip.createSpan({text:name});
      const remove=this.button(chip,'×',()=>this.saveQuickField('venues',(this.detailRow.venues||[]).filter(v=>v!==name)),'ldb-venue-remove');remove.setAttribute('aria-label',tr('移除 Venue ')+name);this.venueRemoveButtons.push(remove);
    }
    this.syncQuickFields();if(animate)this.queueDetailMotion();
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
  async saveBookmark(value){
    const row=this.detailRow;
    if(!row||!this.isPublic()||this.saving||this.editing||this.readError)return false;
    if(!!row.bookmarked===value)return true;
    // Keep unrelated controls and Notes live; the existing saving guard serializes writes.
    this.saving=true;this.bookmarkButton?.setAttribute('aria-busy','true');this.quickError.hidden=true;
    try{
      let updated;
      await this.plugin.mutate(LIBRARY_SOURCE,text=>{
        const next=Engine.updateLibraryEntry(text,row,{bookmarked:value},{kind:'human',name:'user'});
        updated=Engine.parseLibrary(next).find(item=>item.path===row.path);return next;
      });
      this.detailRow=this.notesBase=updated;
    }catch(error){this.quickError.setText(error.message);this.quickError.hidden=false;}
    finally{
      this.saving=false;this.bookmarkButton?.setAttribute('aria-busy','false');this.syncQuickFields();this.remember();
    }
    const saved=this.quickError.hidden;
    if(saved){await this.reload();this.queueDetailMotion();}
    return saved;
  }
  async saveQuickField(key,value){
    if(key==='bookmarked')return this.saveBookmark(value);
    const row=this.detailRow;
    const review=this.scope==='reviews'&&key==='status';
    if(!row||!(review||(this.isPublic()&&['status','priority','venues','organizing','bookmarked'].includes(key))))return false;
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
    if(saved){this.renderPaperVenues();if(!this.dirty())await this.reload();this.queueDetailMotion();}
    return saved;
  }
  syncQuickFields(){
    const disabled=this.saving||this.editing||this.readError;
    for(const {key,select} of this.quickFields||[]){select.value=this.detailRow[key];select.disabled=disabled;}
    if(this.bookmarkButton){
      const marked=!!this.detailRow.bookmarked,label=tr(marked?'取消书签':'添加书签');
      this.bookmarkButton.disabled=disabled;this.bookmarkButton.title=label;
      this.bookmarkButton.setAttribute('aria-label',label);this.bookmarkButton.setAttribute('aria-pressed',String(marked));this.bookmarkButton.setAttribute('data-ldb-motion-value',String(marked));
      this.bookmarkButton.setAttribute('class','ldb-bookmark-button'+(marked?' is-bookmarked':''));
    }
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
  lockFilters(locked){for(const el of [this.searchEl,this.statusEl,this.tagEl,this.organizingEl,this.bookmarkFilterEl,this.clearEl,this.actionEl,this.venueDeadlineEl,this.exportEl,...this.sortButtons].filter(Boolean))el.disabled=locked;}
  startEditing(row){if(TRACK_FILES[this.scope])return this.startTrackingEditor(row);this.startForm(row,[['title',tr('篇名')],['published',tr('发表时间')],['status',tr('阅读状态'),Engine.STATUSES],['priority',tr('优先级'),Engine.PRIORITIES],['tags',tr('标签'),'area'],['tldr','TL;DR','area']]);}
  startTrackingEditor(row){
    const base=row||{path:'',filename:'',pdfPath:'',category:this.filters.category||this.plugin.stagingGroup(this.scope),status:this.scope==='reviews'?'待审':'准备中',published:'—',tldr:'',notes:''};
    const data={...base,title:base.filename,due:base.published,next:base.tldr};
    this.startForm(data,[...(!base.pdfPath?[['title',tr('稿件名称')]]:[]),['category','Venue','venue'],['status',tr('状态'),this.scope==='reviews'?[...new Set([...Engine.REVIEW_STATUSES,base.status])]:undefined],['next',tr('下一步'),'area'],['notes','Notes','area']]);
  }
  startForm(row,spec){
    if(this.readError){new Notice(tr('请等待源数据同步完成'));return;}
    this.editing=true;this.editBase=row;this.detailRenderKey=null;this.lockFilters(true);this.detailMotion?.pause();this.detailEl.empty();
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
  async onClose(){this.closed=true;this.listDropController?.destroy();this.detailMotion?.destroy();}
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
