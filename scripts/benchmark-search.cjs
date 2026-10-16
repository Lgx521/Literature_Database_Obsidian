// Synthetic, offline search benchmark. Usage: node --expose-gc scripts/benchmark-search.cjs [scripts-directory] [baseline|cached]
const {performance}=require('node:perf_hooks'),path=require('node:path');
const root=path.resolve(process.argv[2]||__dirname),mode=process.argv[3]||'cached',E=require(path.join(root,'dashboard.js')),A=require(path.join(root,'advanced-search.js')),Fields=require(path.join(root,'custom-fields.js'));
const Session=mode==='cached'?require(path.join(root,'library-search.js'))(E,A):null;
const conditions={match:'all',conditions:[{field:'tags',op:'any',tags:['#research/rl','#research/wm']},{field:'published',op:'between',value:'2020',end:'2026.10'},{field:'tldr',op:'contains',value:'VPP2'}]};
function run(n){
 const rows=Array.from({length:n},(_,i)=>({path:'papers/'+i+'.pdf',filename:i+'.pdf',title:(i%3?'World model learning ':'Robot action framework ')+((i*3571)%n),tags:i%2?'#research/rl #research/vla':'#research/wm #research/ttt',published:i%10?`${2020+i%7}.${1+i%12}`:'待核实',tldr:'Proposes VPP2 &amp; world model learning. '.repeat(5),notes:'Personal notes<br>benchmark only. '.repeat(3),categories:[i%3?'Robotics':'ML'],status:i%2?'在读':'待读',priority:i%2?'高':'—',organizing:'待整理',customFields:{},venues:['arXiv']}));
 const fields=Fields.definitions(),fieldSearch=r=>fields.map(f=>Fields.display(f,Fields.value(r,f.id))).join(' '),session=Session&&new Session();
 const filter=o=>session?session.filter(rows,o):E.filterLibrary(rows,o),base={sort:'title',fieldSearch,fieldSearchKey:'en-default'};
 global.gc?.();const memory=process.memoryUsage().heapUsed;
 const coldStart=performance.now();filter({...base,query:'world'});const cold=performance.now()-coldStart;
 const queries=['w','wo','wor','world','world m','world mo','world mod','world model','world','vpp2','vpp2 12','vpp2'];
 function measure(advanced){const samples=[];let total=0;for(let i=0;i<48;i++){const t=performance.now();total+=filter({...base,query:queries[i%queries.length],advanced}).length;const ms=performance.now()-t;if(i>=12)samples.push(ms);}samples.sort((a,b)=>a-b);return {medianMs:+samples[Math.floor(samples.length/2)].toFixed(2),p95Ms:+samples[Math.floor(samples.length*.95)].toFixed(2),checksum:total};}
 const plain=measure(),advanced=measure(conditions);global.gc?.();const retained=(process.memoryUsage().heapUsed-memory)/1048576;
 const output={n,coldMs:+cold.toFixed(2),plain,advanced,retainedMiB:+retained.toFixed(2)};
 session?.clear();return output;
}
console.log(JSON.stringify({mode,results:[run(1000),run(10000)]},null,2));
