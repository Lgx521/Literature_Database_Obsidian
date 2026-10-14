// Resizes the existing panes; preferences belong to workspace view state, never paper data.
class LdbPaneSplitter {
  static sizes(value){
    const sizes={};
    if(Number.isFinite(value?.width)&&value.width>0)sizes.width=Math.min(10000,value.width);
    if(Number.isFinite(value?.rows)&&value.rows>0&&value.rows<1)sizes.rows=value.rows;
    return sizes;
  }
  static bounds(axis,total){
    const min=axis==='rows'?Math.min(140,total*.44):Math.min(280,total*.48),detail=axis==='rows'?Math.min(180,total*.56):Math.min(280,total*.48);
    return {min,max:Math.max(min,total-detail)};
  }
  constructor(view,body,list,detail){
    this.view=view;this.body=body;this.list=list;this.detail=detail;this.doc=body.ownerDocument;this.win=this.doc?.defaultView;this.cleanups=[];
    if(!this.win?.getComputedStyle)return;
    list.id='ldb-pane-list-'+view.leaf.id;detail.id='ldb-pane-detail-'+view.leaf.id;
    this.handle=body.createDiv({cls:'ldb-splitter',attr:{role:'separator',tabindex:'0','aria-label':tr('调整列表与详情大小'),'aria-controls':list.id+' '+detail.id}});
    this.listen(this.handle,'pointerdown',e=>this.start(e));
    this.listen(this.doc,'pointermove',e=>this.move(e),{capture:true,passive:false});
    this.listen(this.doc,'pointerup',e=>{if(e.pointerId===this.drag?.id){this.move(e);this.finish(true);}},{capture:true});
    this.listen(this.doc,'pointercancel',e=>{if(e.pointerId===this.drag?.id)this.finish(false);},true);
    this.listen(this.handle,'lostpointercapture',e=>{if(e.pointerId===this.drag?.id)this.finish(false);});
    this.listen(this.handle,'keydown',e=>this.keydown(e));
    this.listen(this.doc,'keydown',e=>{if(this.drag&&e.key==='Escape'){e.preventDefault();e.stopPropagation();this.finish(false);}},true);
    this.listen(this.win,'blur',()=>this.finish(false));
    this.listen(this.doc,'visibilitychange',()=>{if(this.doc.hidden)this.finish(false);});
    this.listen(body,'transitionend',e=>{if(e.target===body)this.sync();});
    if(this.win.ResizeObserver){this.observer=new this.win.ResizeObserver(()=>{this.finish(false);this.sync();});this.observer.observe(body);}
    else this.listen(this.win,'resize',()=>{this.finish(false);this.sync();});
    this.sync();
  }
  listen(el,type,fn,options){el.addEventListener(type,fn,options);this.cleanups.push(()=>el.removeEventListener(type,fn,options));}
  metrics(){
    const axis=this.win.getComputedStyle(this.body).getPropertyValue('--ldb-split-axis').trim()==='rows'?'rows':'columns';
    const rect=this.body.getBoundingClientRect(),total=axis==='rows'?rect.height:rect.width;
    return {axis,total,...LdbPaneSplitter.bounds(axis,total),first:this.list.getBoundingClientRect()[axis==='rows'?'height':'width']};
  }
  apply(sizes){
    for(const [key,property,value]of [['width','--ldb-pane-width',sizes.width+'px'],['rows','--ldb-pane-rows',(sizes.rows*100)+'%']]){
      if(sizes[key]===undefined)this.body.style.removeProperty(property);else this.body.style.setProperty(property,value);
    }
  }
  sync(){
    if(!this.handle||this.destroyed)return;
    this.apply(this.preview||this.view.paneSizes||{});
    const m=this.metrics(),expanded=!!this.view.mobileExpanded;
    this.handle.setAttribute('aria-orientation',m.axis==='rows'?'horizontal':'vertical');
    this.handle.setAttribute('aria-hidden',String(expanded));this.handle.tabIndex=expanded?-1:0;
    if(m.total>0)for(const [key,value]of [['min',m.min],['max',m.max],['now',m.first]])this.handle.setAttribute('aria-value'+key,String(Math.round(value/m.total*100)));
  }
  start(e){
    if(this.drag||this.view.mobileExpanded||e.button>0||e.isPrimary===false)return;
    const m=this.metrics();if(m.total<=0)return;
    e.preventDefault();e.stopPropagation();
    this.drag={...m,id:e.pointerId,start:m.axis==='rows'?e.clientY:e.clientX};
    // Grab the visible position even when a detail-collapse transition is still running.
    this.preview={...this.view.paneSizes,...(m.axis==='rows'?{rows:m.first/m.total}:{width:m.total-m.first})};this.apply(this.preview);
    this.body.addClass('is-resizing');this.handle.focus({preventScroll:true});
    try{this.handle.setPointerCapture(e.pointerId);}catch(_){} // Document listeners also cover older WebViews.
  }
  move(e){
    const d=this.drag;if(!d||d.id!==e.pointerId)return;
    const point=d.axis==='rows'?e.clientY:e.clientX;if(!Number.isFinite(point))return;
    if(!d.moved&&Math.abs(point-d.start)<2)return;d.moved=true;
    e.preventDefault();e.stopPropagation();this.nextFirst=d.first+point-d.start;
    if(!this.frame)this.frame=this.win.requestAnimationFrame(()=>{this.frame=0;this.flush();});
  }
  flush(){
    if(this.frame){this.win.cancelAnimationFrame(this.frame);this.frame=0;}
    if(!this.drag||this.nextFirst===undefined)return;
    const d=this.drag,first=Math.max(d.min,Math.min(d.max,this.nextFirst));this.nextFirst=undefined;
    this.preview={...this.view.paneSizes,...(d.axis==='rows'?{rows:first/d.total}:{width:d.total-first})};this.apply(this.preview);
    this.handle.setAttribute('aria-valuenow',String(Math.round(first/d.total*100)));
  }
  finish(commit){
    if(!this.drag)return;
    this.flush();const drag=this.drag;this.drag=null;
    if(commit&&drag.moved&&this.preview){this.view.paneSizes=this.preview;this.view.remember();}
    this.preview=null;this.nextFirst=undefined;
    // Restore the saved geometry before reenabling the expansion transition.
    this.sync();this.body.removeClass('is-resizing');
    try{if(this.handle.hasPointerCapture(drag.id))this.handle.releasePointerCapture(drag.id);}catch(_){}
  }
  keydown(e){
    if(this.view.mobileExpanded||this.drag||e.altKey||e.ctrlKey||e.metaKey)return;
    const m=this.metrics(),keys=m.axis==='rows'?['ArrowUp','ArrowDown']:['ArrowLeft','ArrowRight'];
    if(![...keys,'Home','End'].includes(e.key)||m.total<=0)return;
    e.preventDefault();e.stopPropagation();
    const next=e.key==='Home'?m.min:e.key==='End'?m.max:m.first+(e.key===keys[0]?-1:1)*(e.shiftKey?40:10),first=Math.max(m.min,Math.min(m.max,next));
    this.view.paneSizes={...this.view.paneSizes,...(m.axis==='rows'?{rows:first/m.total}:{width:m.total-first})};this.sync();this.view.remember();
  }
  destroy(){this.finish(false);this.destroyed=true;this.observer?.disconnect();for(const off of this.cleanups)off();this.cleanups=[];this.handle?.remove();}
}
