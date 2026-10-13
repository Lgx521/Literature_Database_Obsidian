const {t:tr}=require('./i18n');
'use strict';
// Pure Markdown -> Markdown. Shared by the offline CLI and the Obsidian plugin.
const HEADERS = ['PDF（文件名）', '发表时间', '标签', 'TL;DR', '阅读', '优先级'];
const NOTES_HEADERS = [...HEADERS, 'Notes'];
const VENUE_HEADERS = [...NOTES_HEADERS, 'Venue'];
const CITATION_HEADERS = [...VENUE_HEADERS, 'BibTeX', '引用来源'];
const TITLE_HEADERS = [...CITATION_HEADERS, '篇名'];
const STATUSES = ['在读', '待读', '待整理', '未标记', '已读', '暂存'];
const PRIORITIES = ['高', '中', '低', '—'];
const REVIEW_STATUSES = ['待审', '在审', '完成'];
const UNFILED_CATEGORY='未分类';
const TRACKING_HEADERS = ['稿件 / PDF', '状态', '截止时间', '下一步', 'TL;DR / 笔记'];
function cells(line) { return line.trim().slice(1, -1).split(/(?<!\\)\|/).map(x => x.trim()); }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function separator(line, n) { const c = cells(line); return c.length === n && c.every(x => /^:?-+:?$/.test(x)); }
function parseTables(text, headers, categories) {
  const rows = [], tables = [], lines = text.split(/\r?\n/); let heading = '';
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) heading = lines[i].slice(3).trim();
    if (!lines[i].startsWith('|') || !same(cells(lines[i]), headers)) continue;
    tables.push(heading);
    if (!separator(lines[++i] || '', headers.length)) throw new Error(tr`${heading}：表头分隔行无效`);
    while ((lines[i + 1] || '').startsWith('|')) {
      const line = lines[++i];
      if (!line.trimEnd().endsWith('|')) throw new Error(tr`${heading}：第 ${i + 1} 行没有闭合`);
      const c = cells(line);
      if (c.length !== headers.length) throw new Error(tr`${heading}：第 ${i + 1} 行列数异常`);
      rows.push({ cells: c, category: heading });
    }
  }
  if (categories && (tables.length !== categories.length || categories.some(c => tables.filter(t => t === c).length !== 1))) {
    throw new Error(tr('文献库需要五个分类，每个分类一个完整表格'));
  }
  return rows;
}
function parseLibrary(text) {
  if (!text.includes('<!-- library:end -->')) throw new Error(tr('文献库尚未完整同步，暂停刷新'));
  const rows = libraryTables(text).rows, paths = new Set();
  for (const r of rows) {
    const [pdf, published, tags, tldr, status, priority, notes = ''] = r.cells;
    const link = pdf.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (!link) throw new Error(tr`${r.category}：PDF 必须使用完整 Markdown 链接`);
    const path = decodeURIComponent(link[2]), filename = path.split('/').pop();
    if (!path.startsWith('papers/') || !path.endsWith('.pdf') || path.split('/').includes('..')) throw new Error(tr`${filename}：PDF 路径无效`);
    if (paths.has(path)) throw new Error(tr`${filename}：PDF 被重复收录`);
    if (!STATUSES.includes(status) || !PRIORITIES.includes(priority)) throw new Error(tr`${filename}：阅读状态或优先级无效`);
    if (!/^(?:(?:19|20)\d{2}(?:\.(?:[1-9]|1[0-2]))?|待核实)$/.test(published)) throw new Error(tr`${filename}：发表时间须为 YYYY.M（如 2026.5）、YYYY 或待核实，月份为 1–12 且不补零`);
    if (!tldr) throw new Error(tr`${filename}：请填写 TL;DR 或待整理`);
    paths.add(path);
    const venues=normalizeVenues(decodeText(r.cells[7]||'').split('\n').filter(Boolean));
    Object.assign(r, { pdf, published, tags, tldr, status, priority, notes, venues, bibtex:decodeText(r.cells[8]||''), citationSource:decodeText(r.cells[9]||''), title:decodeText(r.cells[10]||''), path, filename });
  }
  return rows;
}
function table(headers, rows) {
  return ['| ' + headers.join(' | ') + ' |', '| ' + headers.map(() => '---').join(' | ') + ' |',
    ...rows.map(r => '| ' + r.map(c => String(c).replace(/(?<!\\)\|/g, '\\|')).join(' | ') + ' |')].join('\n');
}
function deadline(value) {
  if (!value || value === '—') return Infinity;
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} [+-]\d{2}:\d{2}$/.test(value)) throw new Error(tr`截止时间需含时区：${value}`);
  const [date,time,zone]=value.split(' '),[y,m,d]=date.split('-').map(Number),[h,min]=time.split(':').map(Number);
  const [zh,zm]=zone.slice(1).split(':').map(Number),offset=(zone[0]==='-'?-1:1)*(zh*60+zm);
  if(y<1000||m<1||m>12||d<1||d>new Date(Date.UTC(y,m,0)).getUTCDate()||h>23||min>59||zm>59||offset < -720||offset > 840)throw new Error(tr('日期、时间或时区无效'));
  const result = Date.parse(value.replace(' ', 'T').replace(' ', ''));
  if (!Number.isFinite(result)) throw new Error(tr`${value}：无法识别截止时间`);
  return result;
}
function deadlineParts(value){
  if(!value||value==='—')return {date:'',time:'23:59',zone:''};
  deadline(value);const [date,time,zone]=value.split(' ');return {date,time,zone};
}
function composeDeadline(date,time,zone){
  if(!date)return '—';
  if(!time||!zone)throw new Error(tr('请选择截止时间和时区'));
  const value=`${date} ${time} ${zone}`;deadline(value);return value;
}
function displayDeadline(value){return !value||value==='—'?'—':value.replace(' -12:00',' AoE').replace(/ ([+-]\d{2}:\d{2})$/,' UTC$1');}
function deadlineCountdown(value,now=Date.now()){
  const remaining=deadline(value)-now;
  if(!Number.isFinite(remaining))return '';
  if(remaining<=0)return '已截止';
  for(const [unit,suffix] of [[86400000,'d'],[3600000,'h'],[60000,'m']])if(remaining>=unit)return Math.floor(remaining/unit)+suffix;
  return '<1m';
}
function trackingRows(text, name) {
  if (!text.includes('<!-- tracking:end -->')) throw new Error(tr`${name}尚未完整同步，暂停刷新`);
  return parseTables(text, TRACKING_HEADERS).map(r => ({ ...r, source: name, due: deadline(r.cells[2]) }));
}
function escapeLabel(text) { return text.replace(/[&<>\[\]_*|`\\]/g, c => `&#${c.charCodeAt(0)};`); }
function encodeURIPath(text) { return text.split('/').map(encodeURIComponent).join('/').replace(/\(/g, '%28').replace(/\)/g, '%29'); }
// View helpers operate on the same parsed rows; no second metadata store.
function publicationRank(value) {
  if (value === '待核实') return -1;
  const [year, month = '0'] = value.split('.');
  return Number(year) * 12 + Number(month);
}
function filterLibrary(rows, { query = '', category = '', status = '', tag = '', sort = 'filename', descending = false } = {}) {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const result = rows.filter(r => (!category || (r.categories ? (category===UNFILED_CATEGORY?!r.categories.length:r.categories.includes(category)) : r.category === category)) && (!status || r.status === status)
    && (!tag || r.tags.split(/\s+/).includes(tag))
    && tokens.every(t => [r.filename, r.title||'', ...(r.categories||[r.category]), r.tags, r.tldr, decodeText(r.notes || ''), r.published, r.status, r.priority, ...(r.venues||[])].join(' ').toLocaleLowerCase().includes(t)));
  return result.sort((a, b) => {
    // Unknown dates always stay at the end, in either direction.
    if (sort === 'published' && (a.published === '待核实') !== (b.published === '待核实')) return a.published === '待核实' ? 1 : -1;
    const cmp = sort === 'published' ? publicationRank(a.published) - publicationRank(b.published)
      : sort === 'status' ? STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status)
      : sort === 'priority' ? PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority)
      : a.filename.localeCompare(b.filename, 'en', { numeric: true });
    return (descending ? -cmp : cmp) || a.filename.localeCompare(b.filename, 'en', { numeric: true });
  });
}

function decodeText(value) {
  return String(value).replace(/<br\s*\/?\s*>/gi, '\n').replace(/\\\|/g, '|')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (m,n) => { const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n); return c<=0x10ffff?String.fromCodePoint(c):m; })
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&');
}
function encodeNotes(value) {
  return String(value).replace(/\r\n?/g, '\n').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\|/g,'&#124;').replace(/\[/g,'&#91;').replace(/\]/g,'&#93;').replace(/\n/g,'<br>');
}
function categoryName(value) {
  const name=String(value).trim();
  if (!name || name.length>80 || /[\r\n\x00-\x1f#|<>\[\]\\]/.test(name)) throw new Error(tr('分类名不能为空，最多 80 字，不能包含换行或 # | < > [ ] \\'));
  return name;
}
function normalizeVenues(values){
  if(!Array.isArray(values))throw new Error(tr('Venue 必须是名称列表'));
  const result=[],seen=new Set();
  for(const value of values){
    if(typeof value!=='string'||/[\r\n\x00-\x1f]/.test(value))throw new Error(tr('Venue 名称不能包含换行或控制字符'));
    const name=value.trim().replace(/\s+/g,' '),key=name.toLocaleLowerCase();
    if(!name||name.length>80)throw new Error(tr('Venue 名称须为 1–80 字'));
    if(!seen.has(key)){seen.add(key);result.push(name);}
  }
  return result;
}
function venueOptions(rows){return normalizeVenues(rows.flatMap(r=>r.venues||[])).sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));}
function libraryHeaders(text){const n=Math.max(...libraryTables(text).tables.map(t=>t.header.length));return n===11?TITLE_HEADERS:n===10?CITATION_HEADERS:n===8?VENUE_HEADERS:NOTES_HEADERS;}
function libraryTables(text) {
  if (text.split('<!-- library:end -->').length!==2) throw new Error(tr('文献库尚未完整同步，暂停刷新'));
  const lines=text.split(/\r?\n/), tables=[], rows=[]; let heading='',headingLine=-1;
  for(let i=0;i<lines.length;i++) {
    if(lines[i]==='<!-- library:end -->') break;
    if(lines[i].startsWith('## ')){heading=lines[i].slice(3).trim();headingLine=i;}
    if(!lines[i].startsWith('|')) continue;
    const header=cells(lines[i]);
    if (!same(header,HEADERS) && !same(header,NOTES_HEADERS) && !same(header,VENUE_HEADERS) && !same(header,CITATION_HEADERS) && !same(header,TITLE_HEADERS)) throw new Error(tr`${heading}：文献表头无效`);
    categoryName(heading);
    if(tables.some(t=>t.name.toLocaleLowerCase()===heading.toLocaleLowerCase())) throw new Error(tr('分类名称重复：')+heading);
    const start=i;
    if(!separator(lines[++i]||'',header.length)) throw new Error(tr`${heading}：表头分隔行无效`);
    while((lines[i+1]||'').startsWith('|')) {
      const line=lines[++i], values=cells(line);
      if(!line.trimEnd().endsWith('|')||values.length!==header.length) throw new Error(tr`${heading}：第 ${i+1} 行列数异常`);
      rows.push({cells:values,category:heading});
    }
    tables.push({name:heading,heading:headingLine,start,end:i,header});
  }
  if(!tables.length) throw new Error(tr('文献库至少需要一个分类表格'));
  return {tables,rows};
}
function getCategories(text) { return libraryTables(text).tables.map(t=>t.name); }
function migrateLibraryNotes(text) {
  return migrateLibraryColumns(text,libraryHeaders(text));
}
function migrateLibraryVenues(text){return migrateLibraryColumns(text,VENUE_HEADERS);}
function migrateLibraryTitles(text){return migrateLibraryColumns(text,TITLE_HEADERS);}
function migrateLibraryCitations(text){return migrateLibraryColumns(text,CITATION_HEADERS);}
function migrateLibraryColumns(text,headers){
  const {tables}=libraryTables(text), lines=text.split('\n');
  for(const t of tables.filter(t=>t.header.length<headers.length).reverse()) {
    for(let i=t.start;i<=t.end;i++) {
      const cr=lines[i].endsWith('\r')?'\r':'';
      const extra=headers.slice(t.header.length).map(name=>i===t.start?name:i===t.start+1?'---':'').join(' | ');
      lines[i]=lines[i].replace(/\r$/, '').replace(/\|\s*$/, '| '+extra+' |')+cr;
    }
  }
  const output=lines.join('\n'); parseLibrary(output); return output;
}
function addCategory(text,name) {
  parseLibrary(text); name=categoryName(name);
  if(getCategories(text).some(n=>n.toLocaleLowerCase()===name.toLocaleLowerCase())) throw new Error(tr('分类已存在：')+name);
  const eol=text.includes('\r\n')?'\r\n':'\n';
  const section=['## '+name,'',table(libraryHeaders(text),[]),''].join('\n').replace(/\n/g,eol);
  const output=text.replace('<!-- library:end -->',section+eol+'<!-- library:end -->');
  parseLibrary(output); return output;
}
function renameCategory(text,from,to) {
  parseLibrary(text); to=categoryName(to);
  if(from===UNFILED_CATEGORY||to===UNFILED_CATEGORY)throw new Error(tr('未分类是保留分类，不能重命名'));
  if(!getCategories(text).includes(from)) throw new Error(tr('分类已被修改，请刷新'));
  if(from===to) return text;
  if(getCategories(text).some(n=>n.toLocaleLowerCase()===to.toLocaleLowerCase())) throw new Error(tr('分类已存在：')+to);
  const lines=text.split('\n'),t=libraryTables(text).tables.find(t=>t.name===from);
  lines[t.heading]='## '+to+(lines[t.heading].endsWith('\r')?'\r':'');const output=lines.join('\n');
  parseLibrary(output); return output;
}
function deleteCategory(text,name){
  parseLibrary(text);if(name===UNFILED_CATEGORY)throw new Error(tr('未分类不能删除'));
  let info=libraryTables(text),t=info.tables.find(t=>t.name===name);if(!t)throw new Error(tr('分类已被修改，请刷新'));
  const hasRows=t.end>t.start+1;
  if(hasRows)text=migrateLibraryNotes(text);
  if((hasRows||info.tables.length===1)&&!getCategories(text).includes(UNFILED_CATEGORY))text=addCategory(text,UNFILED_CATEGORY);
  info=libraryTables(text);t=info.tables.find(t=>t.name===name);
  const lines=text.split('\n'),moved=lines.slice(t.start+2,t.end+1),remove=new Set([t.heading]);
  for(let i=t.start;i<=t.end;i++)remove.add(i);
  const kept=lines.filter((_,i)=>!remove.has(i));
  if(moved.length){const target=libraryTables(kept.join('\n')).tables.find(t=>t.name===UNFILED_CATEGORY);kept.splice(target.end+1,0,...moved);}
  const output=kept.join('\n');parseLibrary(output);return output;
}
function reorderGroups(text,scope,from,target,after=false,expected){
  const library=scope==='library';if(!library&&!['reviews','submissions'].includes(scope))throw new Error(tr('无效分组类型'));
  const source=scope==='reviews'?'审稿':'投稿';library?parseLibrary(text):parseTracker(text,source);
  const tables=library?libraryTables(text).tables:trackerLayout(text).tables,names=tables.map(t=>t.name);
  if(expected&&!same(names,expected))throw new Error(tr('分组顺序已在其他窗口或设备中修改，请重新拖动'));
  const movable=names.filter(n=>library||!isStagingGroup(n));
  if(!movable.includes(from)||!movable.includes(target))throw new Error(tr('请在同一分组区域内排序；暂存区固定在顶部'));
  if(from===target)return text;
  const order=movable.filter(n=>n!==from);order.splice(order.indexOf(target)+(after?1:0),0,from);
  let next=0;const desired=names.map(n=>library||!isStagingGroup(n)?order[next++]:n);
  if(same(desired,names))return text;
  const lines=text.split('\n'),marker=lines.findIndex(l=>l.trim()===(library?'<!-- library:end -->':'<!-- tracking:end -->'));
  const headings=[];for(let i=0;i<marker;i++)if(lines[i].startsWith('## '))headings.push(i);
  const slots=tables.map(t=>({name:t.name,start:t.heading,end:headings.find(i=>i>t.heading)??marker}));
  const blocks=new Map(slots.map(t=>[t.name,lines.slice(t.start,t.end)])),at=new Map(slots.map(t=>[t.start,t]));
  const output=[];next=0;
  for(let i=0;i<lines.length;){const slot=at.get(i);if(slot){output.push(...blocks.get(desired[next++]));i=slot.end;}else output.push(lines[i++]);}
  const result=output.join('\n');library?parseLibrary(result):parseTracker(result,source);return result;
}
function updateLibraryEntry(text, expected, changes) {
  let rows = parseLibrary(text), current = rows.find(r => r.path === expected.path);
  if (!current || current.category !== expected.category || !same(current.cells, expected.cells)) {
    throw new Error(tr('这篇文献已在其他窗口或设备中修改。请取消编辑，查看最新内容后重试；你的输入仍保留。'));
  }
  const columns = { published: 1, tags: 2, tldr: 3, status: 4, priority: 5, notes:6, venues:7, bibtex:8, citationSource:9, title:10 };
  for (const key of Object.keys(changes)) if (!(key in columns) && key!=='category') throw new Error(tr('不支持修改字段：') + key);
  const target=changes.category===undefined?current.category:categoryName(changes.category);
  if(!getCategories(text).includes(target)) throw new Error(tr('目标分类不存在'));
  if('title' in changes){
    text=migrateLibraryTitles(text);current=parseLibrary(text).find(r=>r.path===expected.path);
  }else if('bibtex' in changes||'citationSource' in changes){
    text=migrateLibraryCitations(text);current=parseLibrary(text).find(r=>r.path===expected.path);
  }else if('venues' in changes){
    text=migrateLibraryVenues(text);current=parseLibrary(text).find(r=>r.path===expected.path);
  }else if(('notes' in changes || target!==current.category) && current.cells.length===6) {
    text=migrateLibraryNotes(text); current=parseLibrary(text).find(r=>r.path===expected.path);
  }
  const next = [...current.cells];
  for (const [key,value] of Object.entries(changes)) {
    if(key==='category') continue;
    next[columns[key]]=key==='venues'?normalizeVenues(value).map(encodeNotes).join('<br>'):['notes','bibtex','citationSource','title'].includes(key)?encodeNotes(value):String(value).replace(/\r?\n/g,' ').trim().replace(/\|/g,'&#124;');
  }
  if(same(next,current.cells) && target===current.category) return text;
  const lines=text.split('\n'), index=lines.findIndex(l=>l.startsWith('|')&&same(cells(l),current.cells));
  if(index<0) throw new Error(tr('无法定位源表格行，未写入'));
  const cr=lines[index].endsWith('\r')?'\r':'', line='| '+next.join(' | ')+' |'+cr;
  if(target===current.category) lines[index]=line;
  else {
    lines.splice(index,1);
    const targetTable=libraryTables(lines.join('\n')).tables.find(t=>t.name===target);
    // All tables must use the Notes schema before moving rows between them.
    if(targetTable.header.length!==next.length) return updateLibraryEntry(migrateLibraryNotes(text),parseLibrary(migrateLibraryNotes(text)).find(r=>r.path===expected.path),changes);
    lines.splice(targetTable.end+1,0,line);
  }
  const output=lines.join('\n'); parseLibrary(output); return output;
}
function isStagingGroup(name){return ['暂存区','待确定 venue'].includes(name);}
function trackerLayout(text){
  if(text.split('<!-- tracking:end -->').length!==2)throw new Error(tr('稿件数据尚未完整同步'));
  const lines=text.split('\n'),tables=[];let name='',heading=-1;
  for(let i=0;i<lines.length;i++){
    if(lines[i].trim()==='<!-- tracking:end -->')break;
    if(lines[i].startsWith('## ')){name=lines[i].slice(3).trim();heading=i;}
    if(!lines[i].startsWith('|'))continue;
    if(!same(cells(lines[i]),TRACKING_HEADERS))throw new Error(tr('稿件表头无效'));
    categoryName(name);if(tables.some(t=>t.name.toLowerCase()===name.toLowerCase()))throw new Error(tr('重复 Venue 分组'));
    const start=i;if(!separator(lines[++i]||'',5))throw new Error(tr('稿件表头分隔行无效'));
    while((lines[i+1]||'').startsWith('|')){const row=lines[++i];if(!row.trimEnd().endsWith('|')||cells(row).length!==5)throw new Error(tr('稿件表格列数异常'));deadline(cells(row)[2]);}
    const deadlineLines=[];for(let j=heading+1;j<start;j++)if(/^截止时间[：:]/.test(lines[j]))deadlineLines.push(j);
    if(deadlineLines.length>1)throw new Error(name+tr('：重复的 Venue 截止时间'));
    const deadlineIndex=deadlineLines[0]??-1;
    tables.push({name,heading,start,end:i,deadlineIndex});
  }
  return {lines,tables};
}
function trackerGroups(text){return trackerLayout(text).tables.map(t=>t.name);}
function trackerDeadline(text,name){
  const {lines,tables}=trackerLayout(text),t=tables.find(t=>t.name===name);
  if(!t||isStagingGroup(name))return '—';
  if(t.deadlineIndex>=0){const value=lines[t.deadlineIndex].replace(/^截止时间[：:]\s*/,'').trim()||'—';deadline(value);return value;}
  const values=[...new Set(lines.slice(t.start+2,t.end+1).map(l=>cells(l)[2]).filter(v=>v&&v!=='—'))];
  if(values.length>1)throw new Error(name+tr('：旧记录的 DDL 不一致，请先统一 Venue 截止时间'));
  return values[0]||'—';
}
function setTrackerDeadline(text,source,name,value,expected){
  const {lines,tables}=trackerLayout(text),t=tables.find(t=>t.name===name);
  if(!t)throw new Error(tr('Venue 已被修改，请刷新'));
  if(isStagingGroup(name)&&value!=='—')throw new Error(tr('暂存区没有统一 DDL'));
  value=value||'—';deadline(value);
  if(expected!==undefined&&trackerDeadline(text,name)!==expected)throw new Error(tr('Venue 的截止时间已被修改，请重新打开设置'));
  const cr=text.includes('\r\n')?'\r':'';
  for(let i=t.start+2;i<=t.end;i++){
    const row=cells(lines[i]);if(row[2]===value)continue;row[2]=value;lines[i]='| '+row.join(' | ')+' |'+cr;
  }
  if(t.deadlineIndex>=0)lines[t.deadlineIndex]='截止时间：'+value+cr;
  else lines.splice(t.heading+1,0,'截止时间：'+value+cr);
  const output=lines.join('\n');parseTracker(output,source);return output;
}
function migrateTrackerDeadlines(text,source){
  const names=trackerGroups(text),values=names.map(name=>[name,trackerDeadline(text,name)]);
  for(const [name,value] of values)text=setTrackerDeadline(text,source,name,value);
  return text;
}
function renameTrackerGroup(text,source,from,to){
  parseTracker(text,source);to=categoryName(to);
  if(isStagingGroup(from)||isStagingGroup(to))throw new Error(tr('暂存区名称保留，不能重命名'));
  const {lines,tables}=trackerLayout(text),t=tables.find(t=>t.name===from);
  if(!t)throw new Error(tr('Venue 已被修改，请刷新'));if(from===to)return text;
  if(tables.some(t=>t.name.toLowerCase()===to.toLowerCase()))throw new Error(tr('Venue 已存在'));
  lines[t.heading]='## '+to+(lines[t.heading].endsWith('\r')?'\r':'');
  const output=lines.join('\n');parseTracker(output,source);return output;
}
function deleteTrackerGroup(text,source,name){
  parseTracker(text,source);if(isStagingGroup(name))throw new Error(tr('暂存区不能删除'));
  let layout=trackerLayout(text),t=layout.tables.find(t=>t.name===name);if(!t)throw new Error(tr('Venue 已被修改，请刷新'));
  const staging=layout.tables.some(t=>t.name==='暂存区')?'暂存区':layout.tables.some(t=>t.name==='待确定 venue')?'待确定 venue':'暂存区';
  if(!layout.tables.some(t=>t.name===staging))text=addTrackerGroup(text,source,staging);
  // Move records in one Markdown transaction; attachment paths and personal text stay intact.
  layout=trackerLayout(text);t=layout.tables.find(t=>t.name===name);const lines=layout.lines,cr=text.includes('\r\n')?'\r':'';
  const moved=lines.slice(t.start+2,t.end+1).map(line=>{const row=cells(line);row[2]='—';return '| '+row.join(' | ')+' |'+cr;});
  const remove=new Set([t.heading,t.deadlineIndex]);for(let i=t.heading+1;i<t.start;i++)if(lines[i].startsWith('共享 DDL：'))remove.add(i);for(let i=t.start;i<=t.end;i++)remove.add(i);
  const kept=lines.filter((_,i)=>!remove.has(i));
  const target=trackerLayout(kept.join('\n')).tables.find(t=>t.name===staging);kept.splice(target.end+1,0,...moved);
  const output=kept.join('\n');parseTracker(output,source);return output;
}
function addTrackerGroup(text,source,name){
  parseTracker(text,source);name=categoryName(name);
  if(trackerGroups(text).some(n=>n.toLowerCase()===name.toLowerCase()))throw new Error(tr('Venue 已存在'));
  const newline=text.includes('\r\n')?'\r\n':'\n';
  const section=('## '+name+'\n截止时间：—\n\n'+table(TRACKING_HEADERS,[])+'\n\n').replace(/\n/g,newline);
  const output=text.replace('<!-- tracking:end -->',section+'<!-- tracking:end -->');parseTracker(output,source);return output;
}
function parseTracker(text, source) {
  source=source.replace(/\.md$/, '');source=({reviews:'审稿',submissions:'投稿'})[source]||source;
  const deadlines=new Map(trackerGroups(text).map(name=>[name,trackerDeadline(text,name)]));
  return trackingRows(text,source).map((r,index)=>{
    const link=r.cells[0].match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    const pdfPath=link?decodeURIComponent(link[2]):'';
    if(pdfPath && (!pdfPath.startsWith(source==='审稿'?'reviews/':'submissions/') || pdfPath.split('/').some(p=>p==='..'||p==='.') || pdfPath.includes('\\') || !/\.pdf$/i.test(pdfPath))) throw new Error(tr('稿件 PDF 必须位于对应的 reviews/ 或 submissions/ 目录'));
    return {...r,index,path:`${source}:${index}`,pdfPath,filename:link?decodeText(link[1]):decodeText(r.cells[0]),published:deadlines.get(r.category),due:deadline(deadlines.get(r.category)),status:decodeText(r.cells[1]),priority:r.category,tags:'',tldr:decodeText(r.cells[3]),notes:decodeText(r.cells[4])};
  });
}
function updateReviewStatus(text,expected,status){
  if(!REVIEW_STATUSES.includes(status))throw new Error(tr('无效审稿状态'));
  const current=parseTracker(text,'reviews.md')[expected.index];
  if(!current||current.category!==expected.category||!same(current.cells,expected.cells))throw new Error(tr('任务已被修改，请保留草稿并重新载入'));
  if(current.status===status)return text;
  const lines=text.split('\n');let heading='',found=-1;
  for(let i=0;i<lines.length;i++){
    if(lines[i].startsWith('## '))heading=lines[i].slice(3).trim();
    if(heading===expected.category&&lines[i].startsWith('|')&&same(cells(lines[i]),expected.cells)){found=i;break;}
  }
  if(found<0)throw new Error(tr('无法定位任务'));
  // Change just the status cell: keep Notes, the venue DDL and all other cells verbatim.
  const parts=lines[found].split(/(?<!\\)\|/);parts[2]=' '+status+' ';lines[found]=parts.join('|');
  const output=lines.join('\n');parseTracker(output,'reviews.md');return output;
}
function updateTracker(text, source, expected, values) {
  source=source.replace(/\.md$/, '');source=({reviews:'审稿',submissions:'投稿'})[source]||source;
  const rows=parseTracker(text,source), group=categoryName(values.category);
  if(!values.title.trim() || !values.status.trim()) throw new Error(tr('稿件名称和状态不能为空'));
  deadline(values.due||'—');
  const next=[values.pdfPath?`[${escapeLabel(values.pdfPath.split('/').pop())}](${encodeURIPath(values.pdfPath)})`:encodeNotes(values.title),encodeNotes(values.status),trackerDeadline(text,group),encodeNotes(values.next),encodeNotes(values.notes)];
  const lines=text.split('\n'), cr=text.includes('\r\n')?'\r':'';
  if(expected) {
    const current=rows[expected.index];
    if(!current||!same(current.cells,expected.cells)||current.category!==expected.category) throw new Error(tr('任务已被修改，请保留草稿并重新载入'));
    // Match within its group to handle equal titles in distinct review rounds.
    let heading='',found=-1;
    for(let i=0;i<lines.length;i++){if(lines[i].startsWith('## '))heading=lines[i].slice(3).trim();if(heading===expected.category&&lines[i].startsWith('|')&&same(cells(lines[i]),expected.cells)){found=i;break;}}
    if(found<0)throw new Error(tr('无法定位任务'));
    if(group===expected.category)lines[found]='| '+next.join(' | ')+' |'+cr;
    else lines.splice(found,1);
  }
  if(!expected||expected.category!==group) {
    let heading='',end=-1;
    for(let i=0;i<lines.length;i++) {if(lines[i].startsWith('## '))heading=lines[i].slice(3).trim();if(heading===group&&lines[i].startsWith('|')&&same(cells(lines[i]),TRACKING_HEADERS)){end=i+1;while((lines[end+1]||'').startsWith('|'))end++;break;}}
    if(end>=0)lines.splice(end+1,0,'| '+next.join(' | ')+' |'+cr);
    else {const at=lines.findIndex(l=>l.trim()==='<!-- tracking:end -->');lines.splice(at,0,...('## '+group+'\n截止时间：—\n\n'+table(TRACKING_HEADERS,[next])+'\n').split('\n').map(l=>l+cr));}
  }
  const output=lines.join('\n');parseTracker(output,source);return output;
}
function removeRecord(text,scope,expected){
  const library=scope==='library',source=scope==='reviews'?'审稿':'投稿';
  if(!['library','reviews','submissions'].includes(scope))throw new Error(tr('无效记录类型'));
  const rows=library?parseLibrary(text):parseTracker(text,source);
  const current=library?rows.find(r=>r.path===expected.path):rows[expected.index];
  if(!current||current.category!==expected.category||!same(current.cells,expected.cells))throw new Error(tr('记录已被修改，请刷新后重试'));
  const lines=text.split('\n');let heading='',index=-1;
  for(let i=0;i<lines.length;i++){if(lines[i].startsWith('## '))heading=lines[i].slice(3).trim();if(heading===current.category&&lines[i].startsWith('|')&&same(cells(lines[i]),current.cells)){index=i;break;}}
  if(index<0)throw new Error(tr('无法定位记录'));lines.splice(index,1);
  const output=lines.join('\n');library?parseLibrary(output):parseTracker(output,source);return output;
}
function sameTrackerContent(a,b){return same(a.filter((_,i)=>i!==2),b.filter((_,i)=>i!==2));}
function restoreRecord(text,scope,row){
  const library=scope==='library',source=scope==='reviews'?'审稿':'投稿';
  if(!['library','reviews','submissions'].includes(scope))throw new Error(tr('无效记录类型'));
  const rows=library?parseLibrary(text):parseTracker(text,source),group=library&&text.includes('<!-- library:collections -->')?'文献':categoryName(row.category);
  if(rows.some(r=>library?r.path===row.path:r.category===group&&sameTrackerContent(r.cells,row.cells)))throw new Error(tr('这条记录已存在，未重复恢复'));
  if(library)text=row.cells.length===11?migrateLibraryTitles(text):row.cells.length===10?migrateLibraryCitations(text):row.cells.length===8?migrateLibraryVenues(text):migrateLibraryNotes(text);
  const names=library?getCategories(text):trackerGroups(text),cr=text.includes('\r\n')?'\r':'';
  if(!names.includes(group)){
    if(library)text=addCategory(text,group);
    else text=addTrackerGroup(text,source,group);
  }
  const lines=text.split('\n'),header=library?libraryHeaders(text):TRACKING_HEADERS;let heading='',end=-1;
  for(let i=0;i<lines.length;i++){if(lines[i].startsWith('## '))heading=lines[i].slice(3).trim();if(heading===group&&lines[i].startsWith('|')&&same(cells(lines[i]),header)){end=i+1;while((lines[end+1]||'').startsWith('|'))end++;break;}}
  if(end<0)throw new Error(tr('无法恢复到分类'));const values=[...row.cells];if(library)while(values.length<header.length)values.push('');if(!library)values[2]=trackerDeadline(text,group);
  lines.splice(end+1,0,'| '+values.join(' | ')+' |'+cr);const output=lines.join('\n');library?parseLibrary(output):parseTracker(output,source);return output;
}
module.exports = { REVIEW_STATUSES, updateReviewStatus, TITLE_HEADERS, migrateLibraryTitles, trackerLayout, CITATION_HEADERS, migrateLibraryCitations, HEADERS, NOTES_HEADERS, VENUE_HEADERS, normalizeVenues, venueOptions, migrateLibraryVenues, STATUSES, PRIORITIES, UNFILED_CATEGORY, TRACKING_HEADERS, parseLibrary, deadline, deadlineParts, composeDeadline, displayDeadline, deadlineCountdown, escapeLabel, filterLibrary, updateLibraryEntry, decodeText, encodeNotes, getCategories, migrateLibraryNotes, addCategory, renameCategory, deleteCategory, reorderGroups, parseTracker, trackerGroups, trackerDeadline, setTrackerDeadline, migrateTrackerDeadlines, isStagingGroup, renameTrackerGroup, deleteTrackerGroup, addTrackerGroup, updateTracker, removeRecord, restoreRecord, sameTrackerContent };
