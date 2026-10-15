'use strict';
// Cache only the four canonical sources. Publish a new cache/snapshot together,
// after every source has validated, so partial sync never poisons the last good view.
class SnapshotCache {
  constructor(Engine,Collections,Deadlines,TFile,translate=text=>text){Object.assign(this,{Engine,Collections,Deadlines,TFile,translate});this.sources=new Map();}
  async read(vault,dirty=new Set(['*'])){
    try{const snapshot=await this.load(vault,this.retryAll?new Set(['*']):dirty);this.retryAll=false;return snapshot;}catch(error){this.retryAll=true;throw error;}
  }
  async load(vault,dirty){
    const {Engine:E,Collections:C,Deadlines:D,TFile}=this,next=new Map(this.sources),all=dirty.has('*');
    const read=async(name,parse)=>{
      const file=vault.getAbstractFileByPath(name);if(!(file instanceof TFile))throw Error(this.translate(name==='collections.md'?'集合尚未同步齐全':'源文件尚未同步齐全'));
      const old=this.sources.get(name);
      if(old&&!all&&!dirty.has(name))return old;
      const text=await vault.read(file);if(old?.text===text)return old;
      const value={text,data:parse(text)};next.set(name,value);return value;
    };
    const tracker=(text,kind)=>{const rows=E.parseTracker(text,kind),groups=E.trackerGroups(text);return {rows,groups,deadlines:Object.fromEntries(groups.map(g=>[g,E.trackerDeadline(text,g)]))};};
    const [publicSource,reviews,submissions]=await Promise.all([
      read('library.md',text=>E.parseLibrary(text)),read('reviews.md',text=>tracker(text,'审稿')),read('submissions.md',text=>tracker(text,'投稿'))
    ]);
    const collectionSource=publicSource.text.includes('<!-- library:collections -->')?await read('collections.md',text=>C.parse(text).groups):null;
    let inbox=this.inbox;
    if(!inbox||all||[...dirty].some(p=>p==='temp'||p.startsWith('temp/'))){
      const folder=vault.getAbstractFileByPath('temp'),files=[];
      if(folder?.children){const walk=f=>{for(const child of f.children||[])child.children?walk(child):files.push(child);};walk(folder);}
      else files.push(...vault.getFiles().filter(f=>f.path.startsWith('temp/')));
      const rows=files.filter(f=>f.extension?.toLowerCase()==='pdf').map(f=>({path:f.path,filename:f.name,category:'',published:new Date(f.stat.ctime).toLocaleDateString('sv-SE'),mtime:f.stat.ctime,fileMtime:f.stat.mtime,fileSize:f.stat.size,status:'待整理',priority:(f.stat.size/1024/1024).toFixed(1)+' MB',tags:'',notes:'',tldr:''}));
      inbox=this.inbox&&JSON.stringify(rows)===JSON.stringify(this.inbox)?this.inbox:rows;
    }
    if(this.snapshot&&publicSource===this.publicSource&&collectionSource===this.collectionSource&&reviews===this.reviews&&submissions===this.submissions&&inbox===this.inbox)return this.snapshot;
    const collections=collectionSource?.data||null;
    const library=this.snapshot&&publicSource===this.publicSource&&collectionSource===this.collectionSource?this.snapshot.library:collections?C.decorate(publicSource.data,collections):publicSource.data;
    const deadlineEntries=this.snapshot&&collectionSource===this.collectionSource&&submissions===this.submissions?this.snapshot.deadlineEntries:collections?D.entries({'collections.md':collectionSource.text,'submissions.md':submissions.text}):[];
    const snapshot={library,collections,inbox,reviews:reviews.data.rows,submissions:submissions.data.rows,deadlineEntries,
      categories:collections?[...collections.filter(g=>g.scope==='library').map(g=>g.name),...(library.some(r=>!r.categories.length)?[E.UNFILED_CATEGORY]:[])]:E.getCategories(publicSource.text),
      groups:{projects:collections?.filter(g=>g.scope==='projects').map(g=>g.name)||[],reviews:reviews.data.groups,submissions:submissions.data.groups},
      deadlines:{reviews:reviews.data.deadlines,submissions:submissions.data.deadlines,projects:Object.fromEntries(deadlineEntries.filter(g=>g.scope==='projects').map(g=>[g.name,g.deadline]))}};
    Object.assign(this,{sources:next,publicSource,collectionSource,reviews,submissions,inbox,snapshot});return snapshot;
  }
  clear(){this.retryAll=false;this.sources.clear();this.publicSource=this.collectionSource=this.reviews=this.submissions=this.inbox=this.snapshot=null;}
}
module.exports=SnapshotCache;
