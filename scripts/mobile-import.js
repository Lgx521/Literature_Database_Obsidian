'use strict';
const {t:tr}=require('./i18n');
// Browser File objects and the vault API only. Never request a device filesystem path.
async function importFiles(vault,files,{folder='temp'}={}){
  if(!/^(temp|papers|reviews\/[^/]+|submissions\/[^/]+)$/.test(folder)||folder.includes('..')||folder.includes('\\'))throw Error(tr('无效导入目录'));
  const canonical=s=>s.normalize('NFC').toLowerCase(),stem=s=>canonical(s.replace(/\.[^.]+$/,''));
  const valid=file=>file&&typeof file.name==='string'&&!/[\\/\x00-\x1f]/.test(file.name)&&!file.name.startsWith('.')&&typeof file.arrayBuffer==='function';
  const pdfs=files.filter(f=>/\.pdf$/i.test(f.name||'')),results=[];
  let parent='';for(const part of folder.split('/')){parent+=(parent?'/':'')+part;if(!await vault.adapter.exists(parent))try{await vault.createFolder(parent);}catch(error){if(!await vault.adapter.exists(parent))throw error;}}
  for(const pdf of pdfs){
    let destination='';const saved=[];
    try{
      if(!valid(pdf))throw Error(tr('无效文件名'));
      const companions=files.filter(f=>/\.(skim|fdf|xfdf)$/i.test(f.name||'')&&stem(f.name)===stem(pdf.name));
      if(companions.length&&pdfs.filter(f=>stem(f.name)===stem(pdf.name)).length>1)throw Error(tr('批注对应多个同名 PDF，请分批导入'));
      const group=[...companions,pdf];
      if(group.some(f=>!valid(f))||new Set(group.map(f=>canonical(f.name.split('.').pop()))).size!==group.length)throw Error(tr('有多个同类型批注文件，请先确认版本'));
      // Each buffer is released after its write; no full-batch buffering on phones.
      for(let i=1;i<=10000;i++){
        const candidate=i===1?folder:folder+'/import-'+i;
        if(!await vault.adapter.exists(candidate))try{await vault.createFolder(candidate);}catch(error){if(!await vault.adapter.exists(candidate))throw error;}
        const listing=await vault.adapter.list(candidate),occupied=new Set([...listing.files,...listing.folders].map(p=>canonical(p.split('/').pop())));
        if(['pdf','skim','fdf','xfdf'].some(ext=>occupied.has(stem(pdf.name)+'.'+ext)))continue;
        destination=candidate;break;
      }
      if(!destination)throw Error(tr('同名文件过多，请先整理收件箱'));
      for(const file of group){
        const bytes=await file.arrayBuffer();
        // createBinary rejects existing paths; a concurrent import must never overwrite.
        const path=destination+'/'+file.name;await vault.createBinary(path,bytes);saved.push(path);
      }
      results.push({name:pdf.name,path:destination+'/'+pdf.name,attachments:companions.length,collision:destination!==folder,renamed:false});
    }catch(error){
      // Retain any already-written companion if interrupted; do not delete a synced edit.
      results.push({name:pdf.name,error:error.message+(saved.length?'；'+tr('附件保留在 ')+destination:'')});
    }
  }
  return results;
}
module.exports={importFiles};
