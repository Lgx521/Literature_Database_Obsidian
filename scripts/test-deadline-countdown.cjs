const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const E=require('./dashboard');
const due='2026-10-21 23:59 -12:00',end=Date.parse('2026-10-22T11:59:00Z');
assert.equal(E.deadline(due),end);
for(const [remaining,text] of [[12*86400000,'12d'],[86400000,'1d'],[86400000-1,'23h'],[12*3600000,'12h'],[3600000,'1h'],[3600000-1,'59m'],[60000,'1m'],[59999,'<1m'],[1,'<1m'],[0,'已截止'],[-1,'已截止']]){
  assert.equal(E.deadlineCountdown(due,end-remaining),text);
}
assert.equal(E.deadlineCountdown('2026-10-22 19:59 +08:00',end-12*3600000),'12h');
assert.equal(E.deadlineCountdown('—',end),'');assert.equal(E.deadlineCountdown(undefined,end),'');
assert.throws(()=>E.deadlineCountdown('2026-10-21 23:59',end),/时区/);

// Exercise sidebar rendering and clock lifecycle without a real vault or real timers.
let now=end-12*86400000,timerId=0;
const timers=new Map(),listeners=[];
const doc={hidden:false,defaultView:{}};
class Element{
  constructor(options={}){this.children=[];this.attributes={};this.textContent=options.text||'';this.cls=typeof options==='string'?options:options.cls||'';this.isConnected=true;this.ownerDocument=doc;}
  createEl(tag,options){const e=new Element(options);e.tag=tag;this.children.push(e);return e;}
  createDiv(o){return this.createEl('div',o);}createSpan(o){return this.createEl('span',o);}
  setAttribute(k,v){this.attributes[k]=v;}addEventListener(){}addClass(){}toggleClass(){}
  setText(t){this.textContent=t;}empty(){this.children=[];}appendChild(e){this.children.push(e);}
  get lastElementChild(){return this.children.at(-1);}
  querySelector(selector){return this.children.find(e=>e.cls===selector.slice(1));}
}
class ItemView{
  constructor(){this.contentEl=new Element();this.disposers=[];}
  register(f){this.disposers.push(f);}registerDomEvent(target,type,fn){listeners.push({target,type,fn});}
}
const sandbox={module:{exports:{}},Date:class extends Date{static now(){return now;}},setTimeout:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),require:n=>n==='obsidian'?{Plugin:class{},ItemView,Modal:class{},setIcon(){}}:require(n)};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+'\nmodule.exports.Navigation=LibraryNavigation;',sandbox);
const plugin={snapshot:{library:[],inbox:[],reviews:[],submissions:[],categories:[],collections:[],groups:{projects:['Project','Unscheduled'],reviews:['待确定 venue','Review','Unknown'],submissions:['Submit']},deadlines:{projects:{Project:due,Unscheduled:'—'},reviews:{Review:due,Unknown:'—'},submissions:{Submit:due}}},stagingGroup:()=> '待确定 venue',hasPendingEdit:()=>false};
(async()=>{
  const nav=new sandbox.module.exports.Navigation({},plugin);await nav.onOpen();
  assert.equal(nav.countdowns.length,3,'Only known project/venue deadlines get badges, including empty venues.');
  const first=nav.countdowns[0];assert.equal(first.name,'Project');
  assert.equal(first.badge.textContent,'12d');assert.equal(first.badge.title,'截止：2026-10-21 23:59 AoE');
  assert.equal(first.button.querySelector('.ldb-nav-count').textContent,'0');
  assert.equal(first.button.querySelector('.ldb-nav-label').children[0].textContent,'Project');
  assert.equal(first.button.querySelector('.ldb-nav-label').children[1],first.badge,'Name can truncate independently; deadline and paper count remain separate.');
  assert.equal(timers.size,1);assert.equal([...timers.values()][0].delay,60000);
  nav.renaming={scope:'reviews',name:'Review'};now=end-12*3600000;
  nav.updateCountdowns();assert.equal(first.badge.textContent,'12h');assert.equal(nav.renaming.name,'Review');
  assert.equal(nav.countdowns[0].badge,first.badge,'Clock never rebuilds the sidebar or active editor.');
  assert.equal(timers.size,1,'Refresh replaces, rather than stacks, timers.');
  doc.hidden=true;listeners.find(l=>l.type==='visibilitychange').fn();assert.equal(timers.size,0);
  now=end-30*60000;doc.hidden=false;listeners.find(l=>l.type==='visibilitychange').fn();assert.equal(first.badge.textContent,'30m');
  now=end;listeners.find(l=>l.type==='focus').fn();assert.equal(first.badge.textContent,'已截止');assert.equal(timers.size,0);
  now=end-100000;nav.updateCountdowns();assert.equal(timers.size,1);
  await nav.onClose();assert.equal(timers.size,0);nav.updateCountdowns();assert.equal(timers.size,0);
  nav.closed=false;nav.renaming=null;nav.render();assert.equal(timers.size,1);
  for(const dispose of nav.disposers)dispose();assert.equal(timers.size,0);
  plugin.stopped=true;nav.updateCountdowns();assert.equal(timers.size,0);
  console.log('PASS: AoE and equivalent UTC offsets; day/hour/minute/expiry boundaries; unknown deadlines; review/submission badges; separate counts; editor preservation; hidden/resume, close and unload cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1;});
