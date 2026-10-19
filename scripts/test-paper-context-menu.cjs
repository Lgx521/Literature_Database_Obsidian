'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const doc={addEventListener(){},removeEventListener(){},defaultView:{addEventListener(){},removeEventListener(){}}};
class Element{
 constructor(o={}){this.children=[];this.events={};this.dataset={};this.ownerDocument=doc;this.textContent=o?.text||'';}
 createEl(tag,o){const e=new Element(o);this.children.push(e);return e;}createDiv(o){return this.createEl('div',o);}createSpan(o){return this.createEl('span',o);}
 addEventListener(n,f){this.events[n]=f;}removeEventListener(){}addClass(){}removeClass(){}setAttribute(){}empty(){this.children=[];}
}
class ItemView{constructor(){this.contentEl=new Element();this.app={workspace:{requestSaveLayout(){}}};}registerDomEvent(el,event,fn){el.addEventListener(event,fn);}}
class Menu{
 constructor(){this.items=[];Menu.last=this;}
 addItem(fn){const item={setTitle(v){this.title=v;return this;},setIcon(){return this;},setDisabled(v){this.disabled=v;return this;},onClick(fn){this.click=fn;return this;}};fn(item);this.items.push(item);return this;}
 showAtMouseEvent(){}
}
class TFile{constructor(p){this.path=p;this.extension=p.split('.').pop();}}
const platform={isDesktopApp:true,isMacOS:true,isMobile:false},notices=[],revealed=[],imports=[];
const ctx={module:{exports:{}},require:name=>{
 if(name==='obsidian')return {Plugin:class{},ItemView,Modal:class{},Menu,TFile,Platform:platform,setIcon(){},Notice:class{constructor(message){notices.push(message);}}};
 imports.push(name);if(name==='electron')return {shell:{showItemInFolder:fullPath=>revealed.push(fullPath)}};
 assert.equal(name,'path','Reveal must not start a shell, read PDFs or enumerate files');return path;
}};
vm.runInNewContext(fs.readFileSync('main.js','utf8')+'\nmodule.exports.Browser=LiteratureBrowser;',ctx);
(async()=>{
 const plugin=new ctx.module.exports(),pdf='papers/中文 $ (a) #%.pdf',review='reviews/Conference/paper.pdf',files=new Map([pdf,review,'library.md','../outside.pdf'].map(p=>[p,new TFile(p)]));
 plugin.app={vault:{adapter:{getBasePath:()=>'/vault',exists:async p=>files.has(p)},getAbstractFileByPath:p=>files.get(p)}};
 plugin.settings={deepSeekBetaEnabled:true};plugin.snapshot={collections:[{scope:'library',name:'Robotics',subgroups:['RL'],members:[]},{scope:'projects',name:'Writing',subgroups:['Related work'],members:[]}]};plugin.hasPendingEdit=()=>false;
 const view=new ctx.module.exports.Browser({},plugin);view.reload=async()=>{};await view.onOpen();
 const row={path:pdf,filename:'中文 $ (a) #%.pdf'},other={path:'papers/other.pdf'};
 function menu(scope,category,clicked=row){view.scope=scope;view.filters.category=category;view.rows=view.visibleRows=[clicked,other];view.selectedPaths=new Set([clicked.path,other.path]);view.listEl.events.contextmenu({target:{closest:()=>({dataset:{paperPath:clicked.path}})},preventDefault(){},clientX:10,clientY:10});return Menu.last;}
 let m=menu('library','Robotics'),labels=m.items.map(i=>i.title);
 assert.equal(labels[0],'在 Finder 中显示');assert.equal(labels.indexOf('设置子类…'),labels.indexOf('加入分类／项目…')+1);assert.deepEqual(labels.slice(-3),['导出选中文献…','从当前分类移除','移至回收站']);assert.equal(imports.length,0,'Opening a menu must not import desktop modules');
 await m.items[0].click();assert.deepEqual(revealed,[path.resolve('/vault',pdf)],'Reveal only the clicked PDF, preserving spaces, Unicode and shell metacharacters');
 m=menu('projects','Writing');assert.deepEqual(m.items.slice(-2).map(i=>i.title),['从当前项目移除','移至回收站']);
 m=menu('library','');assert(!m.items.some(i=>i.title==='从当前分类移除'));
 m=menu('inbox','',{path:pdf});await m.items[0].click();assert.equal(revealed.at(-1),path.resolve('/vault',pdf));
 m=menu('reviews','Conference',{path:'review-record-id',pdfPath:review});await m.items[0].click();assert.equal(revealed.at(-1),path.resolve('/vault',review));
 m=menu('submissions','Conference',{path:'submission-record-id',pdfPath:''});assert(m.items[0].disabled);
 platform.isMacOS=false;assert.equal(menu('library','Robotics').items[0].title,'在文件管理器中显示');
 const calls=revealed.length;await plugin.revealPDF('missing.pdf');await plugin.revealPDF('library.md');await plugin.revealPDF('../outside.pdf');assert.equal(revealed.length,calls);assert.equal(notices.length,3);
 const count=imports.length;platform.isMobile=true;platform.isDesktopApp=false;assert(!menu('library','Robotics').items.some(i=>i.title.includes('Finder')||i.title.includes('文件管理器')));await plugin.revealPDF(pdf);assert.equal(imports.length,count,'Mobile cannot load Electron or Node for reveal');assert.equal(revealed.length,calls);
 await view.onClose();console.log('PASS: context menu order, clicked-file reveal, public/inbox/manuscript paths, unavailable files, desktop labels and mobile exclusion.');
})().catch(e=>{console.error(e);process.exitCode=1;});
