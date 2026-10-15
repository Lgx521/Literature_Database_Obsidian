'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const E=require('./dashboard'),C=require('./collections'),T=require('./tag-tree'),O=require('./organization'),Q=require('./pdf-work'),S=require('./sha256');
const I=require('./i18n');I.setLanguage('en');
const store=new Map(),files=new Map();let clock=0,failSource='',requests=0,destroyed=0,activePdfs=0,emptyPdf=false,pageCount=14;
function folder(path){if(files.has(path))return files.get(path);const f={path,name:path.split('/').pop(),children:[]};files.set(path,f);if(path.includes('/')){f.parent=folder(path.slice(0,path.lastIndexOf('/')));f.parent.children.push(f);}return f;}
function put(path,value){store.set(path,value);let f=files.get(path);if(!f){f={path,name:path.split('/').pop(),extension:path.split('.').pop()};files.set(path,f);if(path.includes('/')){f.parent=folder(path.slice(0,path.lastIndexOf('/')));f.parent.children.push(f);}}f.stat={size:value.length,mtime:++clock};return f;}
for(const n of ['library.md','collections.md','reviews.md','submissions.md'])put(n,fs.readFileSync('templates/empty-vault/'+n,'utf8'));
folder('papers');folder('temp');
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
 const body=JSON.parse(request.body);assert.equal(body.thinking.type,'disabled');assert.equal(body.response_format.type,'json_object');assert(body.max_tokens<=6000);
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

