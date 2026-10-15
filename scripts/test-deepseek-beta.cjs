'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const E=require('./dashboard'),C=require('./collections'),T=require('./tag-tree'),O=require('./organization'),Q=require('./pdf-work'),S=require('./sha256');
const I=require('./i18n');I.setLanguage('en');
const store=new Map(),files=new Map();let clock=0,failSource='',requests=0,destroyed=0,activePdfs=0,emptyPdf=false,pageCount=14;
function folder(path){if(files.has(path))return files.get(path);const f={path,name:path.split('/').pop(),children:[]};files.set(path,f);if(path.includes('/')){f.parent=folder(path.slice(0,path.lastIndexOf('/')));f.parent.children.push(f);}return f;}
function put(path,value){store.set(path,value);let f=files.get(path);if(!f){f={path,name:path.split('/').pop(),extension:path.split('.').pop()};files.set(path,f);if(path.includes('/')){f.parent=folder(path.slice(0,path.lastIndexOf('/')));f.parent.children.push(f);}}f.stat={size:value.length,mtime:++clock};return f;}
for(const n of ['library.md','collections.md','reviews.md','submissions.md'])put(n,fs.readFileSync('templates/empty-vault/'+n,'utf8'));
folder('papers');folder('temp');put('collections.md',C.add(store.get('collections.md'),'library','Robotics'));
put('collections.md',C.add(store.get('collections.md'),'projects','SECRET_WRITING_PROJECT'));
put('reviews.md',store.get('reviews.md')+'\nSECRET_REVIEW');
const vault={getAbstractFileByPath:p=>files.get(p),read:async f=>store.get(f.path),readBinary:async f=>new TextEncoder().encode(store.get(f.path)).buffer,
 create:async(p,t)=>{if(files.has(p))throw Error('collision');return put(p,t);},createFolder:async p=>{if(files.has(p))throw Error('collision');return folder(p);},
 process:async(f,fn)=>{if(f.path===failSource)throw Error('simulated write failure');return put(f.path,fn(store.get(f.path)));},
 rename:async(f,to)=>{if(files.has(to))throw Error('collision');const value=store.get(f.path);store.delete(f.path);files.delete(f.path);if(f.parent)f.parent.children=f.parent.children.filter(x=>x!==f);f.path=to;f.name=to.split('/').pop();f.parent=folder(to.slice(0,to.lastIndexOf('/')));f.parent.children.push(f);files.set(to,f);store.set(to,value);},
 delete:async f=>{files.delete(f.path);store.delete(f.path);},adapter:{exists:async p=>files.has(p),mkdir:async p=>folder(p),write:async(p,t)=>put(p,t)}};
