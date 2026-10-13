const assert = require('node:assert/strict');
const E = require('./dashboard.js');
const table = '| ' + E.HEADERS.join(' | ') + ' |\n| ' + E.HEADERS.map(() => '---').join(' | ') + ' |';
const records = [
  '| [Alpha.pdf](papers/Alpha.pdf) | 2026.5 | #research/rl #精读 | 第一篇 | 在读 | 高 |',
  '| [Beta.pdf](papers/Beta.pdf) | 2026.10 | #research/vla | 第二篇 | 待读 | — |',
  '| [Gamma.pdf](papers/Gamma.pdf) | 待核实 | #research/rl | 第三篇 | 未标记 | 中 |'
];
const source = '手写开头\n' + ['Robotics Policies', 'Agentic/RSI', 'ML', '3DV', 'Generative'].map((c,i) => '## ' + c + '\n\n' + table + '\n' + (i === 0 ? records.join('\n') : '')).join('\n\n') + '\n<!-- library:end -->\n手写结尾\n';
const rows = E.parseLibrary(source);
assert.deepEqual(E.filterLibrary(rows, { sort: 'published', descending: true }).map(r => r.filename), ['Beta.pdf','Alpha.pdf','Gamma.pdf']);
assert.deepEqual(E.filterLibrary(rows, { sort: 'published' }).map(r => r.filename), ['Alpha.pdf','Beta.pdf','Gamma.pdf']);
assert.equal(E.filterLibrary(rows, { query: 'ALPHA 精读' }).length, 1);
assert.equal(E.filterLibrary(rows, { tag: '#research/rl', status: '在读' }).length, 1);
assert.equal(E.filterLibrary(rows, { tag: '#research/r' }).length, 0);
assert.equal(E.filterLibrary(rows, { category: 'ML' }).length, 0);
const updated = E.updateLibraryEntry(source, rows[0], { tldr: 'a | b\n下一句', published: '2026.10', status: '已读' });
assert.equal(E.parseLibrary(updated)[0].tldr, 'a &#124; b 下一句');
assert.equal(E.parseLibrary(updated)[0].published, '2026.10');
assert.equal(E.parseLibrary(updated)[0].status, '已读');
const changedLines = source.split('\n').filter((line,i) => line !== updated.split('\n')[i]);
assert.deepEqual(changedLines, [records[0]]);
assert.equal(E.updateLibraryEntry(source, rows[0], {}), source);
assert.throws(() => E.updateLibraryEntry(updated, rows[0], { status: '待读' }), /其他窗口或设备/);
// An unrelated paper's concurrent change is retained.
const unrelated = E.updateLibraryEntry(source, rows[1], { tldr: '另一窗口的笔记' });
const merged = E.updateLibraryEntry(unrelated, rows[0], { priority: '低' });
assert.equal(E.parseLibrary(merged)[1].tldr, '另一窗口的笔记');
for (const changes of [{ published:'2026.05' }, { status:'Done' }, { priority:'最高' }, { path:'papers/Oops.pdf' }]) assert.throws(() => E.updateLibraryEntry(source, rows[0], changes));
const crlf = source.replaceAll('\n', '\r\n');
const crlfAfter = E.updateLibraryEntry(crlf, E.parseLibrary(crlf)[0], { status: '已读' });
assert.equal(crlfAfter.split('\r\n').length, crlf.split('\r\n').length);
assert(!crlfAfter.replaceAll('\r\n','').includes('\n'));
assert.throws(() => E.updateLibraryEntry(source.replace(records[0],''), rows[0], { status: '已读' }));
console.log('PASS: compact view filtering, exact tags, month sorting, single-row writes, conflict detection, unrelated edits, invalid input refusal, CRLF preservation.');
