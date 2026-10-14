'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const hash=require('./sha256');
for(const value of ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(10000), '中文 🚀\n#research/rl', '\ud800x\udfff', 'e\u0301', ...Array.from({length:40},()=>crypto.randomBytes(200).toString('utf8'))])assert.equal(hash(value),crypto.createHash('sha256').update(value).digest('hex'));
class TFile{constructor(path){Object.assign(this,{path,name:path.split('/').pop(),extension:path.split('.').pop(),stat:{ctime:1,mtime:1,size:64}});}}
const store=new Map(['library.md','collections.md','reviews.md','submissions.md'].map(n=>[n,fs.readFileSync('templates/empty-vault/'+n,'utf8')]));
const files=new Map([...store.keys()].map(n=>[n,new TFile(n)])),folders=new Set(),buffers=new Map(),notices=[],opened=[];
let failPath='';
const adapter={
 exists:async p=>store.has(p)||buffers.has(p)||folders.has(p),mkdir:async p=>folders.add(p),write:async(p,t)=>store.set(p,t),read:async p=>store.get(p),
 list:async p=>({files:[...buffers.keys(),...store.keys()].filter(n=>n.slice(0,n.lastIndexOf('/'))===p),folders:[...folders].filter(n=>n.slice(0,n.lastIndexOf('/'))===p)}),
 stat:async p=>files.get(p)?.stat,readBinary:async p=>buffers.get(p),
 rename:async(a,b)=>{if(buffers.has(b))throw Error('Exists');buffers.set(b,buffers.get(a));buffers.delete(a);files.delete(a);files.set(b,new TFile(b));}
};
const vault={adapter,on(){},getAbstractFileByPath:p=>files.get(p),getFiles:()=>[...files.values()],read:async f=>store.get(f.path),readBinary:async f=>buffers.get(f.path),process:async(f,fn)=>store.set(f.path,fn(store.get(f.path))),createFolder:async p=>{if(folders.has(p))throw Error('Exists');folders.add(p);},createBinary:async(p,b)=>{if(p===failPath)throw Error('Storage unavailable');if(await adapter.exists(p))throw Error('Exists');buffers.set(p,b);files.set(p,new TFile(p));return files.get(p);}};
const workspace={getLeavesOfType:()=>[],on(){},onLayoutReady(fn){this.start=fn;},getLeaf:()=>({openFile:async f=>opened.push(f.path)})};
class Plugin{constructor(){this.app={vault,workspace};}registerView(){}addRibbonIcon(){}addCommand(){}registerObsidianProtocolHandler(){}registerEvent(){}register(){}}
const title='Verified Synthetic Paper';
const pdfjs={getDocument:()=>({promise:Promise.resolve({numPages:1,getMetadata:async()=>({info:{Title:title,Author:'Ada Lovelace',PublicationDate:'2026-05-14'}}),getPage:async()=>({getTextContent:async()=>({items:[{str:title+' Ada Lovelace',transform:[12,0,0,12,100,700],width:300}]}),getViewport:()=>({height:800}),cleanup(){}}),destroy:async()=>{}})})};
const api={Plugin,TFile,ItemView:class{},Modal:class{},Notice:class{constructor(m){notices.push(m);}hide(){}},Platform:{isMobile:true,isMobileApp:true,isIosApp:true,isPhone:true,isMacOS:true,isDesktopApp:false},loadPdfJs:async()=>pdfjs,requestUrl:async()=>{throw Error('No test network');}};
const ctx={module:{exports:{}},setTimeout,clearTimeout,console,TextEncoder,TextDecoder,URL,Blob,
 require:name=>{assert.equal(name,'obsidian','Mobile must not require Node/Electron: '+name);return api;}};
