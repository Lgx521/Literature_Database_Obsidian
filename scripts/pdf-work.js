'use strict';
// One PDF buffer/document per plugin, shared by metadata intake and DeepSeek reads.
// No polling/timers while idle; queued jobs hold paths, never PDF bytes.
class PdfWorkQueue {
  constructor(){this.jobs=[];this.active=null;this.closed=false;}
  run(job,{cancelled=()=>false,owner=null,timeout=45000}={}){
    if(this.closed)return Promise.reject(this.error());
    return new Promise((resolve,reject)=>{this.jobs.push({job,cancelled,owner,timeout,resolve,reject});this.drain();});
  }
  error(message='PDF task cancelled'){const error=Error(message);error.name='AbortError';return error;}
  cancelOwner(owner){
    const keep=[];for(const job of this.jobs)if(job.owner===owner)job.reject(this.error());else keep.push(job);this.jobs=keep;
    if(this.active?.owner===owner)this.active.cancel();
  }
  cancelAll(){for(const job of this.jobs)job.reject(this.error());this.jobs=[];this.active?.cancel();}
  close(){this.closed=true;this.cancelAll();}
  async drain(){
    if(this.active||this.closed)return;const job=this.jobs.shift();if(!job)return;
    if(job.cancelled()){job.reject(this.error());this.drain();return;}
    let failure=null,timer,poll;const listeners=new Set();
    const cancel=(message)=>{if(failure)return;failure=this.error(message);for(const listener of listeners)try{Promise.resolve(listener()).catch(()=>{});}catch(_){};};
    const work={check:()=>{if(!failure&&(this.closed||job.cancelled()))cancel();if(failure)throw failure;},onCancel:fn=>{listeners.add(fn);if(failure)fn();return ()=>listeners.delete(fn);}};
    this.active={owner:job.owner,cancel};
    timer=setTimeout(()=>cancel('PDF extraction timed out'),job.timeout);
    const watch=()=>{if(this.closed||job.cancelled())cancel();if(!failure)poll=setTimeout(watch,100);};poll=setTimeout(watch,100);
    try{const result=await job.job(work);work.check();job.resolve(result);}catch(error){job.reject(failure||error);}
    finally{clearTimeout(timer);clearTimeout(poll);listeners.clear();this.active=null;this.drain();}
  }
}
module.exports=PdfWorkQueue;
