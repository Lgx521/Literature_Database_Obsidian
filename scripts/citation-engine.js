'use strict';
// Bundled locally, loaded on demand for deterministic metadata conversion or export.
// Only BibTeX and CSL plugins are registered. No DOI/URL lookup plugin.
const {Cite,plugins}=require('@citation-js/core');
require('@citation-js/plugin-bibtex');
require('@citation-js/plugin-csl');
const config=plugins.config.get('@csl');
config.styles.add('ldb-apa',require('./vendor/styles/apa.csl'));
config.styles.add('ldb-ieee',require('./vendor/styles/ieee.csl'));
function parseEntry(raw){
  if(typeof raw!=='string'||raw.length>100000)throw new Error('BibTeX 内容过长或无效');
  let records;try{records=new Cite(raw,{forceType:'@bibtex/text'}).data;}catch(e){throw new Error('BibTeX 解析失败：'+e.message);}
  if(records.length!==1)throw new Error('每篇文献必须对应一个 BibTeX 条目');
  const data=records[0],key=String(data['citation-key']||data.id||'');
  if(!/^[A-Za-z0-9_:.+\/-]+$/.test(key))throw new Error('引用键须为非空英文、数字或 _ : . + / -');
  const issues=[];
  if(!data.title?.trim())issues.push('标题');
  if(!data.author?.length||data.author.some(a=>!a.family&&!a.literal))issues.push('作者');
  const year=data.issued?.['date-parts']?.[0]?.[0];if(!Number.isInteger(year)||year<1000||year>2999)issues.push('年份');
  if(['article-journal','paper-conference','chapter'].includes(data.type)&&!data['container-title'])issues.push('期刊／会议／书名');
  if(['book','chapter'].includes(data.type)&&!data.publisher)issues.push('出版方');
  return {data:{...data,id:key},key,issues,raw:raw.trim()};
}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Keep the processor's formatting, never executable content from imported fields.
function safeHtml(html){
  return html.replace(/<[^>]*>/g,tag=>{
    if(/^<\/?(?:i|b|em|strong|sup|sub|br)\s*\/?\s*>$/i.test(tag))return tag;
    if(/^<\/(?:div|span|a)\s*>$/i.test(tag))return tag;
    const match=tag.match(/^<(div|span)\b/i);if(match){const cls=tag.match(/\bclass="([a-z -]+)"/i);return '<'+match[1]+(cls?' class="'+cls[1]+'"':'')+'>';}
    if(/^<a\b/i.test(tag)){const href=tag.match(/href="(https?:\/\/[^"<>]+)"/i);return href?'<a href="'+href[1]+'" rel="noreferrer">':'<a>';}
    return escape(tag);
  });
}
function documentHtml(title,bibliography){return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>'+escape(title)+'</title><style>body{max-width:900px;margin:48px auto;padding:0 24px;font:16px/1.6 Georgia,serif}h1{font:600 20px/1.4 system-ui}.csl-entry{margin:0 0 14px 2em;text-indent:-2em}.csl-left-margin{float:left;min-width:2em}.csl-right-inline{margin-left:2em;text-indent:0}a{color:inherit}</style></head><body><h1>'+escape(title)+'</h1>'+safeHtml(bibliography)+'</body></html>';}
function exportRows(rows,format,title='References'){
  if(!['apa','ieee','bibtex','titles'].includes(format))throw new Error('无效导出格式');
  const missing=[],ready=[];const seenPaths=new Set();
  for(const row of rows){
    if(seenPaths.has(row.path))continue;seenPaths.add(row.path);
    if(!row.bibtex?.trim()){missing.push({row,reason:row.citationError||'未识别到完整引用资料'});continue;}
    try{const entry=parseEntry(row.bibtex);if(entry.issues.length)missing.push({row,reason:'缺少'+entry.issues.join('、')});else ready.push({row,...entry});}
    catch(error){missing.push({row,reason:error.message});}
  }
  const collision=new Set();for(const entry of ready){const others=ready.filter(e=>e.key===entry.key);if(others.length>1)for(const e of others)collision.add(e);}
  const entries=ready.filter(entry=>{if(!collision.has(entry))return true;missing.push({row:entry.row,reason:'重复引用键 '+entry.key});return false;});
  const report=missing.map(({row,reason})=>row.filename+'\n  '+reason+'\n  '+row.path+(row.citationSource?'\n  来源：'+row.citationSource:'')).join('\n\n');
  if(format==='titles'){
    const titles=[],missing=[];
    for(const row of [...new Map(rows.map(row=>[row.path,row])).values()]){
      let title=row.title?.trim()||'';try{if(!title&&row.bibtex)title=parseEntry(row.bibtex).data.title||'';}catch(_){}
      if(title&&!/\.pdf$/i.test(title))titles.push(title.replace(/\s+/g,' '));
      else missing.push({row,reason:'尚未取得论文篇名'});
    }
    const text=titles.join('\n');return {text,content:text?(text+'\n'):'',extension:'txt',ready:titles.length,missing,report:missing.map(({row,reason})=>row.path+'\n  '+reason).join('\n\n')};
  }
  if(!entries.length)return {text:'',content:'',extension:format==='bibtex'?'bib':'html',ready:0,missing,report};
  if(format==='bibtex'){
    const text=entries.map(e=>e.raw).join('\n\n')+'\n';return {text,content:text,extension:'bib',ready:entries.length,missing,report};
  }
  const cite=new Cite(entries.map(e=>e.data)),options={style:'ldb-'+format,lang:'en-US'};
  const text=cite.format('bibliography',{...options,format:'text'}),html=cite.format('bibliography',{...options,format:'html'});
  return {text,html:safeHtml(html),content:documentHtml(title,html),extension:'html',ready:entries.length,missing,report};
}
function fromCsl(data,key){
  if(!/^[A-Za-z0-9_:.+\/-]+$/.test(key))throw new Error('无效引用键');
  data=Object.fromEntries(Object.entries(data).filter(([,v])=>v!==undefined&&v!==null&&v!==''));
  const raw=new Cite({...data,id:key,'citation-key':key}).format('bibtex');
  const bibtex=raw.replace(/^(@[^{]+\{)[^,]+,/,(_,prefix)=>prefix+key+',').trim();
  const parsed=parseEntry(bibtex);if(parsed.issues.length)throw new Error('来源缺少'+parsed.issues.join('、'));
  return {bibtex,title:parsed.data.title};
}
module.exports={parseEntry,exportRows,safeHtml,fromCsl};
