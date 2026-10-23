'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const E=require('./dashboard'),C=require('./collections');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ldb-web-check-'));
try{
 let library=fs.readFileSync('templates/empty-vault/library.md','utf8'),collections=C.add(C.empty(),'library','Research');
 library=E.addWebEntry(library,{url:'https://example.test/blog',title:'Blog',id:'web:check-12345678',inbox:false});
 collections=C.change(collections,['web:check-12345678'],{scope:'library',name:'Research'});
 const put=(name,text)=>fs.writeFileSync(path.join(dir,name),text);
 put('library.md',library);put('collections.md',collections);
 const check=()=>spawnSync('python3',['scripts/check_library.py','check','--vault',dir],{encoding:'utf8'});
 let result=check();assert.equal(result.status,0,result.stderr);
 const row=E.parseLibrary(library)[0];put('library.md',E.removeRecord(library,'library',row));
 result=check();assert.notEqual(result.status,0);assert(result.stderr.includes('未收录的网页'));
 const receipt=path.join(dir,'.maintenance-backups/deleted/example');fs.mkdirSync(receipt,{recursive:true});fs.writeFileSync(path.join(receipt,'record.json'),JSON.stringify({scope:'library',state:'deleted',row}));
 result=check();assert.equal(result.status,0,result.stderr);
 put('library.md',library.replace('https://example.test/blog','javascript:alert%281%29'));
 assert.notEqual(check().status,0);
 console.log('PASS: read-only checker understands web records, stable relationship IDs, archived references and invalid schemes.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
