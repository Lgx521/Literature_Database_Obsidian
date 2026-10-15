'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),M=require('./agent-migration');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ldb-agent-migration-'));
 try{
  await fs.mkdir(path.join(root,'files/123'),{recursive:true});await fs.writeFile(path.join(root,'files/123/Original.pdf'),'%PDF original');await fs.writeFile(path.join(root,'files/123/Original.skim'),'annotations');
  const bib='@article{source_key,\n title = {A {Nested} Title},\n author={Doe, Jane}, year={2026}, journal={Test},\n file = {Full Text PDF:files/123/Original.pdf:application/pdf}\n}';
  await fs.writeFile(path.join(root,'Export.bib'),bib);await fs.symlink('/etc/hosts',path.join(root,'Escape.pdf'));
  const grant=await M.scan(root);assert.equal(grant.files.length,1);assert.equal(grant.references.get(grant.files[0].file).raw,bib);assert.equal(grant.warnings.length,0);
  assert.equal(M.bibEntries('@comment{ignore}\n'+bib+'\n'+bib).length,2);
  const record=grant.files[0];assert((await M.verify(grant,record.file,record.revision)).reference.raw===bib);
  await assert.rejects(M.resolve(grant,'../hosts'),/Invalid/);await assert.rejects(M.resolve(grant,'Escape.pdf'),/escaped/);
  await assert.rejects(M.verify(grant,record.file,'wrong'),/stale/);
  await fs.appendFile(path.join(root,'Export.bib'),'\nchanged');await assert.rejects(M.verify(grant,record.file,record.revision),/Bibliography export changed/);
  await fs.writeFile(path.join(root,'Export.bib'),bib+'\n'+bib.replace('source_key','second_key'));const collision=await M.scan(root);assert.equal(collision.references.get(record.file),null);assert(collision.warnings.length);
  assert.throws(()=>M.bibEntries('@article{incomplete'),/Incomplete/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
 console.log('PASS: real exported BibTeX-to-file association, immutable paths, ambiguity reporting, stale exports and symlink/path confinement.');
})().catch(e=>{console.error(e);process.exitCode=1;});
