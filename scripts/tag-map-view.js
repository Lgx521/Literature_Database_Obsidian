// Editable tag vocabulary. Paper assignments stay in library.md; no PDF reads or network calls.
class TagMapModal extends Modal {
  constructor(view){super(view.app);this.view=view;this.plugin=view.plugin;this.closed=false;this.busy=false;this.nodes=new Map();this.collapsed=new Set();this.zoom=1;this.pan={x:24,y:24};this.cleanups=[];this.pointers=new Map();this.scope=new Scope(view.app.scope);this.scope.register([], 'Escape', e=>{e.preventDefault();if(this.editor)this.cancelEditor();else this.close();return false;});}
  listen(el,type,fn,options){el.addEventListener(type,fn,options);this.cleanups.push(()=>el.removeEventListener(type,fn,options));}
  icon(parent,icon,label,action,cls=''){const b=ldbButton(parent,'',action,'ldb-map-icon '+cls);setIcon(b,icon);b.title=label;b.setAttribute('aria-label',label);return b;}
  onOpen(){
    this.modalEl.addClass('ldb-tag-map-modal');this.titleEl.setText(tr('标签思维导图'));
    this.titleEl.title=this.view.detailTitle(this.view.detailRow);
    this.mapDoc=this.contentEl.ownerDocument;this.mapWin=this.mapDoc.defaultView;
    const toolbar=this.contentEl.createDiv('ldb-map-toolbar');
    this.search=toolbar.createEl('input',{type:'search',attr:{placeholder:tr('搜索标签…'),'aria-label':tr('搜索标签')}});
    this.listen(this.search,'input',()=>this.searchFor(this.search.value));
    this.icon(toolbar,'minus',tr('缩小'),()=>this.zoomAt(this.zoom/1.2));
    this.zoomLabel=toolbar.createSpan('ldb-map-zoom');
    this.icon(toolbar,'plus',tr('放大'),()=>this.zoomAt(this.zoom*1.2));
    this.icon(toolbar,'scan',tr('适应画布'),()=>this.fit());
    this.icon(toolbar,'fold-vertical',tr('收起全部分组'),()=>{if(this.editor)return;for(const n of this.tree?.children||[])this.collapsed.add(n.key);this.render();this.fit();});
    this.error=this.contentEl.createDiv({cls:'ldb-map-error',attr:{role:'status'}});this.error.hidden=true;
    this.viewport=this.contentEl.createDiv({cls:'ldb-map-viewport',attr:{tabindex:'0','aria-label':tr('标签画布')}});
    this.stage=this.viewport.createDiv('ldb-map-stage');
    this.lines=this.mapDoc.createElementNS('http://www.w3.org/2000/svg','svg');this.lines.setAttribute('class','ldb-map-lines');this.lines.setAttribute('aria-hidden','true');this.stage.appendChild(this.lines);
    this.listen(this.contentEl,'keydown',e=>{if(e.key==='Escape'&&this.editor){e.preventDefault();e.stopPropagation();this.cancelEditor();}} ,true);
    this.listen(this.viewport,'wheel',e=>{if(e.target.closest('input'))return;e.preventDefault();if(e.ctrlKey||e.metaKey)this.zoomAt(this.zoom*Math.exp(-e.deltaY*.008),e.clientX,e.clientY);else{this.pan.x-=e.deltaX;this.pan.y-=e.deltaY;this.transform();}},{passive:false});
    this.listen(this.viewport,'pointerdown',e=>{
      if(e.target.closest('button,input')||e.button>0)return;this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});this.viewport.setPointerCapture(e.pointerId);this.viewport.addClass('is-panning');e.preventDefault();
    });
    this.listen(this.viewport,'pointermove',e=>{
      const old=this.pointers.get(e.pointerId);if(!old)return;
      const other=[...this.pointers.entries()].find(([id])=>id!==e.pointerId)?.[1];
      if(other){const before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(e.clientX-other.x,e.clientY-other.y);if(before>5)this.zoomAt(this.zoom*after/before,(e.clientX+other.x)/2,(e.clientY+other.y)/2);}
      else{this.pan.x+=e.clientX-old.x;this.pan.y+=e.clientY-old.y;this.transform();}
      this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    });
    const release=e=>{this.pointers.delete(e.pointerId);if(!this.pointers.size)this.viewport.removeClass('is-panning');};
    for(const type of ['pointerup','pointercancel','lostpointercapture'])this.listen(this.viewport,type,release);
    this.listen(this.viewport,'keydown',e=>{if(e.target!==this.viewport)return;const delta={ArrowLeft:[35,0],ArrowRight:[-35,0],ArrowUp:[0,35],ArrowDown:[0,-35]}[e.key];if(delta){e.preventDefault();this.pan.x+=delta[0];this.pan.y+=delta[1];this.transform();}});
    if(this.mapWin.ResizeObserver){this.observer=new this.mapWin.ResizeObserver(()=>this.transform());this.observer.observe(this.viewport);}
    this.load(true);
  }
  async load(initial=false){
    try{
      const source=await TagTree.read(this.plugin.app.vault);if(this.closed)return;
      this.catalogText=source.text;this.model=TagTree.effective(source.model,this.plugin.snapshot.library);this.tree=TagTree.tree(this.model);
      if(initial){const selected=this.selected();for(const group of this.tree.children)if(!this.descendants(group).some(n=>n.tag&&selected.has(TagTree.fold(n.tag))))this.collapsed.add(group.key);}
      this.error.hidden=true;this.render();if(initial){this.fit();if(this.viewport.clientWidth<600){this.zoom=1;const selected=this.selected(),focus=this.descendants(this.tree).find(n=>n.tag&&selected.has(TagTree.fold(n.tag)));this.focusNode(focus?.key||'root');}}
    }catch(e){this.showError(e);}
  }
  descendants(node){return [node,...(node.children||[]).flatMap(n=>this.descendants(n))];}
  selected(){return new Set(String(this.view.detailRow?.tags||'').split(/\s+/).map(TagTree.fold));}
  showError(error){if(this.closed)return;this.error.setText(error.message||String(error));this.error.hidden=false;}
  catalogChanged(){if(this.closed||this.busy||this.editor)return;clearTimeout(this.refreshTimer);this.refreshTimer=setTimeout(()=>{if(!this.closed&&!this.busy&&!this.editor)this.load();},180);}
  transform(){if(!this.stage)return;this.stage.style.transform=`translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;this.zoomLabel.setText(Math.round(this.zoom*100)+'%');}
  zoomAt(value,x,y){const r=this.viewport.getBoundingClientRect(),point={x:(x??r.left+r.width/2)-r.left,y:(y??r.top+r.height/2)-r.top},next=Math.max(.35,Math.min(1.7,value));this.pan={x:point.x-(point.x-this.pan.x)*next/this.zoom,y:point.y-(point.y-this.pan.y)*next/this.zoom};this.zoom=next;this.transform();}
  fit(){if(!this.layout)return;const r=this.viewport.getBoundingClientRect();this.zoom=Math.max(.35,Math.min(1,(r.width-56)/this.layout.width,(r.height-56)/this.layout.height));this.pan={x:Math.max(20,(r.width-this.layout.width*this.zoom)/2),y:Math.max(20,(r.height-this.layout.height*this.zoom)/2)};this.transform();}
  focusNode(key){const n=this.positions?.get(key);if(!n)return;const r=this.viewport.getBoundingClientRect();this.pan={x:r.width/2-(n.x+n.width/2)*this.zoom,y:r.height/2-(n.y+18)*this.zoom};this.transform();}
  render(){
    if(this.closed||!this.tree)return;
    const visible=[],walk=(node,depth,parent)=>{const n={...node,depth,parent,width:Math.min(260,Math.max(node.kind==='root'?106:128,58+[...node.label].reduce((sum,c)=>sum+(/[\u2e80-\uffff]/.test(c)?14:7.8),0))),children:[]};visible.push(n);
      if(!this.collapsed.has(node.key))n.children=node.children.map(c=>walk(c,depth+1,n));
      if(this.editor?.parent===node.key){const editor={key:'editor',kind:'editor',label:'',depth:depth+1,parent:n,width:234,children:[]};n.children.push(editor);visible.push(editor);}return n;};
    const root=walk(this.tree,0,null),widths=[];for(const n of visible)widths[n.depth]=Math.max(widths[n.depth]||0,n.width);
    let row=0;const place=n=>{if(n.children.length){n.children.forEach(place);n.y=(n.children[0].y+n.children.at(-1).y)/2;}else n.y=row++*49;n.x=widths.slice(0,n.depth).reduce((s,w)=>s+w+55,0);};place(root);
    this.layout={width:Math.max(...visible.map(n=>n.x+n.width))+36,height:row*49+18};this.positions=new Map(visible.map(n=>[n.key,n]));
    this.stage.style.width=this.layout.width+'px';this.stage.style.height=this.layout.height+'px';this.lines.setAttribute('width',this.layout.width);this.lines.setAttribute('height',this.layout.height);this.lines.replaceChildren();
    const alive=new Set(visible.map(n=>n.key));for(const [key,el]of this.nodes)if(!alive.has(key)){el.remove();this.nodes.delete(key);}
    for(const n of visible){
      if(n.parent){const p=n.parent,x=p.x+p.width,y=p.y+18,to=n.x,ty=n.y+18,path=this.mapDoc.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',`M ${x} ${y} C ${x+28} ${y}, ${to-28} ${ty}, ${to} ${ty}`);this.lines.appendChild(path);}
      let el=this.nodes.get(n.key);if(!el){el=this.createNode(n);this.nodes.set(n.key,el);this.stage.appendChild(el);}el.ldbNode=n;el.style.left=n.x+'px';el.style.top=n.y+'px';el.style.width=n.width+'px';
      if(n.kind!=='editor'){el.ldbLabel.setText(n.label);const hasChildren=!!this.descendants(this.tree).find(x=>x.key===n.key)?.children.length;el.ldbFold.hidden=!hasChildren;el.ldbFold.setAttribute('aria-expanded',String(!this.collapsed.has(n.key)));el.ldbFold.title=tr(this.collapsed.has(n.key)?'展开':'收起');el.ldbFold.setAttribute('aria-label',el.ldbFold.title);setIcon(el.ldbFold,this.collapsed.has(n.key)?'chevron-right':'chevron-down');}
    }
    this.syncChecked();this.transform();
  }
  createNode(n){
    const el=this.mapDoc.createElement('div');el.className='ldb-map-node is-'+n.kind;
    if(n.kind==='editor'){
      const input=el.createEl('input',{type:'text',attr:{placeholder:tr(this.editor.kind==='group'?'分组名称':'标签名称'),'aria-label':tr(this.editor.kind==='group'?'分组名称':'标签名称'),autocomplete:'off'}});input.value=this.editor.value||'';this.editor.input=input;
      input.addEventListener('input',()=>{this.editor.value=input.value;input.removeAttribute('aria-invalid');});
      input.addEventListener('keydown',e=>{e.stopPropagation();if(e.isComposing||e.keyCode===229)return;if(e.key==='Enter'){e.preventDefault();this.commitEditor();}else if(e.key==='Escape'){e.preventDefault();this.cancelEditor();}});
      this.icon(el,'check',tr('保存'),()=>this.commitEditor(),'ldb-map-save');return el;
    }
    const fold=this.icon(el,'chevron-down',tr('收起'),()=>{if(this.editor)return;this.collapsed.has(n.key)?this.collapsed.delete(n.key):this.collapsed.add(n.key);this.render();},'ldb-map-fold');el.ldbFold=fold;
    if(n.kind==='tag'){
      const box=el.createEl('input',{type:'checkbox',attr:{'aria-label':TagTree.label(n.tag)}});el.ldbCheck=box;box.addEventListener('change',()=>this.toggle(el.ldbNode,box.checked));
      const label=el.createEl('button',{cls:'ldb-map-node-label',text:n.label});label.addEventListener('click',()=>this.toggle(el.ldbNode,!box.checked));el.ldbLabel=label;
      el.title=TagTree.label(n.tag);
      el.addEventListener('contextmenu',e=>{e.preventDefault();if(this.busy||this.editor)return;const menu=new Menu().setUseNativeMenu(!Platform?.isMobile);menu.addItem(i=>i.setTitle(tr('移动标签分支到…')).setIsLabel(true));for(const g of this.model.groups)menu.addItem(i=>i.setTitle(g.name).setChecked(g.name===el.ldbNode.group).onClick(()=>this.move(el.ldbNode,g.name)));const r=el.getBoundingClientRect();menu.showAtPosition({x:r.left,y:r.bottom},this.mapDoc);});
    }else el.ldbLabel=el.createSpan({cls:'ldb-map-node-label',text:n.label});
    el.ldbPlus=this.icon(el,'plus',tr(n.kind==='root'?'新建标签分组':n.kind==='group'?'新建标签':'新建子标签'),()=>this.beginEditor(el.ldbNode),'ldb-map-add');
    return el;
  }
  beginEditor(node){
    if(this.busy)return;if(this.editor?.value?.trim()){this.editor.input.focus();return;}this.editor={parent:node.key,kind:node.kind==='root'?'group':'tag',group:node.group,tag:node.kind==='tag'?node.tag:null,value:''};this.collapsed.delete(node.key);this.nodes.get('editor')?.remove();this.nodes.delete('editor');this.render();this.focusNode('editor');this.editor.input.focus();
  }
  cancelEditor(){if(this.busy)return;const parent=this.editor?.parent;this.editor=null;this.render();this.nodes.get(parent)?.ldbPlus?.focus({preventScroll:true});}
  async store(model){const text=await TagTree.save(this.plugin,this.catalogText,model);if(this.closed)return;this.catalogText=text;this.model=model;this.tree=TagTree.tree(model);}
  async commitEditor(){
    if(!this.editor||this.busy)return;const draft=this.editor;this.busy=true;draft.input.readOnly=true;this.error.hidden=true;this.syncChecked();
    try{const change=draft.kind==='group'?{model:TagTree.addGroup(this.model,draft.value)}:TagTree.addTag(this.model,draft.group,draft.tag,draft.value);await this.store(change.model);if(this.closed)return;this.editor=null;this.render();this.busy=false;this.syncChecked();const key=change.tag?'tag:'+TagTree.fold(change.tag):'group:'+draft.value.trim();this.focusNode(key);const el=this.nodes.get(key);el?.classList.add('is-new');el?.addEventListener('animationend',()=>el.classList.remove('is-new'),{once:true});(el?.ldbCheck||el?.ldbPlus)?.focus({preventScroll:true});}
    catch(e){this.showError(e);if(!this.closed){draft.input.readOnly=false;draft.input.setAttribute('aria-invalid','true');draft.input.focus();}}
    finally{this.busy=false;this.syncChecked();}
  }
  async move(node,group){if(node.group===group||this.busy)return;this.busy=true;try{await this.store(TagTree.moveFamily(this.model,node.tag,group));if(this.closed)return;this.collapsed.delete('group:'+group);this.render();this.focusNode(node.key);}catch(e){this.showError(e);}finally{this.busy=false;this.syncChecked();}}
  syncChecked(){
    const selected=this.selected();for(const el of this.nodes.values()){const n=el.ldbNode;if(!n||n.kind==='editor')continue;if(el.ldbCheck){const checked=selected.has(TagTree.fold(n.tag));el.ldbCheck.checked=checked;el.ldbCheck.disabled=this.busy||!!this.editor;el.classList.toggle('is-checked',checked);const actual=String(this.view.detailRow.tags||'').split(/\s+/).find(t=>TagTree.fold(t)===TagTree.fold(n.tag));el.classList.toggle('is-human',!!actual&&Organization.source(this.view.detailRow,actual,true).kind==='human');}if(el.ldbPlus)el.ldbPlus.disabled=this.busy;}
  }
  async toggle(node,checked){
    if(this.busy||this.editor||this.closed){this.syncChecked();return;}this.busy=true;this.error.hidden=true;this.syncChecked();
    try{
      let model=this.model;if(!model.groups.some(g=>g.tags.some(t=>TagTree.fold(t)===TagTree.fold(node.tag))))model=TagTree.addTag(model,node.group,null,node.tag).model;
      if(this.catalogText===null||TagTree.serialize(model,this.catalogText)!==this.catalogText)await this.store(model);
      if(this.closed)return;
      const saved=await this.view.saveMapTag(node.tag,checked);if(!saved)throw Error(this.view.quickError?.textContent||tr('标签未保存，请重试'));
    }catch(e){this.showError(e);}finally{this.busy=false;this.syncChecked();}
  }
  searchFor(query){
    if(!this.tree||this.editor)return;const q=TagTree.fold(query.trim());
    if(!q){for(const el of this.nodes.values())el.classList.remove('is-match');return;}
    let first=null;const walk=(node,ancestors)=>{if(node.kind==='tag'&&TagTree.fold(TagTree.label(node.tag)).includes(q)){for(const parent of ancestors)this.collapsed.delete(parent);first??=node.key;}for(const child of node.children)walk(child,[...ancestors,node.key]);};walk(this.tree,[]);this.render();
    for(const el of this.nodes.values())el.classList.toggle('is-match',!!el.ldbNode?.tag&&TagTree.fold(TagTree.label(el.ldbNode.tag)).includes(q));if(first)this.focusNode(first);
  }
  close(force=false){if(this.busy&&!this.plugin.stopped&&!force)return;super.close();}
  onClose(){
    this.closed=true;clearTimeout(this.refreshTimer);this.observer?.disconnect();for(const off of this.cleanups)off();this.pointers.clear();
    if(this.view.tagMap===this)this.view.tagMap=null;if(this.plugin.tagMap===this)this.plugin.tagMap=null;
    if(!this.plugin.stopped&&!this.view.closed){this.view.lockFilters(this.view.dirty());if(!this.view.dirty())this.view.reload();}
    this.contentEl.empty();
  }
}
