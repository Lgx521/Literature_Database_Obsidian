'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
let requests=0,wire;
let menuTitles=[];
class Menu{addItem(fn){const item={setTitle(title){menuTitles.push(title);return this;},setIcon(){return this;},onClick(){return this;}};fn(item);return this;}showAtPosition(){}}
class Plugin{addCommand(command){(this.commands??=[]).push(command);}}
const context={module:{exports:{}},setTimeout,clearTimeout,TextEncoder,URL,require:name=>{assert.equal(name,'obsidian');return {
 Plugin,Menu,ItemView:class{},Modal:class{},Notice:class{},Platform:{isMobile:true},requestUrl:async()=>{requests++;wire=deferred();return wire.promise;}
};}};
vm.runInNewContext(fs.readFileSync('main.js','utf8')+'\nmodule.exports.testing={ldbDeepSeek,ldbDeepSeekAvailable,ldbOpenDeepSeek,LibraryNavigation,LiteratureBrowser,LdbI18n};',context);
const Manager=context.module.exports,{ldbDeepSeek,ldbDeepSeekAvailable,ldbOpenDeepSeek,LiteratureBrowser,LdbI18n}=Manager.testing;
LdbI18n.setLanguage('en','en');
(async()=>{
 const p=new Manager(),navEntries=[{hidden:false},{hidden:false}],detailEntry={hidden:false},notes={value:'Unsaved human note'};
 const browser={scope:'inbox',actionEl:{hidden:false},detailEl:{querySelectorAll:()=>[detailEntry]},notesInput:notes,selectedPath:'temp/example.pdf',syncDeepSeekAccess:LiteratureBrowser.prototype.syncDeepSeekAccess};browser.plugin=p;
 const nav={containerEl:{querySelectorAll:()=>navEntries},render(){throw Error('Do not rebuild navigation');}};
 p.app={workspace:{getLeavesOfType:type=>[{view:type==='literature-database-navigation'?nav:browser}]}};p.ready=true;
 let saved={language:'en',deepSeekEncrypted:{fixture:'ciphertext'},deepSeekModel:'test-model',libraryFields:[{id:'custom-one'}]},saves=0;
 p.settings={...saved};p.loadData=async()=>saved;p.saveData=async next=>{saves++;saved=next;};
 assert(ldbDeepSeekAvailable(p),'Existing Beta entry remains accessible');
 p.registerCommands();const command=p.commands.find(c=>c.id==='deepseek-beta');assert(command.checkCallback(true));
 const service=ldbDeepSeek(p);service.enable('synthetic-key-for-offline-test');
 const items=[{edits:{tldr:'Edited preview'},proposal:{path:'papers/example.pdf'}}];let stops=0,closes=0;
 p.deepSeekWork={items,stop(){stops++;}};p.deepSeekModal={close(){closes++;p.deepSeekModal=null;}};
 // Failure must not hide controls, close a draft, stop work or discard the key.
 const normalSave=p.saveData;p.saveData=async()=>{throw Error('Settings disk failure');};
 await assert.rejects(p.setDeepSeekBetaEnabled(false),/Settings disk failure/);assert(ldbDeepSeekAvailable(p));assert.equal(stops,0);assert.equal(closes,0);assert(service.enabled);assert(navEntries.every(e=>!e.hidden));
 p.saveData=normalSave;
 // Cancelling discovery must keep the in-flight boundary until its response settles.
 const loading=service.listModels().catch(e=>e);await new Promise(r=>setImmediate(r));assert.equal(requests,1);
 saved={...saved,unrelatedSetting:'newer value'};await p.setDeepSeekBetaEnabled(false);
 assert.equal((await loading).message,'Cancelled');assert(service.wire);assert.equal(service.key,'');assert(!service.enabled);
 assert.equal(saved.deepSeekBetaEnabled,false);assert.equal(saved.unrelatedSetting,'newer value');assert.equal(saved.deepSeekEncrypted.fixture,'ciphertext');assert.equal(saved.deepSeekModel,'test-model');assert.equal(saved.libraryFields[0].id,'custom-one');
 assert(navEntries.every(e=>e.hidden));assert(browser.actionEl.hidden);assert(detailEntry.hidden);assert.equal(browser.notesInput,notes);assert.equal(notes.value,'Unsaved human note');assert.equal(browser.selectedPath,'temp/example.pdf');assert.equal(p.deepSeekWork.items,items);assert.equal(items[0].edits.tldr,'Edited preview');assert.equal(stops,1);assert.equal(closes,1);
 assert.equal(command.checkCallback(true),false);assert.equal(command.checkCallback(false),false);assert.equal(ldbOpenDeepSeek(p),undefined);
 browser.actionEl.textContent='DeepSeek Beta';browser.isPublic=()=>false;browser.venueDeadlineEl={hidden:true};browser.contentEl={ownerDocument:{}};
 const event={currentTarget:{getBoundingClientRect:()=>({left:0,bottom:0})}};
 LiteratureBrowser.prototype.mobileMenu.call(browser,event);assert(!menuTitles.includes('DeepSeek Beta'),'Mobile overflow menu hides the disabled feature');
 assert.throws(()=>service.enable('synthetic-key-for-offline-test'),/plugin settings/);await assert.rejects(service.organize('temp/example.pdf','en'),/plugin settings/);await assert.rejects(service.apply({}),/plugin settings/);await assert.rejects(service.listModels(),/plugin settings/);assert.equal(requests,1);
 await p.setDeepSeekBetaEnabled(true);assert(navEntries.every(e=>!e.hidden));assert(!detailEntry.hidden);assert(!browser.actionEl.hidden);assert(command.checkCallback(true));assert.equal(requests,1);assert(!service.enabled,'Re-enable must not unlock or issue requests');assert.throws(()=>service.enable('synthetic-key-for-offline-test'),/current request/);
 menuTitles=[];LiteratureBrowser.prototype.mobileMenu.call(browser,event);assert(menuTitles.includes('DeepSeek Beta'));
 wire.resolve({status:200,json:{data:[{id:'test-model'}]}});await new Promise(r=>setImmediate(r));assert.equal(service.wire,null);
 // Persisted off state survives a fresh service; concurrent toggle writes are refused.
 const gate=deferred();p.saveData=async next=>{await gate.promise;saved=next;};const turningOff=p.setDeepSeekBetaEnabled(false);await Promise.resolve();await assert.rejects(p.setDeepSeekBetaEnabled(true),/finish saving/);gate.resolve();await turningOff;
 const reopened={settings:saved,ready:true};const fresh=ldbDeepSeek(reopened);assert(!ldbDeepSeekAvailable(reopened));await assert.rejects(fresh.listModels(),/plugin settings/);assert.equal(requests,1);assert(saves>0);
 console.log('DeepSeek feature toggle: persistence, credential/preview/draft retention, command and service gates, failure rollback, cancellation and no automatic restart passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
