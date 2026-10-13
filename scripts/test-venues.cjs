const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const E=require('./dashboard');
const header='| '+E.TRACKING_HEADERS.join(' | ')+' |\n| --- | --- | --- | --- | --- |';
const due='2026-10-21 23:59 -12:00',otherDue='2027-01-05 12:30 +08:00';
const source=`USER HEADER\n## 待确定 venue\n\n${header}\n| Pending | 待审 | — | n | keep |\n\n## ICLR\n手写段落\n\n${header}\n| [One.pdf](reviews/ICLR/One.pdf) | 待审 | ${due} | todo &#124; x | Notes<br>&#91;x&#93; |\n| [Two.pdf](reviews/ICLR/Two.pdf) | 在审 | — | next | retain |\n\n<!-- tracking:end -->\nUSER FOOTER\n`;
const migrated=E.migrateTrackerDeadlines(source,'审稿');
assert.equal(E.trackerDeadline(migrated,'ICLR'),due);assert(migrated.includes('截止时间：'+due));
assert.deepEqual(E.parseTracker(migrated,'审稿').filter(r=>r.category==='ICLR').map(r=>r.published),[due,due]);
assert.equal(E.migrateTrackerDeadlines(migrated,'审稿'),migrated);
const renamed=E.renameTrackerGroup(migrated,'审稿','ICLR','ICLR 2027');
assert.deepEqual(E.parseTracker(renamed,'审稿').map(r=>r.cells),E.parseTracker(migrated,'审稿').map(r=>r.cells));
assert.equal(E.trackerDeadline(renamed,'ICLR 2027'),due);
for(const name of ['待确定 venue','暂存区'])assert.throws(()=>E.renameTrackerGroup(renamed,'审稿','ICLR 2027',name),/暂存区/);
assert.throws(()=>E.renameTrackerGroup(renamed,'审稿','Missing','Name'),/修改/);
let withOther=E.addTrackerGroup(renamed,'审稿','CoRL');
assert.throws(()=>E.renameTrackerGroup(withOther,'审稿','CoRL','iclr 2027'),/已存在/);
withOther=E.setTrackerDeadline(withOther,'审稿','CoRL',otherDue);
const row=E.parseTracker(withOther,'审稿')[1];
const moved=E.updateTracker(withOther,'审稿',row,{title:row.filename,pdfPath:row.pdfPath,category:'CoRL',status:row.status,due:row.published,next:row.tldr,notes:row.notes});
const movedRow=E.parseTracker(moved,'审稿').find(r=>r.pdfPath===row.pdfPath);assert.equal(movedRow.published,otherDue);assert.equal(movedRow.notes,row.notes);assert.equal(movedRow.pdfPath,row.pdfPath);
const changed=E.setTrackerDeadline(migrated,'审稿','ICLR',otherDue,due);
assert(E.parseTracker(changed,'审稿').filter(r=>r.category==='ICLR').every(r=>r.published===otherDue));
assert.throws(()=>E.setTrackerDeadline(changed,'审稿','ICLR',due,due),/已被修改/);
const added=E.updateTracker(changed,'审稿',null,{title:'Third',pdfPath:'reviews/ICLR/Third.pdf',category:'ICLR',status:'待审',due:'—',next:'',notes:'new note'});assert.equal(E.parseTracker(added,'审稿').at(-1).published,otherDue);
const deleted=E.deleteTrackerGroup(added,'审稿','ICLR');assert.deepEqual(E.trackerGroups(deleted),['待确定 venue']);
const before=E.parseTracker(added,'审稿'),after=E.parseTracker(deleted,'审稿');assert.equal(after.length,before.length);
for(const r of before){const next=after.find(n=>n.filename===r.filename);assert(E.sameTrackerContent(next.cells,r.cells));assert.equal(next.pdfPath,r.pdfPath);assert.equal(next.published,'—');assert.equal(next.category,'待确定 venue');}
assert(deleted.includes('手写段落'));assert(deleted.startsWith('USER HEADER'));assert(deleted.endsWith('USER FOOTER\n'));
assert.throws(()=>E.deleteTrackerGroup(deleted,'审稿','待确定 venue'),/不能删除/);
const only=E.addTrackerGroup('<!-- tracking:end -->\n','投稿','ICML');assert.deepEqual(E.trackerGroups(E.deleteTrackerGroup(only,'投稿','ICML')),['暂存区']);
const crlf=E.deleteTrackerGroup(migrated.replaceAll('\n','\r\n'),'审稿','ICLR');assert(!crlf.replaceAll('\r\n','').includes('\n'));
const removed=E.removeRecord(changed,'reviews',E.parseTracker(changed,'审稿')[1]);
const restored=E.restoreRecord(removed,'reviews',E.parseTracker(migrated,'审稿')[1]);assert.equal(E.parseTracker(restored,'审稿').at(-1).published,otherDue);
assert.throws(()=>E.restoreRecord(restored,'reviews',E.parseTracker(migrated,'审稿')[1]),/已存在/);
// Exercise inline edit event lifecycle: cancel, IME, Enter/blur race, error recovery and no modal.
class Element{
 constructor(){this.events={};this.attrs={};this.children=[];this.isConnected=true;this.ownerDocument={createElement:()=>new Element()};}
 createSpan(){return new Element();}
 createEl(tag){const child=new Element();child.tag=tag;this.children.push(child);return child;}
 addEventListener(name,fn){this.events[name]=fn;}
 setAttribute(k,v){this.attrs[k]=v;}
 removeAttribute(k){delete this.attrs[k];}
 replaceWith(el){this.replacement=el;this.isConnected=false;}
 focus(){this.focused=true;}select(){this.selected=true;}
}
let modalCount=0;const notices=[],api={module:{exports:{}},document:{createElement:()=>new Element()},require:n=>n==='obsidian'?{ItemView:class{},Plugin:class{},Modal:class{constructor(){modalCount++;}},Notice:class{constructor(m){notices.push(m);}},setIcon(){}}:require(n)};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+'\nmodule.exports.Navigation=LibraryNavigation;',api);
const settle=()=>new Promise(r=>setImmediate(r));
const key=(key,more={})=>({key,...more,preventDefault(){},stopPropagation(){}});
(async()=>{
 let calls=[],fail=false;const plugin={hasPendingEdit:()=>false,renameGroup:async(...args)=>{calls.push(args);if(fail)throw Error('已存在');}};
 const nav=new api.module.exports.Navigation(null,plugin);let renders=0;nav.render=()=>{renders++;};
 const edit=(scope='reviews')=>{const button=new Element();nav.beginRename(button,scope,'ICLR');return button.replacement.children[0];};
 let input=edit();assert(input.focused&&input.selected);input.value='Changed';input.events.keydown(key('Escape'));input.events.blur();await settle();assert.equal(calls.length,0);assert.equal(nav.renaming,null);
 input=edit('library');input.value='ML new';input.events.keydown(key('Enter',{isComposing:true}));await settle();assert.equal(calls.length,0);
 input.events.keydown(key('Enter'));input.events.blur();await settle();assert.equal(calls.length,1);assert.deepEqual(calls[0],['library','ICLR','ML new']);assert.equal(nav.renaming,null);
 fail=true;input=edit();input.value='taken';input.events.blur();await settle();assert.equal(input.attrs['aria-invalid'],'true');assert(nav.renaming);assert.equal(input.readOnly,false);assert.equal(input.value,'taken');input.events.keydown(key('Escape'));assert.equal(nav.renaming,null);
 input=edit();input.events.blur();await settle();assert.equal(calls.length,2);assert.equal(modalCount,0);
 console.log('PASS: Venue rename/delete, staging protection, row/Notes/path retention, shared DDL migration/edit/inheritance, stale DDL refusal, CRLF, restore after DDL change, inline Enter/Escape/blur/IME and error recovery.');
})().catch(e=>{console.error(e);process.exitCode=1;});
