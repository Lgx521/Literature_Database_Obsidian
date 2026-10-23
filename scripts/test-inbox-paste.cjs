const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const I=require('./inbox-import');
const xml='<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><array><string>/tmp/论文 &amp; paper.pdf</string><string>/tmp/B.PDF</string><string>/tmp/notes.txt</string></array></plist>';
const raw=Buffer.from(xml),reads=[];
const clipboard={readBuffer(format){reads.push(format);return format==='NSFilenamesPboardType'?raw:format==='public.file-url'?Buffer.from('file:///tmp/B.PDF\0'):Buffer.alloc(0);}};
const testDocument={addEventListener(){},removeEventListener(){},defaultView:{addEventListener(){},removeEventListener(){}}};
class Element{
 constructor(options={}){this.children=[];this.events={};this.dataset={};this.textContent=options.text||'';this.ownerDocument=testDocument;}
 createEl(tag,o){const e=new Element(o);e.tag=tag;this.children.push(e);return e;}createDiv(o){return this.createEl('div',o);}createSpan(o){return this.createEl('span',o);}
 addEventListener(n,f){this.events[n]=f;}removeEventListener(){}addClass(){}removeClass(){}setAttribute(){}empty(){this.children=[];}
}
const menus=[],notices=[];
class Menu{
 constructor(){this.items=[];menus.push(this);}setUseNativeMenu(v){this.native=v;return this;}
 addItem(fn){const item={setTitle(v){this.title=v;return this;},setIcon(){return this;},setDisabled(v){this.disabled=v;return this;},onClick(fn){this.click=fn;return this;}};fn(item);this.items.push(item);return this;}
 showAtMouseEvent(e){this.event=e;}
}
class ItemView{constructor(){this.contentEl=new Element();this.app={workspace:{requestSaveLayout(){}}};}registerDomEvent(el,event,fn){el.addEventListener(event,fn);}}
const platform={isDesktopApp:true,isMacOS:true};
const ctx={module:{exports:{}},require:n=>n==='obsidian'?{Plugin:class{},ItemView,Modal:class{},Platform:platform,Menu,setIcon(){},Notice:class{constructor(m){notices.push(m);}}}:n==='electron'?{clipboard}:require(n)};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8')+'\nmodule.exports.Browser=LiteratureBrowser;',ctx);
(async()=>{
 const files=await I.readClipboardFiles(clipboard);assert.deepEqual(files,[{path:'/tmp/论文 & paper.pdf',name:'论文 & paper.pdf'},{path:'/tmp/B.PDF',name:'B.PDF'}]);
 const binary=await new Promise((resolve,reject)=>{const child=require('child_process').execFile('/usr/bin/plutil',['-convert','binary1','-o','-','-'],{encoding:'buffer'},(e,out)=>e?reject(e):resolve(out));child.stdin.end(raw);});
 assert.deepEqual(await I.decodeFileList(binary),['/tmp/论文 & paper.pdf','/tmp/B.PDF','/tmp/notes.txt']);
 const fallback=await I.readClipboardFiles({readBuffer:f=>Buffer.from(f==='NSFilenamesPboardType'?'broken':f==='public.file-url'?'file:///tmp/A%20%23%25.pdf':'')});assert.equal(fallback[0].path,'/tmp/A #%.pdf');
 await assert.rejects(I.readClipboardFiles({readBuffer:()=>Buffer.alloc(0)}),/没有本地 PDF/);
 await assert.rejects(I.readClipboardFiles({readBuffer:f=>Buffer.from(f==='text/uri-list'?'https://example.com/A.pdf\nfile://remote/A.pdf':'')}),/没有本地 PDF/);
 await assert.rejects(I.readClipboardFiles({readBuffer:()=>Buffer.alloc(1024*1024+1)}),/过大/);
 const modern=await I.readClipboardFiles({read:async()=>[{types:['electron application/osclipboard;format="NSFilenamesPboardType"'],getType:async()=>({arrayBuffer:async()=>raw})}]});assert.deepEqual(modern,files);
 // Exercise the actual copy path using clipboard-decoded file URLs and a matching Skim sidecar.
 const tmp=await fs.promises.mkdtemp(path.join(os.tmpdir(),'ldb-paste-test-'));
 try{
  const base=path.join(tmp,'vault'),external=path.join(tmp,'external');await fs.promises.mkdir(base);await fs.promises.mkdir(external);
  const pdf=path.join(external,'Literal $ (paper).pdf'),skim=pdf.slice(0,-4)+'.skim';await fs.promises.writeFile(pdf,'%PDF test');await fs.promises.writeFile(skim,'personal notes');
  const pasted=await I.readClipboardFiles({readBuffer:f=>Buffer.from(f==='public.file-url'?require('url').pathToFileURL(pdf).href:'')});
  const first=await I.importInboxFiles(base,pasted),second=await I.importInboxFiles(base,pasted);
  assert.equal(first[0].attachments,1);assert(second[0].collision);assert.equal(second[0].path.split('/').pop(),path.basename(pdf));assert.equal(second[0].renamed,false);assert.equal(await fs.promises.readFile(skim,'utf8'),'personal notes');assert.equal(await fs.promises.readFile(path.join(base,first[0].path.slice(0,-4)+'.skim'),'utf8'),'personal notes');
 }finally{await fs.promises.rm(tmp,{recursive:true,force:true});}
 const plugin=new ctx.module.exports();plugin.stopped=false;let imports=[];plugin.importDroppedFiles=async(files,nav)=>{imports.push({files,nav});return 'imported';};
 const view=new ctx.module.exports.Browser({},plugin);view.scope='inbox';view.reload=async()=>{};await view.onOpen();
 const previous=reads.length,event={target:{closest:()=>null},preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}};
 view.listEl.events.contextmenu(event);assert(event.prevented&&event.stopped);const menu=menus.at(-1);assert(menu.native);assert.equal(menu.items[0].title,'粘贴');assert.equal(reads.length,previous,'Opening the menu never reads the clipboard.');
 await menu.items[0].click();assert.equal(imports.length,1);assert.equal(imports[0].nav.scope,'inbox');assert.equal(imports[0].files.length,2);
 plugin.importing=true;view.listEl.events.contextmenu(event);assert(menus.at(-1).items[0].disabled);await assert.rejects(plugin.pasteInboxFiles(),/等待/);plugin.importing=false;
 const n=menus.length;view.scope='library';view.listEl.events.contextmenu(event);assert.equal(menus.length,n+1,'Public collections accept pasted web links.');
 const row={title:'Actual Paper Title',filename:'1234v2.pdf'};assert.equal(view.detailTitle(row),row.title);assert.equal(view.detailTitle({...row,title:''}),row.filename);view.scope='projects';assert.equal(view.detailTitle(row),row.title);view.scope='inbox';assert.equal(view.detailTitle(row),row.filename);
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../manifest.json'),'utf8'));assert.equal(manifest.name,'Literature Database');assert.equal(manifest.author,'shengzhegan');
 console.log('PASS: Finder XML/binary file lists, multi-file/file-URL import, Unicode paths, clipboard access only on Paste, native blank-space menu, busy state, sidecar/original preservation, filename collisions, real detail titles and plugin identity.');
})().catch(e=>{console.error(e);process.exitCode=1;});
