'use strict';
const Engine=require('./dashboard.js'),Collections=require('./collections.js');
// Pure migration. Deployment backs up and compares both source files before writing.
function migrate(library){
  if(library.includes('<!-- library:collections -->'))throw new Error('已迁移，不能从主表重建或覆盖集合');
  const rows=Engine.parseLibrary(library),names=Engine.getCategories(library),eol=library.includes('\r\n')?'\r\n':'\n';
  const lines=library.split(/\r?\n/),first=lines.findIndex(l=>l.startsWith('## ')),end=lines.indexOf('<!-- library:end -->');
  let collections=Collections.empty();
  for(const n of names){
    if(n===Engine.UNFILED_CATEGORY)continue;
    collections=Collections.add(collections,'library',n);
    collections=Collections.change(collections,rows.filter(r=>r.category===n).map(r=>r.path),{scope:'library',name:n});
    const start=lines.indexOf('## '+n);let stop=start+1;while(stop<end&&!lines[stop].startsWith('## '))stop++;
    const prose=lines.slice(start+1,stop).filter(l=>!l.startsWith('|')).join('\n').trim();
    if(prose)collections=collections.replace('## 分类：'+n+'\n','## 分类：'+n+'\n\n'+prose+'\n');
  }
  const headers=rows.some(r=>r.cells.length===14)?Engine.BOOKMARK_HEADERS:rows.some(r=>r.cells.length===13)?Engine.ORGANIZATION_HEADERS:Engine.TITLE_HEADERS;
  const header='| '+headers.join(' | ')+' |',separator='| '+headers.map(()=> '---').join(' | ')+' |';
  const migrated=[...lines.slice(0,first),'<!-- library:collections -->','## 文献','',header,separator,...rows.map(r=>'| '+[...r.cells,...Array(Math.max(0,headers.length-r.cells.length)).fill('')].join(' | ')+' |'),'',...lines.slice(end)].join(eol);
  if(eol==='\r\n')collections=collections.replace(/\n/g,eol);
  const after=Engine.parseLibrary(migrated);Collections.parse(collections);
  if(after.length!==rows.length||after.some((r,i)=>JSON.stringify(r.cells.slice(0,rows[i].cells.length))!==JSON.stringify(rows[i].cells)))throw new Error('迁移校验失败');
  return {library:migrated,collections};
}
module.exports={migrate};
