'use strict';
// Short, guarded transactions over canonical Markdown. No persistent second database.
async function write(vault,before,after,label='agent'){
 const names=Object.keys(before),changed=names.filter(n=>before[n]!==after[n]);
 if(!changed.length)return;
 const read=async n=>{const f=vault.getAbstractFileByPath(n);if(f)return vault.read(f);if(await vault.adapter.exists(n))throw Error('Source is not indexed: '+n);return null;};
 const guard=async values=>{for(const n of names)if(await read(n)!==values[n])throw Error('Source changed; reload and retry: '+n);};
 await guard(before);
 const root='.maintenance-backups';if(!await vault.adapter.exists(root))await vault.adapter.mkdir(root);
 const stamp=new Date().toISOString().replace(/[:.]/g,'-')+'-'+Math.random().toString(36).slice(2);
 for(const n of changed)if(before[n]!==null)await vault.adapter.write(root+'/'+label+'-'+stamp+'-'+n.replaceAll('/','_'),before[n]);
 await guard(before);const written=[];
 try{
  for(const n of changed){if(before[n]===null)await vault.create(n,after[n]);else await vault.process(vault.getAbstractFileByPath(n),current=>{if(current!==before[n])throw Error('Source changed: '+n);return after[n];});written.push(n);}
  await guard(after);
 }catch(error){
  const failed=[];for(const n of written.reverse())try{
   if(before[n]===null){if(await read(n)!==after[n])throw Error('External edit');await vault.delete(vault.getAbstractFileByPath(n));}
   else await vault.process(vault.getAbstractFileByPath(n),current=>{if(current!==after[n])throw Error('External edit');return before[n];});
  }catch(_){failed.push(n);}
  if(failed.length)error.message+='; external edits retained, inspect backups: '+failed.join(', ');
  throw error;
 }
}
module.exports={write};
