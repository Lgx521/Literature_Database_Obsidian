'use strict';
module.exports=function(Engine,TagTree,Organization){
 function plan(library,catalog,node,name){
  const rows=Engine.parseLibrary(library),model=TagTree.effective(catalog===null?null:TagTree.parse(catalog),rows),change=TagTree.rename(model,node,name);
  const lookup=new Map(Object.entries(change.mapping).map(([a,b])=>[TagTree.fold(a),b]));
  let output=library;const affected=[];
  for(const row of rows){
   const tags=String(row.tags||'').split(/\s+/).filter(Boolean),next=tags.map(t=>lookup.get(TagTree.fold(t))||t);
   if(next.join(' ')===tags.join(' '))continue;
   const provenance=Organization.parse(row.provenance),renamed={};
   for(let i=0;i<tags.length;i++){
    const old=tags[i],tag=next[i],entry=provenance.tags[old];
    // Unknown or stale provenance must remain unknown after renaming.
    if(entry&&Organization.source(row,old,true).kind!=='unknown')renamed[tag]={...entry,hash:Organization.hash(tag)};
   }
   provenance.tags=renamed;
   output=Engine.updateLibraryEntry(output,row,{tags:next.join(' '),provenance});affected.push(row.path);
  }
  return {...change,affected,before:{'library.md':library,'tags.md':catalog},after:{'library.md':output,'tags.md':TagTree.serialize(change.model,catalog)}};
 }
 function removePlan(library,catalog,node){
  const rows=Engine.parseLibrary(library),model=TagTree.effective(catalog===null?null:TagTree.parse(catalog),rows),change=TagTree.remove(model,node),removed=new Set(change.removed.map(TagTree.fold));
  let output=library;const affected=[];
  for(const row of rows){const tags=String(row.tags||'').split(/\s+/).filter(Boolean),next=tags.filter(t=>!removed.has(TagTree.fold(t)));if(tags.length===next.length)continue;const provenance=Organization.parse(row.provenance);for(const key of Object.keys(provenance.tags))if(removed.has(TagTree.fold(key)))delete provenance.tags[key];output=Engine.updateLibraryEntry(output,row,{tags:next.join(' '),provenance});affected.push(row.path);}
  return {...change,affected,before:{'library.md':library,'tags.md':catalog},after:{'library.md':output,'tags.md':TagTree.serialize(change.model,catalog)}};
 }
 return {plan,removePlan};
};