vm.runInNewContext(fs.readFileSync('main.js','utf8')+'\nmodule.exports.testing={Engine,Collections,TagTree,MobileImport,getCitations,parse:JSON.parse};',ctx);
const {Engine:E,Collections:C,MobileImport:M,getCitations}=ctx.module.exports.testing;
vault.create=async(path,text)=>{if(await adapter.exists(path))throw Error('Exists');store.set(path,text);files.set(path,new TFile(path));return files.get(path);};
store.set('collections.md',C.add(C.add(store.get('collections.md'),'library','Mobile'),'projects','Writing'));
const input=(name,text='%PDF synthetic')=>({name,arrayBuffer:async()=>new TextEncoder().encode(text).buffer});
(async()=>{
 const p=new ctx.module.exports();p.loadData=async()=>({language:'en',openOnStartup:false});await p.onload();await workspace.start();p.openLibrary=async()=>{};
 assert(p.ready);assert.equal(p.lastError,'');
 await p.importDroppedFiles([input('2605.12345v1.pdf'),input('2605.12345v1.skim','notes')],{scope:'library',category:'Mobile'});
 await p.citationQueue;
 let r=p.snapshot.library[0];assert.equal(r.filename,'2605.12345v1.pdf');assert.equal(r.organizing,'自动整理');assert.equal(r.published,'2026.5');assert.equal(r.title,title);assert(r.bibtex);assert.deepEqual([...r.categories],['Mobile']);assert(buffers.has('papers/2605.12345v1.skim'));
 await p.importDroppedFiles([input('2605.12345v1.pdf')],{scope:'projects',category:'Writing'});
 await p.citationQueue;
 assert.equal(p.snapshot.library.length,2);assert.equal(p.snapshot.library[1].path,'papers/import-2/2605.12345v1.pdf');
 await p.mutate('library.md',text=>E.updateLibraryEntry(text,r,{title:'Verified Synthetic Paper',notes:'Mobile notes\n第二行',status:'在读',organizing:'人工完成',tags:'#human'},{kind:'human',name:'user'}));
 const T=ctx.module.exports.testing.TagTree;let catalog=T.addGroup({groups:[]},'Mobile tags');catalog=T.addTag(catalog,'Mobile tags',null,'unused').model;
 const firstCatalog=await T.save(p,null,catalog);catalog=T.addTag(catalog,'Mobile tags','#research/unused','child').model;await T.save(p,firstCatalog,catalog);
 assert((await T.read(vault)).model.groups[0].tags.includes('#research/unused/child'));assert(!p.snapshot.library[0].tags.includes('unused'),'Catalog creation must not assign tags');
 r=p.snapshot.library[0];assert.equal(r.organizing,'人工完成');assert.equal(E.Organization.source(r,'#human',true).kind,'human');assert.equal(E.decodeText(r.notes),'Mobile notes\n第二行');
 await p.mutate('library.md',text=>E.updateLibraryEntry(text,r,{bookmarked:true},{kind:'human',name:'user'}));
 r=p.snapshot.library[0];assert.equal(r.bookmarked,true);assert.equal(E.groupLibrary(E.filterLibrary(p.snapshot.library,{bookmarked:true}),p.snapshot.categories).length,1);
 await p.openPDF(r.path);assert.deepEqual(opened,[r.path]);
 await p.importDroppedFiles([input('Private.pdf')],{scope:'reviews'});assert.equal(p.snapshot.reviews.length,1);assert.equal(p.snapshot.library.length,2);assert(buffers.has('reviews/_staging/Private.pdf'));
 // Existing local bibliography and deterministic formats work with no Node or process global.
 const cite=getCitations(),data={type:'document',title:'Verified Synthetic Paper',author:[{family:'Lovelace',given:'Ada'}],issued:{'date-parts':[[2026,5]]}};
 const ref=cite.fromCsl(ctx.module.exports.testing.parse(JSON.stringify(data)),'synthetic');for(const format of ['bibtex','apa','ieee','titles']){const out=cite.exportRows([{...r,...ref}],format);assert.equal(out.ready,1);assert(/verified synthetic paper/i.test(out.text.replace(/[{}]/g,'')),format+': '+out.text);}
 // Browser File import never escapes, overwrites or silently mismatches annotations.
 let result=await M.importFiles(vault,[input('../Escape.pdf')]);assert(result[0].error);assert(!buffers.has('Escape.pdf'));
 result=await M.importFiles(vault,[input('A.pdf'),input('a.PDF'),input('A.skim')]);assert(result.every(x=>x.error));
 failPath='temp/Interrupted.pdf';result=await M.importFiles(vault,[input('Interrupted.pdf'),input('Interrupted.skim')]);assert(result[0].error);assert(buffers.has('temp/Interrupted.skim'));assert(!buffers.has(failPath));failPath='';
 result=await M.importFiles(vault,[input('Interrupted.pdf'),input('Interrupted.skim')]);assert.equal(result[0].path,'temp/import-2/Interrupted.pdf');
 // Same non-Node vault adapter supports recoverable deletion and restoration.
 const receipt=await p.trashStore.remove('library',p.snapshot.library[0]);assert.equal(p.snapshot.library.length,1);assert(!buffers.has(r.path));await p.trashStore.restore(receipt.folder,receipt);assert.equal(p.snapshot.library.length,2);assert(buffers.has(r.path));assert.equal(p.snapshot.library.find(row=>row.path===r.path).bookmarked,true);
 p.onunload();console.log('PASS: mobile startup, browser imports and annotations, collision/error recovery, metadata/Notes/provenance, PDF opening, reviews, trash/restore and all citation formats without Node/Electron globals.');
})().catch(error=>{console.error(error);process.exitCode=1;});
