'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const E=require('./dashboard'),C=require('./collections'),T=require('./tag-tree'),O=require('./organization'),I=require('./i18n');I.setLanguage('en');
const files=new Map(['library.md','collections.md','reviews.md','submissions.md'].map(n=>[n,fs.readFileSync('templates/empty-vault/'+n,'utf8')]));
files.set('collections.md',C.add(C.add(files.get('collections.md'),'library','ML'),'projects','SECRET_PROJECT'));
let fail='',webResponse=null,reply=null,hold=null,fetchResponse=null,fetchHold=null;const requests=[];
const vault={getAbstractFileByPath:p=>files.has(p)?{path:p}:null,read:async f=>files.get(f.path),process:async(f,fn)=>{if(f.path===fail)throw Error('Injected failure');files.set(f.path,fn(files.get(f.path)));},create:async(p,t)=>{assert(!files.has(p));files.set(p,t);},delete:async f=>files.delete(f.path),adapter:{exists:async p=>files.has(p)||p==='.maintenance-backups',write:async(p,t)=>files.set(p,t)}};
const plugin={app:{vault,workspace:{getLeavesOfType:()=>[]}},ready:true,hasPendingEdit:()=>false,recordAction:async fn=>fn(),refresh:async()=>{}};
const body='Web Evidence Title\nWe introduce WEBRL, a method for learning robot policies. '+('The article explains online reinforcement learning, its implementation and evaluation limitations. '.repeat(90));
const normal=()=>({status:200,headers:{'Content-Type':'text/plain'},text:body});
const good=()=>({title:'Web Evidence Title',tldr:'Introduces WEBRL for online learning of robot policies.',tags:['#research/rl'],placement:{category:0,subgroup:''},uncertainty:''});
const requestUrl=async req=>{
 requests.push(req);
 if(req.url.startsWith('https://example.test/')){assert(!req.headers.Authorization);assert(!req.headers.Cookie);return hold?hold():webResponse||normal();}
 if(req.url==='https://api.deepseek.com/v1/tools/fetch'){assert.equal(req.headers.Authorization,'Bearer sk-synthetic-web-test');assert.deepEqual(Object.keys(JSON.parse(req.body)),['url']);return fetchHold?fetchHold():fetchResponse||{status:404,text:'{}'};}
 assert.equal(req.url,'https://api.deepseek.com/chat/completions');assert.equal(req.headers.Authorization,'Bearer sk-synthetic-web-test');
 assert(!req.body.includes('SECRET_'));assert(!req.body.includes('sk-synthetic'));return {status:200,text:JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(reply||good())}}]})};
};
const Plan=require('./deepseek-plan')({TagTree:T,Collections:C,tr:I.t});
const runtime=require('./deepseek-beta')({Plan,WebResources:require('./web-resources'),WebExcerpt:require('./web-excerpt')({tr:I.t}),Engine:E,Collections:C,TagTree:T,Organization:O,Sha256:require('./sha256'),CitationMetadata:require('./citation-metadata'),SourceTransaction:require('./source-transaction'),loadPdfJs:()=>{throw Error('No PDF reads for web');},requestUrl,tr:I.t,nodeRequire:()=>{throw Error('No Node IO for web');},desktop:true});
const service=new runtime.Service(plugin);service.enable('sk-synthetic-web-test');service.models=[{id:'synthetic-model',maxOutput:6000}];service.selectModel('synthetic-model');
const sources=()=>['library.md','collections.md','tags.md'].map(p=>files.get(p));
const row=id=>E.parseLibrary(files.get('library.md')).find(r=>r.path===id);
function add(id,inbox=true,title=''){files.set('library.md',E.addWebEntry(files.get('library.md'),{url:'https://example.test/'+id,id:'web:'+id,inbox,title}));return 'web:'+id;}
function update(id,changes){files.set('library.md',E.updateLibraryEntry(files.get('library.md'),row(id),changes,{kind:'human',name:'user'}));}
(async()=>{try{
 const a=add('example-a1');update(a,{notes:'SECRET_NOTES',bookmarked:true});files.set('tags.md',T.serialize({groups:[{name:'Methods',tags:['#research/rl']}]},null));
 const before=sources(),p=await service.organize(a,'en');assert.deepEqual(sources(),before);assert.equal(p.preview.title,'Web Evidence Title');assert.equal(service.review(p).error,'');assert.equal(p.coverage.kind,'web');assert(!JSON.stringify(p).includes('implementation and evaluation'));
 await service.apply(p,{tldr:'Human-reviewed WEBRL summary.'});assert.equal(row(a).path,a);assert(!row(a).inbox);assert.equal(row(a).tldr,'Human-reviewed WEBRL summary.');assert.equal(E.decodeText(row(a).notes),'SECRET_NOTES');assert(row(a).bookmarked);assert.equal(row(a).bibtex,'');assert.equal(row(a).citationSource,'');assert.equal(O.source(row(a),'title').kind,'ai');assert.equal(O.source(row(a),'tldr').kind,'human');assert.equal(O.source(row(a),'#research/rl',true).kind,'ai');
 files.set('collections.md',C.change(files.get('collections.md'),[a],{scope:'projects',name:'SECRET_PROJECT'}));const existing=await service.organize(a,'en');assert.equal(existing.changes.title,undefined);assert.equal(existing.changes.tldr,undefined);assert.equal(existing.target,null);await service.apply(existing);assert(C.parse(files.get('collections.md')).groups.find(g=>g.name==='SECRET_PROJECT').members.some(m=>m.path===a));
 const stale=await service.organize(a,'en');update(a,{url:'https://example.test/changed'});await assert.rejects(service.apply(stale),/paper changed/);
 const b=add('example-b2');const proposal=await service.organize(b,'en'),baseline=sources();fail='collections.md';await assert.rejects(service.apply(proposal),/Injected/);fail='';assert.deepEqual(sources(),baseline);assert(row(b).inbox);await service.apply(proposal);assert(!row(b).inbox);
 const c=add('example-c3');update(c,{organizing:'人工完成'});const count=requests.length;await assert.rejects(service.organize(c,'en'),/manually complete/);await assert.rejects(service.planInbox([c],'en'),/manually complete/);assert.equal(requests.length,count);
 await assert.rejects(service.organize('reviews/Private.pdf','en'),/Only public/);await assert.rejects(service.organize('web:unknown-id','en'),/Only public/);
 const d=add('example-d4');webResponse={status:403,headers:{'content-type':'text/html'},text:'Denied'};let n=requests.length;await assert.rejects(service.organize(d,'en'),/Could not read/);assert.equal(requests.length,n+2);
 webResponse={status:200,headers:{'content-type':'application/pdf'},text:'PDF'};await assert.rejects(service.organize(d,'en'),/readable webpage/);
 webResponse={status:200,headers:{'content-type':'text/plain'},text:'Too short'};await assert.rejects(service.organize(d,'en'),/Not enough/);
 webResponse={status:200,headers:{'content-type':'text/plain','content-length':'2097153'},get text(){throw Error('Do not read oversized body');}};await assert.rejects(service.organize(d,'en'),/too large/);
 webResponse={status:200,headers:{'content-type':'text/plain'},text:'中'.repeat(700000)};await assert.rejects(service.organize(d,'en'),/too large/);webResponse=null;
 // Inbox planning accepts web identities, preserves evidence checks through edits,
 // and only files the canonical row after the explicit Apply operation.
 const planReply={categories:[{name:'ML',reason:'',subgroups:[]}],papers:[{index:0,title:'Web Evidence Title',category:'ML',subgroup:''}]};
 reply=planReply;const planBefore=sources(),plan=await service.planInbox([d],'en');const approved=await service.approvePlan(plan);assert(approved.papers[0].evidenceRevision);assert.equal(approved.papers[0].webReader,'direct');assert.deepEqual(sources(),planBefore);
 assert.equal(JSON.parse(JSON.parse(requests.at(-1).body).messages[1].content).papers[0].pages[0].text,body,'Planning no longer clips at 5,500 characters');
 reply={title:good().title,tldr:good().tldr,tags:good().tags,uncertainty:''};webResponse={...normal(),text:body+' changed'};n=requests.length;await assert.rejects(service.organize(d,'en',approved),/content changed/);assert.equal(requests.length,n+1);webResponse=null;
 fetchResponse={status:200,text:JSON.stringify({title:good().title,content:'Different provider representation. '.repeat(40)})};
 n=requests.length;const planned=await service.organize(d,'en',approved);assert.equal(requests.length,n+2,'Confirmed direct plan skips provider even when available');await service.apply(planned);assert(!row(d).inbox);reply=null;
 // Native Fetch uses only the exact URL, with no third-party Authorization.
 const native=add('native-a1');fetchResponse={status:200,text:JSON.stringify({title:good().title,content:body})};n=requests.length;const nativeProposal=await service.organize(native,'en');assert.equal(nativeProposal.coverage.reader,'deepseek');assert.equal(requests.length,n+2);assert(!requests.slice(n).some(r=>r.url.startsWith('https://example.test')));
 reply=planReply;const nativePlan=await service.approvePlan(await service.planInbox([native],'en'));assert.equal(nativePlan.papers[0].webReader,'deepseek');reply={title:good().title,tldr:good().tldr,tags:good().tags,uncertainty:''};assert.equal((await service.organize(native,'en',nativePlan)).coverage.reader,'deepseek');
 fetchResponse={status:404,text:'{}'};n=requests.length;await assert.rejects(service.organize(native,'en',nativePlan),/reader is unavailable/);assert.equal(requests.length,n+1,'No representation switch after confirmation');reply=null;
 for(const status of [401,402,403,429]){fetchResponse={status,text:'SECRET_RESPONSE'};n=requests.length;await assert.rejects(service.organize(native,'en'),err=>!err.message.includes('SECRET'));assert.equal(requests.length,n+1,'Do not bypass permission or billing errors');}
 for(const text of ['invalid JSON',JSON.stringify({title:'No text'}),JSON.stringify({title:'Short',content:'short'}),'x'.repeat(2097153)]){fetchResponse={status:200,text};assert.equal((await service.organize(native,'en')).coverage.reader,'direct');}
 fetchResponse={status:200,text:JSON.stringify({title:good().title,content:body.repeat(10)})};const long=await service.organize(native,'en');assert(long.coverage.truncated);assert.equal(JSON.parse(JSON.parse(requests.at(-1).body).messages[1].content).pages[0].text.length,48000);
 fetchResponse=null;
 // Cancellation leaves the native request slot occupied until it settles and
 // must never send a model request with a late webpage response.
 const e=add('example-e5');let finish;hold=()=>new Promise(resolve=>finish=resolve);n=requests.length;const pending=service.organize(e,'en');while(!finish)await new Promise(r=>setImmediate(r));service.cancel();await assert.rejects(pending,/Cancelled/);assert(service.wire);await assert.rejects(service.organize(e,'en'),/current request/);finish(normal());await new Promise(r=>setImmediate(r));assert.equal(service.wire,null);assert.equal(requests.length,n+2);hold=null;assert(row(e).inbox);
 finish=null;fetchHold=()=>new Promise(resolve=>finish=resolve);n=requests.length;const cancelledFetch=service.organize(e,'en');while(!finish)await new Promise(r=>setImmediate(r));service.cancel();await assert.rejects(cancelledFetch,/Cancelled/);assert(service.wire);finish({status:404,text:'{}'});await new Promise(r=>setImmediate(r));assert.equal(service.wire,null);assert.equal(requests.length,n+1,'No fallback or model request after cancelled Fetch');fetchHold=null;
 const hostRequest=service.hostRequest.bind(service);service.hostRequest=(options,check)=>hostRequest(options,check,5);
 fetchHold=()=>new Promise(resolve=>finish=resolve);n=requests.length;await assert.rejects(service.organize(e,'en'),/timed out/);assert(service.wire);assert.equal(requests.length,n+1,'Timed-out Fetch must not overlap a direct request');finish({status:404,text:'{}'});await new Promise(r=>setImmediate(r));service.hostRequest=hostRequest;fetchHold=null;
 fetchHold=()=>{throw Error('SECRET_PROVIDER_NETWORK_ERROR')};assert.equal((await service.organize(e,'en')).coverage.reader,'direct');fetchHold=null;
 hold=()=>{throw Error('SECRET_NETWORK_ERROR')};await assert.rejects(service.organize(e,'en'),err=>!err.message.includes('SECRET_'));hold=null;
 console.log('PASS: web AI organization, inbox planning, protected metadata, provenance, same-ID filing, paired rollback, content/URL conflicts, limits, privacy and cancellation.');
 }finally{service.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
