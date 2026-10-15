'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const E=require('./dashboard'),T=require('./tag-tree'),O=require('./organization'),R=require('./tag-rename')(E,T,O),TX=require('./source-transaction');
let library=fs.readFileSync('templates/empty-vault/library.md','utf8');
for(const path of ['papers/A.pdf','papers/B.pdf'])library=E.addLibraryEntry(library,path);
function edit(path,changes,actor){library=E.updateLibraryEntry(library,E.parseLibrary(library).find(r=>r.path===path),changes,actor);}
edit('papers/A.pdf',{tags:'#research/rl/online #other',tldr:'AI summary'},{kind:'ai',name:'Codex'});
edit('papers/A.pdf',{tags:'#research/rl/online #research/rl/offline #other',notes:'Personal notes',bookmarked:true,organizing:'人工完成',customFields:{'custom-testing-123':'Keep'}},{kind:'human',name:'user'});
edit('papers/B.pdf',{tags:'#research/RL/online #other',notes:'Unknown provenance',bibtex:'@misc{test, title={Actual export}}',citationSource:'Actual source'});
const catalog=T.serialize(T.effective(null,E.parseLibrary(library))),before=E.parseLibrary(library),node={kind:'tag',tag:'#research/rl'},change=R.removePlan(library,catalog,node),rows=E.parseLibrary(change.after['library.md']);
assert.equal(change.affected.length,2);assert.equal(change.removed.length,2);assert(rows.every(r=>r.tags==='#other'));assert.equal(O.source(rows[0],'#other',true).kind,'ai');assert.equal(O.source(rows[1],'#other',true).kind,'unknown');
assert(!Object.keys(O.parse(rows[0].provenance).tags).some(k=>k.includes('/rl/')));
for(let i=0;i<rows.length;i++)for(let c=0;c<rows[i].cells.length;c++)if(![2,12].includes(c))assert.equal(rows[i].cells[c],before[i].cells[c],`Preserve paper ${i} field ${c}`);
assert.throws(()=>R.removePlan(library,catalog,{kind:'tag',tag:'#missing'}));assert.throws(()=>T.remove(T.parse(catalog),{kind:'root'}));
const branch=R.removePlan(library,catalog,{kind:'tag',tag:'#research/rl/online'});assert(E.parseLibrary(branch.after['library.md'])[0].tags.includes('#research/rl/offline'));
const group=T.parse(catalog).groups[0],whole=R.removePlan(library,catalog,{kind:'group',group:group.name});assert(!whole.model.groups.some(g=>g.name===group.name));
(async()=>{
 const files=new Map(Object.entries(change.before)),backups=[];let fail='',concurrent=false;
 const vault={getAbstractFileByPath:p=>files.has(p)?{path:p}:null,read:async f=>files.get(f.path),process:async(f,fn)=>{if(f.path===fail)throw Error('disk full');files.set(f.path,fn(files.get(f.path)));},adapter:{exists:async()=>true,write:async(p,t)=>{backups.push(t);if(concurrent)files.set('library.md',library+'external');}}};
 fail='tags.md';await assert.rejects(TX.write(vault,change.before,change.after,'tag-delete'),/disk full/);assert.deepEqual(Object.fromEntries(files),change.before,'Partial failure rolls back unchanged first write');assert(backups.includes(library));
 fail='';concurrent=true;await assert.rejects(TX.write(vault,change.before,change.after,'tag-delete'));assert.equal(files.get('library.md'),library+'external');assert.equal(files.get('tags.md'),catalog);
 console.log('Tag deletion preserves metadata/provenance and guards paired writes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
