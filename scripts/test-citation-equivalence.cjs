'use strict';
const assert=require('node:assert/strict'),fixtures=require('./fixtures/citation-4.8.5.json'),C=require('./vendor/citation-engine.cjs'),T=require('./title-export');
for(const fixture of fixtures)for(const [format,expected]of Object.entries(fixture.formats)){
 assert.deepEqual(C.exportRows(fixture.rows,format,'References'),expected,fixture.name+' '+format+' must match released 4.8.5 byte-for-byte');
 if(format==='titles')assert.deepEqual(T.exportTitles(fixture.rows,C.parseEntry),expected);
}
console.log('PASS: title/BibTeX/APA/IEEE text, HTML, ordering and missing/collision reports match released 4.8.5 fixtures.');
