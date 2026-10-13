const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path'),E=require('./dashboard');
const rowLine=(name='A',tail='')=>`| [${name}.pdf](papers/${name}.pdf) | 2024.1 | #research/rl | User TLDR | 在读 | 高 | User notes | User Venue | ${tail} |  |  |`;
const source='## 文献\n| '+E.TITLE_HEADERS.join(' | ')+' |\n| '+E.TITLE_HEADERS.map(()=> '---').join(' | ')+' |\n'+rowLine()+'\n<!-- library:end -->';
const tracker='## 暂存区\n| '+E.TRACKING_HEADERS.join(' | ')+' |\n| '+E.TRACKING_HEADERS.map(()=> '---').join(' | ')+' |\n<!-- tracking:end -->';
class TFile{constructor(n){this.path=n;this.name=n.split('/').pop();this.extension=n.split('.').pop();this.stat={ctime:0,size:100};}}
const store=new Map([['library.md',source],['reviews.md',tracker],['submissions.md',tracker]]),files=new Map([...store.keys(),'papers/A.pdf'].map(n=>[n,new TFile(n)]));
let pdfReads=0,requests=0,onRead=null,dirty=false;
const vault={getAbstractFileByPath:n=>files.get(n),getFiles:()=>[...files.values()],read:async f=>store.get(f.path),readBinary:async()=>{pdfReads++;if(onRead)await onRead();return new ArrayBuffer(1);},on(){},process:async(f,fn)=>store.set(f.path,fn(store.get(f.path))),adapter:{exists:async()=>true,mkdir:async()=>{},write:async(n,t)=>store.set(n,t)}};
const workspace={getLeavesOfType:()=>dirty?[{view:{dirty:()=>true}}]:[],on(){},onLayoutReady(callback){this.startup=callback;}};
class Plugin{constructor(){this.app={vault,workspace};}registerView(){}addRibbonIcon(){}addCommand(){}registerObsidianProtocolHandler(){}registerEvent(){}}
const title='An Actual Scientific Title';
const pdfjs={getDocument:()=>({promise:Promise.resolve({numPages:1,getMetadata:async()=>({info:{Title:title,Author:'Ada Lovelace',PublicationDate:'2024-01-10'}}),getPage:async()=>({getTextContent:async()=>({items:[{str:title+' Ada Lovelace',transform:[12,0,0,12,100,700],width:300}]}),getViewport:()=>({height:800}),cleanup(){}}),destroy:async()=>{}})})};
const mock={Plugin,ItemView:class{},Modal:class{},Notice:class{},Platform:{isDesktopApp:true,isMacOS:true},TFile,loadPdfJs:async()=>pdfjs,requestUrl:async()=>{requests++;throw Error('Network should not be needed');}};
const ctx={module:{exports:{}},require:n=>n==='obsidian'?mock:require(n),setTimeout,clearTimeout,console,URL,TextEncoder,TextDecoder};
const bundle=fs.readFileSync(path.join(__dirname,'../main.js'),'utf8');
assert(!bundle.includes('CitationImportModal'));assert(!bundle.includes('导入引用资料…'));
vm.runInNewContext(bundle,ctx);
(async()=>{
 const plugin=new ctx.module.exports();plugin.loadData=async()=>({language:'zh',openOnStartup:false});await plugin.onload();await workspace.startup();assert.equal(pdfReads,0,'No full-library scan at startup.');
 const before=plugin.snapshot.library[0];let result=await plugin.ensureCitationRows([before,before]);
 assert.equal(result.length,1);assert.equal(pdfReads,1);assert.equal(requests,0);assert.equal(result[0].title,title);assert(result[0].bibtex);assert.equal(result[0].citationError,'');
 assert.deepEqual([...result[0].cells.slice(0,8)],[...before.cells.slice(0,8)]);
 const existing=result[0].bibtex;await plugin.ensureCitationRows(result);assert.equal(pdfReads,1);assert.equal(plugin.snapshot.library[0].bibtex,existing);
 async function reset(){store.set('library.md',source);onRead=null;dirty=false;await plugin.refresh();}
 // Keep concurrent personal notes, never overwrite concurrent bibliographic edits.
 await reset();onRead=()=>store.set('library.md',E.updateLibraryEntry(store.get('library.md'),E.parseLibrary(store.get('library.md'))[0],{notes:'New notes'}));
 result=await plugin.ensureCitationRows(plugin.snapshot.library);assert.equal(result[0].notes,'New notes');assert(result[0].bibtex);
 await reset();onRead=()=>store.set('library.md',E.updateLibraryEntry(store.get('library.md'),E.parseLibrary(store.get('library.md'))[0],{title:'User corrected title'}));
 result=await plugin.ensureCitationRows(plugin.snapshot.library);assert(result[0].citationError.includes('其他窗口'));assert.equal(E.parseLibrary(store.get('library.md'))[0].title,'User corrected title');assert.equal(E.parseLibrary(store.get('library.md'))[0].bibtex,'');
 await reset();dirty=true;result=await plugin.ensureCitationRows(plugin.snapshot.library);assert(result[0].citationError.includes('未保存'));assert.equal(store.get('library.md'),source);dirty=false;
 await reset();let cancelled=false;onRead=()=>{cancelled=true;};result=await plugin.ensureCitationRows(plugin.snapshot.library,()=>{},{cancelled:()=>cancelled});assert.equal(result.length,0);assert.equal(store.get('library.md'),source);
 await reset();const oldReads=pdfReads;result=await plugin.ensureCitationRows(plugin.snapshot.library,()=>{},{titleOnly:true});assert.equal(result[0].title,title);assert.equal(result[0].bibtex,'');assert.equal(pdfReads,oldReads+1);
 await plugin.ensureCitationRows(result,()=>{},{titleOnly:true});assert.equal(pdfReads,oldReads+1);
 // Existing custom keys, raw BibTeX and source remain byte-for-byte intact.
 await reset();store.set('library.md',E.updateLibraryEntry(source,E.parseLibrary(source)[0],{bibtex:'@misc{UserStableKey,title={User Record Title},author={Doe, Jane},year={2022}}',citationSource:'User original source'}));await plugin.refresh();
 const supplied=plugin.snapshot.library[0];const reads=pdfReads;result=await plugin.ensureCitationRows([supplied]);assert.equal(pdfReads,reads);assert.equal(result[0].bibtex,supplied.bibtex);assert.equal(result[0].citationSource,supplied.citationSource);assert.equal(result[0].title,'User Record Title');
 // New public rows trigger once. Reloads and unrelated metadata changes do not retry.
 const newSource=store.get('library.md').replace('<!-- library:end -->',rowLine('B')+'\n<!-- library:end -->');files.set('papers/B.pdf',new TFile('papers/B.pdf'));store.set('library.md',newSource);await plugin.refresh();await plugin.citationQueue;
 assert(plugin.snapshot.library.find(r=>r.path==='papers/B.pdf').bibtex);const intakeReads=pdfReads;await plugin.refresh();await plugin.citationQueue;assert.equal(pdfReads,intakeReads);
 // Removing a PDF while a fetch is pending must not restore a deleted row.
 await reset();onRead=()=>store.set('library.md',E.removeRecord(store.get('library.md'),'library',E.parseLibrary(store.get('library.md'))[0]));result=await plugin.ensureCitationRows(plugin.snapshot.library);assert(result[0].citationError);assert.equal(E.parseLibrary(store.get('library.md')).length,0);
 plugin.onunload();console.log('PASS: automatic intake, lazy startup/cache, original fields and keys, title-only export, concurrent Notes/bibliography edits, dirty drafts, cancellation and deleted records.');
})().catch(e=>{console.error(e);process.exitCode=1;});
