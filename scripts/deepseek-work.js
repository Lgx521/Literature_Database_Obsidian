'use strict';
// Bounded session state, independent of modal DOM. Only explicit user actions
// start work; hiding the panel does not cancel an already requested batch.
module.exports=class DeepSeekWork{
 constructor(service,{tr=x=>x,language=()=> 'en',changed=()=>{},completed=()=>{}}={}){
  this.service=service;this.tr=tr;this.language=language;this.changed=changed;this.completed=completed;this.listeners=new Set();this.items=[];this.reviews=new WeakMap();this.plan=null;this.planEdits={};this.draft={mode:'inbox'};this.phase='idle';this.running=false;this.done=0;this.total=0;this.filename='';this.error='';this.revision=0;this.closed=false;
  service.onIdle=()=>this.emit();
  service.onPhase=phase=>{if(this.running&&!this.stopping&&this.phase!==phase){this.phase=phase;this.emit();}};
 }
 subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
 emit(){if(this.closed)return;try{this.changed();}catch(_){}for(const fn of this.listeners)try{fn();}catch(_){} }
 get pending(){return this.items.filter(i=>i.proposal&&!i.applied&&!i.ignored);}
 review(item){
  // Preview edits are replaced immutably by the view. Apply revalidates against
  // fresh source data inside Service.apply; this cache only drives preview UI.
  let cached=this.reviews.get(item);
  if(!cached||cached.proposal!==item.proposal||cached.edits!==item.edits){cached={proposal:item.proposal,edits:item.edits,result:this.service.review(item.proposal,item.edits||{})};this.reviews.set(item,cached);}
  return cached.result;
 }
 get ready(){return this.pending.filter(i=>!i.tagInput?.trim()&&!this.review(i).error);}
 releaseTagDraft(item){for(const key of ['tagModel','originalTagModel','tagBase','tagMapState'])delete item[key];}
 begin(kind,total){if(this.closed||this.running||this.service.busy||this.service.wire)throw Error(this.tr('请等待当前请求结束'));if(!this.service.enabled)throw Error(this.tr('请先启用 DeepSeek Beta 并填写密钥'));this.kind=kind;this.total=total;this.done=0;this.error='';this.stopping=false;this.running=true;this.phase='reading';this.started=Date.now();}
 finish(){this.running=false;this.elapsed=Date.now()-this.started;this.phase=this.stopping?'stopped':this.error?'error':this.plan?'plan':this.pending.length?'ready':'done';this.filename='';this.emit();if(!this.closed&&!this.stopping)this.completed();}
 stop(){if(!this.running)return;this.stopping=true;this.phase='stopping';if(this.kind!=='apply')this.service.cancel();this.emit();}
 async planInbox(paths){
  const batch=[...new Set(paths)].slice(0,20);if(!batch.length)throw Error(this.tr('当前范围没有待整理文献'));
  this.begin('plan',batch.length);this.items=[];this.plan=null;this.planEdits={};this.revision++;this.emit();
  try{const plan=await this.service.planInbox(batch,this.language(),(index,total,path)=>{this.done=index;this.filename=path.split('/').pop();this.emit();});if(!this.stopping&&!this.closed){this.plan=plan;this.done=batch.length;this.revision++;}}
  catch(error){if(!this.stopping&&!this.closed)this.error=error.message;}finally{this.finish();}
 }
 async confirmPlan(){
  if(!this.plan||this.running)return;const plan=this.plan;this.begin('confirm',plan.papers.length);this.emit();let approved;
  try{approved=await this.service.approvePlan(plan,this.planEdits);}finally{this.running=false;if(this.stopping)this.phase='stopped';this.emit();}
  if(this.closed||this.stopping||this.plan!==plan)return;
  this.plan=null;this.planEdits={};await this.organize(approved.papers.map(p=>p.path),approved);
 }
 async organize(paths,approved=null){
  const batch=[...new Set(paths)].slice(0,20);if(!batch.length)throw Error(this.tr('当前范围没有待整理文献'));this.begin('organize',batch.length);this.items=[];this.revision++;this.emit();
  try{for(const path of batch){if(this.stopping||this.closed)break;this.filename=path.split('/').pop();this.phase='reading';this.emit();
   try{const proposal=await this.service.organize(path,this.language(),approved);if(this.stopping||this.closed)break;this.items.push({proposal,path,filename:proposal.filename,edits:{},tagInput:''});}
   catch(error){if(this.stopping||this.closed)break;this.items.push({path,filename:this.filename,error:error.message});this.error=error.message;
    if(this.service.wire||['DeepSeek 密钥无效或无权限','DeepSeek 余额不足','DeepSeek 请求过多，请稍后重试','请先保存或取消编辑，并等待当前操作结束','分类或标签已改变，请重新规划','收件箱文件已改变，请重新规划'].map(this.tr).includes(error.message)){this.done++;this.revision++;break;}}
   this.done++;this.revision++;this.emit();
  }}finally{this.finish();}
 }
 async apply(items){
  const ready=new Set(this.ready),batch=items.filter(i=>ready.has(i));if(!batch.length)return;this.begin('apply',batch.length);this.phase='applying';this.emit();
  try{for(const item of batch){if(this.stopping||this.closed)break;this.filename=item.filename;this.emit();
   try{await this.service.apply(item.proposal,item.edits||{});if(!this.closed){item.applied=true;this.releaseTagDraft(item);item.error='';this.done++;}}
   catch(error){if(!this.closed){item.error=error.message;this.error=error.message;}break;}
   finally{this.revision++;this.emit();}
  }}finally{this.finish();}
 }
 ignore(item){if(this.running)return;item.ignored=true;this.releaseTagDraft(item);this.revision++;if(!this.pending.length)this.phase='done';this.emit();}
 clear(){if(this.running)return;this.items=[];this.plan=null;this.planEdits={};this.reviews=new WeakMap();this.error='';this.phase='idle';this.total=this.done=0;this.revision++;this.emit();}
 close(){this.closed=true;this.stopping=true;this.service.onPhase=this.service.onIdle=null;this.service.cancel();this.listeners.clear();this.items=[];this.plan=null;this.planEdits={};this.reviews=new WeakMap();this.draft={};this.changed=this.completed=()=>{};}
};
