const assert=require('node:assert/strict'),fs=require('node:fs').promises,path=require('node:path'),os=require('node:os');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const run=promisify(execFile),{importInboxFiles}=require('./inbox-import.js');
(async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'literature-import-test-'));
 try{
  const vault=path.join(tmp,'vault'),external=path.join(tmp,'external');await fs.mkdir(vault);await fs.mkdir(external);
  const name='Paper $ (draft) 中文.pdf',source=path.join(external,name),stem=source.slice(0,-4);
  await fs.writeFile(source,'%PDF test original');await fs.writeFile(stem+'.skim','personal notes');await fs.writeFile(stem+'.xfdf','other notes');
  await run('/usr/bin/xattr',['-w','org.literature.drag-test','attribute notes',source]);
  const input={name,path:source},first=await importInboxFiles(vault,[input,input]);
  assert.equal(first.length,1);assert.equal(first[0].path,'temp/'+name);assert.equal(first[0].attachments,2);
  assert.equal(await fs.readFile(path.join(vault,'temp',name),'utf8'),'%PDF test original');
  assert.equal((await run('/usr/bin/xattr',['-p','org.literature.drag-test',path.join(vault,'temp',name)])).stdout.trim(),'attribute notes');
  assert.equal(await fs.readFile(path.join(vault,'temp',name.slice(0,-4)+'.skim'),'utf8'),'personal notes');
  const second=await importInboxFiles(vault,[input]);assert.equal(second[0].path,'temp/'+name.slice(0,-4)+' (2).pdf');assert(second[0].renamed);
  assert.equal(await fs.readFile(path.join(vault,second[0].path.slice(0,-4)+'.skim'),'utf8'),'personal notes');
  assert.equal(await fs.readFile(stem+'.skim','utf8'),'personal notes');assert.equal(await fs.readFile(source,'utf8'),'%PDF test original');
  // An orphan sidecar also reserves the stem, so unrelated notes cannot become paired.
  await fs.writeFile(path.join(vault,'temp',name.slice(0,-4)+' (3).fdf'),'existing unrelated');
  assert((await importInboxFiles(vault,[input]))[0].path.endsWith(' (4).pdf'));
  const skipped=await importInboxFiles(vault,[{name,path:path.join(vault,'temp',name)}]);assert(skipped[0].skipped);
  const missing=await importInboxFiles(vault,[{name:'absent.pdf',path:path.join(external,'absent.pdf')}]);assert(missing[0].error);
  // Simulate a competing writer appearing after destination planning: no file is overwritten.
  const raceSource=path.join(external,'Race.pdf');await fs.writeFile(raceSource,'race source');await fs.writeFile(path.join(external,'Race.skim'),'race notes');let raced=false;
  const raceFS=new Proxy(fs,{get:(target,key)=>key==='link'?async(s,d)=>{
   if(!raced&&d.endsWith('/Race.pdf')){raced=true;await fs.writeFile(d,'other device');}
   return fs.link(s,d);
  }:target[key]});
  const racedResult=await importInboxFiles(vault,[{name:'Race.pdf',path:raceSource}],{fs:raceFS});assert.equal(racedResult[0].path,'temp/Race (2).pdf');
  assert.equal(await fs.readFile(path.join(vault,'temp/Race.pdf'),'utf8'),'other device');
  await assert.rejects(fs.stat(path.join(vault,'temp/Race.skim')),e=>e.code==='ENOENT');
  assert.equal(await fs.readFile(path.join(vault,'temp/Race (2).skim'),'utf8'),'race notes');
  // If attachment copying fails, do not expose a PDF without its annotations.
  const failed=await importInboxFiles(vault,[input],{execFile:(bin,args,cb)=>args[2].endsWith('.skim')?cb(new Error('copy failed')):execFile(bin,args,cb)});
  assert(failed[0].error);assert.deepEqual(await fs.readdir(path.join(vault,'.maintenance-imports')),[]);
  assert.equal(await fs.readFile(stem+'.skim','utf8'),'personal notes');
  const privateCopy=await importInboxFiles(vault,[input],{folder:'reviews/_staging'});assert.equal(privateCopy[0].path,'reviews/_staging/'+name);assert.equal(privateCopy[0].attachments,2);
  const submissionCopy=await importInboxFiles(vault,[input],{folder:'submissions/CoRL-2027'});assert.equal(submissionCopy[0].path,'submissions/CoRL-2027/'+name);
  await assert.rejects(importInboxFiles(vault,[input],{folder:'reviews/../../papers'}),/目录/);
  console.log('PASS: real Mac copy, extended attributes, sidecars, original retention, duplicate names/batches, orphan notes, vault skips, missing files, exclusive-write race and partial failure cleanup.');
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
