const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('./dashboard'),C=require('./collections');
class TFile{constructor(path){Object.assign(this,{path,name:path.split('/').pop(),extension:path.split('.').pop(),stat:{ctime:0,size:32}});}}
const store=new Map(['library.md','collections.md','reviews.md','submissions.md'].map(n=>[n,fs.readFileSync('templates/empty-vault/'+n,'utf8')]));
store.set('collections.md',C.add(C.add(store.get('collections.md'),'library','Category'),'projects','Project'));
const files=new Map([...store.keys()].map(n=>[n,new TFile(n)]));
let fail=false,copyCount=0;
const vault={getAbstractFileByPath:p=>files.get(p),getFiles:()=>[...files.values()],read:async f=>store.get(f.path),on(){},process:async(f,fn)=>{if(fail&&f.path==='collections.md')throw Error('Write failed');store.set(f.path,fn(store.get(f.path)));},adapter:{getBasePath:()=>'/synthetic-vault',exists:async()=>true,mkdir:async()=>{},write:async(n,t)=>store.set(n,t)}};
const workspace={getLeavesOfType:()=>[],on(){},onLayoutReady(fn){this.start=fn;}};
class Plugin{constructor(){this.app={vault,workspace};}registerView(){}addRibbonIcon(){}addCommand(){}registerObsidianProtocolHandler(){}registerEvent(){}}
const ctx={module:{exports:{}},setTimeout,clearTimeout,console,require:n=>n==='obsidian'?{Plugin,TFile,ItemView:class{},Modal:class{},Notice:class{hide(){}},Platform:{isDesktopApp:true,isMacOS:true}}:n==='electron'?{}:require(n)};
vm.runInNewContext(fs.readFileSync('main.js','utf8')+'\nmodule.exports.importer=InboxImport;',ctx);
ctx.module.exports.importer.importInboxFiles=async(base,inputs,{folder})=>{
 assert.equal(base,'/synthetic-vault');assert.equal(folder,'papers');copyCount++;
 return inputs.map(f=>{if(f.path.startsWith('/synthetic-vault/'))return {name:f.name,skipped:true,existingPath:f.path.slice('/synthetic-vault/'.length)};const path='papers/'+f.name;files.set(path,new TFile(path));return {path,name:f.name,attachments:0};});
};
(async()=>{
 const plugin=new ctx.module.exports();plugin.loadData=async()=>({openOnStartup:false,language:'zh'});await plugin.onload();await workspace.start();const navigations=[];plugin.openLibrary=async nav=>navigations.push(nav);
 const input={name:'2601.12345v1.PDF',path:'/external/2601.12345v1.PDF'};
 await plugin.importDroppedFiles([input],{scope:'library',category:'Category'});
 let r=plugin.snapshot.library[0];assert.equal(r.title,input.name);assert.equal(r.organizing,'待整理');assert.equal(r.tldr,'');assert.equal(r.tags,'');assert.equal(r.bibtex,'');assert.deepEqual([...r.categories],['Category']);assert.equal(copyCount,1);
 assert.deepEqual([...navigations.at(-1).revealPaths],[r.path]);
 assert([...store.keys()].some(p=>p.startsWith('.maintenance-backups/library-import-')));assert([...store.keys()].some(p=>p.startsWith('.maintenance-backups/collections-import-')));
 await plugin.importDroppedFiles([{...input,path:'/synthetic-vault/'+r.path}],{scope:'projects',category:'Project'});
 assert.equal(plugin.snapshot.library.length,1);r=plugin.snapshot.library[0];assert.deepEqual([...r.projects],['Project']);assert.deepEqual([...r.categories],['Category']);
 await plugin.editChild('add','library','Category',null,'Methods',C.childState(plugin.snapshot.collections.find(g=>g.name==='Category')));
 await plugin.importDroppedFiles([{...input,path:'/synthetic-vault/'+r.path}],{scope:'library',category:'Category',subgroup:'Methods'});
 assert.equal(plugin.snapshot.collections.find(g=>g.name==='Category').members[0].subgroup,'Methods');assert.equal(plugin.snapshot.library.length,1);
 assert.equal(navigations.at(-1).subgroup,'Methods');assert.deepEqual([...navigations.at(-1).revealPaths],[r.path]);
 await plugin.importDroppedFiles([{name:'Z.pdf',path:'/external/Z.pdf'},{name:'A.pdf',path:'/external/A.pdf'}],{scope:'library',category:'Category',subgroup:'Methods',stayInParent:true});
 assert.equal(navigations.at(-1).subgroup,undefined);assert.deepEqual([...navigations.at(-1).revealPaths],['papers/Z.pdf','papers/A.pdf']);
 const beforeInvalid=copyCount;await assert.rejects(plugin.importDroppedFiles([input],{scope:'library',category:'Category',subgroup:'Missing'}),/子类/);assert.equal(copyCount,beforeInvalid);
 const count=copyCount;await assert.rejects(plugin.importDroppedFiles([input],{scope:'library',category:'Missing'}));await assert.rejects(plugin.importDroppedFiles([input],{scope:'library'}));assert.equal(copyCount,count);
 const before=store.get('library.md'),collections=store.get('collections.md');fail=true;
 await assert.rejects(plugin.importDroppedFiles([{name:'Retained.pdf',path:'/external/Retained.pdf'}],{scope:'projects',category:'Project'}),/附件保留/);fail=false;
 assert.equal(store.get('library.md'),before);assert.equal(store.get('collections.md'),collections);assert(files.has('papers/Retained.pdf'));assert.equal(plugin.importing,false);assert.equal(plugin.ddlWriting,false);
 const actual=plugin.hasPendingEdit;plugin.hasPendingEdit=()=>true;await assert.rejects(plugin.importDroppedFiles([input],{scope:'library',category:'Category'}),/保存或取消/);plugin.hasPendingEdit=actual;
 plugin.onunload();console.log('PASS: direct category/project intake, paired source backups and rollback, preserved files on failure, existing-file membership reuse, invalid destinations and draft guards.');
})().catch(e=>{console.error(e);process.exitCode=1;});
