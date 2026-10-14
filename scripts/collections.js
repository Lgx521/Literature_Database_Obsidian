const {t:tr}=require('./i18n');
'use strict';
// Collection membership only. Paper metadata stays in library.md.
const END='<!-- collections:end -->', HEADERS=['PDF（文件名）','项目备注'];
const CHILD_HEADERS=[...HEADERS,'子类'];
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
function pdfPath(path){if(typeof path!=='string'||!path.startsWith('papers/')||!/\.pdf$/i.test(path)||path.includes('\\')||/[\r\n\x00]/.test(path)||path.split('/').some(s=>!s||s==='.'||s==='..'))throw new Error(tr('集合只能引用文献库 PDF'));return path;}
function link(path){pdfPath(path);return '['+encode(path.split('/').pop())+']('+path.split('/').map(encodeURIComponent).join('/').replace(/\(/g,'%28').replace(/\)/g,'%29')+')';}
function deadlineValue(value){
  value=String(value||'—').trim()||'—';
  if(value!=='—'&&!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} [+-]\d{2}:\d{2}$/.test(value))throw new Error(tr('项目截止时间需含日期、时间和时区'));
  return value;
}
function childName(value){const n=name(value);if(n==='未分组')throw new Error(tr('未分组为系统视图'));return n;}
function memberLine(g,path,notes,subgroup,cr=''){return '| '+link(path)+' | '+encode(notes)+' |'+(g.childColumn?' '+encode(subgroup||'')+' |':'')+cr;}
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
    const table=headers[0],header=cells(lines[table]||''),childColumn=eq(header,CHILD_HEADERS);
    if(table===undefined||(!childColumn&&!eq(header,HEADERS))||!eq(cells(lines[table+1]||'').map(c=>/^:?-+:?$/.test(c)),header.map(()=>true)))throw new Error(n+tr('：集合表格无效'));
    const subgroups=[],subgroupIndexes=[];
    for(let j=start+1;j<table;j++)if(/^子类[：:]/.test(lines[j])){const child=childName(decode(lines[j].replace(/^子类[：:]\s*/, '').trim()));if(subgroups.some(s=>s.toLocaleLowerCase()===child.toLocaleLowerCase()))throw new Error(tr('子类名称重复'));subgroups.push(child);subgroupIndexes.push(j);}
    const members=[];let tableEnd=table+1;
    while(tableEnd+1<end&&lines[tableEnd+1].startsWith('|')){
      const index=++tableEnd,c=cells(lines[index]),l=c[0]?.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if(c.length!==header.length||!lines[index].trimEnd().endsWith('|')||!l)throw new Error(n+tr('：集合行无效'));
      const path=pdfPath(decodeURIComponent(l[2]));if(decode(l[1])!==path.split('/').pop())throw new Error(n+tr('：文件名与路径不一致'));
      const subgroup=childColumn?decode(c[2]):'';if(subgroup&&!subgroups.includes(subgroup))throw new Error(tr('文献引用了不存在的子类'));
      if(members.some(m=>m.path===path))throw new Error(n+tr('：重复引用'));members.push({path,notes:decode(c[1]),subgroup,index,line:lines[index]});
    }
    if(lines.slice(tableEnd+1,end).some(l=>l.startsWith('|')))throw new Error(n+tr('：集合包含多余表格'));
    const venues=[];for(let j=start+1;j<table;j++)if(lines[j].startsWith('投稿 Venue：'))venues.push(j);
    if(venues.length>1)throw new Error(n+tr('：重复关联投稿'));
    const venueIndex=venues[0]??-1,venue=venueIndex<0?'':decode(lines[venueIndex].slice('投稿 Venue：'.length).trim());
    const deadlines=[];if(scope==='projects')for(let j=start+1;j<table;j++)if(/^截止时间[：:]/.test(lines[j]))deadlines.push(j);
    if(deadlines.length>1)throw new Error(n+tr('：重复的项目截止时间'));
    const deadlineIndex=deadlines[0]??-1,deadline=deadlineIndex<0?'—':deadlineValue(lines[deadlineIndex].replace(/^截止时间[：:]\s*/,''));
    groups.push({scope,name:n,start,end,table,tableEnd,members,venue,venueIndex,deadline,deadlineIndex,childColumn,subgroups,subgroupIndexes});i=end-1;
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
  if(target){const g=find(info,target.scope,target.name);if(target.subgroup&&!g.subgroups.includes(target.subgroup))throw new Error(tr('子类已改变，请重新选择'));if(target.subgroup!==undefined&&!g.childColumn){text=enableChildColumn(text,target.scope,target.name);info=parse(text);}}if(from)find(info,from.scope,from.name);
  if(move&&!from)throw new Error(tr('全部文献没有可移除的来源分类'));
  if(move&&target&&from&&target.scope!==from.scope)throw new Error(tr('移动仅限同类集合；跨类型请添加'));
  if(target&&from&&target.scope===from.scope&&target.name===from.name){if(target.subgroup===undefined)return text;from=null;move=false;}
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
    if(move&&target.scope==='projects')for(const m of g.members){const notes=old?.members.find(x=>x.path===m.path)?.notes;if(paths.includes(m.path)&&notes&&!m.notes)info.lines[m.index]=memberLine(g,m.path,notes,m.subgroup,cr);}
    if(target.subgroup!==undefined)for(const m of g.members)if(paths.includes(m.path)){const current=cells(info.lines[m.index]);current[2]=encode(target.subgroup);info.lines[m.index]='| '+current.join(' | ')+' |'+cr;}
    const added=paths.filter(path=>!g.members.some(m=>m.path===path)).map(path=>memberLine(g,path,move?old?.members.find(m=>m.path===path)?.notes||'':'',target.subgroup||'',cr));
    info.lines.splice(g.tableEnd+1,0,...added);text=finish(info.lines);
  }
  return text;
}
function setNote(text,project,path,value,expected){
  const info=parse(text),g=find(info,'projects',project),m=g.members.find(m=>m.path===path);
  if(!m||m.notes!==expected)throw new Error(tr('项目备注已被修改或文献已移除，输入仍保留'));
  const c=cells(info.lines[m.index]);c[1]=encode(value);info.lines[m.index]='| '+c.join(' | ')+' |'+(text.includes('\r\n')?'\r':'');return finish(info.lines);
}
// Child placement belongs to one parent relationship, never to the canonical paper.
function enableChildColumn(text,scope,parent){
 const info=parse(text),g=find(info,scope,parent);if(g.childColumn)return text;
 const cr=text.includes('\r\n')?'\r':'';
 info.lines[g.table]='| '+CHILD_HEADERS.join(' | ')+' |'+cr;info.lines[g.table+1]='| --- | --- | --- |'+cr;
 for(const m of g.members)info.lines[m.index]=m.line.replace(/\|\s*$/, '|  |'+cr);
 return finish(info.lines);
}
function childState(group){return {names:[...(group.subgroups||[])],members:group.members.map(m=>[m.path,m.subgroup||''])};}
function placementState(groups,paths,target){const g=groups.find(g=>g.scope===target.scope&&g.name===target.name);return g?paths.map(path=>{const m=g.members.find(m=>m.path===path);return m?{notes:m.notes,subgroup:m.subgroup||''}:null;}):null;}
function checkChildState(group,expected){if(expected&&!eq(childState(group),expected))throw new Error(tr('子类或归属已被修改，请重试'));}
function addChild(text,scope,parent,value,expected){
 const n=childName(value),info=parse(text),g=find(info,scope,parent);checkChildState(g,expected);
 if(g.subgroups.some(s=>s.toLocaleLowerCase()===n.toLocaleLowerCase()))throw new Error(tr('子类名称重复'));
 info.lines.splice(g.table,0,'子类：'+encode(n)+(text.includes('\r\n')?'\r':''));return finish(info.lines);
}
function renameChild(text,scope,parent,from,value,expected){
 const to=childName(value),info=parse(text),g=find(info,scope,parent);checkChildState(g,expected);
 const i=g.subgroups.indexOf(from);if(i<0)throw new Error(tr('子类已改变，请重新选择'));if(from===to)return text;
 if(g.subgroups.some(s=>s.toLocaleLowerCase()===to.toLocaleLowerCase()))throw new Error(tr('子类名称重复'));
 const cr=text.includes('\r\n')?'\r':'';info.lines[g.subgroupIndexes[i]]='子类：'+encode(to)+cr;
 for(const m of g.members)if(m.subgroup===from){const c=cells(m.line);c[2]=encode(to);info.lines[m.index]='| '+c.join(' | ')+' |'+cr;}
 return finish(info.lines);
}
function removeChild(text,scope,parent,child,expected){
 const info=parse(text),g=find(info,scope,parent);checkChildState(g,expected);const i=g.subgroups.indexOf(child);if(i<0)throw new Error(tr('子类已改变，请重新选择'));
 const cr=text.includes('\r\n')?'\r':'';
 for(const m of g.members)if(m.subgroup===child){const c=cells(m.line);c[2]='';info.lines[m.index]='| '+c.join(' | ')+' |'+cr;}
 info.lines.splice(g.subgroupIndexes[i],1);return finish(info.lines);
}
function reorderChild(text,scope,parent,from,target,after,expected){
 const info=parse(text),g=find(info,scope,parent);if(!eq(g.subgroups,expected))throw new Error(tr('子类顺序已被修改，请重新拖动'));
 if(!g.subgroups.includes(from)||!g.subgroups.includes(target))throw new Error(tr('子类已改变，请重新选择'));
 if(from===target)return text;const names=g.subgroups.filter(n=>n!==from);names.splice(names.indexOf(target)+(after?1:0),0,from);
 g.subgroupIndexes.forEach((line,i)=>{info.lines[line]='子类：'+encode(names[i])+(text.includes('\r\n')?'\r':'');});return finish(info.lines);
}
function groupRows(rows,group){
 const placements=new Map(group.members.map(m=>[m.path,m.subgroup||'']));
 return [...(group.subgroups||[]),''].map(name=>({name:name||'未分组',subgroup:name,kind:name?'child':'ungrouped',rows:rows.filter(r=>placements.has(r.path)&&placements.get(r.path)===name)})).filter(g=>g.rows.length);
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
  const memberships=[...new Set(paths)].map(path=>({path,groups:groups.filter(g=>g.members.some(m=>m.path===path)).map(g=>({scope:g.scope,name:g.name,notes:g.members.find(m=>m.path===path).notes,subgroup:g.members.find(m=>m.path===path).subgroup||''})).sort((a,b)=>JSON.stringify([a.scope,a.name]).localeCompare(JSON.stringify([b.scope,b.name])))}));
  const sourceValid=!!from&&memberships.length>0&&memberships.every(m=>m.groups.some(g=>g.scope===from.scope&&g.name===from.name));
  return {memberships,sourceValid,shared:memberships.some(m=>m.groups.length>1),canRemove:sourceValid&&memberships.every(m=>m.groups.length>1)};
}
function decorate(rows,groups){return rows.map(r=>({...r,categories:memberships(groups,r.path,'library'),projects:memberships(groups,r.path,'projects')}));}
module.exports={CHILD_HEADERS,childState,placementState,addChild,renameChild,removeChild,reorderChild,groupRows,END,HEADERS,parse,empty,add,rename,remove,reorder,change,setNote,setVenue,setDeadline,memberships,removalPlan,decorate,link,encode,decode};
