const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path'),E=require('./dashboard'),C=require('./collections'),{migrate}=require('./migrate-collections.cjs');
const h='| '+E.VENUE_HEADERS.join(' | ')+' |\n| '+E.VENUE_HEADERS.map(()=> '---').join(' | ')+' |';
const old='## A\n'+h+'\n| [One.pdf](papers/One.pdf) | 2026.10 | #research/rl | TLDR | 在读 | 高 | Notes | User Venue |\n| [Two.pdf](papers/Two.pdf) | 2025 | #research/vla | TLDR 2 | 待读 | — | Notes 2 |  |\n## B\n'+h+'\n<!-- library:end -->';
const data=migrate(old),tracker='## 暂存区\n| '+E.TRACKING_HEADERS.join(' | ')+' |\n| --- | --- | --- | --- | --- |\n<!-- tracking:end -->';
class TFile{constructor(n){this.path=n;this.name=n.split('/').pop();this.extension=n.split('.').pop();this.stat={ctime:0,size:1};}}
const store=new Map([['文献库.md',data.library],['集合.md',data.collections],['审稿.md',tracker],['投稿.md',tracker]]),files=new Map([...store.keys()].map(p=>[p,new TFile(p)]));
const vault={getAbstractFileByPath:p=>files.get(p),getFiles:()=>[...files.values()],read:async f=>store.get(f.path),on(){},process:async(f,fn)=>store.set(f.path,fn(store.get(f.path))),create:async(n,t)=>{assert(!store.has(n));store.set(n,t);files.set(n,new TFile(n));},adapter:{exists:async()=>true,mkdir:async()=>{},write:async(n,t)=>store.set(n,t)}};
const workspace={getLeavesOfType:()=>[],on(){},onLayoutReady(){}};
class Plugin{constructor(){this.app={vault,workspace};}registerView(){}addRibbonIcon(){}addCommand(){}registerObsidianProtocolHandler(){}registerEvent(){}}
const ctx={module:{exports:{}},require:n=>n==='obsidian'?{Plugin,ItemView:class{},Modal:class{},Notice:class{},Platform:{isDesktopApp:true,isMacOS:true},TFile}:require(n),setTimeout,clearTimeout,console,TextEncoder,TextDecoder};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+'\nmodule.exports.drop=ldbDropTarget;module.exports.Browser=LiteratureBrowser;',ctx);
const notices=[];
(async()=>{
 const plugin=new ctx.module.exports();await plugin.onload();await plugin.refresh();
 assert.equal(plugin.snapshot.library.length,2);assert.equal(ctx.module.exports.Browser.prototype.getDisplayText.call({}), '文献库');
 const paperBefore=store.get('文献库.md'),dt={setData(){}};
 assert(plugin.beginPaperDrag({dataTransfer:dt},plugin.snapshot.library[0],'library',[plugin.snapshot.library[0]],'A'));assert.equal(dt.effectAllowed,'copyMove');
 await plugin.moveDraggedPaper(plugin.dragState.token,'B','library');assert.deepEqual([...plugin.snapshot.library[0].categories],['A','B']);assert.equal(store.get('文献库.md'),paperBefore);
 const size=store.size;await plugin.changeMembership([plugin.snapshot.library[0]],{scope:'library',name:'B'});assert.equal(store.size,size);
 await plugin.newCollection('projects','Project');await plugin.newCollection('projects','Other');
 assert(plugin.beginPaperDrag({dataTransfer:dt},plugin.snapshot.library[0],'library',plugin.snapshot.library,'A'));await plugin.moveDraggedPaper(plugin.dragState.token,'Project','projects');
 assert(plugin.snapshot.library.every(r=>r.projects.includes('Project')));assert.equal(plugin.snapshot.library.length,2);assert.equal(store.get('文献库.md'),paperBefore);
 await plugin.mutate('集合.md',text=>C.setNote(text,'Project','papers/One.pdf','Project-specific',''));
 await plugin.changeMembership([plugin.snapshot.library[0]],{scope:'projects',name:'Other'},{scope:'projects',name:'Project'},true);
 assert.equal(plugin.snapshot.collections.find(g=>g.name==='Other').members[0].notes,'Project-specific');assert.equal(plugin.snapshot.library[0].notes,'Notes');
 await plugin.changeMembership([plugin.snapshot.library[0]],null,{scope:'library',name:'B'});assert.deepEqual([...plugin.snapshot.library[0].categories],['A']);
 await plugin.renameGroup('projects','Other','Renamed');assert(plugin.snapshot.library[0].projects.includes('Renamed'));
 assert(plugin.beginGroupDrag({dataTransfer:dt},'projects','Renamed'));await plugin.moveDraggedGroup(plugin.groupDrag.token,'projects','Project',false);assert.deepEqual([...plugin.snapshot.groups.projects],['Renamed','Project']);
 await plugin.deleteProject('Renamed');assert.equal(plugin.snapshot.library[0].projects.length,0);assert.equal(store.get('文献库.md'),paperBefore);
 assert(plugin.beginPaperDrag({dataTransfer:dt},plugin.snapshot.library[0],'library'));const token=plugin.dragState.token;
 store.set('文献库.md',E.updateLibraryEntry(store.get('文献库.md'),E.parseLibrary(store.get('文献库.md'))[0],{notes:'External notes'}));
 await assert.rejects(plugin.moveDraggedPaper(token,'B'),/其他窗口/);await plugin.refresh();
 await plugin.deleteLibraryCategory('A');assert(plugin.snapshot.library.every(r=>!r.categories.length));assert(plugin.snapshot.categories.includes('未分类'));assert.equal(plugin.snapshot.library.length,2);
 await assert.rejects(plugin.changeMembership([plugin.snapshot.library[0]],{scope:'library',name:'未分类'}),/自动显示/);
 // Independent by default, including identical names. Sharing is an explicit creation choice.
 const own='2026-10-21 23:59 -12:00',shared='2027-01-05 12:30 +08:00';
 const paperSnapshot=store.get('文献库.md');
 assert.equal(plugin.snapshot.deadlines.projects.Project,'—');
 await plugin.setVenueDeadline('projects','Project',own,'—','');
 await plugin.newVenue('submissions','Project');
 assert.equal(plugin.snapshot.deadlines.submissions.Project,'—');
 assert.equal(plugin.snapshot.deadlines.projects.Project,own);
 assert(!store.get('集合.md').includes('投稿 Venue：'));
 await assert.rejects(plugin.setVenueDeadline('projects','Project',shared,'—',''),/已被修改/);
 await assert.rejects(plugin.setVenueDeadline('projects','Project','2026-02-30 23:59 +08:00',own,''),/无效/);
 const source=plugin.deadlineChoices('submissions').find(g=>g.name==='Project');
 await plugin.newVenue('submissions','Shared Conference',source);
 const entry=plugin.snapshot.deadlineEntries.find(g=>g.scope==='projects'&&g.name==='Project');assert(entry.key);
 assert.equal(plugin.snapshot.deadlines.submissions['Shared Conference'],own);
 await plugin.setVenueDeadline('submissions','Shared Conference',shared,own,entry.key);
 assert.equal(plugin.snapshot.deadlines.projects.Project,shared);
 assert.equal(plugin.snapshot.deadlines.submissions.Project,'—','Same-name independent Venue is untouched.');
 await plugin.setVenueDeadline('projects','Project',own,shared,entry.key);
 assert.equal(plugin.snapshot.deadlines.submissions['Shared Conference'],own);
 await plugin.renameGroup('submissions','Shared Conference','Renamed Venue');
 assert.equal(plugin.snapshot.deadlines.projects.Project,own);
 await plugin.newCollection('projects','Other Shared',plugin.deadlineChoices('projects').find(g=>g.name==='Renamed Venue'));
 await plugin.setVenueDeadline('projects','Other Shared',shared,own,entry.key);
 assert.equal(plugin.snapshot.deadlines.projects.Project,shared);assert.equal(plugin.snapshot.deadlines.submissions['Renamed Venue'],shared);
 await plugin.deleteVenue('submissions','Renamed Venue');
 assert.equal(plugin.snapshot.deadlines.projects.Project,shared);assert.equal(plugin.snapshot.deadlines.projects['Other Shared'],shared);
 assert(!store.get('投稿.md').includes('共享 DDL：'));
 await plugin.deleteProject('Other Shared');await plugin.setVenueDeadline('projects','Project','—',shared,entry.key);
 assert.equal(plugin.snapshot.deadlines.projects.Project,'—');
 assert.equal(store.get('文献库.md'),paperSnapshot);
 // Stale selection, new same-name independent groups, and failed cross-file writes cannot silently link.
 await assert.rejects(plugin.newVenue('submissions','Stale',source),/重新选择/);assert(!EngineTracker('Stale'));
 const actualProcess=vault.process,choice=plugin.deadlineChoices('submissions').find(g=>g.name==='Project');
 const beforeCollections=store.get('集合.md'),beforeSubmissions=store.get('投稿.md');
 // Use an unshared project so both files need a write; fail the second write.
 await plugin.newCollection('projects','Fresh');const fresh=plugin.deadlineChoices('submissions').find(g=>g.name==='Fresh');
 const freshBefore=store.get('集合.md');
 vault.process=async(f,fn)=>{if(f.path==='投稿.md')throw Error('Injected write failure');return actualProcess(f,fn);};
 await assert.rejects(plugin.newVenue('submissions','Failed Venue',fresh),/Injected/);vault.process=actualProcess;
 assert.equal(store.get('集合.md'),freshBefore);assert.equal(store.get('投稿.md'),beforeSubmissions);assert(!EngineTracker('Failed Venue'));
 // Never overwrite another device's text during compensation.
 vault.process=async(f,fn)=>{if(f.path==='投稿.md'){store.set('集合.md',store.get('集合.md')+'\nExternal prose');throw Error('Concurrent edit');}return actualProcess(f,fn);};
 await assert.rejects(plugin.newVenue('submissions','Failed Concurrent',fresh),/未覆盖/);vault.process=actualProcess;
 assert(store.get('集合.md').endsWith('External prose'));assert(!EngineTracker('Failed Concurrent'));
 // An external inconsistent pair must preserve the previous valid snapshot.
 await plugin.refresh();const freshChoice=plugin.deadlineChoices('submissions').find(g=>g.name==='Fresh');
 await plugin.newVenue('submissions','Consistent',freshChoice);
 const goodSubmission=store.get('投稿.md'),priorSnapshot=plugin.snapshot;
 store.set('投稿.md',E.setTrackerDeadline(goodSubmission,'投稿.md','Consistent',own,'—'));await plugin.refresh();
 assert.equal(plugin.snapshot,priorSnapshot);assert(plugin.lastError.includes('尚未同步一致'));
 store.set('投稿.md',goodSubmission);await plugin.refresh();assert.equal(plugin.lastError,'');
 assert.equal(store.get('文献库.md'),paperSnapshot);
 console.log('PASS: independent defaults, explicit bidirectional DDL sharing, same-name isolation, shared rename/delete, stale selections, two-file rollback, concurrent-edit preservation and incomplete-sync refusal.');
 // Checkboxes refuse a changed membership or project note, rather than applying stale intent.
 const selected=plugin.snapshot.library[0],target={scope:'library',name:'B'};
 await plugin.changeMembership([selected],target,null,false,{target,members:[null]});
 await assert.rejects(plugin.changeMembership([selected],target,null,false,{target,members:[null]}),/勾选菜单/);
 await plugin.changeMembership([selected],null,target,false,{target,members:['']});
 assert.equal(store.get('文献库.md'),paperSnapshot);
 console.log('PASS: stale membership refusal and unchanged paper metadata.');
 // Purging the last trashed copy clears only that paper's collection memberships.
 await plugin.changeMembership(plugin.snapshot.library,{scope:'library',name:'B'});
 await plugin.changeMembership(plugin.snapshot.library,{scope:'projects',name:'Project'});
 await plugin.mutate('集合.md',text=>C.setNote(text,'Project','papers/Two.pdf','Keep this project note',''));
 const active=store.get('文献库.md'),memberships=store.get('集合.md'),receipt={folder:'current',scope:'library',row:plugin.snapshot.library[0]};
 const actualList=plugin.trashStore.list;plugin.trashStore.list=async()=>[];
 await plugin.forgetTrashedMembership(receipt);assert.equal(store.get('集合.md'),memberships,'A re-added active paper keeps memberships.');
 store.set('文献库.md',E.removeRecord(active,'library',receipt.row));
 plugin.trashStore.list=async()=>[{...receipt,folder:'older'}];await plugin.forgetTrashedMembership(receipt);assert.equal(store.get('集合.md'),memberships,'Another recoverable receipt still owns these memberships.');
 plugin.trashStore.list=async()=>[receipt];await plugin.forgetTrashedMembership(receipt);
 const remaining=C.parse(store.get('集合.md')).groups;
 assert(remaining.every(g=>g.members.every(m=>m.path!==receipt.row.path)));assert.equal(remaining.length,C.parse(memberships).groups.length);
 assert.equal(remaining.find(g=>g.scope==='projects'&&g.name==='Project').members.find(m=>m.path==='papers/Two.pdf').notes,'Keep this project note');
 assert(remaining.find(g=>g.scope==='library'&&g.name==='B').members.some(m=>m.path==='papers/Two.pdf'));
 store.set('文献库.md',active);store.set('集合.md',memberships);plugin.trashStore.list=actualList;await plugin.refresh();
 console.log('PASS: last-receipt membership cleanup, active/other-trashed-copy retention, unchanged groups and unrelated project notes.');
 function EngineTracker(name){return E.trackerGroups(store.get('投稿.md')).includes(name);}
 const before=plugin.snapshot;store.set('集合.md','partial sync');await plugin.refresh();assert.equal(plugin.snapshot,before);assert(plugin.lastError.includes('集合'));
 plugin.onunload();console.log('PASS: live plugin multi-selection add/move/remove, projects/notes/order/rename/delete, unchanged master, stale row refusal, malformed collections preserve prior snapshot.');
})().catch(e=>{console.error(e);process.exitCode=1;});
