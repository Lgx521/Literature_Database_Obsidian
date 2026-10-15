'use strict';
const {t:tr}=require('./i18n');
const ID=/^custom-[a-z0-9-]{8,80}$/;
const DEFAULTS=[
 {id:'published',name:'发表时间',type:'readonly'},
 {id:'status',name:'阅读状态',type:'select',values:['在读','待读','待整理','未标记','已读','暂存']},
 {id:'organizing',name:'整理状态',type:'select',values:['待整理','AI 已整理','人工完成','自动整理']},
 {id:'priority',name:'优先级',type:'select',values:['高','中','低','—']}
];
function name(value,allowEmpty=false){if(typeof value!=='string'||value.length>80||/[\x00-\x1f]/.test(value)||!allowEmpty&&!value.trim())throw Error(tr('字段名称和选项须为 1–80 字'));return value.trim();}
function validate(raw){
 if(!Array.isArray(raw)||raw.length>34)throw Error(tr('最多支持 30 个自定义字段'));
 const ids=new Set();return raw.map(field=>{
  if(!field||typeof field!=='object'||ids.has(field.id))throw Error(tr('字段设置无效'));
  ids.add(field.id);const base=DEFAULTS.find(d=>d.id===field.id);if(!base&&!ID.test(field.id))throw Error(tr('字段设置无效'));
  const type=base?.type||field.type;if(!['text','select','readonly'].includes(type)||!base&&type==='readonly')throw Error(tr('字段设置无效'));
  const result={id:field.id,name:name(field.name||'',!!base),type,hidden:field.hidden===true,options:[]};
  if(type==='select'){
   if(!Array.isArray(field.options)||field.options.length>40)throw Error(tr('每个字段最多 40 个选项'));
   const seen=new Set();for(const option of field.options){if(!option||seen.has(option.value)||!base?.values.includes(option.value)&&!ID.test(option.value)||field.id==='organizing'&&!base.values.includes(option.value))throw Error(tr('字段选项无效'));seen.add(option.value);result.options.push({value:option.value,label:name(option.label||'',!!base?.values.includes(option.value)),hidden:option.hidden===true});}
  }
  return result;
 });
}
function definitions(raw=[]){
 const saved=validate(raw);return [...DEFAULTS.map(base=>{
  const field=saved.find(f=>f.id===base.id)||{id:base.id,name:'',type:base.type,hidden:false,options:[]};
  return {...field,label:field.name||tr(base.name),options:[...(base.values||[]).map(value=>({value,label:'',hidden:false,...field.options.find(o=>o.value===value)})),...field.options.filter(o=>!base.values?.includes(o.value))]};
 }),...saved.filter(f=>ID.test(f.id)).map(f=>({...f,label:f.name}))];
}
function get(raw,id){return definitions(raw).find(f=>f.id===id);}
function value(row,id){return ID.test(id)?row.customFields?.[id]||'':row[id]||'';}
function display(field,v){if(!field)return v;const option=field.options.find(o=>o.value===v);return option?.label|| (ID.test(v)?tr('自定义选项（设置尚未同步）'):tr(v));}
function options(field,current=''){const result=field.options.filter(o=>!o.hidden||o.value===current).map(o=>[o.value,display(field,o.value)]);if(ID.test(field.id))result.unshift(['','—']);if(current&&!result.some(([v])=>v===current))result.push([current,display(field,current)]);return result;}
function values(raw){
 let data=raw;if(typeof raw==='string'){try{data=raw?JSON.parse(raw):{};}catch(_){throw Error(tr('自定义字段数据无效'));}}
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length>30||Object.entries(data).some(([k,v])=>!ID.test(k)||typeof v!=='string'||v.length>4000))throw Error(tr('自定义字段数据无效'));
 return {...data};
}
module.exports={ID,DEFAULTS,validate,definitions,get,value,display,options,values};
