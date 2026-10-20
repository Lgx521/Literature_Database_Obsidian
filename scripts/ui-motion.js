// One owner per view: short transitions, native disclosures and explicit teardown.
class LdbMotion {
  constructor(root,{disclosures=false,prepareDisclosure=null,finishDisclosure=null}={}){
    this.prepareDisclosure=prepareDisclosure;this.finishDisclosure=finishDisclosure;
    this.root=root;this.win=root.ownerDocument.defaultView;this.animations=new Set();this.disclosures=new Map();
    const style=this.win.getComputedStyle?.(root);
    this.duration=parseFloat(style?.getPropertyValue('--ldb-motion-duration'))||180;
    this.easing=style?.getPropertyValue('--ldb-motion-easing').trim()||'cubic-bezier(.2,.8,.2,1)';
    this.media=this.win.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.reduce=()=>{if(this.media.matches)this.cancelAnimations();};this.media?.addEventListener?.('change',this.reduce);
    if(disclosures){this.click=e=>{const summary=e.target.closest?.('summary'),details=summary?.parentElement;if(!details||details.tagName!=='DETAILS'||!root.contains(details)||e.defaultPrevented||e.target.closest('button,a,input,select,textarea'))return;e.preventDefault();this.setOpen(details,!(this.disclosures.get(details)?.open??details.open));};root.addEventListener('click',this.click);}
  }
  animate(el,kind,cleanup=()=>{},options={}){
    if(this.media?.matches||!el.animate||el.ownerDocument.hidden){cleanup();return;}
    const frames=Array.isArray(kind)?kind:kind==='out'?[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.9)'}]
      :kind==='in'?[{opacity:0,transform:'translateY(2px) scale(.92)'},{opacity:1,transform:'translateY(0) scale(1.035)',offset:.7},{opacity:1,transform:'scale(1)'}]
      :kind==='bookmark'?[{transform:'scale(.88)'},{transform:'scale(1.14)',offset:.6},{transform:'scale(1)'}]
      :[{opacity:.45},{opacity:1}];
    const animation=el.animate(frames,{duration:this.duration,easing:this.easing,...options});
    this.animations.add(animation);let cleaned=false;const finish=()=>{if(cleaned)return;cleaned=true;this.animations.delete(animation);cleanup();animation.cancel();};
    animation.onfinish=animation.oncancel=finish;animation.finished?.then(finish,finish);return animation;
  }
  setOpen(details,open){
    const previous=this.disclosures.get(details);if((previous?.open??details.open)===open)return;
    const start=details.getBoundingClientRect().height;if(previous?.animation){previous.animation.cancel();previous.animation.oncancel?.();}
    this.prepareDisclosure?.(details,open);
    const summary=details.querySelector(':scope > summary');
    if(!summary||!start||this.media?.matches||details.ownerDocument.hidden){details.open=open;summary?.setAttribute('aria-expanded',String(open));this.finishDisclosure?.(details,open);return;}
    const overflow=details.style.overflow,children=[...details.children].filter(el=>el!==summary).map(el=>[el,el.inert]);
    if(!open&&details.contains(details.ownerDocument.activeElement))summary.focus({preventScroll:true});
    details.open=open;const end=details.getBoundingClientRect().height;details.open=true;
    summary.setAttribute('aria-expanded',String(open));for(const [el]of children)el.inert=!open;
    details.style.overflow='hidden';const state={open};this.disclosures.set(details,state);
    state.animation=this.animate(details,[{height:start+'px'},{height:end+'px'}],()=>{
      details.open=open;details.style.overflow=overflow;for(const [el,inert]of children)el.inert=inert;
      if(this.disclosures.get(details)===state)this.disclosures.delete(details);
      this.finishDisclosure?.(details,open);
    },{fill:'both'});
  }
  cancelAnimations(){for(const animation of [...this.animations]){animation.cancel();animation.oncancel?.();}this.animations.clear();}
  destroy(){this.cancelAnimations();this.disclosures.clear();this.media?.removeEventListener?.('change',this.reduce);if(this.click)this.root.removeEventListener('click',this.click);this.click=this.prepareDisclosure=this.finishDisclosure=null;}
}