let dirty=false;const plugin={app:{vault,workspace:{getLeavesOfType:()=>[]}},ready:true,stopped:false,hasPendingEdit:()=>dirty,recordAction:async fn=>{if(dirty)throw Error('dirty');return fn();},refresh:async()=>{},pdfWork:new Q()};
const evidence='Synthetic Evidence Title. The method uses reinforcement learning for robotic control. Evidence is limited to the supplied pages.';
const loadPdfJs=async()=>({getDocument:()=>{activePdfs++;let done=false;return {promise:Promise.resolve({numPages:pageCount,getPage:async()=>({getTextContent:async()=>({items:[{str:emptyPdf?'':evidence}]}),cleanup(){}})}),destroy:async()=>{if(!done){done=true;destroyed++;activePdfs--;}}};}});
const good=()=>({title:'Synthetic Evidence Title',tldr:'A grounded synthetic summary.',tags:['#research/rl'],placement:{category:0,subgroup:''},uncertainty:''});
let responseValue=good,requestOverride=null;
const requestUrl=async request=>{
 if(request.method==='GET'){assert.equal(request.url,'https://api.deepseek.com/models');return {status:200,text:JSON.stringify({data:[{id:'provider-test-text'}]})};}
 requests++;assert.equal(activePdfs,0,'Release PDF resources before the network request');assert.equal(request.url,'https://api.deepseek.com/chat/completions');
 const body=JSON.parse(request.body);assert.equal(body.thinking.type,'disabled');assert.equal(body.response_format.type,'json_object');assert(body.max_tokens<=1800);
 assert(!request.body.includes('SECRET_BIBLIOGRAPHY'));assert(!request.body.includes('SECRET_NOTES'));assert(!request.body.includes('SECRET_REVIEW'));assert(!request.body.includes('SECRET_WRITING_PROJECT'));assert(!request.body.includes('sk-test-key-123456'));
 if(requestOverride)return requestOverride(request);
 return {status:200,text:JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(responseValue())}}],usage:{prompt_tokens:100,completion_tokens:50}})};
};
const runtime=require('./deepseek-beta')({Engine:E,Collections:C,TagTree:T,Organization:O,Sha256:S,CitationMetadata:require('./citation-metadata'),SourceTransaction:require('./source-transaction'),loadPdfJs,requestUrl,tr:I.t});
const service=new runtime.Service(plugin);
const sources=()=>[store.get('library.md'),store.get('collections.md')];
function add(path,changes={}){put(path,'%PDF synthetic');let text=E.addLibraryEntry(store.get('library.md'),path);const row=E.parseLibrary(text).find(r=>r.path===path);text=E.updateLibraryEntry(text,row,changes,{kind:'human',name:'user'});put('library.md',text);return E.parseLibrary(text).find(r=>r.path===path);}
function update(path,changes){const row=E.parseLibrary(store.get('library.md')).find(r=>r.path===path);put('library.md',E.updateLibraryEntry(store.get('library.md'),row,changes,{kind:'human',name:'user'}));}
(async()=>{
 try{
  assert.equal(service.enabled,false);assert.equal(requests,0);await assert.rejects(service.organize('temp/A.pdf','en'),/Enable DeepSeek/);
  add('papers/Existing.pdf',{title:'Human title',notes:'SECRET_NOTES',tldr:'Human summary',tags:'#research/rl',bookmarked:true,published:'2020.7',status:'在读',priority:'高',venues:['Human venue'],bibtex:'@misc{synthetic, title={SECRET_BIBLIOGRAPHY}}',citationSource:'Human evidence'});put('collections.md',C.change(store.get('collections.md'),['papers/Existing.pdf'],{scope:'library',name:'Robotics'}));
  put('temp/2605.12345.pdf','%PDF synthetic');put('temp/2605.12345.skim','ANNO');
  service.enable('sk-test-key-123456');await service.listModels();const before=sources(),proposal=await service.organize('temp/2605.12345.pdf','en');assert.deepEqual(sources(),before,'Generation never writes sources');assert.equal(proposal.changes.title,'Synthetic Evidence Title');assert.equal(destroyed,1);assert.equal(proposal.coverage.pages.length,12);assert.equal(proposal.coverage.total,14);
  assert(!JSON.stringify(proposal).includes(evidence),'Preview must not retain PDF text');
  const dest=await service.apply(proposal),stored=E.parseLibrary(store.get('library.md')).find(r=>r.path===dest);assert(dest.endsWith('/2605.12345.pdf'));assert.equal(store.get(dest.replace('.pdf','.skim')),'ANNO');assert.equal(stored.tldr,good().tldr);assert.equal(stored.organizing,'AI 已整理');assert.equal(stored.bibtex,'');assert.equal(stored.citationSource,'');assert.equal(O.source(stored,'#research/rl',true).name,'DeepSeek');
  const existing=await service.organize('papers/Existing.pdf','en');assert.equal(existing.target,null);assert.equal(existing.changes.title,undefined);assert.equal(existing.changes.tldr,undefined);await service.apply(existing);let r=E.parseLibrary(store.get('library.md')).find(r=>r.path==='papers/Existing.pdf');assert.equal(E.decodeText(r.notes),'SECRET_NOTES');assert(r.bookmarked);assert.equal(r.tldr,'Human summary');assert.equal(r.published,'2020.7');assert.equal(r.status,'在读');assert.equal(r.priority,'高');assert.deepEqual(r.venues,['Human venue']);assert(r.bibtex.includes('SECRET_BIBLIOGRAPHY'));assert.equal(r.citationSource,'Human evidence');
  // Different previews remain applicable after another paper is filed.
  put('temp/B.pdf','%PDF B');put('temp/C.pdf','%PDF C');const b=await service.organize('temp/B.pdf','en'),c=await service.organize('temp/C.pdf','en');await service.apply(b);await service.apply(c);
  const stale=await service.organize('papers/Existing.pdf','en');update('papers/Existing.pdf',{notes:'SECRET_NOTES edited'});await assert.rejects(service.apply(stale),/paper changed/);
  update('papers/Existing.pdf',{organizing:'人工完成'});const count=requests;await assert.rejects(service.organize('papers/Existing.pdf','en'),/manually complete/);assert.equal(requests,count);
  await assert.rejects(service.organize('reviews/Secret.pdf','en'),/Only public/);await assert.rejects(service.organize('temp/../Escape.pdf','en'),/Only public/);
  put('temp/D.pdf','%PDF D');emptyPdf=true;const beforeEmpty=requests;await assert.rejects(service.organize('temp/D.pdf','en'),/No extractable/);assert.equal(requests,beforeEmpty);assert.equal(activePdfs,0);emptyPdf=false;
  responseValue=()=>({...good(),bibtex:'Fabricated'});await assert.rejects(service.organize('temp/D.pdf','en'),/Invalid AI response/);
  responseValue=()=>({...good(),tags:['#invented']});await assert.rejects(service.organize('temp/D.pdf','en'),/unknown tag/);
  responseValue=()=>({...good(),placement:{category:44,subgroup:''}});await assert.rejects(service.organize('temp/D.pdf','en'),/unknown category/);
  responseValue=()=>({...good(),title:'Fabricated unrelated title'});assert.equal((await service.organize('temp/D.pdf','en')).changes.title,undefined);
  responseValue=()=>({...good(),uncertainty:'Insufficient classification evidence.'});const unsure=await service.organize('temp/D.pdf','en');assert.equal(unsure.target,null);await assert.rejects(service.apply(unsure),/Complete: Categories/);
  responseValue=good;const rollback=await service.organize('temp/D.pdf','en');const beforeFailure=sources();failSource='collections.md';await assert.rejects(service.apply(rollback),/simulated/);failSource='';assert.deepEqual(sources(),beforeFailure);assert(files.has('temp/D.pdf'),'Failed filing restores the PDF');
  const editable=await service.organize('temp/D.pdf','en');dirty=true;await assert.rejects(service.apply(editable),/Save or cancel/);dirty=false;
  assert.equal(service.ask,undefined,'The removed Q&A API is not available');
  // Review is read-only; human edits are stamped separately from AI additions.
  responseValue=good;put('temp/Edit.pdf','%PDF edit');const edit=await service.organize('temp/Edit.pdf','en');const originalSources=sources();
  assert.deepEqual(edit.preview,{title:good().title,tldr:good().tldr,tags:'#research/rl',placements:[{scope:'library',name:'Robotics',subgroup:''}]});
  const human={title:'Reviewed title',tldr:'Human corrected summary',tags:'#research/rl #research/new-human'};
  assert.equal(service.review(edit,human).error,'');assert.deepEqual(sources(),originalSources);assert(!store.has('tags.md'));
  assert(service.review(edit,{tldr:''}).error);assert(service.review(edit,{tags:''}).error);assert(service.review(edit,{placements:[]}).error);assert(service.review(edit,{bibtex:'bad'}).error);
  const editDest=await service.apply(edit,human),edited=E.parseLibrary(store.get('library.md')).find(r=>r.path===editDest);
  assert.equal(edited.title,human.title);assert.equal(edited.tldr,human.tldr);assert.equal(O.source(edited,'title').kind,'human');assert.equal(O.source(edited,'tldr').kind,'human');assert.equal(O.source(edited,'#research/rl',true).kind,'ai');assert.equal(O.source(edited,'#research/new-human',true).kind,'human');assert(store.get('tags.md').includes('#research/new-human'));
  // Explicit review changes research memberships, preserving writing projects.
  put('collections.md',C.add(store.get('collections.md'),'library','ML'));
  put('collections.md',C.change(store.get('collections.md'),[editDest],{scope:'projects',name:'SECRET_WRITING_PROJECT'}));
  const more=await service.organize(editDest,'en');assert.equal(more.preview.title,'Reviewed title');assert.equal(more.preview.tldr,human.tldr);
  const both=[{scope:'library',name:'Robotics',subgroup:''},{scope:'library',name:'ML',subgroup:''}];await service.apply(more,{placements:both});
  const multi=await service.organize(editDest,'en');assert.equal(multi.preview.placements.length,2);await service.apply(multi,{placements:[both[1]],tags:'#research/new-human'});
  const member=C.parse(store.get('collections.md')).groups.filter(g=>g.members.some(m=>m.path===editDest));assert.deepEqual(member.map(g=>g.name).sort(),['ML','SECRET_WRITING_PROJECT']);
  const newrow=E.parseLibrary(store.get('library.md')).find(r=>r.path===editDest);assert.equal(newrow.tags,'#research/new-human');
  // A catalog write failure restores sources and the original inbox attachment.
  put('temp/Failure.pdf','%PDF rollback');const failure=await service.organize('temp/Failure.pdf','en'),sourceBefore=sources(),tagsBefore=store.get('tags.md');failSource='tags.md';
  await assert.rejects(service.apply(failure,{tags:'#research/rl #research/new-failing'}),/simulated/);failSource='';assert.deepEqual(sources(),sourceBefore);assert.equal(store.get('tags.md'),tagsBefore);assert(files.has('temp/Failure.pdf'));
  const invalid=await service.organize('temp/Failure.pdf','en');await assert.rejects(service.apply(invalid,{placements:[{scope:'library',name:'Missing',subgroup:''}]}),/category or subcategory changed/);
  responseValue=()=>({...good(),title:'Fabricated unrelated title',tags:[],tldr:'',placement:null});const incomplete=await service.organize('temp/Failure.pdf','en');assert.deepEqual(service.review(incomplete).missing,['篇名','TL;DR','标签','分类']);await assert.rejects(service.apply(incomplete),/Complete:/);
  // New taxonomy requires explicit reasons; generation stays read-only and only
  // reviewed/selected additions are committed in the same rollback boundary.
  responseValue=()=>({...good(),tags:['#research/new-domain'],placement:{category:null,name:'New domain',subgroup:'Theory'},novelty:{tags:[{tag:'#research/new-domain',reason:'No existing method tag matches.'}],categoryReason:'A distinct application domain.',subgroupReason:'A distinct theoretical method.'}});
  put('temp/Novel.pdf','%PDF novel');const noveltyBefore=sources(),novel=await service.organize('temp/Novel.pdf','en');assert.deepEqual(sources(),noveltyBefore);assert.equal(novel.taxonomy.category.name,'New domain');
  const novelDest=await service.apply(novel),novelRow=E.parseLibrary(store.get('library.md')).find(r=>r.path===novelDest);assert.equal(O.source(novelRow,'#research/new-domain',true).kind,'ai');assert(store.get('tags.md').includes('#research/new-domain'));
  const novelGroup=C.parse(store.get('collections.md')).groups.find(g=>g.name==='New domain');assert(novelGroup.subgroups.includes('Theory'));assert.equal(novelGroup.members.find(m=>m.path===novelDest).subgroup,'Theory');
  responseValue=()=>({...good(),placement:{category:null,name:'Unselected domain',subgroup:''},novelty:{tags:[],categoryReason:'No existing category fits.',subgroupReason:''}});
  put('temp/Reviewed.pdf','%PDF reviewed');const unselected=await service.organize('temp/Reviewed.pdf','en');await service.apply(unselected,{placements:[{scope:'library',name:'Robotics',subgroup:''}],tagAdditions:{groups:[{name:'Human draft group',tags:['#research/draft-unused']}]}});assert(!C.parse(store.get('collections.md')).groups.some(g=>g.name==='Unselected domain'));assert(store.get('tags.md').includes('#research/draft-unused'));
  responseValue=()=>({...good(),placement:{category:null,name:'No reason',subgroup:''}});await assert.rejects(service.organize('temp/Failure.pdf','en'),/needs a reason/);
  responseValue=()=>({...good(),placement:{category:0,subgroup:'No reason'}});await assert.rejects(service.organize('temp/Failure.pdf','en'),/needs a reason/);
  responseValue=()=>({...good(),tags:['#research/novel-failure'],placement:{category:null,name:'Rollback domain',subgroup:''},novelty:{tags:[{tag:'#research/novel-failure',reason:'Distinct method.'}],categoryReason:'Distinct domain.',subgroupReason:''}});
  const novelFailure=await service.organize('temp/Failure.pdf','en'),allBefore=[...sources(),store.get('tags.md')];failSource='tags.md';await assert.rejects(service.apply(novelFailure),/simulated/);failSource='';assert.deepEqual([...sources(),store.get('tags.md')],allBefore);assert(files.has('temp/Failure.pdf'));
  // Host requests cannot be aborted: cancellation drops late results and keeps
  // the one-request slot occupied until the host finishes, avoiding accumulation.
  responseValue=good;let resolveWire;requestOverride=()=>new Promise(resolve=>resolveWire=resolve);const cancellationBefore=sources(),pending=service.organize('temp/D.pdf','en');while(!resolveWire)await new Promise(resolve=>setImmediate(resolve));service.cancel();await assert.rejects(pending,/Cancelled/);await assert.rejects(service.organize('temp/D.pdf','en'),/current request/);assert(service.wire);resolveWire({status:200,text:'late'});await new Promise(resolve=>setImmediate(resolve));assert.equal(service.wire,null);assert.deepEqual(sources(),cancellationBefore);requestOverride=null;
  requestOverride=()=>{throw Error('secret sk-test-key-123456');};await assert.rejects(service.organize('temp/D.pdf','en'),e=>/Network request failed/.test(e.message)&&!e.message.includes('sk-test'));requestOverride=null;
  service.disable();assert.equal(service.key,'');assert.equal(service.enabled,false);assert(!service.busy);assert.equal(service.cancelRequest,null);
 }finally{service.close();plugin.pdfWork.close();}
 console.log('PASS: offline DeepSeek proposals, bounded PDF lifetime, protected fields, provenance, guarded filing/rollback, editable previews, catalog transactions, cancellation and redacted errors.');
})().catch(e=>{console.error(e);process.exitCode=1;});
