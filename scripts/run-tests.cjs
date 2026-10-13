'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const macOnly=new Set(['test-inbox-import.cjs','test-inbox-paste.cjs']);
let passed=0,skipped=0,failed=0;
for(const name of fs.readdirSync(__dirname).filter(n=>/^test-.*\.cjs$/.test(n)).sort()){
  if(process.platform!=='darwin'&&macOnly.has(name)){console.log('SKIP '+name+' (macOS Finder/ditto/plutil)');skipped++;continue;}
  const result=spawnSync(process.execPath,[path.join(__dirname,name)],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
  if(result.status===0){console.log('PASS '+name);passed++;}
  else{console.error('FAIL '+name+'\n'+(result.error?.message||'')+result.stdout+result.stderr);failed++;}
}
console.log(`${passed} passed, ${skipped} platform-specific skipped, ${failed} failed`);
process.exitCode=failed?1:0;
