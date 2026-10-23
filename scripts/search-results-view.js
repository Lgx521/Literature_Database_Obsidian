// Transient, local search. Only the visible result window owns DOM nodes.
class PaperSearchPopover {
  constructor(view){
    this.view=view;this.doc=view.contentEl.ownerDocument;this.win=this.doc.defaultView;
    this.session=new LibrarySearch();this.cleanups=[];this.results=[];this.active=-1;this.closed=false;
  }
  listen(el,type,fn,options){el.addEventListener(type,fn,options);this.cleanups.push(()=>el.removeEventListener(type,fn,options));}
  static destination(view,row,scope){
    if(scope!=='library'&&scope!=='projects')return {scope,category:row.category||''};
    const data=view.plugin.snapshot||{},categories=row.categories||[],projects=row.projects||[];
    if(view.scope==='library'&&categories.includes(view.filters.category))return {scope:'library',category:view.filters.category};
    if(view.scope==='projects'&&projects.includes(view.filters.category))return {scope:'projects',category:view.filters.category};
    const category=(data.categories||[]).find(name=>categories.includes(name))||categories[0];
    if(category)return {scope:'library',category};
    const project=(data.groups?.projects||[]).find(name=>projects.includes(name))||projects[0];
    return project?{scope:'projects',category:project}:{scope:'library',category:''};
  }
  open(){
    const id=`ldb-search-${this.view.leaf.id}`;
    this.root=this.doc.body.createDiv({cls:'ldb-search-popover',attr:{role:'dialog','aria-label':tr('搜索文献')}});
    this.inlineMath=new LdbInlineMath(this.root);
    const header=this.root.createDiv('ldb-search-options'),label=header.createEl('label');
    this.all=label.createEl('input',{type:'checkbox'});label.createSpan({text:tr('在全部文献中搜索')});
    this.count=header.createSpan({cls:'ldb-search-result-count',attr:{role:'status','aria-live':'polite'}});
    if(Platform?.isMobile){
      this.root.addClass('ldb-mobile-search');
      this.dismiss=ldbButton(header,'',()=>this.close(),'ldb-search-dismiss clickable-icon');setIcon(this.dismiss,'x');
      this.dismiss.setAttribute('aria-label',tr('收起搜索和键盘'));this.dismiss.title=tr('收起搜索和键盘');
    }
    this.list=this.root.createDiv({cls:'ldb-search-results',attr:{id,role:'listbox','aria-label':tr('搜索结果')}});
    this.empty=this.root.createDiv('ldb-search-empty');
    this.listen(this.all,'change',()=>{this.view.filters.searchAll=this.all.checked;this.view.remember();this.refresh();});
    this.listen(this.list,'scroll',()=>this.schedulePaint());
    this.listen(this.list,'click',e=>{const index=e.target.closest?.('[data-search-index]')?.dataset.searchIndex;if(index!==undefined)void this.choose(Number(index));});
    this.listen(this.view.searchEl,'keydown',e=>this.keydown(e));
    this.listen(this.doc,'keydown',e=>{if(e.key==='Escape'&&!e.isComposing){e.preventDefault();e.stopPropagation();this.close(true);}},true);
    this.listen(this.doc,'pointerdown',e=>{if(!this.root.contains(e.target)&&!this.view.searchWrap.contains(e.target))this.close();},true);
    this.listen(this.doc,'focusin',e=>{if(!this.root.contains(e.target)&&!this.view.searchWrap.contains(e.target))this.close();});
    this.listen(this.doc,'visibilitychange',()=>{if(this.doc.hidden)this.close();});
    this.listen(this.win,'blur',()=>this.close());
    this.listen(this.win,'resize',()=>this.position());
    this.listen(this.win,'scroll',e=>{if(e.target===this.win||!this.root.contains(e.target))this.position();},true);
    if(this.win.visualViewport)for(const type of ['resize','scroll'])this.listen(this.win.visualViewport,type,()=>this.position());
    this.view.searchEl.setAttribute('aria-controls',id);this.view.searchEl.setAttribute('aria-expanded','true');
    this.refresh();this.motion=new LdbMotion(this.root);this.motion.animate(this.root,[{opacity:0,transform:'translateY(-3px)'},{opacity:1,transform:'translateY(0)'}]);
  }
  refresh(){
    if(this.closed)return;
    const v=this.view;if(v.closed||v.dirty()||!ldbViewVisible(v)){this.close();return;}
    this.all.checked=!!v.filters.searchAll;
    this.scope=this.all.checked?'library':v.scope;
    const query=v.filters.query.trim(),publicRows=this.scope==='library'||this.scope==='projects';
    this.query=query;
    const rows=this.all.checked?(v.plugin.snapshot?.filedLibrary||v.plugin.snapshot?.library||[]):v.visibleRows;
    this.results=query?this.session.filter(rows,{query,sort:publicRows?'title':'filename',fieldSearchKey:v.fieldSettingsKey||LdbI18n.getLanguage(),fieldSearch:publicRows?r=>v.fieldDefinitions().map(f=>v.fieldText(f.id,v.fieldValue(r,f.id))).join(' '):null}):[];
    this.active=-1;this.list.scrollTop=0;this.count.setText(query?tr`${this.results.length} 篇`:'');
    this.empty.setText(query?tr('没有匹配文献'):tr('输入关键词搜索文献'));this.empty.hidden=!!this.results.length;this.list.hidden=!this.results.length;
    this.position();this.paint();
  }
  location(row){
    const nav=PaperSearchPopover.destination(this.view,row,this.scope),group=this.view.plugin.snapshot?.collections?.find(g=>g.scope===nav.scope&&g.name===nav.category);
    const child=group?.members.find(m=>m.path===row.path)?.subgroup;
    return (nav.category|| (nav.scope==='library'?tr('全部文献'):SCOPES[nav.scope]))+(child?' › '+child:'');
  }
  schedulePaint(){if(this.frame||this.closed)return;this.frame=this.win.requestAnimationFrame(()=>{this.frame=0;this.paint();});}
  paint(){
    if(this.closed)return;
    const scroll=this.list.scrollTop,height=56,start=Math.max(0,Math.floor(scroll/height)-3),end=Math.min(this.results.length,start+Math.ceil((this.list.clientHeight||336)/height)+6);
    // Fixed-height rows bound the DOM even for thousands of matching papers.
    this.list.empty();this.list.createDiv({attr:{'aria-hidden':'true'}}).style.height=(start*height)+'px';
    for(let i=start;i<end;i++){
      const row=this.results[i],el=this.list.createDiv({cls:'ldb-search-result',attr:{role:'option',id:`ldb-search-${this.view.leaf.id}-${i}`,'aria-selected':String(i===this.active),'aria-posinset':String(i+1),'aria-setsize':String(this.results.length)}});
      el.dataset.searchIndex=String(i);el.toggleClass('is-active',i===this.active);
      setIcon(el.createSpan('ldb-search-result-icon'),'file-text');
      const body=el.createDiv('ldb-search-result-body'),title=row.title?.trim()||row.filename,location=this.location(row);
      // A native tooltip reveals the unabridged text without expanding the row,
      // creating another overlay or retaining pointer listeners per result.
      el.title=title+'\n'+location;
      this.inlineMath.set(body.createDiv({cls:'ldb-search-result-title',text:title}),title);
      body.createDiv({cls:'ldb-search-result-location',text:location});
    }
    this.list.createDiv({attr:{'aria-hidden':'true'}}).style.height=((this.results.length-end)*height)+'px';
    this.list.scrollTop=scroll;
    if(this.active>=start&&this.active<end)this.view.searchEl.setAttribute('aria-activedescendant',`ldb-search-${this.view.leaf.id}-${this.active}`);
    else this.view.searchEl.removeAttribute('aria-activedescendant');
  }
  keydown(e){
    if(e.isComposing||this.view.searchComposing)return;
    if(this.query!==this.view.filters.query.trim()){this.view.cancelSearchRender();this.refresh();}
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();e.stopPropagation();if(!this.results.length)return;
      this.active=Math.max(0,Math.min(this.results.length-1,this.active<0?(e.key==='ArrowDown'?0:this.results.length-1):this.active+(e.key==='ArrowDown'?1:-1)));
      const top=this.active*56,bottom=top+56;if(top<this.list.scrollTop)this.list.scrollTop=top;else if(bottom>this.list.scrollTop+this.list.clientHeight)this.list.scrollTop=bottom-this.list.clientHeight;
      this.paint();
    }else if(e.key==='Enter'&&this.results.length){e.preventDefault();e.stopPropagation();void this.choose(Math.max(0,this.active));}
  }
  async choose(index){
    if(this.closed||this.view.dirty())return;
    if(this.query!==this.view.filters.query.trim()){this.refresh();return;}
    const row=this.results[index];if(!row)return;
    const source=this.scope==='projects'?'library':this.scope,latest=this.view.plugin.snapshot?.[source]?.find(r=>r.path===row.path);
    if(!latest){this.refresh();new Notice(tr('文献已发生变化，请重新搜索'));return;}
    const nav=PaperSearchPopover.destination(this.view,latest,this.scope);
    this.close();this.view.searchEl.blur();
    try{await this.view.navigate({...nav,revealPaths:[latest.pdfPath||latest.path],preserveSearch:true});}catch(error){new Notice(error.message);}
  }
  position(){
    if(this.closed)return;const anchor=this.view.searchWrap;if(!anchor.isConnected){this.close();return;}
    const rect=anchor.getBoundingClientRect(),vp=this.win.visualViewport,w=vp?.width||this.win.innerWidth,h=vp?.height||this.win.innerHeight,x=vp?.offsetLeft||0,y=vp?.offsetTop||0;
    this.root.style.width=Math.min(Math.max(rect.width,320),640,w-16)+'px';
    this.root.style.left=Math.max(x+8,Math.min(rect.left,x+w-this.root.offsetWidth-8))+'px';
    const below=y+h-rect.bottom-8,above=rect.top-y-8,useBelow=below>=Math.min(180,above),space=Math.max(0,useBelow?below:above);
    this.root.style.maxHeight=Math.min(400,space)+'px';
    this.root.style.top=Math.max(y+8,useBelow?rect.bottom+4:rect.top-this.root.offsetHeight-4)+'px';
  }
  close(restoreFocus=false){
    if(this.closed)return;this.closed=true;
    // WebViews keep the software keyboard open after removing a menu. Explicitly
    // release only search-owned focus; never blur a Notes field tapped outside it.
    if(Platform?.isMobile){const active=this.doc.activeElement;if(active===this.view.searchEl||this.root?.contains(active))active?.blur();}
    for(const off of this.cleanups)off();this.cleanups=[];
    if(this.frame)this.win.cancelAnimationFrame(this.frame);this.frame=0;
    this.motion?.destroy();this.inlineMath?.destroy();this.inlineMath=null;this.session.clear();this.results=[];this.root?.remove();
    if(this.view.searchMenu===this)this.view.searchMenu=null;
    this.view.cancelSearchRender();this.view.searchEl?.setAttribute('aria-expanded','false');this.view.searchEl?.removeAttribute('aria-activedescendant');this.view.searchEl?.removeAttribute('aria-controls');
    if(restoreFocus&&!Platform?.isMobile&&!this.view.closed){this.view.suppressSearchFocus=true;try{this.view.searchEl?.focus({preventScroll:true});}finally{this.view.suppressSearchFocus=false;}}
  }
}
