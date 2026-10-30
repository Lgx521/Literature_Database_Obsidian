'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const E=require('./dashboard'),C=require('./collections'),T=require('./tag-tree'),O=require('./organization'),Q=require('./pdf-work'),S=require('./sha256');
const I=require('./i18n');I.setLanguage('en');
const store=new Map(),files=new Map();let clock=0,failSource='',requests=0,destroyed=0,activePdfs=0,emptyPdf=false,pageCount=14,tagReads=0,lastPayload=null;
function folder(path){if(files.has(path))return files.get(path);const f={path,name:path.split('/').pop(),children:[]};files.set(path,f);if(path.includes('/')){f.parent=folder(path.slice(0,path.lastIndexOf('/')));f.parent.children.push(f);}return f;}
function put(path,value){store.set(path,value);let f=files.get(path);if(!f){f={path,name:path.split('/').pop(),extension:path.split('.').pop()};files.set(path,f);if(path.includes('/')){f.parent=folder(path.slice(0,path.lastIndexOf('/')));f.parent.children.push(f);}}f.stat={size:value.length,mtime:++clock};return f;}
for(const n of ['library.md','collections.md','reviews.md','submissions.md'])put(n,fs.readFileSync('templates/empty-vault/'+n,'utf8'));
folder('papers');folder('temp');
put('collections.md',C.add(store.get('collections.md'),'projects','SECRET_WRITING_PROJECT'));
put('reviews.md',store.get('reviews.md')+'\nSECRET_REVIEW');
const vault={getAbstractFileByPath:p=>files.get(p),read:async f=>{if(f.path==='tags.md')tagReads++;return store.get(f.path);},readBinary:async f=>new TextEncoder().encode(store.get(f.path)).buffer,
 create:async(p,t)=>{if(files.has(p))throw Error('collision');return put(p,t);},createFolder:async p=>{if(files.has(p))throw Error('collision');return folder(p);},
 process:async(f,fn)=>{if(f.path===failSource)throw Error('simulated write failure');return put(f.path,fn(store.get(f.path)));},
 rename:async(f,to)=>{if(files.has(to))throw Error('collision');const value=store.get(f.path);store.delete(f.path);files.delete(f.path);if(f.parent)f.parent.children=f.parent.children.filter(x=>x!==f);f.path=to;f.name=to.split('/').pop();f.parent=folder(to.slice(0,to.lastIndexOf('/')));f.parent.children.push(f);files.set(to,f);store.set(to,value);},
 delete:async f=>{files.delete(f.path);store.delete(f.path);},adapter:{exists:async p=>files.has(p),mkdir:async p=>folder(p),write:async(p,t)=>put(p,t)}};
let dirty=false;const plugin={app:{vault,workspace:{getLeavesOfType:()=>[]}},ready:true,stopped:false,hasPendingEdit:()=>dirty,recordAction:async fn=>{if(dirty)throw Error('dirty');return fn();},refresh:async()=>{},pdfWork:new Q()};
const evidence='Synthetic Evidence Title. The method uses reinforcement learning for robotic control. Evidence is limited to the supplied pages.'.repeat(50);
const loadPdfJs=async()=>({getDocument:()=>{activePdfs++;let done=false;return {promise:Promise.resolve({numPages:pageCount,getPage:async()=>({getTextContent:async()=>({items:[{str:emptyPdf?'':evidence}]}),cleanup(){}})}),destroy:async()=>{if(!done){done=true;destroyed++;activePdfs--;}}};}});
const good=()=>({title:'Synthetic Evidence Title',tldr:'A grounded synthetic summary.',tags:['#research/rl'],placement:{category:0,subgroup:''},uncertainty:''});
let responseValue=good,requestOverride=null;
const requestUrl=async request=>{
 if(request.method==='GET'){assert.equal(request.url,'https://api.deepseek.com/models');return {status:200,text:JSON.stringify({data:[{id:'provider-test-text'}]})};}
 requests++;assert.equal(activePdfs,0,'Release PDF resources before the network request');assert.equal(request.url,'https://api.deepseek.com/chat/completions');
 const body=JSON.parse(request.body);lastPayload=JSON.parse(body.messages[1].content);assert.equal(body.thinking.type,'disabled');assert.equal(body.response_format.type,'json_object');assert(body.max_tokens<=6000);
 if(body.max_tokens===6000){const payload=JSON.parse(body.messages[1].content);for(const p of payload.papers){assert(p.pages.length>2);assert.equal(p.pages.reduce((n,p)=>n+p.text.length,0),48000,'Planning uses the same excerpt budget as generation');}}
 assert(!request.body.includes('SECRET_BIBLIOGRAPHY'));assert(!request.body.includes('SECRET_NOTES'));assert(!request.body.includes('SECRET_REVIEW'));assert(!request.body.includes('SECRET_WRITING_PROJECT'));assert(!request.body.includes('sk-test-key-123456'));
 if(requestOverride)return requestOverride(request);
 return {status:200,text:JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(responseValue())}}],usage:{prompt_tokens:100,completion_tokens:50}})};
};
const Plan=require('./deepseek-plan')({TagTree:T,Collections:C,tr:I.t});
const runtime=require('./deepseek-beta')({Plan,Engine:E,Collections:C,TagTree:T,Organization:O,Sha256:S,CitationMetadata:require('./citation-metadata'),SourceTransaction:require('./source-transaction'),loadPdfJs,requestUrl,tr:I.t});
const service=new runtime.Service(plugin);
const sources=()=>[store.get('library.md'),store.get('collections.md')];
function add(path,changes={}){put(path,'%PDF synthetic');let text=E.addLibraryEntry(store.get('library.md'),path);const row=E.parseLibrary(text).find(r=>r.path===path);text=E.updateLibraryEntry(text,row,changes,{kind:'human',name:'user'});put('library.md',text);return E.parseLibrary(text).find(r=>r.path===path);}
function update(path,changes){const row=E.parseLibrary(store.get('library.md')).find(r=>r.path===path);put('library.md',E.updateLibraryEntry(store.get('library.md'),row,changes,{kind:'human',name:'user'}));}

