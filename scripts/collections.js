const {t:tr}=require('./i18n');
'use strict';
// Collection membership only. Paper metadata stays in library.md.
const END='<!-- collections:end -->', HEADERS=['PDF（文件名）','项目备注'];
const TYPES={library:'分类',projects:'项目'};
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function name(value){
  const s=String(value).trim();
  if(!s||s.length>80||/[\r\n\x00-\x1f#|<>\[\]\\]/.test(s))throw new Error(tr('名称须为 1–80 字，不能含换行或 # | < > [ ] \\'));
  if(s==='未分类')throw new Error(tr('未分类为系统视图'));return s;
}
function encode(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\|/g,'&#124;').replace(/\[/g,'&#91;').replace(/\]/g,'&#93;').replace(/\r?\n/g,'<br>');}
function decode(s){return String(s).replace(/<br\s*\/?\s*>/gi,'\n').replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');}
function cells(s){return s.trim().slice(1,-1).split(/(?<!\\)\|/).map(c=>c.trim());}
function pdfPath(path){if(typeof path!=='string'||!path.startsWith('papers/')||!path.endsWith('.pdf')||path.includes('\\')||/[\r\n\x00]/.test(path)||path.split('/').some(s=>!s||s==='.'||s==='..'))throw new Error(tr('集合只能引用文献库 PDF'));return path;}
function link(path){pdfPath(path);return '['+encode(path.split('/').pop())+']('+path.split('/').map(encodeURIComponent).join('/').replace(/\(/g,'%28').replace(/\)/g,'%29')+')';}
function deadlineValue(value){
  value=String(value||'—').trim()||'—';
  if(value!=='—'&&!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} [+-]\d{2}:\d{2}$/.test(value))throw new Error(tr('项目截止时间需含日期、时间和时区'));
  return value;
}
function parse(text){
  if(text.split(END).length!==2)throw new Error(tr('集合尚未完整同步'));
  const lines=text.split('\n'),groups=[];const marker=lines.findIndex(l=>l.trim()===END);
  for(let i=0;i<marker;i++){
    if(!lines[i].startsWith('## '))continue;
    const match=lines[i].trim().match(/^## (分类|项目)：(.+)$/);if(!match)throw new Error(tr('集合标题无效'));
    const scope=match[1]==='分类'?'library':'projects',n=name(match[2]),start=i;
    if(groups.some(g=>g.scope===scope&&g.name.toLocaleLowerCase()===n.toLocaleLowerCase()))throw new Error(tr('集合名称重复：')+n);
    let end=i+1;while(end<marker&&!lines[end].startsWith('## '))end++;
    const headers=[];for(let j=i+1;j<end;j++)if(lines[j].startsWith('|')){headers.push(j);break;}
    const table=headers[0];if(table===undefined||!eq(cells(lines[table]),HEADERS)||!eq(cells(lines[table+1]||'').map(c=>/^:?-+:?$/.test(c)),[true,true]))throw new Error(n+tr('：集合表格无效'));
    const members=[];let tableEnd=table+1;
    while(tableEnd+1<end&&lines[tableEnd+1].startsWith('|')){
      const index=++tableEnd,c=cells(lines[index]),l=c[0]?.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if(c.length!==2||!lines[index].trimEnd().endsWith('|')||!l)throw new Error(n+tr('：集合行无效'));
      const path=pdfPath(decodeURIComponent(l[2]));if(decode(l[1])!==path.split('/').pop())throw new Error(n+tr('：文件名与路径不一致'));
      if(members.some(m=>m.path===path))throw new Error(n+tr('：重复引用'));members.push({path,notes:decode(c[1]),index,line:lines[index]});
    }
    if(lines.slice(tableEnd+1,end).some(l=>l.startsWith('|')))throw new Error(n+tr('：集合包含多余表格'));
    const venues=[];for(let j=start+1;j<table;j++)if(lines[j].startsWith('投稿 Venue：'))venues.push(j);
    if(venues.length>1)throw new Error(n+tr('：重复关联投稿'));
    const venueIndex=venues[0]??-1,venue=venueIndex<0?'':decode(lines[venueIndex].slice('投稿 Venue：'.length).trim());
    const deadlines=[];if(scope==='projects')for(let j=start+1;j<table;j++)if(/^截止时间[：:]/.test(lines[j]))deadlines.push(j);
    if(deadlines.length>1)throw new Error(n+tr('：重复的项目截止时间'));
    const deadlineIndex=deadlines[0]??-1,deadline=deadlineIndex<0?'—':deadlineValue(lines[deadlineIndex].replace(/^截止时间[：:]\s*/,''));
    groups.push({scope,name:n,start,end,table,tableEnd,members,venue,venueIndex,deadline,deadlineIndex});i=end-1;
  }
  return {lines,groups,marker};
}
function empty(){return '# 集合\n\n'+END+'\n';}
function find(info,scope,n){const g=info.groups.find(g=>g.scope===scope&&g.name===n);if(!g)throw new Error(tr('集合已被修改，请刷新'));return g;}
function finish(lines){const text=lines.join('\n');parse(text);return text;}
function add(text,scope,n){
  if(!TYPES[scope])throw new Error(tr('无效集合类型'));n=name(n);const info=parse(text);
  if(info.groups.some(g=>g.scope===scope&&g.name.toLocaleLowerCase()===n.toLocaleLowerCase()))throw new Error(tr('集合已存在'));
  const eol=text.includes('\r\n')?'\r\n':'\n';
  const block=['## '+TYPES[scope]+'：'+n,'',...(scope==='projects'?['截止时间：—','']:[]),'| '+HEADERS.join(' | ')+' |','| --- | --- |','',''].join(eol);
  return text.replace(END,block+END);
}
function rename(text,scope,from,to){
  to=name(to);const info=parse(text),g=find(info,scope,from);if(from===to)return text;
  if(info.groups.some(x=>x.scope===scope&&x.name.toLocaleLowerCase()===to.toLocaleLowerCase()))throw new Error(tr('集合已存在'));
  info.lines[g.start]='## '+TYPES[scope]+'：'+to+(text.includes('\r\n')?'\r':'');return finish(info.lines);
}
function remove(text,scope,n){const info=parse(text),g=find(info,scope,n);info.lines.splice(g.start,g.end-g.start);return finish(info.lines);}
function reorder(text,scope,from,target,after,expected){
  const info=parse(text),groups=info.groups.filter(g=>g.scope===scope),names=groups.map(g=>g.name);
  if(expected&&!eq(names,expected))throw new Error(tr('分组顺序已在其他窗口或设备中修改，请重新拖动'));
  find(info,scope,from);find(info,scope,target);if(from===target)return text;
  const order=names.filter(n=>n!==from);order.splice(order.indexOf(target)+(after?1:0),0,from);
  const blocks=new Map(groups.map(g=>[g.name,info.lines.slice(g.start,g.end)]));
  for(let i=groups.length-1;i>=0;i--)info.lines.splice(groups[i].start,groups[i].end-groups[i].start,...blocks.get(order[i]));
  return finish(info.lines);
}
function change(text,paths,target,{from=null,move=false}={}){
  const original=text;paths=[...new Set(paths.map(pdfPath))];let info=parse(text);
  if(!target&&!from)throw new Error(tr('请选择集合'));
  if(target)find(info,target.scope,target.name);if(from)find(info,from.scope,from.name);
  if(move&&!from)throw new Error(tr('全部文献没有可移除的来源分类'));
  if(move&&target&&from&&target.scope!==from.scope)throw new Error(tr('移动仅限同类集合；跨类型请添加'));
  if(target&&from&&eq(target,from))return text;
  if(move&&from?.scope==='projects'&&target){const a=find(info,from.scope,from.name),b=find(info,target.scope,target.name);for(const path of paths){const x=a.members.find(m=>m.path===path),y=b.members.find(m=>m.path===path);if(x?.notes&&y?.notes&&x.notes!==y.notes)throw new Error(tr('目标项目已有不同备注，请先处理备注后移动'));}}
  if(from&&(!target||move)){
    const g=find(info,from.scope,from.name),indexes=g.members.filter(m=>paths.includes(m.path)).map(m=>m.index);
    if(move&&indexes.length!==paths.length)throw new Error(tr('来源集合已改变，请刷新后重试'));
    for(const index of indexes.reverse())info.lines.splice(index,1);text=finish(info.lines);info=parse(text);
  }
  if(target){
    const g=find(info,target.scope,target.name),cr=text.includes('\r\n')?'\r':'';
    // Move project notes with the reference; never replace notes already in the target.
    const old=from?parse(original).groups.find(g=>g.scope===from.scope&&g.name===from.name):null;
    if(move&&target.scope==='projects')for(const m of g.members){const notes=old?.members.find(x=>x.path===m.path)?.notes;if(paths.includes(m.path)&&notes&&!m.notes)info.lines[m.index]='| '+link(m.path)+' | '+encode(notes)+' |'+cr;}
    const added=paths.filter(path=>!g.members.some(m=>m.path===path)).map(path=>'| '+link(path)+' | '+encode(move?old?.members.find(m=>m.path===path)?.notes||'':'')+' |'+cr);
    info.lines.splice(g.tableEnd+1,0,...added);text=finish(info.lines);
  }
  return text;
}
function setNote(text,project,path,value,expected){
  const info=parse(text),g=find(info,'projects',project),m=g.members.find(m=>m.path===path);
  if(!m||m.notes!==expected)throw new Error(tr('项目备注已被修改或文献已移除，输入仍保留'));
  info.lines[m.index]='| '+link(path)+' | '+encode(value)+' |'+(text.includes('\r\n')?'\r':'');return finish(info.lines);
}
function setVenue(text,project,value,expected){
  if(/[\r\n]/.test(value))throw new Error(tr('Venue 无效'));
  const info=parse(text),g=find(info,'projects',project);if(g.venue!==expected)throw new Error(tr('关联投稿已被修改'));
  const line='投稿 Venue：'+encode(value)+(text.includes('\r\n')?'\r':'');
  if(g.venueIndex>=0)info.lines[g.venueIndex]=line;else info.lines.splice(g.start+1,0,line);return finish(info.lines);
}
// The manager validates calendar/time-zone semantics with Engine.deadline before writing.
function setDeadline(text,project,value,expected){
  value=deadlineValue(value);const info=parse(text),g=find(info,'projects',project);
  if(g.deadline!==expected)throw new Error(tr('项目截止时间已被修改，请重新打开设置'));
  const line='截止时间：'+value+(text.includes('\r\n')?'\r':'');
  if(g.deadlineIndex>=0)info.lines[g.deadlineIndex]=line;else info.lines.splice(g.start+1,0,line);
  return finish(info.lines);
}
function memberships(groups,path,scope){return groups.filter(g=>g.scope===scope&&g.members.some(m=>m.path===path)).map(g=>g.name);}
// Count real categories and writing projects together; smart views are not memberships.
function removalPlan(groups,paths,from=null){
  const memberships=[...new Set(paths)].map(path=>({path,groups:groups.filter(g=>g.members.some(m=>m.path===path)).map(g=>({scope:g.scope,name:g.name,notes:g.members.find(m=>m.path===path).notes})).sort((a,b)=>JSON.stringify([a.scope,a.name]).localeCompare(JSON.stringify([b.scope,b.name])))}));
  const sourceValid=!!from&&memberships.length>0&&memberships.every(m=>m.groups.some(g=>g.scope===from.scope&&g.name===from.name));
  return {memberships,sourceValid,shared:memberships.some(m=>m.groups.length>1),canRemove:sourceValid&&memberships.every(m=>m.groups.length>1)};
}
function decorate(rows,groups){return rows.map(r=>({...r,categories:memberships(groups,r.path,'library'),projects:memberships(groups,r.path,'projects')}));}
module.exports={END,HEADERS,parse,empty,add,rename,remove,reorder,change,setNote,setVenue,setDeadline,memberships,removalPlan,decorate,link,encode,decode};
