// Keep copy/select-all inside the title or summary, never the neighbouring controls.
class LdbTextSelection {
  constructor(root){
    this.root=root;this.doc=root.ownerDocument;
    this.field=event=>{const el=event.target.closest?.('.ldb-title,.ldb-tldr');return el&&root.contains(el)?el:null;};
    this.pointer=event=>{const el=this.field(event);this.active=el;if(el){el.focus({preventScroll:true});event.stopPropagation();}};
    this.double=event=>{const el=this.field(event);if(el){event.preventDefault();event.stopPropagation();this.selectAll(el);}};
    this.key=event=>{const el=this.field(event);if(el&&(event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='a'){event.preventDefault();event.stopPropagation();this.selectAll(el);}};
    this.change=()=>this.constrain();
    root.addEventListener('pointerdown',this.pointer);root.addEventListener('dblclick',this.double);root.addEventListener('keydown',this.key);
    this.doc.addEventListener?.('selectionchange',this.change);
  }
  selectAll(el){
    this.active=el;el.focus({preventScroll:true});const selection=this.doc.defaultView.getSelection(),range=this.doc.createRange();range.selectNodeContents(el);selection.removeAllRanges();selection.addRange(range);
  }
  constrain(){
    const el=this.active,selection=this.doc.defaultView.getSelection?.();
    if(!el?.isConnected||!selection?.rangeCount||selection.isCollapsed)return;
    // A new selection elsewhere belongs to that control/document, not this field.
    if(!el.contains(selection.anchorNode))return;
    const range=selection.getRangeAt(0),bounds=this.doc.createRange();bounds.selectNodeContents(el);
    const before=bounds.comparePoint(range.startContainer,range.startOffset)<0,after=bounds.comparePoint(range.endContainer,range.endOffset)>0;
    if(!before&&!after)return;
    const clipped=range.cloneRange();if(before)clipped.setStart(bounds.startContainer,bounds.startOffset);if(after)clipped.setEnd(bounds.endContainer,bounds.endOffset);
    selection.removeAllRanges();selection.addRange(clipped);
  }
  destroy(){this.root.removeEventListener('pointerdown',this.pointer);this.root.removeEventListener('dblclick',this.double);this.root.removeEventListener('keydown',this.key);this.doc.removeEventListener?.('selectionchange',this.change);this.active=null;}
}
