'use strict';
// Loaded with the AI service, never during link intake. Parse into a detached,
// inert template: no scripts, frames, images or styles enter the live document.
module.exports=function({tr=x=>x,document:doc=globalThis.document}={}){
 const MAX_HTML=2*1024*1024,MAX_TEXT=48000;
 const fail=key=>{throw Error(tr(key));};
 const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
 function extractFetch(response){
  // Fetch returns source Markdown, not a search snippet or model-generated
  // answer. Bound the JSON before parsing and detach the retained excerpt.
  const raw=response.text;
  if(typeof raw!=='string'||raw.length>MAX_HTML||new TextEncoder().encode(raw).byteLength>MAX_HTML)fail('网页正文过大，暂不整理');
  let data;try{data=JSON.parse(raw);}catch(_){fail('此链接未返回可读取的网页正文');}
  if(!data||typeof data.content!=='string'||typeof data.title!=='string')fail('此链接未返回可读取的网页正文');
  const text=data.content.slice(0,MAX_TEXT).split('').join('');
  if(clean(text).length<160)fail('网页正文不足，未发送 AI 请求');
  return {title:clean(data.title).slice(0,600),text,truncated:data.content.length>MAX_TEXT};
 }
 function extract(response){
  const headers=Object.fromEntries(Object.entries(response.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
  if(response.status!==200)fail('网页读取失败，请检查链接或网站访问限制');
  const type=String(headers['content-type']||'').split(';')[0].trim().toLowerCase();
  if(!['text/html','application/xhtml+xml','text/plain'].includes(type))fail('此链接未返回可读取的网页正文');
  // requestUrl buffers a response in the host. These limits bound parsing and
  // model input, not the host's download. Never retain the response in previews.
  if(Number(headers['content-length'])>MAX_HTML)fail('网页正文过大，暂不整理');
  const html=response.text;
  if(typeof html!=='string'||html.length>MAX_HTML||new TextEncoder().encode(html).byteLength>MAX_HTML)fail('网页正文过大，暂不整理');
  if(type==='text/plain'){
   const text=html.slice(0,MAX_TEXT).split('').join('');
   if(clean(text).length<160)fail('网页正文不足，未发送 AI 请求');
   return {title:'',text,truncated:html.length>MAX_TEXT};
  }
  const detached=doc.implementation.createHTMLDocument(''),template=detached.createElement('template');
  template.innerHTML=html;
  const root=template.content;
  const title=clean(root.querySelector('article h1,main h1,[role="main"] h1')?.textContent||root.querySelector('meta[property="og:title"]')?.getAttribute('content')||root.querySelector('h1')?.textContent||root.querySelector('title')?.textContent).slice(0,600);
  // Boilerplate cannot become evidence for an otherwise empty / login page.
  root.querySelectorAll('script,style,noscript,template,iframe,object,embed,svg,canvas,nav,header,footer,aside,form,dialog,button,input,select,textarea,[hidden],[aria-hidden="true"],[role="navigation"],[role="banner"],[role="contentinfo"]').forEach(n=>n.remove());
  const content=root.querySelector('article')||root.querySelector('main,[role="main"]')||root.querySelector('body')||root;
  const walker=detached.createTreeWalker(content,4),parts=[];let left=MAX_TEXT,node,truncated=false;
  while((node=walker.nextNode())){
   const value=clean(node.nodeValue);if(!value)continue;
   if(left<=0){truncated=true;break;}
   const piece=value.length>left?value.slice(0,left).split('').join(''):value;
   parts.push(piece);left-=piece.length+1;if(piece.length<value.length){truncated=true;break;}
  }
  const text=parts.join('\n');
  if(clean(text).length<160)fail('网页正文不足，未发送 AI 请求');
  if(/^(just a moment|access denied|attention required|sign in|log in|enable javascript|verify you are human|安全验证|请登录|访问受限)\b/i.test(title))fail('网页需要登录或验证，无法读取正文');
  return {title,text,truncated};
 }
 return {extract,extractFetch,MAX_HTML,MAX_TEXT};
};
