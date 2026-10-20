'use strict';
// Diagnostic only. Run with a bundle directory and an external Playwright path:
// node scripts/benchmark-ai-memory.cjs /path/to/build /path/to/playwright
// Uses synthetic data, host shims and Chromium; never a personal vault or API.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const bundle=path.resolve(process.argv[2]||'.'),{chromium}=require(process.argv[3]||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.LDB_CHROME?{executablePath:process.env.LDB_CHROME}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:850}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.abort());
  await page.setContent(`<style>
   *{box-sizing:border-box}body{margin:0;font:14px sans-serif;background:white}
   :root{--background-primary:white;--background-secondary:#eee;--background-modifier-border:#ddd;--text-normal:#222;--text-muted:#777;--interactive-accent:#9273ef;--font-ui-small:13px;--font-ui-medium:14px}
   .modal{position:absolute;inset:10px;overflow:auto;background:white;padding:16px}button,input,textarea,select{font:inherit}button{padding:6px}
   [hidden]{display:none!important}
  </style>`);
  await page.addStyleTag({content:fs.readFileSync(path.join(bundle,'styles.css'),'utf8')});
  await page.addScriptTag({content:`
   for(const [name,fn] of Object.entries({
    createEl(tag,o={}){if(typeof o==='string')o={cls:o};const e=document.createElement(tag);if(o.cls)e.className=o.cls;if(o.text!=null)e.textContent=o.text;for(const k of ['type','value'])if(o[k]!=null)e[k]=o[k];for(const[k,v]of Object.entries(o.attr||{}))e.setAttribute(k,v);this.append(e);return e;},
    createDiv(o){return this.createEl('div',o)},createSpan(o){return this.createEl('span',o)},empty(){this.replaceChildren()},setText(t){this.textContent=t},appendText(t){this.append(document.createTextNode(t))},addClass(...c){this.classList.add(...c)},removeClass(...c){this.classList.remove(...c)},toggleClass(c,on){this.classList.toggle(c,on)}
   }))HTMLElement.prototype[name]=fn;
   class DemoModal{constructor(app){this.app=app;this.modalEl=document.createElement('div');this.modalEl.className='modal';this.titleEl=this.modalEl.createEl('h2');this.contentEl=this.modalEl.createDiv();}open(){document.body.append(this.modalEl);this.onOpen?.();}close(){this.onClose?.();this.modalEl.remove();}}
   class DemoScope{register(){return {};}unregister(){}}
   window.module={exports:{}};window.require=n=>{if(n!=='obsidian')throw Error(n);return {Plugin:class{},ItemView:class{},Modal:DemoModal,Scope:DemoScope,Platform:{},Notice:class{},setIcon(el){el.innerHTML='<svg width="16" height="16"></svg>';}}};
  `});
  await page.addScriptTag({content:fs.readFileSync(path.join(bundle,'main.js'),'utf8')+'\nwindow.test={Beta:DeepSeekBetaModal,Work:getDeepSeekWork(),TagTree,LdbI18n};'});
  await page.evaluate(()=>{
   const {Beta,Work,TagTree:T,LdbI18n}=test;LdbI18n.setLanguage('en');
   const model={groups:Array.from({length:10},(_,g)=>({name:'Group '+g,tags:Array.from({length:100},(_,t)=>'#research/g'+g+'/tag'+t)}))};
   const rows=Array.from({length:1000},(_,i)=>({path:'papers/'+i+'.pdf',title:'Synthetic paper '+i,tags:'#research/g0/tag0',tldr:'A complete synthetic summary.',organizing:'AI 已整理'}));
   const collections=Array.from({length:100},(_,i)=>({name:'Category '+i,scope:'library',subgroups:['A','B'],members:rows.slice(i*10,i*10+10).map(r=>({path:r.path,notes:'Synthetic note '+r.path}))}));
   const app={scope:{},workspace:{getLeavesOfType:()=>[]},vault:{getAbstractFileByPath:()=>({path:'tags.md'}),read:async()=>T.serialize(model)}};
   const service={enabled:true,models:[{id:'synthetic',name:'Synthetic'}],modelId:'synthetic',selectedModel(){return this.models[0]},review:(p,e)=>({values:{...p.preview,...e},error:''}),cancel(){}};
   window.work=new Work(service);work.items=Array.from({length:20},(_,i)=>({path:'temp/'+i+'.pdf',filename:i+'.pdf',edits:{},proposal:{filename:i+'.pdf',preview:{title:'Synthetic proposal '+i,tldr:'A synthetic summary to edit.',tags:'#research/g0/tag0',placements:[{scope:'library',name:'Category 0',subgroup:''}]},titleVerified:true,taxonomy:{tags:[]}}}));
   window.plugin={app,settings:{},snapshot:{library:rows,collections,inbox:[]},deepSeekWork:work};
   window.openPanel=()=>{window.panel=new Beta(plugin);panel.open();};openPanel();
  });
  await page.waitForTimeout(60);
  const cdp=await page.context().newCDPSession(page);
  const sample=async()=>{
   await cdp.send('HeapProfiler.collectGarbage');
   const heap=await cdp.send('Runtime.getHeapUsage'),dom=await cdp.send('Memory.getDOMCounters');
   const state=await page.evaluate(()=>({mounted:document.querySelectorAll('*').length,bodies:document.querySelectorAll('.ldb-deepseek-proposal-body').length,options:document.querySelectorAll('.ldb-deepseek-proposal option').length,draftBytes:JSON.stringify(work.items).length,catalogCopies:work.items.filter(i=>i.tagModel).length}));
   return {...state,heapMiB:+(heap.usedSize/1048576).toFixed(3),nodes:dom.nodes,listeners:dom.jsEventListeners};
  };
  const initial=await sample();
  // Real animation and browser events must restore the latest draft on reopen.
  const first=page.locator('.ldb-deepseek-proposal').first(),summary=first.locator(':scope > summary');
  await first.locator('textarea').fill('Keep this human draft');await summary.click();await page.waitForTimeout(220);await summary.click();await page.waitForTimeout(220);
  assert.equal(await first.locator('textarea').inputValue(),'Keep this human draft');
  // Read/edit/close the real tag-map UI on every proposal.
  for(let i=0;i<20;i++){
   await page.evaluate(i=>panel.openDraftTagMap(work.items[i],()=>{}),i);
   await page.waitForFunction(()=>panel.tagMap?.model);
   await page.evaluate(async i=>{
    const map=panel.tagMap,T=test.TagTree;
    let next=T.addGroup(map.model,'Draft '+i);next=T.addTag(next,'Draft '+i,null,'new-'+i).model;await map.draft.store(next);
    map.close();
   },i);
  }
  const afterMaps=await sample();
  // Reopen tag drafts and repeat modal teardown. No network or source writes.
  for(let i=0;i<20;i++){
   await page.evaluate(()=>{panel.close();openPanel();});
   await page.waitForTimeout(20);
  }
  const afterCycles=await sample();
  await page.setViewportSize({width:390,height:700});await page.emulateMedia({reducedMotion:'reduce'});
  await summary.click();await page.waitForTimeout(20);await summary.click();await page.waitForTimeout(20);
  assert.equal(await first.locator('textarea').inputValue(),'Keep this human draft');
  await page.evaluate(()=>panel.close());await page.mouse.click(2,2);await page.waitForTimeout(250);const closed=await sample();
  assert.equal(await page.evaluate(()=>work.listeners.size),0);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({initial,afterMaps,afterCycles,closed,checks:'draft preservation, motion, narrow viewport, close/reopen, no network'},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
