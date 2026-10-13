const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const E=require('./dashboard'),C=require('./collections');
const root=path.join(__dirname,'../templates/empty-vault'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const library=read('文献库.md'),collections=C.parse(read('集合.md'));
assert.equal(E.parseLibrary(library).length,0);assert(library.includes('<!-- library:collections -->'));
assert(library.includes('| '+E.TITLE_HEADERS.join(' | ')+' |'));
assert.deepEqual(collections.groups.map(g=>g.name),E.CATEGORIES);assert(collections.groups.every(g=>g.members.length===0));
for(const name of ['审稿','投稿']){assert.equal(E.parseTracker(read(name+'.md'),name).length,0);assert.deepEqual(E.trackerGroups(read(name+'.md')),['暂存区']);}
assert(!read('AGENTS.md').includes('/Users/'));
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../manifest.json'),'utf8'));
const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'),'utf8'));
const versions=JSON.parse(fs.readFileSync(path.join(__dirname,'../versions.json'),'utf8'));
assert.equal(pkg.version,manifest.version);assert.equal(versions[manifest.version],manifest.minAppVersion);assert.equal(pkg.license,'AGPL-3.0-only');
console.log('PASS: synthetic empty vault schema, initial collections, staging areas, no personal paths and consistent version metadata.');
