'use strict';
const {t:tr}=require('./i18n');
const STATES=['待整理','AI 已整理','人工完成','自动整理'];
const hash=value=>require('crypto').createHash('sha256').update(String(value),'utf8').digest('hex');
function parse(value){
  if(!value)return {v:1,fields:{},tags:{}};
  let data;try{data=typeof value==='string'?JSON.parse(value):value;}catch(_){throw new Error(tr('整理来源格式无效'));}
  if(!data||data.v!==1||!data.fields||!data.tags||typeof data.fields!=='object'||typeof data.tags!=='object'||Array.isArray(data.fields)||Array.isArray(data.tags))throw new Error(tr('整理来源格式无效'));
  for(const entries of [data.fields,data.tags])for(const [key,entry]of Object.entries(entries)){
    if(['__proto__','constructor','prototype'].includes(key)||!entry||!['human','ai','system','import'].includes(entry.kind)||typeof entry.name!=='string'||entry.name.length>80||!/^[a-f0-9]{64}$/.test(entry.hash)||(entry.evidence!==undefined&&(typeof entry.evidence!=='string'||entry.evidence.length>2000)))throw new Error(tr('整理来源格式无效'));
  }
  return JSON.parse(JSON.stringify(data));
}
function source(row,key,tag=false){
  const entry=row.provenance?.[tag?'tags':'fields']?.[key];
  const value=tag?key:row[key]||'';
  return entry&&entry.hash===hash(value)?entry:{kind:'unknown',name:''};
}
function temporaryTitle(row){return !row.title?.trim()||source(row,'title').kind==='import';}
function needsPublication(row){return row.organizing!=='人工完成'&&(!row.published||row.published==='待核实'||(/^\d{4}$/.test(row.published)&&source(row,'published').kind==='system'));}
function acceptsPublication(row,value){return !!value&&needsPublication(row)&&(!/^\d{4}$/.test(row.published)||value.startsWith(row.published+'.'));}
function pending(row){return row.organizing!=='人工完成'&&(row.organizing!=='AI 已整理'||temporaryTitle(row)||!row.tags?.trim()||!row.tldr?.trim()||row.tldr==='待整理');}
function apply(row,changes,actor){
  if(!actor)return changes;
  if(!['human','ai','system','import'].includes(actor.kind)||!actor.name||actor.name.length>80)throw new Error(tr('整理来源格式无效'));
  if(actor.kind==='ai'){
    if(row.organizing==='人工完成')throw new Error(tr('此文献已人工完成，Agent 不可修改'));
    if(Object.keys(changes).some(k=>!['title','tldr','tags','published','organizing'].includes(k))||['人工完成','自动整理'].includes(changes.organizing))throw new Error(tr('Agent 只能补充篇名、标签、摘要和整理状态'));
    for(const key of ['title','tldr','published'])if(key in changes&&changes[key]!==row[key]){
      const previous=source(row,key),empty=!row[key]||['待整理','待核实'].includes(row[key]);
      if(!empty&&!(key==='title'&&temporaryTitle(row))&&!(previous.kind==='ai'&&previous.name===actor.name))throw new Error(tr('人工或未知来源的内容已保留，请提供补充建议'));
    }
    if('tags' in changes){const next=new Set(String(changes.tags).split(/\s+/));if(String(row.tags||'').split(/\s+/).filter(Boolean).some(t=>!next.has(t)))throw new Error(tr('Agent 不可移除已有标签'));}
  }
  const provenance=parse(row.provenance),stamp=value=>({kind:actor.kind,name:actor.name,hash:hash(value)});
  for(const key of ['title','tldr','published'])if(key in changes&&String(changes[key])!==String(row[key]||'')){
    provenance.fields[key]=stamp(String(changes[key]));
    if(actor.evidence?.[key])provenance.fields[key].evidence=String(actor.evidence[key]);
  }
  if('tags' in changes){
    const before=new Set(String(row.tags||'').split(/\s+/).filter(Boolean)),after=String(changes.tags).split(/\s+/).filter(Boolean);
    const tags={};for(const tag of after){if(!tag.startsWith('#'))continue;if(!before.has(tag))tags[tag]=stamp(tag);else if(provenance.tags[tag])tags[tag]=provenance.tags[tag];}provenance.tags=tags;
  }
  return {...changes,provenance};
}
module.exports={STATES,hash,parse,source,temporaryTitle,needsPublication,acceptsPublication,pending,apply};
