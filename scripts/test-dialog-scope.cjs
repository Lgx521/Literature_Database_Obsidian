'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Scope{handleKey(){return false;}}
class Modal{constructor(app){this.app=app;this.scope=new Scope();}}
const context={module:{exports:{}},require:n=>{assert.equal(n,'obsidian');return {Plugin:class{},ItemView:class{},Modal,Scope,Platform:{isMobile:false}};}};
const source=fs.readFileSync('main.js','utf8');
vm.runInNewContext(source+'\nmodule.exports.dialogs=[CategoryModal,VenueModal,VenueDeadlineModal];',context);
for(const Dialog of context.module.exports.dialogs){const modal=new Dialog({app:{}},'projects','Synthetic project');assert(modal.scope instanceof Scope,'Retain native keyboard scope');assert.equal(typeof modal.scope.handleKey,'function');assert.equal(modal.libraryScope,'projects');}
assert(!source.includes('class AgentMcpService'),'Retired MCP listener is not bundled');
assert(!source.includes('new AgentMcpModal'),'Retired MCP interface is not reachable');
console.log('Secondary dialogs preserve the native keyboard scope; no retired MCP listener.');
