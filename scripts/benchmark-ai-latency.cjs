'use strict';
// Offline A/B latency diagnostic. No vault, credentials, HTTP or production changes.
// node scripts/benchmark-ai-latency.cjs BEFORE AFTER /external/path/to/playwright [report.json]
// LDB_CHROME optionally selects an installed Chrome. CPU throttling is a synthetic
// sensitivity test, not a claim about a physical phone or tablet.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const [before,after,pw,output]=process.argv.slice(2);
if(!before||!after||!pw)throw Error('Expected BEFORE AFTER PLAYWRIGHT [OUTPUT]');
const {chromium}=require(pw),rounds=Number(process.env.LDB_ROUNDS||3),samples=Number(process.env.LDB_SAMPLES||24);
const scenarios=[{name:'small',papers:100,categories:10,tags:100},{name:'large',papers:1000,categories:100,tags:1000}];
const quantile=(a,p)=>{const s=[...a].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.ceil(p*s.length)-1)];};
const summarize=a=>({n:a.length,p50:+quantile(a,.5).toFixed(2),p95:+quantile(a,.95).toFixed(2),max:+Math.max(...a).toFixed(2)});
async function run(browser,bundle,scenario,rate){
 const page=await browser.newPage({viewport:{width:1000,height:850}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.abort());
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate});
 try{
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
  await page.addScriptTag({content:fs.readFileSync(path.join(bundle,'main.js'),'utf8')+'\nwindow.test={Beta:DeepSeekBetaModal,Work:getDeepSeekWork(),TagTree,TagMapModal,LdbI18n};'});
  await page.evaluate(({papers,categories,tags})=>{
   const {Beta,Work,TagTree:T,LdbI18n}=test;LdbI18n.setLanguage('en');
   const model={groups:Array.from({length:Math.max(1,Math.ceil(tags/100))},(_,g)=>({name:'Group '+g,tags:Array.from({length:Math.min(100,tags-g*100)},(_,t)=>'#research/g'+g+'/tag'+t)}))};
   const rows=Array.from({length:papers},(_,i)=>({path:'papers/'+i+'.pdf',title:'Synthetic paper '+i,tags:'#research/g0/tag0',tldr:'A complete synthetic summary.',organizing:'AI 已整理'}));
   const collections=Array.from({length:categories},(_,i)=>({name:'Category '+i,scope:'library',subgroups:['A','B'],members:rows.slice(i*10,i*10+10).map(r=>({path:r.path,notes:'Synthetic note '+r.path}))}));
   const catalogText=T.serialize(model);window.catalogReads=0;
   const app={scope:{},workspace:{getLeavesOfType:()=>[]},vault:{getAbstractFileByPath:()=>({path:'tags.md'}),read:async()=>{window.catalogReads++;return catalogText;}}};
   const service={enabled:true,models:[{id:'synthetic',name:'Synthetic'}],modelId:'synthetic',selectedModel(){return this.models[0]},review:(p,e)=>({values:{...p.preview,...e},error:''}),cancel(){}};
   window.work=new Work(service);work.items=Array.from({length:20},(_,i)=>({path:'temp/'+i+'.pdf',filename:i+'.pdf',edits:{},proposal:{filename:i+'.pdf',preview:{title:'Synthetic proposal '+i,tldr:'A synthetic summary to edit.',tags:'#research/g0/tag0',placements:[{scope:'library',name:'Category 0',subgroup:''}]},titleVerified:true,taxonomy:{tags:[]}}}));
   window.plugin={app,settings:{},snapshot:{library:rows,collections,inbox:[]},deepSeekWork:work};
   window.openPanel=()=>{window.panel=new Beta(plugin);panel.open();};
  },scenario);
  const result=await page.evaluate(async({samples})=>{
   const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
   const settle=async()=>{await frame();await frame();};
   const layout=()=>document.body.getBoundingClientRect().height;
   const timed=fn=>{const t=performance.now();fn();layout();return performance.now()-t;};
   const data={panelOpen:[],panelClose:[],previewExpand:[],previewCollapse:[],mapOpen:[],mapClose:[],animatedExpand:[],animatedHandler:[]};
   // Include pending frame work before each measurement, not Playwright IPC.
   // No diagnostic GC inside latency loops: normal GC pauses belong in the tail.
   for(let i=-6;i<samples;i++){
    const open=timed(openPanel);await settle();
    const close=timed(()=>panel.close());await settle();
    if(i>=0){data.panelOpen.push(open);data.panelClose.push(close);}
   }
   openPanel();await settle();
   // Separate rebuild/layout work from the unchanged disclosure animation.
   const summary=()=>document.querySelectorAll('.ldb-deepseek-proposal > summary')[1];
   const root=()=>summary().parentElement;
   const actualMedia=panel.motion.media;panel.motion.media={matches:true};
   for(let i=-6;i<samples;i++){
    summary().scrollIntoView({block:'center'});await settle();
    const open=timed(()=>summary().click());await settle();
    const textarea=root().querySelector('textarea');
    if(!textarea)throw Error('Missing preview editor');
    if(i===-6){textarea.value='Retained draft';textarea.dispatchEvent(new Event('input',{bubbles:true}));await settle();}
    if(textarea.value!=='Retained draft')throw Error('Draft lost');
    const close=timed(()=>summary().click());await settle();
    if(i>=0){data.previewExpand.push(open);data.previewCollapse.push(close);}
   }
   panel.motion.media=actualMedia;
   for(let i=-2;i<8;i++){
    summary().scrollIntoView({block:'center'});await settle();
    const t=performance.now(),handler=timed(()=>summary().click());
    const animations=[...panel.motion.animations];
    await Promise.all(animations.map(a=>a.finished.catch(()=>{})));
    layout();const elapsed=performance.now()-t;
    if(root().querySelector('textarea').value!=='Retained draft')throw Error('Animated draft lost');
    summary().click();await Promise.all([...panel.motion.animations].map(a=>a.finished.catch(()=>{})));await settle();
    if(i>=0){data.animatedExpand.push(elapsed);data.animatedHandler.push(handler);}
   }
   const proto=test.TagMapModal.prototype,load=proto.load;
   let loaded;
   proto.load=async function(...args){await load.apply(this,args);loaded?.();};
   const mapOpen=async()=>{
    const ready=new Promise(resolve=>{loaded=resolve;}),start=performance.now();
    panel.openDraftTagMap(work.items[1],()=>{});
    await ready;const map=panel.tagMap;if(!map?.model||!map.error.hidden)throw Error(map?.error?.textContent||'Map load failed');
    // Production schedules fitting/viewport painting for the next frame.
    // Run that same paint now to measure CPU/layout without frame-alignment noise.
    if(map.frame){cancelAnimationFrame(map.frame);map.frame=null;}
    map.paint();layout();return performance.now()-start;
   };
   await mapOpen();
   let model=test.TagTree.addGroup(panel.tagMap.model,'Draft');
   model=test.TagTree.addTag(model,'Draft',null,'new-tag').model;
   await panel.tagMap.draft.store(model);panel.tagMap.close();await settle();
   const readStart=catalogReads;
   for(let i=-6;i<samples;i++){
    const open=await mapOpen();
    if(!panel.tagMap.model.groups.some(g=>g.name==='Draft'))throw Error('Tag draft lost');
    await settle();const close=timed(()=>panel.tagMap.close());await settle();
    if(i>=0){data.mapOpen.push(open);data.mapClose.push(close);}
   }
   const reopenReads=catalogReads-readStart;loaded=null;proto.load=load;
   panel.close();await settle();
   if(work.listeners.size!==0)throw Error('Leaked work subscribers');
   return {data,reopenReads,draftRetained:true};
  },{samples});
  assert.deepEqual(errors,[]);return result;
 }finally{await page.close();}
}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.LDB_CHROME?{executablePath:process.env.LDB_CHROME}:{})});
 try{
  const runs=[];
  for(const scenario of scenarios)for(const rate of [1,4])for(let round=0;round<rounds;round++){
   const order=round%2?[['after',after],['before',before]]:[['before',before],['after',after]];
   for(const [build,bundle]of order){
    process.stderr.write(`${scenario.name} ${rate}x round ${round+1} ${build}\n`);
    runs.push({scenario:scenario.name,rate,round,build,...await run(browser,path.resolve(bundle),scenario,rate)});
   }
  }
  const summary=[];
  for(const scenario of scenarios)for(const rate of [1,4])for(const build of ['before','after']){
   const matching=runs.filter(r=>r.scenario===scenario.name&&r.rate===rate&&r.build===build),metrics={};
   for(const key of Object.keys(matching[0].data))metrics[key]=summarize(matching.flatMap(r=>r.data[key]));
   summary.push({scenario,rate,build,metrics,reopenReads:matching.map(r=>r.reopenReads)});
  }
  const bundleHash=dir=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,'main.js'))).digest('hex');
  const report={date:new Date().toISOString(),browser:browser.version(),rounds,samples,units:'milliseconds',source:'synthetic component harness; cached source text; no network or PDF extraction',before:path.resolve(before),after:path.resolve(after),bundleHashes:{before:bundleHash(before),after:bundleHash(after)},summary,runs};
  if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(summary,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
