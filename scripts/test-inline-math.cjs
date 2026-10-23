'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Events{
 constructor(){this.listeners=new Map();}
 addEventListener(k,f){if(!this.listeners.has(k))this.listeners.set(k,new Set());this.listeners.get(k).add(f);}
 removeEventListener(k,f){this.listeners.get(k)?.delete(f);}
 emit(k,e={}){for(const f of this.listeners.get(k)||[])f(e);}
}
class Node extends Events{
 constructor(doc,tag='div'){super();this.ownerDocument=doc;this.tag=tag;this.children=[];this.dataset={};this.classList={add(){}};}
 append(...nodes){for(const n of nodes){if(n.tag==='#fragment'){this.append(...n.children);continue;}n.parentElement=this;this.children.push(n);}}
 replaceChildren(...nodes){for(const n of this.children)n.parentElement=null;this.children=[];this.append(...nodes);}
 set textContent(s){this.replaceChildren();this.value=s;}
 get textContent(){return this.children.length?this.children.map(n=>n.textContent).join(''):this.value||'';}
 contains(n){return this===n||this.children.some(c=>c.contains(n));}
 querySelector(){return null;}
}
function fixture(){
 const doc=new Events(),frames=new Map();let id=0,calls=0,loads=0,finishes=0,resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 const win={performance:{now:()=>0},requestAnimationFrame:f=>(frames.set(++id,f),id),cancelAnimationFrame:id=>frames.delete(id)};doc.defaultView=win;doc.hidden=false;
 doc.createElement=t=>new Node(doc,t);doc.createTextNode=s=>{const n=new Node(doc,'#text');n.value=s;return n;};doc.createDocumentFragment=()=>new Node(doc,'#fragment');
 const api={loadMathJax(){loads++;return promise;},renderMath(source){calls++;if(source==='bad')throw Error('bad formula');const n=new Node(doc,'mjx-container');n.value='rendered:'+source;return n;},finishRenderMath(){finishes++;return Promise.resolve();}};
 const ctx={require:n=>{assert.equal(n,'obsidian');return api;}};vm.runInNewContext(fs.readFileSync('scripts/inline-math.js','utf8')+'\nthis.Renderer=LdbInlineMath;',ctx);
 const root=new Node(doc),renderer=new ctx.Renderer(root),field=new Node(doc);root.append(field);
 return {doc,root,field,renderer,Type:ctx.Renderer,resolve,reject,frames,stats:()=>({calls,loads,finishes}),frame(){const jobs=[...frames.values()];frames.clear();for(const f of jobs)f();}};
}
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
(async()=>{
 let f=fixture();const parts=s=>Array.from(f.Type.parts(s),x=>({...x}));
 assert.equal(parts('Plain title').length,1);
 assert.equal(parts('$\\pi^{*}_{0.6}$: A policy')[0].math,'\\pi^{*}_{0.6}');
 assert.equal(parts('A $x_t$ and $\\frac{1}{2}$').filter(p=>p.math).length,2);
 for(const source of ['Cost $10 and $20','`$x$`','$$x$$','\\$x$','$\\require{html}$','$\\href{https://x}{x}$','$\\def\\x{x}\\x$','$x^{2$','$ x $','$'+('x'.repeat(1025))+'$'])assert(!parts(source).some(p=>p.math),source);
 assert.equal(parts('`$no$` then $yes$').filter(p=>p.math).length,1);
 f.renderer.set(f.field,'Plain title');await tick();assert.equal(f.stats().loads,0,'Plain text never loads MathJax');
 f.renderer.set(f.field,'$x$');await tick();assert.equal(f.stats().loads,1);
 const other=new Node(f.doc);f.root.append(other);f.renderer.set(other,'$y$');await tick();assert.equal(f.stats().loads,1,'Coalesce host load');
 f.renderer.set(f.field,'Changed before MathJax loaded');f.resolve();await tick();f.frame();await tick();
 assert.equal(f.field.textContent,'Changed before MathJax loaded');assert.equal(f.stats().calls,1,'No stale render');
 const previous=other.children[0];f.renderer.set(other,'$y$');f.frame();assert.equal(other.children[0],previous,'Unchanged math retains DOM');
 f.renderer.set(f.field,'$bad$');f.frame();assert.equal(f.field.textContent,'$bad$','Invalid formula remains source');
 f.renderer.set(f.field,'$'+Array.from({length:24},()=> 'x').join('$ $')+'$');f.frame();assert.equal(f.renderer.pending.size,1,'Bound formulas per frame');f.frame();assert.equal(f.renderer.pending.size,0);
 f.doc.hidden=true;f.renderer.set(f.field,'$z$');assert.equal(f.frames.size,0);f.doc.hidden=false;f.doc.emit('visibilitychange');assert.equal(f.frames.size,1);f.frame();
 f.renderer.set(f.field,'$q$');f.renderer.destroy();assert.equal(f.frames.size,0);assert.equal(f.renderer.pending.size,0);assert.equal(f.root.listeners.get('copy').size,0);assert.equal(f.doc.listeners.get('visibilitychange').size,0);
 f=fixture();f.renderer.set(f.field,'$x$');await tick();f.renderer.destroy();f.resolve();await tick();assert.equal(f.stats().calls,0);assert.equal(f.frames.size,0);assert.equal(f.renderer.root,null,'Late load cannot retain destroyed root');
 f=fixture();f.renderer.set(f.field,'$x$');await tick();f.reject(Error('Unavailable'));await tick();assert.equal(f.field.textContent,'$x$');assert.equal(f.renderer.pending.size,0);assert.equal(f.Type.loading,null);f.renderer.destroy();
 console.log('PASS: math delimiters, bounded subset, lazy host load, stale/detached lifecycle, unchanged DOM, frame budget, hidden views, fallback and teardown.');
})().catch(error=>{console.error(error);process.exitCode=1;});
