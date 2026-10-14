// A filter-only checklist. Its checkboxes never write tags or paper metadata.
class TagFilterPopover {
  constructor(view){this.view=view;this.doc=view.contentEl.ownerDocument;this.win=this.doc.defaultView;this.closed=false;this.cleanups=[];this.entries=new Map();}
  listen(el,type,fn,options){el.addEventListener(type,fn,options);this.cleanups.push(()=>el.removeEventListener(type,fn,options));}
  open(){
    this.root=this.doc.body.createDiv({cls:'ldb-tag-filter-popover',attr:{role:'dialog','aria-label':tr('标签'),'aria-description':tr('同时包含所选标签')}});
    const header=this.root.createDiv('ldb-tag-filter-search');
    this.search=header.createEl('input',{type:'search',attr:{placeholder:tr('搜索标签…'),'aria-label':tr('搜索标签')}});
    this.clear=ldbButton(header,'',()=>this.view.setTagFilters([]),'clickable-icon');setIcon(this.clear,'x');this.clear.title=tr('清除标签筛选');this.clear.setAttribute('aria-label',tr('清除标签筛选'));
    this.list=this.root.createDiv('ldb-tag-filter-options');
    this.empty=this.root.createDiv({cls:'ldb-tag-filter-empty',text:tr('没有匹配标签')});
    this.listen(this.search,'input',()=>this.refresh());
    this.listen(this.doc,'pointerdown',e=>{if(!this.root.contains(e.target)&&!this.view.tagEl.contains(e.target))this.close();},true);
    this.listen(this.doc,'keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();this.close(true);}},true);
    this.listen(this.root,'keydown',e=>{
      const boxes=[...this.entries.values()].filter(row=>!row.el.hidden).map(row=>row.box),index=boxes.indexOf(this.doc.activeElement);
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();boxes[Math.max(0,Math.min(boxes.length-1,index+(e.key==='ArrowDown'?1:-1)))]?.focus();}
      else if(e.key==='Enter'&&index>=0){e.preventDefault();boxes[index].click();}
    });
    this.listen(this.win,'resize',()=>this.position());
    this.listen(this.win,'blur',()=>this.close());
    if(this.win.visualViewport)for(const type of ['resize','scroll'])this.listen(this.win.visualViewport,type,()=>this.position());
    this.listen(this.win,'scroll',e=>{if(e.target===this.win||!this.root.contains(e.target))this.position();},true);
    this.view.tagEl.setAttribute('aria-expanded','true');this.refresh();this.search.focus();
  }
  options(){return Engine.normalizeTagFilter([...this.view.rows.flatMap(r=>String(r.tags||'').split(/\s+/)),...(this.view.filters.tags||[])]).sort((a,b)=>TagTree.label(a).localeCompare(TagTree.label(b)));}
  refresh(){
    if(this.closed||!this.root)return;
    if(this.view.closed||!this.view.isPublic()||this.view.dirty()){this.close();return;}
    const options=this.options(),keys=new Set(options.map(TagTree.fold)),selected=new Set((this.view.filters.tags||[]).map(TagTree.fold)),query=TagTree.fold(this.search.value.trim());
    for(const [key,row]of this.entries)if(!keys.has(key)){row.el.remove();this.entries.delete(key);}
    let visible=0;
    for(const tag of options){
      const key=TagTree.fold(tag);let row=this.entries.get(key);
      if(!row){
        const el=this.list.createEl('label',{cls:'ldb-tag-filter-option'}),box=el.createEl('input',{type:'checkbox'}),label=el.createSpan();row={el,box,label,tag};this.entries.set(key,row);
        box.addEventListener('change',()=>{const current=this.view.filters.tags||[],next=box.checked?[...current,row.tag]:current.filter(t=>TagTree.fold(t)!==TagTree.fold(row.tag));if(!this.view.setTagFilters(next))this.refresh();});
      }
      row.tag=tag;row.label.setText(TagTree.label(tag));row.el.title=TagTree.label(tag);row.box.setAttribute('aria-label',TagTree.label(tag));row.box.checked=selected.has(key);row.el.toggleClass('is-selected',row.box.checked);
      row.el.hidden=!!query&&!key.includes(query);if(!row.el.hidden)visible++;
      // Only reorder when the vocabulary changed, so a toggle retains checkbox focus and scroll.
    }
    const order=options.map(TagTree.fold).join('\n');if(order!==this.order){for(const tag of options)this.list.appendChild(this.entries.get(TagTree.fold(tag)).el);this.order=order;}
    this.empty.hidden=visible>0;this.clear.disabled=!selected.size;this.position();
  }
  position(){
    if(this.closed)return;const anchor=this.view.tagEl;if(!anchor.isConnected){this.close();return;}
    const rect=anchor.getBoundingClientRect(),viewport=this.win.visualViewport,w=viewport?.width||this.win.innerWidth,h=viewport?.height||this.win.innerHeight,x=viewport?.offsetLeft||0,y=viewport?.offsetTop||0;
    this.root.style.width=Math.min(320,w-16)+'px';
    const below=y+h-rect.bottom-8,above=rect.top-y-8,useBelow=below>=Math.min(240,above),space=useBelow?below:above;
    this.root.style.maxHeight=Math.max(120,Math.min(390,space))+'px';
    this.root.style.left=Math.max(x+8,Math.min(rect.left,x+w-this.root.offsetWidth-8))+'px';
    this.root.style.top=Math.max(y+8,useBelow?rect.bottom+5:rect.top-this.root.offsetHeight-5)+'px';
  }
  close(restoreFocus=false){
    if(this.closed)return;this.closed=true;for(const off of this.cleanups)off();this.root?.remove();
    if(this.view.tagFilterMenu===this)this.view.tagFilterMenu=null;if(this.view.plugin.tagFilterMenu===this)this.view.plugin.tagFilterMenu=null;
    this.view.tagEl?.setAttribute('aria-expanded','false');if(restoreFocus&&!this.view.closed)this.view.tagEl?.focus({preventScroll:true});
  }
}
