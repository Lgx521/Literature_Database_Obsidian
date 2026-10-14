const assert=require('node:assert/strict'),E=require('./dashboard'),C=require('./collections');
const rl='#research/rl',vla='#research/vla';
const rows=[
 {path:'one',tags:rl+'/online '+rl+'/real-world '+vla},
 {path:'two',tags:rl},
 {path:'three',tags:rl+'x'},
 {path:'four',tags:''},
 {path:'five',tags:'#methods/rl #精读'}
];
const before=JSON.stringify(rows);
assert.deepEqual(E.rootGroupTags(rows),['#methods',rl,rl+'x',vla,'#精读']);
assert.deepEqual(E.groupLibraryByTags(rows).map(g=>[g.name,g.rows.map(r=>r.path)]),[
 ['#methods',['five']],[rl,['one','two']],[rl+'x',['three']],[vla,['one']],['#精读',['five']],['未标标签',['four']]
]);
assert.equal(JSON.stringify(rows),before,'Grouping never mutates source metadata');
assert.equal(E.groupLibraryByTags(rows).find(g=>g.name===rl).rows.length,2,'Multiple subtags count a paper once in the parent group');
assert.deepEqual(E.groupLibraryByTags([]),[]);
assert.deepEqual(E.groupLibraryByTags([{path:'empty',tags:''}]).map(g=>g.name),['未标标签']);
assert.deepEqual(E.groupLibraryByTags(rows.slice(2,3)).map(g=>g.name),[rl+'x'],'Groups derive only from the current rows');
assert.deepEqual(E.groupLibraryByTags([...rows].reverse()).find(g=>g.name===rl).rows.map(r=>r.path),['two','one'],'Within-group sorting follows the current list order');
const old=C.add(C.empty(),'library','Demo').replace('## 分类：Demo','## 分类：Demo\n分组标签：#research/rl');
assert(C.rename(old,'library','Demo','New name').includes('分组标签：#research/rl'),'Earlier preview settings remain harmless preserved prose');
console.log('PASS: automatic local tag groups, collapsed subtag display, unique parent counts, cross-group appearances, untagged/empty views, sorted rows and unchanged metadata.');
