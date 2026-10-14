'use strict';
const assert=require('node:assert/strict'),T=require('./tag-tree');
const model={groups:[{name:'Methods',tags:['#research/rl','#research/rl/online','#research/rl/residual','#research/meta-learning','#research/ttt']},{name:'Models',tags:['#research/vla','#research/wam','#research/llm']},{name:'Tasks',tags:['#research/dexterous','#research/locomotion']},{name:'Data',tags:['#research/dataset']}]};
const original=JSON.stringify(model),tree=T.tree(model),sides=new Map(),full=T.layout(tree,{sides});
const root=full.nodes.find(n=>n.kind==='root');assert(full.nodes.some(n=>n.side==='left'));assert(full.nodes.some(n=>n.side==='right'));
for(const n of full.nodes){
 assert(n.x>=0&&n.y>=0&&n.x+n.width<=full.width&&n.y+36<=full.height,'Every node fits the canvas');
 if(n.side==='left')assert(n.x+n.width<root.x);if(n.side==='right')assert(n.x>root.x+root.width);
 if(n.parent&&n.parent.kind!=='root')assert.equal(n.side,n.parent.side);
 for(const other of full.nodes)if(n!==other)assert(n.x+n.width<=other.x||other.x+other.width<=n.x||n.y+36<=other.y||other.y+36<=n.y,'No node boxes overlap');
}
const leaves=full.nodes.filter(n=>!n.children.length);assert(full.height<leaves.length*49*.7,'Two sides substantially reduce an expanded map’s height');
const savedSides=[...sides],collapsed=new Set(tree.children.filter(n=>sides.get(n.key)==='left').map(n=>n.key));
const folded=T.layout(tree,{sides,collapsed});assert.deepEqual([...sides],savedSides,'Collapsing groups never swaps their sides');
assert(folded.nodes.length<full.nodes.length);assert.equal(folded.nodes.find(n=>n.key==='root').side,null);
const leftGroup=tree.children.find(n=>sides.get(n.key)==='left');
const edit=T.layout(tree,{sides,editor:{parent:leftGroup.key}});assert.equal(edit.nodes.find(n=>n.kind==='editor').side,'left');
const rootEdit=T.layout(tree,{sides,editor:{parent:'root'}});assert.equal(rootEdit.nodes.find(n=>n.kind==='editor').side,'right','Root plus creates to the right');
const expanded=T.addTag(model,leftGroup.group,null,'added');T.layout(T.tree(expanded.model),{sides});assert.deepEqual([...sides],savedSides,'Adding a tag keeps all group sides');
T.layout(T.tree(T.addGroup(model,'New group')),{sides});for(const [key,side]of savedSides)assert.equal(sides.get(key),side);
assert.equal(JSON.stringify(model),original,'Layout never changes vocabulary or canonical tags');
for(const model of [{groups:[]},{groups:[{name:'Empty',tags:[]}]}]){const l=T.layout(T.tree(model));assert(l.width>0&&l.height>0);assert(l.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));}
console.log('PASS: balanced bidirectional map, non-overlapping bounds, stable sides on fold/create, outward inline editors and unchanged vocabulary.');
