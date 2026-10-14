const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),C=require('./collections');
class Element{
 constructor(tag='div',o={}){if(typeof o==='string')o={cls:o};this.tag=tag;this.children=[];this.events={};this.attributes={...o.attr};this.textContent=o.text||'';this.className=o.cls||'';this.value='';this.ownerDocument=doc;}
 get isConnected(){return this===root||!!this.parentElement?.isConnected;}get lastElementChild(){return this.children.at(-1);}get classes(){return new Set(this.className.split(/\s+/));}
 createEl(tag,o){const e=new Element(tag,o);this.appendChild(e);return e;}createDiv(o){return this.createEl('div',o);}createSpan(o){return this.createEl('span',o);}
 detach(){const p=this.parentElement;if(p)p.children.splice(p.children.indexOf(this),1);this.parentElement=null;}appendChild(e){e.detach();e.parentElement=this;this.children.push(e);}prepend(e){e.detach();e.parentElement=this;this.children.unshift(e);}after(e){const p=this.parentElement;e.parentElement=p;p.children.splice(p.children.indexOf(this)+1,0,e);}replaceWith(e){const p=this.parentElement;e.parentElement=p;p.children.splice(p.children.indexOf(this),1,e);this.parentElement=null;}
 empty(){for(const c of this.children)c.parentElement=null;this.children=[];}setText(t){this.textContent=t;}addEventListener(n,f){const previous=this.events[n];this.events[n]=previous?e=>{previous(e);return f(e);}:f;}addClass(c){this.className+=' '+c;}removeClass(c){this.className=[...this.classes].filter(s=>s!==c).join(' ');}toggleClass(c,v){v?this.addClass(c):this.removeClass(c);}setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];}focus(){this.focused=true;doc.activeElement=this;}select(){}contains(e){return e===this||this.children.some(c=>c.contains(e));}getBoundingClientRect(){return {left:0,bottom:30,top:0,height:30};}
 querySelector(s){return this.querySelectorAll(s)[0];}querySelectorAll(s){const all=this.children.flatMap(c=>[c,...c.querySelectorAll('*')]);return s==='*'?all:all.filter(e=>s.startsWith('.')&&e.classes.has(s.slice(1)));}
}
const doc={hidden:false,activeElement:null,createElement:tag=>new Element(tag)},root=new Element();
class ItemView{constructor(){this.contentEl=root;this.app={workspace:{requestSaveLayout(){}}};}async setState(){}}
class Menu{constructor(){this.items=[];Menu.last=this;}setUseNativeMenu(){return this;}addItem(fn){const item={};for(const [m,key]of [['setTitle','title'],['setIcon','icon'],['onClick','action']])item[m]=v=>(item[key]=v,item);fn(item);this.items.push(item);}showAtPosition(){}showAtMouseEvent(){}}
const notices=[],ctx={module:{exports:{}},clearTimeout,setTimeout,require:n=>n==='obsidian'?{Plugin:class{},ItemView,Modal:class{},Menu,Platform:{},Notice:class{constructor(t){notices.push(t);}},setIcon(){}}:require(n)};
vm.runInNewContext(fs.readFileSync('main.js','utf8')+'\nmodule.exports.Navigation=LibraryNavigation;',ctx);
(async()=>{
 let text=C.add(C.empty(),'library','Parent');text=C.change(text,['papers/One.pdf'],{scope:'library',name:'Parent'});for(const c of ['Methods','Experiments'])text=C.addChild(text,'library','Parent',c);
 let pending=false,fail=false;const calls=[];
 const plugin={navigation:{scope:'library',category:'Parent',subgroup:null},hasPendingEdit:()=>pending,stagingGroup:()=> '暂存区',openLibrary:nav=>calls.push(nav),async editChild(action,scope,parent,child,value,expected){if(fail)throw Error('Injected failure');text=action==='add'?C.addChild(text,scope,parent,value,expected):action==='rename'?C.renameChild(text,scope,parent,child,value,expected):C.removeChild(text,scope,parent,child,expected);refresh();}};
 const refresh=()=>{plugin.snapshot={library:[{path:'papers/One.pdf',categories:['Parent'],projects:[],tags:'#one #two'}],collections:C.parse(text).groups,categories:['Parent'],groups:{projects:[],reviews:[],submissions:[]},inbox:[],reviews:[],submissions:[],deadlines:{}};};refresh();
 const view=new ctx.module.exports.Navigation({},plugin);view.render();
 const parent=()=>root.querySelectorAll('.ldb-nav-item').find(e=>e.attributes['aria-label']==='Parent');
 const child=n=>root.querySelectorAll('.is-subgroup').find(e=>e.attributes['aria-label']===n);
 assert(child('Methods'));assert(child('Experiments'));assert(child('未分组'));assert.equal(child('未分组').querySelector('.ldb-nav-count').textContent,'1');
 child('Methods').events.click();assert.equal(calls.pop().subgroup,'Methods');
 const event=key=>({key,preventDefault(){},stopPropagation(){}});
 const pnode=parent(),method=child('Methods'),toggle=pnode.querySelector('.ldb-tree-toggle'),region=root.querySelector('.ldb-nav-children');
 const originalRender=view.render;let renders=0;view.render=function(){renders++;return originalRender.call(this);};
 method.focus();toggle.events.click(event());assert.equal(region.inert,true);assert.equal(region.attributes['aria-hidden'],'true');assert(region.classes.has('is-collapsed'));assert.equal(view.getState().collapsed.length,1);assert.equal(doc.activeElement,toggle);
 assert.equal(root.querySelectorAll('.is-subgroup').length,3);assert.equal(child('Methods'),method);assert.equal(parent(),pnode);assert.equal(renders,0,'Folding must not recreate unrelated controls');
 toggle.events.keydown(event('Enter'));assert.equal(region.inert,false);assert.equal(toggle.attributes['aria-expanded'],'true');assert(!region.classes.has('is-collapsed'));
 for(let i=0;i<4;i++)toggle.events.click(event());assert.equal(region.inert,false);assert.equal(child('Methods'),method);assert.equal(renders,0);
 plugin.groupDrag={};toggle.events.click(event());assert.equal(region.inert,false);plugin.groupDrag=null;
 toggle.events.click(event());view.render();assert.equal(root.querySelector('.ldb-nav-children').inert,true,'Ordinary refresh retains the collapsed state');assert.equal(parent().querySelector('.ldb-tree-toggle').attributes['aria-expanded'],'false');
 parent().querySelector('.ldb-tree-toggle').events.keydown(event(' '));assert.equal(root.querySelector('.ldb-nav-children').inert,false);
 view.beginChildEdit(parent(),'library','Parent');let input=root.querySelector('.ldb-nav-rename-input');assert(input);parent().querySelector('.ldb-tree-toggle').events.click(event());assert.equal(root.querySelector('.ldb-nav-children').inert,false,'Do not hide an active inline editor');input.value='Background';input.events.keydown(event('Enter'));await new Promise(r=>setTimeout(r,0));assert(child('Background'));assert.equal(view.renaming,null);
 view.beginChildEdit(child('Background'),'library','Parent','Background');input=root.querySelector('.ldb-nav-rename-input');input.value='Motivation';input.events.keydown(event('Enter'));await new Promise(r=>setTimeout(r,0));assert(child('Motivation'));assert(!child('Background'));
 fail=true;view.beginChildEdit(parent(),'library','Parent');input=root.querySelector('.ldb-nav-rename-input');input.value='Unsaved';input.events.keydown(event('Enter'));await new Promise(r=>setTimeout(r,0));assert.equal(input.value,'Unsaved');assert.equal(input.readOnly,false);assert(notices.includes('Injected failure'));input.events.keydown(event('Escape'));fail=false;assert(!root.querySelector('.ldb-nav-rename-input'));
 pending=true;view.beginChildEdit(parent(),'library','Parent');assert(!root.querySelector('.ldb-nav-rename-input'));pending=false;
 child('Motivation').events.contextmenu(event());await Menu.last.items.find(i=>i.title.includes('删除子类')).action();view.render();assert(!child('Motivation'));assert.equal(plugin.snapshot.library.length,1);
 plugin.navigation={scope:'library',category:'Parent',subgroup:'Methods'};view.render();assert(child('Methods').classes.has('is-active'));assert(!parent().classes.has('is-active'));
 view.stopCountdowns();console.log('PASS: nested sidebar counts, distinct child navigation, animated fold DOM retention, rapid reversal, keyboard focus, hidden-child isolation, refresh state, drag/edit guards, inline create/rename/cancel, failed-save draft retention, Notes guard, safe child deletion and active state.');
})().catch(e=>{console.error(e);process.exitCode=1;});
