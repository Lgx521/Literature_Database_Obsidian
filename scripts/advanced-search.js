'use strict';
// Local predicates only: no PDF reads, bibliography parsing, network or source writes.
const FIELDS={title:'篇名',tags:'标签',published:'发表时间',venues:'Venue',tldr:'TL;DR',filename:'文件名',notes:'Notes'};
const OPS={contains:'包含',notContains:'不包含',equals:'完全匹配',empty:'为空',notEmpty:'不为空',any:'包含任一',all:'包含全部',none:'不包含',on:'指定年份／月份',before:'早于',after:'晚于',between:'在范围内'};
const EMPTY={match:'all',conditions:[]};
const fold=v=>String(v??'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
const operators=field=>[...(field==='tags'?['any','all','none']:field==='published'?['on','before','after','between']:['contains','notContains','equals']),'empty','notEmpty'];
const unary=op=>op==='empty'||op==='notEmpty';
function normalize(value){
  const conditions=[];
  for(const c of (Array.isArray(value?.conditions)?value.conditions:[]).slice(0,30)){
    if(!c||!Object.hasOwn(FIELDS,c.field))continue;
    const field=c.field,op=operators(field).includes(c.op)?c.op:operators(field)[0];
    const tags=[...new Set((Array.isArray(c.tags)?c.tags:[]).filter(t=>typeof t==='string'&&t.startsWith('#')&&!/\s/.test(t)).map(fold))].slice(0,200);
    conditions.push({field,op,value:typeof c.value==='string'?c.value.trim().slice(0,1000):'',end:typeof c.end==='string'?c.end.trim().slice(0,40):'',tags});
  }
  return {match:value?.match==='any'?'any':'all',conditions};
}
function dateRange(value){
  const m=String(value??'').trim().match(/^((?:19|20)\d{2})(?:[.\-/](0?[1-9]|1[0-2]))?$/);
  if(!m)return null;const year=Number(m[1])*12,month=m[2]?Number(m[2]):null;
  return month?[year+month-1,year+month-1]:[year,year+11];
}
function problem(c){
  if(unary(c.op))return '';
  if(c.field==='tags')return c.tags.length?'':'请选择标签';
  if(c.field==='published'){
    const start=dateRange(c.value),end=dateRange(c.end);
    if(!start||(c.op==='between'&&!end))return '请输入年份或年月，如 2026 或 2026.5';
    if(c.op==='between'&&start[0]>end[1])return '结束时间不能早于开始时间';
    return '';
  }
  return c.value?'':'请输入搜索内容';
}
function fieldValue(row,field,decode=v=>v){
  if(field==='published')return dateRange(row.published);
  if(field==='tags')return new Set(String(row.tags||'').split(/\s+/).filter(t=>t.startsWith('#')).map(fold));
  return (field==='venues'?(row.venues||[]):[field==='title'?(row.title?.trim()||row.filename):row[field]||'']).map(v=>fold(['notes','tldr'].includes(field)?decode(v):v));
}
function compile(value,decode=v=>v,read=(row,field)=>fieldValue(row,field,decode)){
  const state=normalize(value);
  const predicates=state.conditions.map(c=>{
    if(problem(c))return ()=>false;
    const needle=fold(c.value),start=dateRange(c.value),end=dateRange(c.end);
    return row=>{
      if(c.field==='published'){
        const date=read(row,'published');
        if(unary(c.op))return c.op==='empty'?!date:!!date;
        if(!date)return false;
        if(c.op==='before')return date[1]<start[0];
        if(c.op==='after')return date[0]>start[1];
        // Year-only evidence must not masquerade as a known month.
        return date[0]>=start[0]&&date[1]<=(c.op==='between'?end[1]:start[1]);
      }
      if(c.field==='tags'){
        const tags=read(row,'tags');
        if(unary(c.op))return c.op==='empty'?!tags.size:!!tags.size;
        if(c.op==='all')return c.tags.every(t=>tags.has(t));
        const any=c.tags.some(t=>tags.has(t));return c.op==='none'?!any:any;
      }
      const values=read(row,c.field);
      if(unary(c.op)){const present=values.some(Boolean);return c.op==='empty'?!present:present;}
      if(c.op==='equals')return values.some(v=>v===needle);
      const found=values.some(v=>v.includes(needle));return c.op==='notContains'?!found:found;
    };
  });
  return row=>!predicates.length||(state.match==='any'?predicates.some(p=>p(row)):predicates.every(p=>p(row)));
}
module.exports={FIELDS,OPS,EMPTY,operators,unary,normalize,dateRange,problem,fieldValue,compile};
