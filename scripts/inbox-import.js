// One-shot Mac import. Originals are never modified; no PDF parsing or network I/O.
async function importInboxFiles(base, files, deps={}) {
  const fs=deps.fs||require('fs').promises, path=require('path'), {Buffer}=require('buffer');
  const execFile=deps.execFile||require('child_process').execFile;
  const canonical=s=>s.normalize('NFC').toLowerCase();
  const inside=(parent,child)=>{const rel=path.relative(parent,child);return !rel||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));};
  const folder=deps.folder||'temp';
  if(!/^(temp|reviews\/[^/]+|submissions\/[^/]+)$/.test(folder)||folder.includes('..')||folder.includes('\\'))throw new Error('无效导入目录');
  const root=await fs.realpath(base), inbox=path.join(root,folder);
  await fs.mkdir(inbox,{recursive:true});
  if(!inside(root,await fs.realpath(inbox)))throw new Error('目标目录指向库外，已停止导入');
  const results=[],seen=new Set();
  for(const file of files){
    let stage;
    try{
      const source=await fs.realpath(file.path);
      if(seen.has(source))continue;seen.add(source);
      const filename=path.basename(source);
      if(!/\.pdf$/i.test(filename))throw new Error('只接收本地 PDF 文件');
      if(!(await fs.stat(source)).isFile())throw new Error('不是普通 PDF 文件');
      if(inside(root,source)){results.push({name:filename,skipped:true,reason:'已在本库，保留原位置'});continue;}
      const stem=filename.slice(0,-4), ext=filename.slice(-4), dir=path.dirname(source);
      const companions=(await fs.readdir(dir)).filter(n=>/\.(skim|fdf|xfdf)$/i.test(n)&&canonical(n.replace(/\.[^.]+$/,''))===canonical(stem));
      const group=[{source,ext},...companions.map(n=>({source:path.join(dir,n),ext:path.extname(n).toLowerCase()}))];
      if(new Set(group.map(f=>canonical(f.ext))).size!==group.length)throw new Error('有多个同类型批注文件，请先确认版本');
      for(const item of group)if(!(await fs.lstat(item.source)).isFile())throw new Error('PDF 或批注附件不是普通文件，请从原始目录导入');
      const staging=path.join(root,'.maintenance-imports');await fs.mkdir(staging,{recursive:true});
      if(!inside(root,await fs.realpath(staging)))throw new Error('导入暂存目录指向库外');
      stage=await fs.mkdtemp(path.join(staging,'drop-'));
      for(const item of group){
        item.staged=path.join(stage,'paper'+item.ext);
        // ditto preserves resource forks and Skim extended attributes on macOS.
        await new Promise((resolve,reject)=>execFile('/usr/bin/ditto',['--rsrc','--extattr',item.source,item.staged],error=>error?reject(new Error('复制 PDF 或批注失败，原件已保留')):resolve()));
      }
      let saved=false;
      for(let index=1;index<=10000&&!saved;index++){
        const suffix=index===1?'':` (${index})`;
        let short=stem;while(Buffer.byteLength(short+suffix+ext,'utf8')>240)short=Array.from(short).slice(0,-1).join('');
        const next=short+suffix;
        const occupied=new Set((await fs.readdir(inbox)).map(canonical));
        if(['.pdf','.skim','.fdf','.xfdf'].some(e=>occupied.has(canonical(next+e))))continue;
        const published=[];
        try{
          // Publish companions first and the PDF last; exclusive links never replace a file.
          for(const item of [...group.slice(1),group[0]]){
            const target=path.join(inbox,next+item.ext);
            await fs.link(item.staged,target);published.push({target,staged:item.staged});
          }
          results.push({name:filename,path:folder+'/'+next+ext,attachments:companions.length,renamed:next+ext!==filename});saved=true;
        }catch(error){
          for(const item of published.reverse()){
            const [current,original]=await Promise.all([fs.lstat(item.target).catch(()=>null),fs.lstat(item.staged)]);
            if(current&&current.dev===original.dev&&current.ino===original.ino)await fs.unlink(item.target);
          }
          if(error.code!=='EEXIST')throw error;
        }
      }
      if(!saved)throw new Error('同名文件过多，请先整理收件箱');
    }catch(error){results.push({name:file.name||path.basename(file.path||''),error:error.message});}
    finally{if(stage)await fs.rm(stage,{recursive:true,force:true}).catch(()=>{});}
  }
  return results;
}
// Clipboard access happens only after the user chooses Paste, never while rendering a menu.
function fileURLs(text){
  const {fileURLToPath}=require('url');
  return String(text).split(/\r?\n|\0/).filter(s=>/^file:\/\//i.test(s.trim())).flatMap(s=>{
    try{return [fileURLToPath(s.trim())];}catch(_){return [];}
  });
}
async function decodeFileList(buffer,deps={}){
  const execFile=deps.execFile||require('child_process').execFile;
  // Finder publishes an XML or binary property list. plutil parses both without evaluating text.
  const json=await new Promise((resolve,reject)=>{
    const child=execFile('/usr/bin/plutil',['-convert','json','-o','-','-'],{timeout:5000,maxBuffer:1024*1024},(error,stdout)=>error?reject(new Error('无法读取剪贴板文件列表')):resolve(stdout));
    child.stdin.on('error',()=>{});child.stdin.end(buffer);
  });
  const value=JSON.parse(json);if(!Array.isArray(value)||value.some(p=>typeof p!=='string'))throw new Error('剪贴板文件列表无效');return value;
}
async function readClipboardFiles(clipboard,deps={}){
  const {Buffer}=require('buffer'),path=require('path');const paths=[];let parseFailed=false;
  const consume=async(format,raw)=>{
    const data=Buffer.from(raw);if(!data.length)return;
    if(data.length>1024*1024)throw new Error('剪贴板文件列表过大，请分批复制');
    if(format==='NSFilenamesPboardType'){
      try{paths.push(...await decodeFileList(data,deps));}catch(_){parseFailed=true;}
    }else paths.push(...fileURLs(data.toString('utf8')));
  };
  const formats=['NSFilenamesPboardType','public.file-url','text/uri-list'];
  if(typeof clipboard?.readBuffer==='function'){
    for(const format of formats){let data;try{data=clipboard.readBuffer(format);}catch(_){continue;}await consume(format,data);}
  }else if(typeof clipboard?.read==='function'){
    // Newer Electron versions expose raw platform formats as ClipboardItems.
    const items=await clipboard.read();if(!Array.isArray(items))throw new Error('当前版本无法读取复制的文件');
    for(const item of items)for(const type of item.types){
      const format=type.match(/^electron application\/osclipboard;\s*format="([^"]+)"$/)?.[1]||type;
      if(formats.includes(format))await consume(format,await (await item.getType(type)).arrayBuffer());
    }
  }else throw new Error('当前版本无法读取复制的文件');
  if(paths.length>1000)throw new Error('一次最多粘贴 1000 个文件，请分批复制');
  const files=[...new Set(paths)].filter(p=>path.isAbsolute(p)&&!p.includes('\0')&&/\.pdf$/i.test(p)).map(p=>({path:p,name:path.basename(p)}));
  if(!files.length)throw new Error(parseFailed?'无法读取剪贴板文件列表，请从 Finder 重新复制 PDF':'剪贴板中没有本地 PDF，请先在 Finder 中复制文件');
  return files;
}
module.exports={importInboxFiles,readClipboardFiles,fileURLs,decodeFileList};
