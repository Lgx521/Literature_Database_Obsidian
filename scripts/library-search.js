'use strict';
// View-scoped, lazy caches over immutable snapshots; no persistent index or worker.
module.exports=(Engine,AdvancedSearch)=>class LibrarySearch {
  constructor(){this.clear();}
  clear(){this.rows=null;this.ordered=null;this.sortKey=null;this.fieldKey=null;this.conditionKey=null;this.matcher=null;this.memo=new WeakMap();this.cacheBytes=0;}
  filter(rows,options={}){
    // Snapshot replacement and localization/field edits invalidate every derived value.
    const fieldKey=options.fieldSearchKey??options.fieldSearch;
    if(rows!==this.rows||fieldKey!==this.fieldKey){this.clear();this.rows=rows;this.fieldKey=fieldKey;}
    return Engine.filterLibrary(rows,{...options,search:this});
  }
  cached(row,key,create){
    let entry=this.memo.get(row);if(entry&&Object.hasOwn(entry,key))return entry[key];
    const value=create(),items=typeof value==='string'?[value]:value instanceof Set?[...value]:Array.isArray(value)?value:[];
    const size=64+items.reduce((n,v)=>n+(typeof v==='string'?v.length*2+16:16),0);
    // Bound retained text, especially arbitrary-length Notes. Oversized values remain
    // fully searchable but are not cached; this never truncates a search document.
    if(this.cacheBytes+size<=8*1024*1024){if(!entry){entry=Object.create(null);this.memo.set(row,entry);}entry[key]=value;this.cacheBytes+=size;}
    return value;
  }
  text(row,fieldSearch){return this.cached(row,'query',()=>Engine.librarySearchText(row,fieldSearch));}
  tags(row){return this.cached(row,'basicTags',()=>new Set(row.tags.toLocaleLowerCase().split(/\s+/)));}
  predicate(state){
    const key=JSON.stringify(state||null);
    if(key!==this.conditionKey){
      this.conditionKey=key;
      const matches=new WeakMap(),predicate=AdvancedSearch.compile(state,Engine.decodeText,(row,field)=>this.cached(row,field,()=>AdvancedSearch.fieldValue(row,field,Engine.decodeText)));
      // Typing into the plain search does not change advanced conditions. Retain only
      // the current plan's booleans, not a history of result lists or previous queries.
      this.matcher=row=>{let value=matches.get(row);if(value===undefined){value=predicate(row);matches.set(row,value);}return value;};
    }
    return this.matcher;
  }
  sorted(rows,options){
    const key=JSON.stringify([options.sort,options.descending,options.statusOrder,options.priorityOrder]);
    if(!this.ordered||key!==this.sortKey){this.ordered=Engine.sortLibrary(rows.slice(),options);this.sortKey=key;}
    return this.ordered;
  }
};
