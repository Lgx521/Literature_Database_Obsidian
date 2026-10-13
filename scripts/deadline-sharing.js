'use strict';
// Explicit DDL sharing only. Each side retains its own records, name and local date.
module.exports=function(Engine,Collections){
  const paths={projects:'集合.md',submissions:'投稿.md'},prefix='共享 DDL：';
  function layout(text,scope){
    if(scope==='projects')return Collections.parse(text).groups.filter(g=>g.scope===scope).map(g=>({...g,heading:g.start,table:g.table}));
    if(scope==='submissions')return Engine.trackerLayout(text).tables.map(g=>({...g,table:g.start}));
    throw new Error('此类型不支持共享 DDL');
  }
  function entries(texts){
    const result=[];
    for(const scope of Object.keys(paths)){
      const text=texts[paths[scope]],lines=text.split('\n');
      for(const g of layout(text,scope)){
        const indexes=[];for(let i=g.heading+1;i<g.table;i++)if(lines[i].startsWith(prefix))indexes.push(i);
        if(indexes.length>1)throw new Error(g.name+'：重复的共享 DDL 标记');
        const key=indexes.length?lines[indexes[0]].slice(prefix.length).trim():'';
        if(key&&!/^[a-zA-Z0-9-]{8,80}$/.test(key))throw new Error(g.name+'：共享 DDL 标记无效');
        if(scope==='submissions'&&Engine.isStagingGroup(g.name)){if(key)throw new Error('暂存区不能共享 DDL');continue;}
        const deadline=scope==='projects'?g.deadline:Engine.trackerDeadline(text,g.name);Engine.deadline(deadline);
        result.push({scope,name:g.name,key,deadline});
      }
    }
    const dates=new Map();for(const item of result)if(item.key){
      if(dates.has(item.key)&&dates.get(item.key)!==item.deadline)throw new Error('共享 DDL 尚未同步一致，请等待同步或核对源表');
      dates.set(item.key,item.deadline);
    }
    return result;
  }
  function keyText(text,scope,name,key){
    if(!/^[a-zA-Z0-9-]{8,80}$/.test(key))throw new Error('共享 DDL 标记无效');
    const g=layout(text,scope).find(g=>g.name===name);if(!g)throw new Error('所选项目或 Venue 已不存在');
    const lines=text.split('\n'),indexes=[];
    for(let i=g.heading+1;i<g.table;i++)if(lines[i].startsWith(prefix))indexes.push(i);
    if(indexes.length>1)throw new Error('重复的共享 DDL 标记');
    const line=prefix+key+(text.includes('\r\n')?'\r':'');
    if(indexes.length)lines[indexes[0]]=line;else lines.splice(g.heading+1,0,line);
    return lines.join('\n');
  }
  function setLocal(texts,item,value){
    const path=paths[item.scope];texts[path]=item.scope==='projects'?Collections.setDeadline(texts[path],item.name,value,item.deadline):Engine.setTrackerDeadline(texts[path],path,item.name,value,item.deadline);
  }
  function create(texts,scope,name,selection,key){
    const all=entries(texts),output={...texts};
    output[paths[scope]]=scope==='projects'?Collections.add(output[paths[scope]],scope,name):Engine.addTrackerGroup(output[paths[scope]],paths[scope],name);
    if(selection){
      if(selection.scope===scope||!paths[selection.scope])throw new Error('请选择另一侧的已有项目或 Venue');
      const source=all.find(g=>g.scope===selection.scope&&g.name===selection.name);
      if(!source||source.key!==selection.key||source.deadline!==selection.deadline)throw new Error('所选 DDL 已被修改，请重新选择');
      key=source.key||key;
      output[paths[source.scope]]=keyText(output[paths[source.scope]],source.scope,source.name,key);
      output[paths[scope]]=keyText(output[paths[scope]],scope,name,key);
      setLocal(output,{scope,name,deadline:'—'},source.deadline);
    }
    entries(output);return output;
  }
  function update(texts,scope,name,value,expected,expectedKey){
    value=value||'—';Engine.deadline(value);
    const all=entries(texts),source=all.find(g=>g.scope===scope&&g.name===name);
    if(!source)throw new Error('项目或 Venue 已被修改，请刷新');
    if(source.deadline!==expected||(expectedKey!==undefined&&source.key!==expectedKey))throw new Error('截止时间或共享设置已被修改，请重新打开设置');
    const output={...texts};
    for(const item of all)if(item===source||(source.key&&item.key===source.key))setLocal(output,item,value);
    entries(output);return output;
  }
  // Remove the former project→submission association, preserving a project's own date.
  // If only the linked Venue had a date, retain that displayed date once, independently.
  function detachLegacy(text,submissionText){
    for(const old of Collections.parse(text).groups.filter(g=>g.scope==='projects'&&g.venueIndex>=0)){
      let value=old.deadline;
      if(value==='—'&&old.venue&&Engine.trackerGroups(submissionText).includes(old.venue))value=Engine.trackerDeadline(submissionText,old.venue);
      const info=Collections.parse(text),g=info.groups.find(g=>g.scope==='projects'&&g.name===old.name);
      info.lines.splice(g.venueIndex,1);text=info.lines.join('\n');
      if(value!==old.deadline)text=Collections.setDeadline(text,old.name,value,old.deadline);
    }
    return text;
  }
  return {paths,entries,create,update,detachLegacy};
};
