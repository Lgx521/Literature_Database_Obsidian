// Inline formulas only. Reuse the host's lazy MathJax; never render arbitrary Markdown/HTML.
class LdbInlineMath {
  static commands=new Set(('alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi pi varpi rho varrho sigma varsigma tau upsilon phi varphi chi psi omega Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega frac dfrac tfrac sqrt text textrm mathrm mathbf mathit mathsf mathtt mathcal mathbb boldsymbol operatorname hat widehat bar overline underline tilde widetilde vec dot ddot prime ast star circ degree times cdot pm mp div le leq ge geq ne neq approx sim simeq equiv propto in notin subset subseteq supset supseteq cup cap emptyset infinity infty partial nabla ell forall exists neg land lor to rightarrow leftarrow Rightarrow Leftarrow leftrightarrow mapsto sum prod int sin cos tan log ln exp min max lim inf sup left right big Big bigl bigr Bigl Bigr quad qquad').split(' '));
  static parts(text){
    const parts=[];let start=0,i=0,count=0;
    const escaped=at=>{let n=0;while(at>0&&text[--at]==='\\')n++;return n%2===1;};
    while(i<text.length){
      if(text[i]==='`'&&!escaped(i)){
        let n=1;while(text[i+n]==='`')n++;const end=text.indexOf('`'.repeat(n),i+n);i=end<0?text.length:end+n;continue;
      }
      if(text[i]!=='$'||escaped(i)){i++;continue;}
      // Block math is deliberately left as source in compact, single-line titles.
      if(text[i+1]==='$'){const end=text.indexOf('$$',i+2);i=end<0?text.length:end+2;continue;}
      const open=i++;let end=i;
      while(end<text.length&&text[end]!=='\n'&&(text[end]!=='$'||escaped(end)))end++;
      if(end===text.length||text[end]!=='$'){continue;}
      const source=text.slice(i,end),raw=text.slice(open,end+1);i=end+1;
      if(!source||source.trim()!==source||text[end+1]==='$'||source.length>1024||++count>24)continue;
      // Avoid interpreting prices as math, and keep the lightweight subset bounded.
      if(/^[\d.,\s]+$/.test(source))continue;
      let depth=0,valid=true;
      for(let k=0;k<source.length;k++){
        if(source[k]==='\\'){
          const match=/^[A-Za-z]+/.exec(source.slice(k+1));
          if(match){if(!this.commands.has(match[0])){valid=false;break;}k+=match[0].length;}
          else if(/[{},;! _%^#$]/.test(source[k+1]||''))k++;
          else {valid=false;break;}
        }else if(source[k]==='{'){if(++depth>12){valid=false;break;}}
        else if(source[k]==='}'&&--depth<0){valid=false;break;}
      }
      if(!valid||depth)continue;
      if(open>start)parts.push({text:text.slice(start,open)});
      parts.push({text:raw,math:source});start=end+1;
    }
    if(start<text.length)parts.push({text:text.slice(start)});
    return parts;
  }
  constructor(root,visible=()=>!root.ownerDocument.hidden){
    this.root=root;this.doc=root.ownerDocument;this.win=this.doc.defaultView;this.visible=visible;
    this.states=new WeakMap();this.pending=new Set();this.prepared=new Map();this.frame=0;this.closed=false;
    this.copy=event=>this.copySelection(event);root.addEventListener('copy',this.copy);
    this.visibility=()=>this.resume();this.doc.addEventListener('visibilitychange',this.visibility);
  }
  set(el,value){
    const text=String(value??'');if(this.closed)return;
    if(this.states.get(el)?.text===text){this.resume();return;}
    this.pending.delete(el);this.states.delete(el);
    if(!text.includes('$')){if(el.textContent!==text)el.textContent=text;return;}
    const parts=LdbInlineMath.parts(text);
    if(!parts.some(p=>p.math)){if(el.textContent!==text)el.textContent=text;return;}
    const fragment=this.doc.createDocumentFragment(),slots=[];
    for(const part of parts){
      if(!part.math){fragment.append(this.doc.createTextNode(part.text));continue;}
      const slot=this.doc.createElement('span');slot.className='ldb-inline-math';slot.textContent=part.text;
      slot.dataset.ldbMathSource=part.text;fragment.append(slot);slots.push({slot,source:part.math});
    }
    el.replaceChildren(fragment);this.states.set(el,{text,slots,index:0});this.pending.add(el);this.resume();
  }
  resume(){
    if(this.closed||(!this.pending.size&&!this.prepared.size)||this.loading||this.frame||!this.visible())return;
    if(!this.pending.size){this.flush();return;}
    if(!this.api){
      this.loading=true;
      // The shared promise retains no rows, views or rendered formulas.
      LdbInlineMath.loading??=Promise.resolve().then(async()=>{const api=require('obsidian');await api.loadMathJax();return api;}).catch(error=>{LdbInlineMath.loading=null;throw error;});
      LdbInlineMath.loading.then(api=>{this.loading=false;if(!this.closed){this.api=api;this.resume();}},()=>{this.loading=false;this.pending.clear();});
      return;
    }
    this.frame=this.win.requestAnimationFrame(()=>{this.frame=0;this.paint();});
  }
  paint(){
    if(this.closed||!this.visible())return;
    const start=this.win.performance.now();let rendered=0;
    for(const el of this.pending){
      const state=this.states.get(el);
      if(!state||!this.root.contains(el)){this.pending.delete(el);continue;}
      while(state.index<state.slots.length){
        const {slot,source}=state.slots[state.index++];
        try{
          const math=this.api.renderMath(source,false);
          if(!math.querySelector('mjx-merror,[data-mjx-error]'))this.prepared.set(slot,{el,state,math});
        }catch{/* Invalid/unsupported math keeps its original source. */}
        rendered++;
        if(rendered>=12||this.win.performance.now()-start>=8)break;
      }
      if(state.index===state.slots.length){state.slots=[];this.pending.delete(el);}
      if(rendered>=12||this.win.performance.now()-start>=8)break;
    }
    this.flush();
    this.resume();
  }
  flush(){
    if(this.closed||this.flushing||!this.prepared.size||!this.visible())return;
    this.flushing=true;
    // Obsidian flushes its generated CSS asynchronously. Keep source text until
    // that completes, instead of briefly painting an unstyled formula.
    Promise.resolve().then(()=>this.closed?null:this.api.finishRenderMath()).then(()=>{
      this.flushing=false;if(this.closed||!this.visible())return;
      for(const [slot,{el,state,math}] of this.prepared){
        if(this.states.get(el)===state&&this.root.contains(el)&&el.contains(slot)){slot.replaceChildren(math);slot.classList.add('is-rendered');}
      }
      this.prepared.clear();
    },()=>{this.flushing=false;this.prepared.clear();});
  }
  copySelection(event){
    if(!event.clipboardData)return;
    const selection=this.win.getSelection?.();if(!selection?.rangeCount||selection.isCollapsed)return;
    const range=selection.getRangeAt(0).cloneRange();
    const parent=node=>node.nodeType===1?node:node.parentElement;
    const field=parent(range.startContainer)?.closest('.ldb-title,.ldb-tldr');
    if(!field||!this.root.contains(field)||!field.contains(range.endContainer))return;
    const first=parent(range.startContainer)?.closest('.ldb-inline-math'),last=parent(range.endContainer)?.closest('.ldb-inline-math');
    if(first&&field.contains(first))range.setStartBefore(first);
    if(last&&field.contains(last))range.setEndAfter(last);
    const fragment=range.cloneContents(),formulas=fragment.querySelectorAll('.ldb-inline-math');if(!formulas.length)return;
    for(const el of formulas)el.replaceWith(this.doc.createTextNode(el.dataset.ldbMathSource));
    event.clipboardData.setData('text/plain',fragment.textContent);event.preventDefault();
  }
  destroy(){
    this.closed=true;if(this.frame)this.win.cancelAnimationFrame(this.frame);this.frame=0;this.pending.clear();this.prepared.clear();this.states=new WeakMap();
    this.root.removeEventListener('copy',this.copy);this.doc.removeEventListener('visibilitychange',this.visibility);
    this.root=this.doc=this.win=this.visible=this.api=null;
  }
}
