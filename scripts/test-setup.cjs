'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
class TFile{constructor(path){this.path=path;}}
class TFolder{constructor(path){this.path=path;}}
const api={Plugin:class{},ItemView:class{},Modal:class{},TFile,TFolder,Notice:class{}};
const ctx={module:{exports:{}},setTimeout,clearTimeout,require:n=>n==='obsidian'?api:require(n)};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+'\nmodule.exports.initialize=ldbInitializeVault;',ctx);
const Manager=ctx.module.exports;
function fixture(){
  const files=new Map(),texts=new Map(),created=[];
  const vault={getAbstractFileByPath:p=>files.get(p),on(){},read:async f=>texts.get(f.path),
    createFolder:async p=>{assert(!files.has(p));files.set(p,new TFolder(p));created.push(p);},
    create:async(p,text)=>{vault.beforeCreate?.(p);if(files.has(p))throw Error('COLLISION');files.set(p,new TFile(p));texts.set(p,text);created.push(p);}};
  return {vault,files,texts,created};
}
async function start(f,saved={}){
  const plugin=new Manager(),events={};let layout,opened=0,refreshed=0,persisted;
  plugin.app={vault:f.vault,workspace:{on:(name,handler)=>{events[name]=handler;},onLayoutReady:handler=>{layout=handler;}}};
  plugin.loadData=async()=>saved;plugin.saveData=async data=>{persisted=data;};
  for(const method of ['registerView','addRibbonIcon','registerCommands','registerEvent','registerObsidianProtocolHandler'])plugin[method]=()=>{};
  plugin.openLibrary=async()=>{opened++;};plugin.refresh=async()=>{refreshed++;};
  await plugin.onload();await layout();
  return {plugin,events,opened,refreshed,persisted};
}
(async()=>{
  const fresh=fixture(),initial=await start(fresh);
  assert.equal(initial.opened,0);assert.equal(initial.refreshed,0);assert.equal(initial.plugin.setupNeeded,true);assert.equal(fresh.created.length,0);
  assert.equal(initial.persisted.openOnStartup,false);assert.equal(initial.persisted.redirectSourceFiles,false);
  const f=fixture();f.files.set('AGENTS.md',new TFile('AGENTS.md'));f.texts.set('AGENTS.md','USER INSTRUCTIONS');
  await Manager.initialize(f.vault);assert.equal(f.created.length,8);assert.equal(f.texts.get('AGENTS.md'),'USER INSTRUCTIONS');
  for(const name of ['library.md','collections.md','reviews.md','submissions.md'])assert.equal(f.texts.get(name),fs.readFileSync(path.join(__dirname,'../templates/empty-vault',name),'utf8'));
  const before=new Map(f.texts);await assert.rejects(Manager.initialize(f.vault));assert.deepEqual(f.texts,before);
  const collision=fixture();collision.files.set('library.md',new TFile('library.md'));collision.texts.set('library.md','UNRELATED NOTE');
  await assert.rejects(Manager.initialize(collision.vault));assert.equal(collision.created.length,0);
  const unrelated=await start(collision);assert.equal(unrelated.opened,0);assert.equal(unrelated.plugin.settings.redirectSourceFiles,false);
  const old=fixture();old.files.set('文献库.md',new TFile('文献库.md'));await assert.rejects(Manager.initialize(old.vault));assert.equal(old.created.length,0);
  const folder=fixture();folder.files.set('temp',new TFile('temp'));await assert.rejects(Manager.initialize(folder.vault));assert.equal(folder.created.length,0);
  const race=fixture();race.vault.beforeCreate=p=>{if(p==='library.md'){race.files.set(p,new TFile(p));race.texts.set(p,'SYNCED DATA');}};
  await assert.rejects(Manager.initialize(race.vault),/COLLISION/);assert.equal(race.texts.get('library.md'),'SYNCED DATA');assert(!race.files.has('reviews.md'));
  const clean=fixture();await Manager.initialize(clean.vault);assert(clean.texts.get('AGENTS.md').includes('Do not generate'));
  const existing=await start(clean);assert.equal(existing.opened,1);assert.equal(existing.plugin.settings.redirectSourceFiles,true);
  const optedOut=await start(clean,{openOnStartup:false,redirectSourceFiles:false});assert.equal(optedOut.opened,0);
  let redirected=0;optedOut.plugin.redirectLegacy=()=>{redirected++;};optedOut.events['file-open'](new TFile('library.md'));assert.equal(redirected,0);
  optedOut.plugin.settings.redirectSourceFiles=true;optedOut.events['file-open'](new TFile('library.md'));assert.equal(redirected,1);
  console.log('PASS: explicit setup, untouched fresh vault, schema templates, preserved agent instructions, collision/race safety, retained upgrade behavior and opt-out startup/redirects.');
})().catch(error=>{console.error(error);process.exitCode=1;});
