'use strict';
const {t:tr}=require('./i18n');
const ID=/^web:[a-zA-Z0-9-]{8,80}$/;
function newId(crypto){
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  return 'web:'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
function normalizeURL(value){
  const text=String(value||'').trim();
  if(!/^https?:\/\//i.test(text)||/[\s\x00-\x1f\x7f\\]/.test(text)||text.length>8192)throw Error(tr('请输入完整的 HTTP 或 HTTPS 网址'));
  let url;try{url=new URL(text);}catch(_){throw Error(tr('请输入完整的 HTTP 或 HTTPS 网址'));}
  if(!url.hostname||url.username||url.password)throw Error(tr('网址不能包含登录凭据'));
  // Keep query order, tracking parameters and fragments: they can identify different content.
  return url.href.replace(/[()|]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
}
function metadata(value){
  if(!value)return null;
  let data;try{data=typeof value==='string'?JSON.parse(value):value;}catch(_){throw Error(tr('网页记录格式无效'));}
  if(!data||data.type!=='web'||!ID.test(data.id)||typeof data.inbox!=='boolean'||typeof data.added!=='string'||!Number.isFinite(Date.parse(data.added)))throw Error(tr('网页记录格式无效'));
  return {type:'web',id:data.id,inbox:data.inbox,added:data.added};
}
function isWeb(row){return row?.kind==='web';}
function fallbackTitle(url){const parsed=new URL(normalizeURL(url));return parsed.hostname+(parsed.pathname==='/'?'':parsed.pathname);}
function links(text){
  const found=new Map();
  for(const line of String(text||'').split(/\r?\n/)){
    const value=line.trim();if(!value||value.startsWith('#'))continue;
    const markdown=value.match(/^\[([^\]]*)\]\((https?:\/\/\S+)\)$/i);
    try{const url=normalizeURL(markdown?markdown[2]:value);if(!found.has(url))found.set(url,{url,title:markdown?.[1]||''});}catch(_){}
  }
  return [...found.values()];
}
function fromTransfer(transfer,doc){
  // Local files take precedence; a browser PDF drag must never silently import both.
  if(transfer?.files?.length)return [];
  const result=links(transfer?.getData('text/uri-list')||transfer?.getData('text/plain'));
  if(doc&&transfer?.getData('text/html')){
    // Detached DOMParser documents do not execute scripts or attach remote content.
    const Parser=doc.defaultView?.DOMParser,html=transfer.getData('text/html');
    if(Parser&&html.length<131072){
      const parsed=new Parser().parseFromString(html,'text/html');
      for(const anchor of parsed.querySelectorAll('a[href]')){
        try{
          const url=normalizeURL(anchor.getAttribute('href')),title=(anchor.textContent||'').trim().slice(0,1000);
          const item=result.find(r=>r.url===url);
          if(item&&!item.title)item.title=title;
          else if(!result.length){result.push({url,title});break;}
        }catch(_){}
      }
    }
  }
  return result;
}
module.exports={ID,newId,normalizeURL,metadata,isWeb,fallbackTitle,links,fromTransfer};