const planned=()=>({categories:[{name:'Robotics',reason:'Shared robotics application.'}],tags:[{tag:'#research/rl',reason:'Shared learning method.'}],papers:[0,1].map(index=>({index,title:'Synthetic Evidence Title',category:'Robotics',tags:['#research/rl']}))});
(async()=>{
 service.enable('sk-test-key-123456');await service.listModels();put('temp/A.pdf','%PDF synthetic A');put('temp/B.pdf','%PDF synthetic B');
 const paths=['temp/A.pdf','temp/B.pdf'],before=new Map(store);responseValue=planned;
 const plan=await service.planInbox(paths,'en');assert.equal(requests,1);assert.equal(destroyed,2);assert.equal(activePdfs,0);assert.deepEqual(store,before,'Planning does not write taxonomy, metadata, backups or move PDFs');
 assert(!JSON.stringify(plan).includes(evidence),'No retained PDF excerpts');assert.equal(plan.categories[0].existing,false);assert.equal(plan.papers.length,2);
 const normalized=Plan.edit(plan,{categories:{Robotics:'ML'}});assert.equal(normalized.papers[0].category,'ML');assert.equal(plan.papers[0].category,'Robotics');
 await assert.rejects(service.organize(paths[0],'en',plan),/Confirm the taxonomy/);
 const approved=await service.approvePlan(plan);assert.deepEqual(store,before,'Confirmation alone does not write');
 responseValue=()=>{const {placement,...value}=good();return {...value,uncertainty:''};};const proposals=[];for(const path of paths)proposals.push(await service.organize(path,'en',approved));assert.equal(requests,3);assert.deepEqual(store,before);
 for(const p of proposals){assert.equal(p.taxonomy.category.name,'Robotics');assert.equal(p.taxonomy.tags[0].tag,'#research/rl');assert.equal(service.review(p).error,'');}
 for(const p of proposals)await service.apply(p);
 assert.equal(C.parse(store.get('collections.md')).groups.filter(g=>g.scope==='library').length,1,'One new category for the entire batch');
 const rows=E.parseLibrary(store.get('library.md'));assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.path.split('/').pop()).sort(),['A.pdf','B.pdf']);assert(rows.every(r=>r.organizing==='AI 已整理'&&r.tldr&&r.tags==='#research/rl'));assert(rows.every(r=>!r.bibtex&&!r.citationSource));
 // Existing taxonomy is reused with its exact spelling, even if the model varies case.
 put('temp/C.pdf','%PDF C');put('temp/D.pdf','%PDF D');const later=['temp/C.pdf','temp/D.pdf'];responseValue=()=>{const p=planned();p.categories[0].name='robotics';p.tags[0].tag='#research/RL';p.papers.forEach(p=>{p.category='ROBOTICS';p.tags=['#research/RL'];});return p;};
 const reused=await service.planInbox(later,'en');assert(reused.categories[0].existing);assert(reused.tags[0].existing);assert.equal(reused.categories[0].name,'Robotics');assert.equal(reused.tags[0].tag,'#research/rl');
 const echo=planned();echo.categories.push({name:'Unused example',reason:'Unused'});echo.tags=['#research/rl'];assert.equal(Plan.normalize(echo,reused.base,reused.papers).categories.length,1);assert.throws(()=>Plan.normalize({...echo,tags:['#research/new-without-reason']},reused.base,reused.papers),/Invalid taxonomy/);
 // Explicitly mapping synonyms merges this batch, without renaming global taxonomy.
 const merge={...planned(),categories:[{name:'Robot Learning',reason:'Example A'},{name:'Robotic Control',reason:'Example B'}],tags:[{tag:'#research/reinforcement-learning',reason:'Example A'},{tag:'#research/policy-learning',reason:'Example B'}]};merge.papers.forEach((p,i)=>{p.category=merge.categories[i].name;p.tags=[merge.tags[i].tag];});
 const m={...Plan.normalize(merge,reused.base,reused.papers),base:reused.base};const merged=Plan.edit(m,{categories:{'Robot Learning':'Robotics','Robotic Control':'Robotics'},tags:{'#research/reinforcement-learning':'#research/rl','#research/policy-learning':'#research/rl'}});assert.deepEqual(merged.humanTags,['#research/rl']);assert.equal(merged.categories.length,1);assert.equal(merged.tags.length,1);assert(merged.papers.every(p=>p.category==='Robotics'&&p.tags[0]==='#research/rl'));assert.equal(C.parse(store.get('collections.md')).groups.filter(g=>g.scope==='library').length,1);
 const mappedPlan=await service.approvePlan(reused,{tags:{'#research/rl':'#research/reinforcement-learning'}});
 responseValue=()=>({title:good().title,tldr:good().tldr,uncertainty:'',tags:['#research/reinforcement-learning']});const humanProposal=await service.organize(later[0],'en',mappedPlan);const humanDestination=await service.apply(humanProposal);assert.equal(O.source(E.parseLibrary(store.get('library.md')).find(r=>r.path===humanDestination),'#research/reinforcement-learning',true).kind,'human');
 // Start a fresh pair after that explicit application.
 put('temp/C.pdf','%PDF C again');responseValue=planned;const reusedCurrent=await service.planInbox(later,'en');
 const original=store.get('collections.md');put('collections.md',C.add(original,'library','New human category'));await assert.rejects(service.approvePlan(reusedCurrent),/Categories or tags changed/);put('collections.md',original);
 const fresh=await service.approvePlan(reusedCurrent);put('temp/C.pdf','%PDF changed');await assert.rejects(service.organize(later[0],'en',fresh),/inbox file changed/);
 responseValue=planned;const next=await service.planInbox(later,'en'),locked=await service.approvePlan(next);
 responseValue=()=>({title:good().title,tldr:good().tldr,uncertainty:'',tags:['#research/unknown']});await assert.rejects(service.organize(later[0],'en',locked),/unknown tag/);
 responseValue=()=>({...good(),placement:{category:99,subgroup:''}});await assert.rejects(service.organize(later[0],'en',locked),/Invalid AI response/);
 responseValue=()=>({...planned(),papers:[planned().papers[0]]});await assert.rejects(service.planInbox(later,'en'),/Invalid taxonomy plan/);
 responseValue=()=>({...planned(),bibtex:'BAD'});await assert.rejects(service.planInbox(later,'en'),/Invalid taxonomy plan/);
 const req=requests;await assert.rejects(service.planInbox(['reviews/Secret.pdf'],'en'),/Select up to/);assert.equal(requests,req);emptyPdf=true;await assert.rejects(service.planInbox(later,'en'),/No extractable/);assert.equal(requests,req);emptyPdf=false;
 let finish;requestOverride=()=>new Promise(resolve=>{finish=resolve;});const cancel=service.planInbox(later,'en');while(!finish)await new Promise(r=>setImmediate(r));service.cancel();await assert.rejects(cancel,/Cancelled/);finish({status:200,text:'{}'});await new Promise(r=>setImmediate(r));assert.equal(activePdfs,0);assert.equal(service.wire,null);service.close();plugin.pdfWork.close();
 console.log('PASS: batch-first planning, explicit confirmation, shared taxonomy, canonical reuse/merge, bounded PDF lifetime, stale/cancel guards, protected fields and two-paper filing.');
})().catch(e=>{service.close();plugin.pdfWork.close();console.error(e);process.exitCode=1;});
