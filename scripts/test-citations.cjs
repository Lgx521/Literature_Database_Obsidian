const assert=require('node:assert/strict'),C=require('./vendor/citation-engine.cjs'),E=require('./dashboard.js');
global.fetch=()=>{throw new Error('Network forbidden');};
const bib='@article{smith2024, title={Learning with {Robots}}, author={Smith, Alice and Doe, Bob}, year={2024}, journal={Example Journal}, volume={12}, number={3}, pages={10--20}, doi={10.1234/example}}';
const row={path:'papers/A.pdf',filename:'A.pdf',bibtex:bib};
assert.equal(C.parseEntry(bib).key,'smith2024');assert.deepEqual(C.parseEntry(bib).issues,[]);
const apa=C.exportRows([row],'apa'),ieee=C.exportRows([row],'ieee'),raw=C.exportRows([row],'bibtex');
assert.equal(apa.text,'Smith, A., & Doe, B. (2024). Learning with Robots. Example Journal, 12(3), 10–20. https://doi.org/10.1234/example\n');
assert.match(apa.html,/<i>Example Journal<\/i>/);assert.match(ieee.text,/^\[1\] A\. Smith and B\. Doe/);assert.match(ieee.text,/vol\. 12, no\. 3, pp\. 10–20/);assert.equal(raw.content,bib+'\n');
const second={path:'papers/B.pdf',filename:'B.pdf',bibtex:'@inproceedings{adams2025,title={Another Paper},author={Adams, Clara},year={2025},booktitle={Example Conference},pages={1--5}}'};
assert(C.exportRows([row,second],'apa').text.startsWith('Adams, C.'));assert(C.exportRows([row,second],'ieee').text.startsWith('[1] A. Smith'));
const missing={path:'papers/2601.12345.pdf',filename:'2601.12345.pdf',venues:['Fictional Venue'],published:'2026.1'},broken={path:'papers/X.pdf',filename:'X.pdf',bibtex:'@article{x,title={Title only}}'};
const partial=C.exportRows([row,missing,broken],'bibtex');assert.equal(partial.ready,1);assert.equal(partial.missing.length,2);assert(!partial.text.includes('Fictional Venue'));assert(!partial.text.includes('@article{x'));
assert.equal(C.exportRows([missing],'apa').text,'');assert.equal(C.exportRows([missing],'titles').text,'');assert.equal(C.exportRows([missing],'titles').missing.length,1);
assert.equal(C.exportRows([{...missing,title:'Actual Research Title'},row,row],'titles').content,'Actual Research Title\nLearning with Robots\n');
assert.equal(C.exportRows([{...missing,title:'file.pdf'}],'titles').ready,0);
const collision=C.exportRows([row,{...row,path:'papers/Other.pdf'}],'bibtex');assert.equal(collision.ready,0);assert.equal(collision.missing.length,2);
assert.equal(C.exportRows([row,row],'ieee').ready,1);
assert.throws(()=>C.parseEntry(bib+'\n'+second.bibtex),/一个 BibTeX/);assert.throws(()=>C.parseEntry('https://doi.org/10.1234/example'),/BibTeX/);
assert(!C.safeHtml('<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a>').includes('<script>'));
assert(!C.safeHtml('<span style="bad" onclick="bad">hi</span>').includes('onclick'));
// Exact BibTeX roundtrip: no generated author/DOI/keys, no date or venue fallback.
let source='## 文献\n| '+E.CITATION_HEADERS.join(' | ')+' |\n| '+E.CITATION_HEADERS.map(()=> '---').join(' | ')+' |\n| [A.pdf](papers/A.pdf) | 2026.1 | #research/rl | Summary | 待读 | — | User | User Venue |  |  |\n<!-- library:end -->';
const previous=E.parseLibrary(source)[0];source=E.updateLibraryEntry(source,previous,{bibtex:bib+'\n% | & [ ] < >',citationSource:'User supplied'});
const saved=E.parseLibrary(source)[0];assert.equal(saved.bibtex,bib+'\n% | & [ ] < >');assert.deepEqual(saved.cells.slice(0,8),previous.cells.slice(0,8));
const restored=E.restoreRecord(E.removeRecord(source,'library',saved),'library',saved);assert.equal(E.parseLibrary(restored)[0].bibtex,saved.bibtex);
console.log('PASS: APA 7 and IEEE fixtures, style ordering and numbering, exact BibTeX roundtrip, missing-field/collision reports, real titles without filename fallback, HTML sanitization, no network or inferred citation data.');

// Title columns survive upgrades, edits, trash restoration and CRLF.
const before=E.parseLibrary(source)[0];source=E.updateLibraryEntry(source,before,{title:'Real Title | & [notes]'});
const withTitle=E.parseLibrary(source)[0];assert.equal(withTitle.title,'Real Title | & [notes]');assert.deepEqual(withTitle.cells.slice(0,10),before.cells);
const titleRestored=E.restoreRecord(E.removeRecord(source,'library',withTitle),'library',withTitle);assert.equal(E.parseLibrary(titleRestored)[0].title,withTitle.title);
assert.equal(E.parseLibrary(source.replace(/\n/g,'\r\n'))[0].title,withTitle.title);
const generated=C.fromCsl({type:'document',title:'Exact Source Title',author:[{family:'Lovelace',given:'Ada'}],issued:{'date-parts':[[1843,9]]}},'ref_stable');
assert.equal(C.parseEntry(generated.bibtex).key,'ref_stable');assert.equal(generated.title,'Exact Source Title');
assert.throws(()=>C.fromCsl({title:'Title'},'ref_empty'),/缺少/);
