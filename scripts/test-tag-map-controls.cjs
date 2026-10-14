'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Scope { constructor(parent){this.parent=parent;this.keys=[];}register(mod,key,func){const item={key,func};this.keys.push(item);return item;} }
class Modal { constructor(app){this.app=app;this.scope=new Scope(app.scope);this.scope.register([], 'Escape',()=>this.close());}get doc(){return 'read-only Obsidian document';}close(){this.wasClosed=true;} }
const api={module:{exports:{}},setTimeout,clearTimeout,require:name=>{assert.equal(name,'obsidian','The map bundle must load without Node dependencies');return {Plugin:class{},ItemView:class{},Modal,Scope,Platform:{isMobile:true}};}};
vm.runInNewContext(fs.readFileSync('main.js','utf8')+'\nmodule.exports.TagMapModal=TagMapModal;',api);
const view={app:{scope:{}},plugin:{},detailRow:{tags:''}},map=new api.module.exports.TagMapModal(view);
assert.equal(map.scope.keys.length,1,'Replace the modal scope so Escape is handled before Obsidian closes it');
let prevented=0,cancelled=0;map.editor={value:'Unfinished tag'};map.cancelEditor=()=>{map.editor=null;cancelled++;};
assert.equal(map.scope.keys[0].func({preventDefault(){prevented++;}}),false);assert.equal(cancelled,1);assert(!map.wasClosed,'First Escape must only cancel inline input');
map.scope.keys[0].func({preventDefault(){prevented++;}});assert(map.wasClosed);assert.equal(prevented,2);
map.wasClosed=false;map.busy=true;map.close();assert(!map.wasClosed,'Do not close during a write');map.close(true);assert(map.wasClosed,'Forced shutdown can close without blocking unload');
const I=require('./i18n');for(const file of ['scripts/tag-tree.js','scripts/tag-map-view.js'])for(const match of fs.readFileSync(file,'utf8').matchAll(/tr\('([^']+)'\)/g))if(/[\u3400-\u9fff]/.test(match[1]))assert(I.english[match[1]],'Missing translation: '+match[1]);
console.log('PASS: modal Escape scope, pending write guard, shutdown and bilingual tag-map messages without Node dependencies.');