const planned=()=>({categories:[{name:'Robotics',reason:'Shared robotics application.',subgroups:[{name:'RL',reason:'Policy learning.'}]}],papers:[0,1].map(index=>({index,title:'Synthetic Evidence Title',category:'Robotics',subgroup:'RL'}))});
const enriched=(tag='#research/rl',fresh=true)=>({title:good().title,tldr:good().tldr,tags:[tag],uncertainty:'',novelty:{tags:fresh?[{tag,reason:'Learning method not covered by existing tags.'}]:[]}});
(async()=>{
 service.enable('sk-test-key-123456');await service.listModels();put('temp/A.pdf','%PDF synthetic A');put('temp/B.pdf','%PDF synthetic B');
 put('tags.md',T.serialize({groups:[{name:'Vocabulary',tags:['#research/existing']}]}));
 const paths=['temp/A.pdf','temp/B.pdf'],before=new Map(store);responseValue=planned;
 const plan=await service.planInbox(paths,'en');assert.equal(requests,1);assert.equal(destroyed,2);assert.equal(activePdfs,0);assert.equal(tagReads,0,'Planning does not read the tag catalog');assert.deepEqual(store,before,'Planning performs no writes');
 assert(!('tags' in plan));assert(!('tags' in plan.base));assert(!JSON.stringify(lastPayload).includes('#research/'));assert(!JSON.stringify(plan).includes(evidence));assert.equal(plan.papers[0].subgroup,'RL');
 const fullBatch=Array.from({length:20},(_,index)=>({index,pages:[{page:1,text:'"'.repeat(48000)}]}));assert.equal(JSON.parse(Plan.messages({categories:[]},fullBatch,'en')[1].content).papers.length,20);assert.throws(()=>Plan.messages({categories:[{name:'x'.repeat(2000000)}]},fullBatch,'en'),/Select fewer/);
 const changed=Plan.edit(plan,{placements:{[paths[0]]:{category:'ML',subgroup:'General RL'},[paths[1]]:{category:'ml',subgroup:'general rl'}}});assert.equal(changed.categories.length,1);assert.equal(changed.categories[0].subgroups.length,1);assert(changed.papers.every(p=>p.category==='ML'&&p.subgroup==='General RL'));assert.equal(plan.papers[0].category,'Robotics');
 for(const bad of [{tags:[]},{papers:[planned().papers[0]]},{bibtex:'BAD'},{categories:[{name:'Robotics',reason:'new',subgroups:[{name:'RL',reason:'new'},{name:'rl',reason:'duplicate'}]}]}])assert.throws(()=>Plan.normalize({...planned(),...bad},plan.base,plan.papers),/Invalid taxonomy/);
 assert.throws(()=>Plan.normalize({...planned(),papers:planned().papers.map(p=>({...p,subgroup:'unknown'}))},plan.base,plan.papers),/Invalid taxonomy/);
 assert.throws(()=>Plan.edit(plan,{placements:{'temp/unknown.pdf':{category:'ML',subgroup:''}}}),/Invalid taxonomy/);assert.throws(()=>Plan.edit(plan,{placements:{[paths[0]]:{category:'',subgroup:''}}}),/Invalid taxonomy/);assert.throws(()=>Plan.edit(plan,{paperTags:{}}),/Invalid taxonomy/);
 await assert.rejects(service.organize(paths[0],'en',plan),/Confirm the taxonomy/);
 const withoutReasons=planned();for(const c of withoutReasons.categories){delete c.reason;for(const s of c.subgroups)delete s.reason;}const tolerant=Plan.normalize(withoutReasons,plan.base,plan.papers);assert.equal(tolerant.categories[0].reason,'');assert.equal(tolerant.categories[0].subgroups[0].reason,'');const acceptedPlan=await service.approvePlan({...plan,...tolerant});assert(acceptedPlan);
 const beforeApproval=tagReads,approved=await service.approvePlan(plan);assert.equal(tagReads,beforeApproval);assert.deepEqual(store,before);
 responseValue=()=>enriched();const first=await service.organize(paths[0],'en',approved);assert.equal(first.target.subgroup,'RL');assert.equal(first.taxonomy.category.name,'Robotics');assert.equal(first.taxonomy.subgroup.name,'RL');assert.equal(first.taxonomy.tags[0].tag,'#research/rl');assert.equal(service.review(first).error,'');assert.deepEqual(store,before);
 responseValue=()=>enriched('#research/rl',false);const second=await service.organize(paths[1],'en',approved);assert(lastPayload.existingTags.includes('#research/rl'),'Later papers reuse earlier draft tags');assert.equal(lastPayload.subgroup,'RL');assert.equal(second.taxonomy.tags[0].tag,'#research/rl');assert.deepEqual(store,before);
 // Tags can be removed/replaced in the second-step preview. Human edits get
 // human provenance while untouched proposed tags retain AI provenance.
 assert(service.review(first,{tags:''}).error);await service.apply(first,{tags:'#research/existing'});await service.apply(second);
 const groups=C.parse(store.get('collections.md')).groups.filter(g=>g.scope==='library');assert.equal(groups.length,1);assert.deepEqual(groups[0].subgroups,['RL']);assert(groups[0].members.every(m=>m.subgroup==='RL'));
 const rows=E.parseLibrary(store.get('library.md'));assert.equal(rows.length,2);assert(rows.every(r=>r.organizing==='AI 已整理'&&!r.bibtex&&!r.citationSource));assert.equal(O.source(rows[0],'#research/existing',true).kind,'human');assert.equal(O.source(rows[1],'#research/rl',true).kind,'ai');
 put('temp/C.pdf','%PDF C');put('temp/D.pdf','%PDF D');const later=['temp/C.pdf','temp/D.pdf'];responseValue=()=>{const p=planned();p.categories[0].name='robotics';p.categories[0].subgroups[0].name='rl';p.papers.forEach(p=>{p.category='ROBOTICS';p.subgroup='rL';});return p;};
 const reused=await service.planInbox(later,'en');assert(reused.categories[0].existing);assert(reused.categories[0].subgroups[0].existing);assert(reused.papers.every(p=>p.category==='Robotics'&&p.subgroup==='RL'));
 const ungrouped=Plan.edit(reused,{placements:{[later[0]]:{category:'Robotics',subgroup:''}}});assert.equal(ungrouped.papers[0].subgroup,'');assert.equal(ungrouped.papers[1].subgroup,'RL');
 const original=store.get('collections.md');put('collections.md',C.addChild(original,'library','Robotics','Human child'));await assert.rejects(service.approvePlan(reused),/Categories or subcategories changed/);put('collections.md',original);
 // A tag edit during step one is unrelated; generation uses fresh vocabulary.
 put('tags.md',T.serialize({groups:[{name:'Vocabulary',tags:['#research/new-existing']}]}));const current=await service.approvePlan(reused);responseValue=()=>enriched('#research/new-existing',false);assert.equal((await service.organize(later[0],'en',current)).preview.tags,'#research/new-existing');
 put('temp/C.pdf','%PDF changed');await assert.rejects(service.organize(later[0],'en',current),/inbox file changed/);
 responseValue=planned;const next=await service.planInbox(later,'en'),locked=await service.approvePlan(next);
 responseValue=()=>enriched('#research/unknown',false);await assert.rejects(service.organize(later[0],'en',locked),/unknown tag/);
 responseValue=()=>({...enriched(),placement:{category:99,subgroup:'BAD'}});await assert.rejects(service.organize(later[0],'en',locked),/Invalid AI response/);
 const req=requests;await assert.rejects(service.planInbox(['reviews/Secret.pdf'],'en'),/Select up to/);assert.equal(requests,req);emptyPdf=true;await assert.rejects(service.planInbox(later,'en'),/No extractable/);assert.equal(requests,req);emptyPdf=false;
 let finish;requestOverride=()=>new Promise(resolve=>{finish=resolve;});const cancel=service.planInbox(later,'en');while(!finish)await new Promise(r=>setImmediate(r));service.cancel();await assert.rejects(cancel,/Cancelled/);finish({status:200,text:'{}'});await new Promise(r=>setImmediate(r));assert.equal(activePdfs,0);assert.equal(service.wire,null);service.close();plugin.pdfWork.close();
 console.log('PASS: placement-only Inbox plans, canonical category/child reuse, editable assignments, fixed generation placement, second-step tags/provenance, shared draft vocabulary, guarded filing and cancellation.');
})().catch(e=>{service.close();plugin.pdfWork.close();console.error(e);process.exitCode=1;});
