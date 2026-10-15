'use strict';
const {t:tr}=require('./i18n');
const FILE='tags.md',START='<!-- literature-tags:start -->',END='<!-- literature-tags:end -->';
const fold=s=>String(s).toLocaleLowerCase(),clone=x=>JSON.parse(JSON.stringify(x));
const encode=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const decode=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function validTag(tag){return typeof tag==='string'&&tag.length<=180&&/^#[\p{L}\p{M}\p{N}_/-]+$/u.test(tag)&&!tag.startsWith('#/')&&!tag.endsWith('/')&&!tag.includes('//')&&!/^#\d+$/.test(tag);}
function label(tag){return tag.replace(/^#research\//i,'').replace(/^#/,'');}
function family(tag){const parts=tag.slice(1).split('/');return '#'+parts.slice(0,fold(parts[0])==='research'&&parts.length>1?2:1).join('/');}
function groupName(value){const s=String(value).trim();if(!s||s.length>60||/[\r\n\0]/.test(s))throw Error(tr('请输入 1–60 字的分组名称'));return s;}
function validate(model){
 if(!model||!Array.isArray(model.groups))throw Error(tr('标签目录格式无效'));
 const names=new Set(),tags=new Set(),families=new Map();
 for(const g of model.groups){const name=groupName(g.name),key=fold(name);if(names.has(key)||!Array.isArray(g.tags))throw Error(tr('标签分组名称重复'));names.add(key);
  for(const tag of g.tags){if(!validTag(tag)||tags.has(fold(tag)))throw Error(tr('标签无效或重复'));tags.add(fold(tag));const f=fold(family(tag));if(families.has(f)&&families.get(f)!==key)throw Error(tr('同一标签分支须放在同一分组'));families.set(f,key);}
 }return model;
}
function parse(text){
 if(typeof text!=='string'||text.split(START).length!==2||text.split(END).length!==2||text.indexOf(START)>text.indexOf(END))throw Error(tr('tags.md 不是完整的标签目录，未覆盖文件'));
 const groups=[];let current=null;
 for(const raw of text.slice(text.indexOf(START)+START.length,text.indexOf(END)).split(/\r?\n/)){
  const line=raw.trim();if(!line)continue;
  if(line.startsWith('## Group: ')){current={name:decode(line.slice(10)),tags:[]};groups.push(current);}
  else if(line.startsWith('- #')&&current)current.tags.push(line.slice(2));
  else throw Error(tr('标签目录格式无效'));
 }return validate({groups});
}
function serialize(model,original=null){
 validate(model);const eol=original?.includes('\r\n')?'\r\n':'\n';
 const body=eol+model.groups.map(g=>'## Group: '+encode(g.name)+eol+g.tags.map(t=>'- '+t).join(eol)).join(eol+eol)+eol;
 if(original===null)return '# Tag map\n\n'+START+body+END+'\n';
 parse(original);return original.slice(0,original.indexOf(START)+START.length)+body+original.slice(original.indexOf(END));
}
const suggestions=[['方法',['rl','ttt','meta-learning','few-shot','icl','diffusion','self-supervised','autoregressive','motion-planning','online-adaptation']],['模型',['vla','wam','world-model','generalist-policy','value-model','llm','text_encoder']],['表征',['3d','action-representation','latent-action','graph','memory','spatial-representation','multimodal']],['任务',['cross-embodiment','visual-transfer','dexterous','sim-to-real','locomotion','skill-learning','agentic-robotics','agentic-research','video-generation','temporal-consistency','sequence-modeling']],['数据与评测',['benchmark','dataset','data','data-augmentation','umi']]];
function effective(model,rows){
 const next=clone(model||{groups:[]}),known=new Set(next.groups.flatMap(g=>g.tags.map(fold))),owners=new Map();
 for(const g of next.groups)for(const tag of g.tags)owners.set(fold(family(tag)),g);
 const tags=[...new Set(rows.flatMap(r=>String(r.tags||'').split(/\s+/).filter(validTag)))].sort((a,b)=>a.localeCompare(b));
 for(const tag of tags){if(known.has(fold(tag)))continue;const f=fold(family(tag));let group=owners.get(f);
  if(!group){const name=tr(suggestions.find(([,keys])=>keys.includes(label(f)))?.[0]||'其他标签');group=next.groups.find(g=>g.name===name);if(!group){group={name,tags:[]};next.groups.push(group);}owners.set(f,group);}
  group.tags.push(tag);known.add(fold(tag));
 }return validate(next);
}
function addGroup(model,name){const next=clone(model);next.groups.push({name:groupName(name),tags:[]});return validate(next);}
function addTag(model,group,parent,value){
 const next=clone(model),g=next.groups.find(g=>g.name===group);if(!g)throw Error(tr('标签分组已改变，请重新打开'));
 let name=String(value).trim();if(!name||/[\r\n]/.test(name))throw Error(tr('请输入标签名称'));
 name=name.replace(/\s+/g,'-').toLocaleLowerCase();
 const tag=parent?parent+'/'+name.replace(/^#+/,''):name.startsWith('#')?name:name.startsWith('research/')?'#'+name:'#research/'+name;
 if(!validTag(tag))throw Error(tr('标签只能包含文字、数字、连字符、下划线和斜杠'));
 if(next.groups.some(g=>g.tags.some(t=>fold(t)===fold(tag))))throw Error(tr('标签已存在，请直接勾选'));
 g.tags.push(tag);validate(next);return {model:next,tag};
}
function moveFamily(model,tag,to){const next=clone(model),target=next.groups.find(g=>g.name===to);if(!target)throw Error(tr('标签分组已改变，请重新打开'));const key=fold(family(tag));for(const g of next.groups){if(g===target)continue;target.tags.push(...g.tags.filter(t=>fold(family(t))===key));g.tags=g.tags.filter(t=>fold(family(t))!==key);}return validate(next);}
function rename(model,node,value){
 const next=clone(model);
 if(node.kind==='group'){
  const group=next.groups.find(g=>g.name===node.group);if(!group)throw Error(tr('标签分组已改变，请重新打开'));
  group.name=groupName(value);return {model:validate(next),mapping:{},key:'group:'+group.name};
 }
 // Rename one segment, retaining its prefix and all descendants. Never merge implicitly.
 const name=String(value).trim().replace(/\s+/g,'-').toLocaleLowerCase();
 if(!name||/[\/#]/.test(name))throw Error(tr('请输入单个标签名称，不含斜杠'));
 const from=node.tag,to=from.slice(0,from.lastIndexOf('/')+1)+(from.includes('/')?'':'#')+name;
 if(!validTag(to))throw Error(tr('标签只能包含文字、数字、连字符、下划线和斜杠'));
 const matches=t=>fold(t)===fold(from)||fold(t).startsWith(fold(from)+'/');
 const tags=next.groups.flatMap(g=>g.tags),affected=tags.filter(matches);
 if(!affected.length)throw Error(tr('标签分支已改变，请重新打开'));
 const outside=tags.filter(t=>!matches(t));
 if(fold(from)!==fold(to)&&outside.some(t=>fold(t)===fold(to)||fold(t).startsWith(fold(to)+'/')))throw Error(tr('目标标签分支已存在，不能隐式合并'));
 const mapping=Object.fromEntries(affected.map(t=>[t,to+t.slice(from.length)]));
 for(const g of next.groups)g.tags=g.tags.map(t=>mapping[t]||t);
 return {model:validate(next),mapping,from,to,key:'tag:'+fold(to)};
}
function tree(model){
 return {key:'root',kind:'root',label:tr('标签库'),children:model.groups.map(g=>{
  const root={key:'group:'+g.name,kind:'group',label:g.name,group:g.name,children:[]},nodes=new Map();
  for(const tag of g.tags){const pieces=tag.slice(1).split('/'),start=fold(pieces[0])==='research'&&pieces.length>1?1:0;let parent=root;
   for(let i=start;i<pieces.length;i++){const prefix='#'+pieces.slice(0,i+1).join('/'),key=fold(prefix);let node=nodes.get(key);if(!node){node={key:'tag:'+key,kind:'tag',tag:prefix,label:pieces[i],group:g.name,children:[]};nodes.set(key,node);parent.children.push(node);}parent=node;}
  }return root;
 })};
}
async function read(vault){const file=vault.getAbstractFileByPath(FILE);if(file){if(file.children)throw Error(tr('tags.md 不是完整的标签目录，未覆盖文件'));const text=await vault.read(file);return {text,model:parse(text)};}if(await vault.adapter.exists(FILE))throw Error(tr('标签目录尚未同步，请稍后重试'));return {text:null,model:null};}
async function save(plugin,expected,model){
 const after=serialize(model,expected),vault=plugin.app.vault;
 if(plugin.stopped||plugin.recordBusy||plugin.importing||plugin.lastError)throw Error(tr('请等待当前操作完成'));
 plugin.recordBusy=true;
 try{
  if(expected===null){if(vault.getAbstractFileByPath(FILE)||await vault.adapter.exists(FILE))throw Error(tr('标签目录已改变，请重新打开；输入已保留'));await vault.create(FILE,after);}
  else await plugin.mutate(FILE,current=>{if(current!==expected)throw Error(tr('标签目录已改变，请重新打开；输入已保留'));return after;});
  return after;
 }finally{plugin.recordBusy=false;}
}
// Balance complete branches once per open map. Folding and adding a child must not
// move an existing group across the root. This is view state, never catalog data.
function layout(tree,{collapsed=new Set(),editor=null,sides=new Map()}={}){
 const weight=node=>node.children.length?node.children.reduce((sum,n)=>sum+weight(n),0):1;
 const loads={left:0,right:0},groups=tree.children;
 for(const group of groups)if(sides.has(group.key))loads[sides.get(group.key)]+=weight(group);
 for(const group of groups.filter(g=>!sides.has(g.key)).sort((a,b)=>weight(b)-weight(a))){const side=loads.right<=loads.left?'right':'left';sides.set(group.key,side);loads[side]+=weight(group);}
 const visible=[],widths={left:[],right:[]};
 const walk=(node,depth,parent,side)=>{
  const renaming=editor?.renameKey===node.key;
  const width=node.kind==='editor'||renaming?234:Math.min(260,Math.max(node.kind==='root'?106:128,58+[...node.label].reduce((sum,c)=>sum+(/[\u2e80-\uffff]/.test(c)?14:7.8),0)));
  const n={...node,...(renaming?{key:'editor',kind:'editor'}:{}),depth,parent,side,width,hasChildren:node.children.length>0,children:[]};visible.push(n);
  if(side)widths[side][depth]=Math.max(widths[side][depth]||0,width);
  if(!collapsed.has(node.key))n.children=node.children.map(c=>walk(c,depth+1,n,side||sides.get(c.key)));
  if(!editor?.renameKey&&editor?.parent===node.key){const editorSide=side||'right';n.children.push(walk({key:'editor',kind:'editor',label:'',children:[]},depth+1,n,editorSide));}
  return n;
 };
 const root=walk(tree,0,null,null),heights={left:0,right:0};root.x=0;
 for(const side of ['left','right']){
  let row=0;const place=n=>{
   if(n.children.length){n.children.forEach(place);n.y=(n.children[0].y+n.children.at(-1).y)/2;}else n.y=row++*49;
   const distance=55+widths[side].slice(1,n.depth).reduce((sum,w)=>sum+w+55,0);
   n.x=side==='right'?root.width+distance:-distance-n.width;
  };
  root.children.filter(n=>n.side===side).forEach(place);heights[side]=Math.max(0,(row-1)*49);
 }
 const height=Math.max(heights.left,heights.right);root.y=height/2;
 for(const n of visible)if(n.side)n.y+=(height-heights[n.side])/2;
 const left=Math.min(...visible.map(n=>n.x))-24,right=Math.max(...visible.map(n=>n.x+n.width))+24;
 for(const n of visible){n.x-=left;n.y+=12;}
 return {nodes:visible,width:right-left,height:height+60};
}
module.exports={FILE,START,END,parse,serialize,validate,validTag,label,family,effective,addGroup,addTag,moveFamily,rename,tree,layout,read,save,fold};
