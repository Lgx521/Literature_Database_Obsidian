'use strict';
const {t:tr}=require('./i18n');
// No Citation.js, PDF or network dependency. Parse bibliography only for a
// missing title, through a lazy callback supplied by the caller.
function exportTitles(rows,parse,translate=tr){
  const titles=[],missing=[];
  for(const row of new Map(rows.map(row=>[row.path,row])).values()){
    let title=row.title?.trim()||'';try{if(!title&&row.bibtex)title=parse(row.bibtex).data.title||'';}catch(_){}
    if(title&&!/\.pdf$/i.test(title))titles.push(title.replace(/\s+/g,' '));
    else missing.push({row,reason:translate('尚未取得论文篇名')});
  }
  const text=titles.join('\n');return {text,content:text?text+'\n':'',extension:'txt',ready:titles.length,missing,report:missing.map(({row,reason})=>row.path+'\n  '+reason).join('\n\n')};
}
module.exports={exportTitles};
