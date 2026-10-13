const {t:tr}=require('./i18n');
'use strict';
// Evidence-based bibliography retrieval. Never executes PDF text, guesses an author/year,
// follows arbitrary PDF URLs, or sends review/submission PDFs to a metadata service.
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).replace(/\\pi(?![A-Za-z])/g,'π').replace(/\\Omega(?![A-Za-z])/g,'Ω').replace(/\\(?:text|mathrm|mathbf|mathcal)\b/g,'').normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const xmlText=v=>String(v||'').replace(/<[^>]+>/g,'').replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return c<=0x10ffff?String.fromCodePoint(c):'';}).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
function validTitle(v){v=clean(v);return v.length>=5&&v.length<=1000&&!/^(untitled|unknown|title|paper|main|document|microsoft word.*|.*\.pdf)$/i.test(v)&&!/[\x00-\x08]/.test(v);}
function verifiedTitle(title,evidence){const a=norm(title),b=norm((evidence.pages?.[0]||'').slice(0,5000));return validTitle(title)&&a.length>=5&&b.includes(a);}
function authors(names){
  if(typeof names==='string')names=names.split(/;|\s+and\s+/i);
  if(!Array.isArray(names)||!names.length)return [];
  if(names.some(n=>/anonymous|et\s*al\.?|withheld|unknown/i.test(String(n))))return [];
  return names.map(value=>{
    const name=clean(value);if(!name)return null;
    if(/team|collaboration|consortium|physical intelligence|google deepmind/i.test(name))return {literal:name};
    if(name.includes(',')){const [family,...given]=name.split(',');return {family:clean(family),given:clean(given.join(','))};}
    const parts=name.split(' ');if(parts.length===1)return {literal:name};
    let i=parts.length-1;while(i>0&&/^(van|von|de|del|da|di|du|la|le|der|den)$/i.test(parts[i-1]))i--;
    return {family:parts.slice(i).join(' '),given:parts.slice(0,i).join(' ')};
  }).filter(Boolean);
}
function dateParts(value){
  const m=String(value||'').match(/^(\d{4})(?:[-/](\d{1,2})(?:[-/](\d{1,2}))?)?(?:$|[T\s])/);if(!m)return null;
  const parts=m.slice(1).filter(x=>x!==undefined).map(Number),[y,mo=1,d=1]=parts;
  if(y<1000||y>2999||mo<1||mo>12||d<1||d>new Date(Date.UTC(y,mo,0)).getUTCDate())return null;return parts;
}
function arxivIds(text){return [...new Set([...String(text).matchAll(/(?:arxiv\s*:\s*|arxiv\.org\/(?:abs|pdf)\/)(\d{4}\.\d{4,5}(?:v\d+)?|[a-z.-]+\/\d{7}(?:v\d+)?)/gi)].map(m=>m[1]))];}
function doiIds(text){
  const values=[...String(text).matchAll(/\b10\.\d{4,9}\/[^\s<>"{}]+/gi)].map(m=>{
    let doi=m[0].replace(/[.,;]+$/g,'');
    while(doi.endsWith(')')&&(doi.match(/\)/g)||[]).length>(doi.match(/\(/g)||[]).length)doi=doi.slice(0,-1);
    return doi;
  }).filter(x=>x.length<250);return [...new Set(values)];
}
function evidenceIds(e){
  const metadata=JSON.stringify([e.info||{},e.metadata||{}]);
  const all=metadata+'\n'+(e.pages||[]).join('\n');
  const arxiv=arxivIds(all);
  for(const doi of doiIds(all)){const m=doi.match(/^10\.48550\/arxiv\.(\d{4}\.\d{4,5}(?:v\d+)?)$/i);if(m&&!arxiv.some(x=>x.replace(/v\d+$/,'')===m[1].replace(/v\d+$/,'')))arxiv.push(m[1]);}
  return {arxiv:arxiv.slice(0,3),doi:doiIds(all).filter(d=>!/^10\.48550\/arxiv\./i.test(d)).slice(0,3)};
}
function firstValue(v){if(Array.isArray(v))return v[0]||'';if(v&&typeof v==='object')return v['x-default']||Object.values(v)[0]||'';return v||'';}
function pdfTitle(e,row={}){
  const m=e.metadata||{},info=e.info||{};
  for(const v of [row.title,firstValue(m['dc:title']),info.Title,e.layoutTitle])if(verifiedTitle(v,e))return clean(v);
  return validTitle(row.title)?clean(row.title):'';
}
function embedded(e,row={}){
  const m=e.metadata||{},i=e.info||{},title=pdfTitle(e,row),list=authors(m['dc:creator']||i.Author);
  let date=dateParts(firstValue(m['prism:publicationdate'])||i.PublicationDate);
  const ids=evidenceIds(e),arxiv=ids.arxiv[0];
  // Only a v1 arXiv stamp is an initial publication date. Revisions require the source record.
  // PDF CreationDate/ModDate are never publication evidence.
  if(!date&&arxiv&&!/v([2-9]|[1-9]\d+)$/i.test(arxiv)){const stamp=(e.pages||[]).join('\n').match(/arxiv\s*:\s*[^\n]*?\]\s*(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i);if(stamp)date=dateParts(stamp[3]+'-'+(1+['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(stamp[2].toLowerCase()))+'-'+stamp[1]);}
  if(!title||!list.length||!date||!verifiedTitle(title,e))return null;
  const container=clean(m['prism:publicationname']),type=container&&/journal/i.test(m['prism:aggregationtype']||'')?'article-journal':'document';
  const data={type,title,author:list,issued:{'date-parts':[date]}};
  if(container)data['container-title']=container;
  if(arxiv){data.publisher='arXiv';data.URL='https://arxiv.org/abs/'+arxiv;}
  const doi=doiIds(JSON.stringify([m,i]))[0];if(doi)data.DOI=doi;
  for(const [field,key] of [['volume','prism:volume'],['issue','prism:number'],['page','prism:pagerange']])if(m[key])data[field]=clean(m[key]);
  return {data,source:'PDF XMP/Info'+(arxiv?'；arXiv 首页日期；https://arxiv.org/abs/'+arxiv:'')};
}
function tag(text,name){return [...String(text).matchAll(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','gi'))].map(m=>clean(xmlText(m[1])));}
function atomEntries(xml){
  if(/<!DOCTYPE/i.test(xml))throw new Error(tr('不支持的 XML'));
  return [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map(m=>{
    const text=m[1],id=tag(text,'id')[0]||'',names=[...text.matchAll(/<author\b[^>]*>([\s\S]*?)<\/author>/gi)].map(a=>tag(a[1],'name')[0]).filter(Boolean);
    const date=dateParts(tag(text,'published')[0]);
    return {type:'document',title:tag(text,'title')[0]||'',author:authors(names),...(date?{issued:{'date-parts':[date]}}:{}),publisher:'arXiv',URL:id.replace(/^http:/,'https:'),arxiv:arxivIds(id)[0]||'',DOI:tag(text,'arxiv:doi')[0]||''};
  });
}
function arxivHtml(html,id){
  const values={};for(const match of html.matchAll(/<meta\b([^>]+)>/gi)){
    const attrs={};for(const a of match[1].matchAll(/([\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g))attrs[a[1].toLowerCase()]=xmlText(a[3]);
    const name=(attrs.name||'').toLowerCase();if(name)(values[name]??=[]).push(attrs.content||'');
  }
  const actual=(values.citation_arxiv_id||[])[0]||arxivIds((values.citation_pdf_url||[])[0])[0];if(!actual||actual.replace(/v\d+$/,'')!==id.replace(/v\d+$/,''))return null;
  const date=dateParts((values.citation_date||values.citation_publication_date||[])[0]);
  return {type:'document',title:(values.citation_title||[])[0],author:authors(values.citation_author||[]),...(date?{issued:{'date-parts':[date]}}:{}),publisher:'arXiv',arxiv:actual,URL:'https://arxiv.org/abs/'+id};
}
function crossrefData(item){
  const issued=item.published||item['published-print']||item['published-online']||item.issued;
  return {type:({'journal-article':'article-journal','proceedings-article':'paper-conference','book-chapter':'chapter','book':'book'})[item.type]||'document',title:clean(xmlText(item.title?.[0])),author:(item.author||[]).map(a=>a.name?{literal:clean(a.name)}:{family:clean(a.family),given:clean(a.given)}),'container-title':clean(item['container-title']?.[0]),issued,DOI:item.DOI,URL:item.URL,volume:item.volume,issue:item.issue,page:item.page,publisher:item.publisher};
}
function matches(data,e,title,strict=false){
  if(!data?.title||!data.author?.length||!data.issued?.['date-parts']?.[0]?.[0])return false;
  const candidate=norm(data.title),expected=norm(title);
  const titleMatch=verifiedTitle(data.title,e)&&(!expected||candidate===expected);
  if(!titleMatch)return false;
  if(strict){const head=norm((e.pages?.[0]||'').slice(0,4500));if(!data.author.some(a=>{const n=norm(a.family||a.literal);return n.length>2&&head.includes(n);}))return false;}
  return true;
}
function citationKey(path){let h=2166136261;for(const c of path){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return 'ref_'+(h>>>0).toString(36);}
async function readPdf(pdfjs,data){
  const task=pdfjs.getDocument({data:new Uint8Array(data),isEvalSupported:false,disableFontFace:true,useSystemFonts:false,verbosity:0});let doc;
  try{
    doc=await task.promise;const {info,metadata}=await doc.getMetadata(),pages=[];let layoutTitle='';
    for(let n=1;n<=Math.min(2,doc.numPages);n++){
      const page=await doc.getPage(n),content=await page.getTextContent();
      const items=content.items.filter(i=>typeof i.str==='string');pages.push(items.map(i=>i.str+(i.hasEOL?'\n':' ')).join('').slice(0,45000));
      if(n===1){
        const h=page.getViewport({scale:1}).height;
        const candidates=items.filter(i=>i.str.trim()&&Math.abs(i.transform[1])<0.01&&i.transform[5]>h*0.55&&i.transform[5]<h*0.95&&!/^arxiv:/i.test(i.str));
        const max=Math.max(0,...candidates.map(i=>Math.abs(i.transform[3])));
        const large=candidates.filter(i=>Math.abs(i.transform[3])>=max*0.86&&Math.abs(i.transform[3])>=12).sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4]);
        // Only the first contiguous large-text block is the title; ignore later figure logos.
        const block=[];for(const item of large){if(block.length&&block.at(-1).transform[5]-item.transform[5]>max*2.2)break;block.push(item);}
        if(block.length){
          const top=Math.max(...block.map(i=>i.transform[5]))+max*0.55,bottom=Math.min(...block.map(i=>i.transform[5]))-max*0.55;
          const titleItems=items.filter(i=>i.str.trim()&&Math.abs(i.transform[1])<0.01&&i.transform[5]>=bottom&&i.transform[5]<=top);
          let text='',previous=null;
          for(const item of titleItems){const gap=previous?item.transform[4]-(previous.transform[4]+previous.width):0;
            if(previous&&(previous.hasEOL||Math.abs(previous.transform[5]-item.transform[5])>max*0.6||gap>max*0.18))text+=' ';
            text+=item.str;previous=item;
          }
          layoutTitle=clean(text).replace(/π\s*([∗*]?)\s*(\d)\s*\.\s*(\d)/g,'π$1$2.$3');
        }
        if(!validTitle(layoutTitle)||layoutTitle.length>450)layoutTitle='';
      }
      page.cleanup();
    }
    return {info:info||{},metadata:metadata?.getAll?.()||{},pages,layoutTitle};
  }finally{if(doc)await doc.destroy();else await task.destroy();}
}
async function resolve(row,e,services){
  const title=pdfTitle(e,row),local=embedded(e,row),errors=[];
  const finish=record=>{
    // Prefer the equivalent printed glyphs over raw TeX in a source title (e.g. pi subscripts).
    if(title&&/[$\\]/.test(record.data.title)&&norm(title)===norm(record.data.title))record.data={...record.data,title};
    const converted=services.fromCsl(record.data,citationKey(row.path));
    return {title:converted.title||record.data.title,bibtex:converted.bibtex,citationSource:record.source+'；读取于 '+new Date().toISOString().slice(0,10)};
  };
  if(local)try{return finish(local);}catch(err){errors.push(err.message);}
  const ids=evidenceIds(e);
  for(const id of ids.arxiv){
    const url='https://export.arxiv.org/api/query?id_list='+encodeURIComponent(id);
    try{
      const list=atomEntries(await services.request(url));
      const data=list.find(x=>x.arxiv.replace(/v\d+$/,'')===id.replace(/v\d+$/,'')&&matches(x,e,title));
      if(data)return finish({data,source:'arXiv API；'+url});
    }catch(err){errors.push(err.message);}
    try{
      const url='https://arxiv.org/abs/'+id,data=arxivHtml(await services.request(url),id);
      if(matches(data,e,title))return finish({data,source:'arXiv citation metadata；'+url});
    }catch(err){errors.push(err.message);}
  }
  for(const doi of ids.doi){
    const url='https://api.crossref.org/works/'+encodeURIComponent(doi);
    try{const data=crossrefData(JSON.parse(await services.request(url)).message);if(data.DOI?.toLowerCase()===doi.toLowerCase()&&matches(data,e,title))return finish({data,source:'Crossref DOI；'+url});}catch(err){errors.push(err.message);}
  }
  if(title){
    // An exact title and a visible author are required for title-only search.
    const url='https://api.crossref.org/works?query.title='+encodeURIComponent(title)+'&rows=3';
    try{
      const candidates=(JSON.parse(await services.request(url)).message?.items||[]).map(crossrefData).filter(data=>matches(data,e,title,true));
      if(candidates.length===1)return finish({data:candidates[0],source:'Crossref exact title + PDF author；https://api.crossref.org/works/'+encodeURIComponent(candidates[0].DOI)});
    }catch(err){errors.push(err.message);}
    const words=(title.match(/[A-Za-z]{3,}/g)||[]).filter(w=>!['the','and','with','for','from','does','when','are','over'].includes(w.toLowerCase())).slice(0,10);
    const arxivQuery=words.map(w=>'ti:'+w).join(' AND ');
    const arxivUrl='https://export.arxiv.org/api/query?search_query='+encodeURIComponent(arxivQuery)+'&max_results=5';
    try{
      const candidates=arxivQuery?atomEntries(await services.request(arxivUrl)).filter(data=>matches(data,e,title,true)):[];
      if(candidates.length===1)return finish({data:candidates[0],source:'arXiv exact title + PDF author；'+candidates[0].URL});
    }catch(err){errors.push(err.message);}
  }
  return {title,citationError:errors.length?tr('元数据检索未完成：')+errors.at(-1):tr('没有找到篇名、作者与 PDF 一致的完整引用资料')};
}
function transport(request){
  let lastArxiv=0;
  return async url=>{
    const parsed=new URL(url);if(parsed.protocol!=='https:'||!['export.arxiv.org','arxiv.org','api.crossref.org'].includes(parsed.hostname))throw new Error(tr('不允许的元数据来源'));
    if(parsed.hostname==='export.arxiv.org'){const wait=3100-(Date.now()-lastArxiv);if(wait>0)await new Promise(r=>setTimeout(r,wait));lastArxiv=Date.now();}
    let timer;try{
      const response=await Promise.race([request(url),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(tr('来源响应超时'))),18000);})]);
      const status=response.status??200,body=typeof response==='string'?response:response.text;
      if(status<200||status>=300)throw new Error(tr('来源返回 HTTP ')+status);
      if(typeof body!=='string'||body.length>2000000)throw new Error(tr('来源响应无效'));return body;
    }finally{clearTimeout(timer);}
  };
}
module.exports={clean,norm,validTitle,verifiedTitle,authors,dateParts,arxivIds,doiIds,evidenceIds,pdfTitle,embedded,atomEntries,arxivHtml,crossrefData,matches,citationKey,readPdf,resolve,transport};
