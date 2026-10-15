'use strict';
// Read actual user-selected exports, not model-supplied bibliography. All paths
// are confined to a single grant; symlinks and absolute exported paths are refused.
function bibEntries(text){
 const entries=[];let i=0;
 while(i<text.length){const match=/@([a-z]+)\s*\{/ig;match.lastIndex=i;const m=match.exec(text);if(!m)break;let depth=1,quoted=false,j=match.lastIndex;
  for(;j<text.length&&depth;j++){const c=text[j];if(c==='\\'){j++;continue;}if(c==='"'&&depth===1)quoted=!quoted;if(!quoted){if(c==='{')depth++;if(c==='}')depth--;}}
  if(depth)throw Error('Incomplete BibTeX export');const raw=text.slice(m.index,j);i=j;
  if(!['comment','string','preamble'].includes(m[1].toLowerCase()))entries.push(raw);
 }return entries;
}
function fileField(raw){
 // Zotero's native BibTeX export writes a braced file field. Walk balanced braces
 // instead of guessing a title-to-PDF association.
 let depth=0,quoted=false;
 for(let i=raw.indexOf('{');i>=0&&i<raw.length;i++){
  const c=raw[i];if(c==='\\'){i++;continue;}if(c==='"'&&depth===1)quoted=!quoted;
  if(quoted)continue;
  if(c==='{')depth++;else if(c==='}')depth--;
  if(c!==','||depth!==1)continue;
  const match=/^\s*file\s*=\s*\{/i.exec(raw.slice(i+1));if(!match)continue;
  let value='',level=1;for(let j=i+1+match[0].length;j<raw.length;j++){
   const char=raw[j];if(char==='\\'&&j+1<raw.length){value+=char+raw[++j];continue;}
   if(char==='{')level++;if(char==='}'&&!--level)return value;value+=char;
  }
 }
 return '';
}
async function scan(root){
 const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
 root=await fs.realpath(root);const files=[],exports=[],warnings=[];let visited=0;
 const walk=async(dir,depth)=>{if(depth>12)throw Error('Export folder is too deeply nested');for(const d of await fs.readdir(dir,{withFileTypes:true})){
  if(++visited>20000)throw Error('Select a smaller export folder (maximum 20,000 entries)');if(d.isSymbolicLink()||d.name.startsWith('.'))continue;
  const absolute=path.join(dir,d.name);if(d.isDirectory())await walk(absolute,depth+1);
  else if(d.isFile()&&/\.(pdf|bib)$/i.test(d.name)){const stat=await fs.stat(absolute),relative=path.relative(root,absolute).split(path.sep).join('/'),revision=crypto.createHash('sha256').update(relative+'\0'+stat.size+'\0'+stat.mtimeMs).digest('hex');const entry={file:relative,size:stat.size,mtime:stat.mtimeMs,revision};(/\.pdf$/i.test(d.name)?files:exports).push(entry);}
 }};await walk(root,0);
 const references=new Map(),pdfPaths=new Set(files.map(f=>f.file));let bibliographyBytes=0;
 if(exports.length>100)throw Error('Select a smaller export folder (maximum 100 bibliography files)');
 for(const exported of exports){
  if(exported.size>10*1024*1024){warnings.push(exported.file+': BibTeX exceeds 10 MB');continue;}
  bibliographyBytes+=exported.size;if(bibliographyBytes>30*1024*1024)throw Error('Bibliography exports exceed 30 MB; split this migration into batches');
  const raw=await fs.readFile(path.join(root,exported.file),'utf8');
  let entries;try{entries=bibEntries(raw);}catch(e){warnings.push(exported.file+': '+e.message);continue;}
  for(const entry of entries){const field=fileField(entry);if(!field)continue;
   const matched=[...new Set(field.split(/(?<!\\);/).flatMap(part=>{
    const values=part.trim().split(/(?<!\\):/),value=values.length===1?values[0]:values.length===3&&/^(application\/pdf|pdf)$/i.test(values[2])?values[1]:'';
    if(!value)return [];const relative=value.replace(/\\([{}_:;])/g,'$1');if(path.posix.isAbsolute(relative)||relative.includes('\\'))return [];
    const key=path.posix.normalize(path.posix.join(path.posix.dirname(exported.file),relative));return pdfPaths.has(key)?[key]:[];
   }))];
   if(matched.length!==1){warnings.push(exported.file+': unmatched or ambiguous attachment');continue;}
   const key=matched[0];if(references.has(key)){references.set(key,null);warnings.push(key+': multiple bibliographic entries; citation will be left empty');}
   else references.set(key,{raw:entry,exportFile:exported.file,exportHash:crypto.createHash('sha256').update(raw).digest('hex')});
  }
 }
 return {root,files:files.sort((a,b)=>a.file.localeCompare(b.file)),references,warnings};
}
async function resolve(grant,relative){
 const fs=require('node:fs/promises'),path=require('node:path');
 if(typeof relative!=='string'||relative.includes('\\')||relative.split('/').some(p=>!p||p==='.'||p==='..')||path.isAbsolute(relative))throw Error('Invalid relative export path');
 const absolute=path.join(grant.root,...relative.split('/')),real=await fs.realpath(absolute);
 if(real!==absolute||!real.startsWith(grant.root+path.sep))throw Error('Export path escaped its selected folder');
 return real;
}
async function verify(grant,file,revision){
 const fs=require('node:fs/promises'),crypto=require('node:crypto'),entry=grant.files.find(f=>f.file===file);
 if(!entry||entry.revision!==revision)throw Error('Unknown or stale export file; scan again');
 const absolute=await resolve(grant,file),stat=await fs.stat(absolute);
 if(stat.size!==entry.size||stat.mtimeMs!==entry.mtime)throw Error('Export PDF changed; select the folder again');
 const reference=grant.references.get(file);
 if(reference){const bib=await resolve(grant,reference.exportFile),raw=await fs.readFile(bib,'utf8');if(crypto.createHash('sha256').update(raw).digest('hex')!==reference.exportHash)throw Error('Bibliography export changed; select the folder again');}
 return {absolute,reference};
}
module.exports={scan,resolve,verify,bibEntries,fileField};
