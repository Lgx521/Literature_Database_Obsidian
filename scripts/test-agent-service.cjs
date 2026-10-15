'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),os=require('node:os'),vm=require('node:vm');
(async()=>{
 const root=await fsp.realpath(await fsp.mkdtemp(path.join(os.tmpdir(),'ldb-agent-service-'))),files=new Map();
 class TFile{constructor(p,s){this.path=p;this.name=p.split('/').pop();this.extension=p.split('.').pop();this.stat={size:s.size,mtime:s.mtimeMs,ctime:s.ctimeMs};}}
 const index=async p=>{const file=new TFile(p,await fsp.stat(path.join(root,p)));files.set(p,file);return file;};
 const write=async(p,t)=>{await fsp.mkdir(path.dirname(path.join(root,p)),{recursive:true});await fsp.writeFile(path.join(root,p),t);return index(p);};
 for(const name of ['library.md','collections.md','reviews.md','submissions.md'])await write(name,await fsp.readFile('templates/empty-vault/'+name));
 await fsp.mkdir(path.join(root,'papers'));
 await write('temp/Original.pdf','%PDF Synthetic Evidence Title');await write('temp/Original.skim','user annotations');
 const adapter={getBasePath:()=>root,exists:async p=>fsp.stat(path.join(root,p)).then(()=>true,()=>false),mkdir:async p=>fsp.mkdir(path.join(root,p),{recursive:true}),write:async(p,t)=>write(p,t)};
 const vault={adapter,getName:()=> 'Test',getAbstractFileByPath:p=>files.get(p),getFiles:()=>[...files.values()],on(){},read:async f=>fsp.readFile(path.join(root,f.path),'utf8'),readBinary:async f=>{const b=await fsp.readFile(path.join(root,f.path));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);},create:write,createFolder:async p=>fsp.mkdir(path.join(root,p),{recursive:true}),delete:async f=>{await fsp.unlink(path.join(root,f.path));files.delete(f.path);},process:async(f,fn)=>{const result=fn(await vault.read(f));await fsp.writeFile(path.join(root,f.path),result);await index(f.path);},rename:async(f,to)=>{await fsp.rename(path.join(root,f.path),path.join(root,to));files.delete(f.path);f.path=to;f.name=to.split('/').pop();files.set(to,f);}};
 const workspace={getLeavesOfType:()=>[],on(){},onLayoutReady(fn){this.start=fn;}};
 class Plugin{constructor(){this.app={vault,workspace};this.manifest={version:'test'};}registerView(){}addRibbonIcon(){}addCommand(){}registerObsidianProtocolHandler(){}registerEvent(){}}
 let extracted=0;
 const api={Plugin,TFile,ItemView:class{},Modal:class{},Notice:class{},Platform:{isDesktopApp:true,isMacOS:process.platform==='darwin',isMobile:false},loadPdfJs:async()=>({getDocument:()=>({promise:Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>{extracted++;return {items:[{str:'Synthetic Evidence Title. This is the actual paper text.'}]};},cleanup(){}})}),destroy:async()=>{}})})};
 const deviceHome=path.join(root,'.test-device');await fsp.mkdir(deviceHome);const preferences=new Map();
 const context={module:{exports:{}},Buffer,process,console,TextEncoder,TextDecoder,URL,setTimeout,clearTimeout,localStorage:{getItem:k=>preferences.get(k),setItem:(k,v)=>preferences.set(k,v)},require:n=>n==='obsidian'?api:n==='node:os'?{...os,homedir:()=>deviceHome}:require(n)};
 vm.runInNewContext(fs.readFileSync('main.js','utf8')+'\nmodule.exports.test={AgentMcpService,AgentMigration,Engine,Collections,Organization};',context);
 const Manager=context.module.exports,{Engine:E,Collections:C,Organization:O}=Manager.test;
 await write('collections.md',C.add(await vault.read(files.get('collections.md')),'library','Research'));
 const p=new Manager();p.loadData=async()=>({openOnStartup:false});await p.onload();await workspace.start();
 // Keep this offline: the MCP read/organize test never invokes citation lookup.
 p.ensureCitationRows=async()=>[];const s=p.agentMcp,call=(name,args={})=>s.call(name,args);
 try{
  assert(!s.running);const ctx=await call('library_context');assert(ctx.collections.some(g=>g.name==='Research'));
  let inbox=(await call('list_papers',{scope:'inbox'})).papers;assert.equal(inbox.length,1);
  await assert.rejects(call('read_paper',{path:'reviews/Secret.pdf'}),/public/);await assert.rejects(call('read_paper',{path:'temp/../Secret.pdf'}),/public/);
  await call('read_paper',{path:inbox[0].path});assert.equal(extracted,1);
  await assert.rejects(call('file_inbox',{path:inbox[0].path,revision:'stale',target:{scope:'library',name:'Research'}}),/changed/);
  const archived=await call('file_inbox',{path:inbox[0].path,revision:inbox[0].revision,target:{scope:'library',name:'Research'}});
  assert(archived.path.endsWith('/Original.pdf'));assert.equal(await fsp.readFile(path.join(root,archived.path.replace('.pdf','.skim')),'utf8'),'user annotations');assert(!files.has('temp/Original.pdf'));
  let row=(await call('list_papers',{scope:'pending'})).papers[0];assert.equal(row.collections[0].name,'Research');
  await assert.rejects(call('enrich_paper',{path:row.path,revision:row.revision,tldr:'Without reading'}),/Read this paper/);
  await call('read_paper',{path:row.path});
  await assert.rejects(call('enrich_paper',{path:row.path,revision:row.revision,title:'Fabricated Unrelated Title'}),/first page/);
  await assert.rejects(call('enrich_paper',{path:row.path,revision:row.revision,bibtex:'Invented'}),/Unsupported/);
  await call('enrich_paper',{path:row.path,revision:row.revision,title:'Synthetic Evidence Title',tldr:'A summary based on the evidence.',tags:['#research/rl/online'],complete:true});
  assert.equal((await call('list_papers',{scope:'pending'})).papers.length,0);
  let stored=E.parseLibrary(await vault.read(files.get('library.md')))[0];assert.equal(O.source(stored,'#research/rl/online',true).kind,'ai');assert.equal(stored.bibtex,'');
  await p.mutate('library.md',text=>E.updateLibraryEntry(text,stored,{notes:'Private notes',bookmarked:true,organizing:'人工完成',tags:stored.tags+' #research/user'},{kind:'human',name:'user'}));
  row=(await call('list_papers',{scope:'library'})).papers[0];assert(!JSON.stringify(row).includes('Private notes'));
  await assert.rejects(call('enrich_paper',{path:row.path,revision:row.revision,tldr:'Overwrite'}),/manually complete/);
  const previous=await vault.read(files.get('library.md')),proposal=await call('propose_tag_rename',{tag:'#research/rl',name:'reinforcement'});assert.equal(await vault.read(files.get('library.md')),previous);
  await s.applyProposal(proposal.proposal);stored=E.parseLibrary(await vault.read(files.get('library.md')))[0];assert(stored.tags.includes('#research/reinforcement/online'));assert.equal(stored.notes,'Private notes');assert(stored.bookmarked);
  const output=await call('export_references',{paths:[row.path],format:'titles'});assert.equal(output.text,'Synthetic Evidence Title');assert.equal((await call('library_audit')).missing_pdfs.length,0);
  if(process.platform==='darwin'){
    const exported=await fsp.realpath(await fsp.mkdtemp(path.join(os.tmpdir(),'ldb-source-export-')));
    try{
      await fsp.mkdir(path.join(exported,'files/42'),{recursive:true});await fsp.writeFile(path.join(exported,'files/42/2601.12345.pdf'),'%PDF exported paper');await fsp.writeFile(path.join(exported,'files/42/2601.12345.skim'),'exported annotations');
      const bib='@article{trusted_export, title={Actual Exported Title}, author={Doe, Jane}, year={2026}, journal={Journal}, file={Full Text PDF:files/42/2601.12345.pdf:application/pdf}}';
      await fsp.writeFile(path.join(exported,'Export.bib'),bib);s.grant=await Manager.test.AgentMigration.scan(exported);
      const scanned=(await call('migration_scan')).files[0],imported=await call('migration_import',{file:scanned.file,revision:scanned.revision,target:{scope:'library',name:'Research'}});
      assert(imported.path.endsWith('2601.12345.pdf'));assert.equal(imported.warning,'');await index(imported.path);await index(imported.path.replace('.pdf','.skim'));
      const migrated=E.parseLibrary(await vault.read(files.get('library.md'))).find(r=>r.path===imported.path);assert.equal(migrated.bibtex,bib);assert.equal(migrated.title,'Actual Exported Title');assert.equal(migrated.published,'2026');assert(migrated.citationSource.includes('sha256:'));assert.equal(await fsp.readFile(path.join(root,imported.path.replace('.pdf','.skim')),'utf8'),'exported annotations');
      const duplicate=await call('migration_import',{file:scanned.file,revision:scanned.revision,target:{scope:'library',name:'Research'}});assert.equal(duplicate.duplicate,imported.path);
      assert(await fsp.stat(path.join(exported,'files/42/2601.12345.pdf')),'Source export remains intact');
    }finally{await fsp.rm(exported,{recursive:true,force:true});}
  }
  p.recordBusy=true;await assert.rejects(call('enrich_paper',{path:row.path,revision:row.revision,tldr:'busy'}),/Save open edits/);p.recordBusy=false;
  await s.stop();await assert.rejects(call('library_context'),/initialized/);
  // Explicit project setup starts only this synthetic vault. Reload keeps the
  // connection ID/config and restores this device's descriptor; disable revokes it.
  await s.prepareCodex();assert(s.running&&s.codexRegistration);const configured=await fsp.readFile(path.join(root,'.codex/config.toml'),'utf8'),descriptor=s.codexRegistration.file;
  assert(!configured.includes(s.running.token));assert.equal(s.config().codex,true);
  await s.stop(false);await assert.rejects(fsp.stat(descriptor),{code:'ENOENT'});assert.equal(s.config().enabled,true);
  await s.resume();assert(s.running&&s.codexRegistration);assert.equal(await fsp.readFile(path.join(root,'.codex/config.toml'),'utf8'),configured);
  await s.stop();await s.resume();assert(!s.running);assert.equal(s.config().enabled,false);
 }finally{p.onunload();await fsp.rm(root,{recursive:true,force:true});}
 console.log('PASS: real vault-backed MCP filing, PDF evidence, AI enrichment, human/manual/citation protection, stale revisions, proposals, export and lifecycle.');
})().catch(e=>{console.error(e);process.exitCode=1;});
