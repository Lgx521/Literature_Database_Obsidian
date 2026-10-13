const assert = require('node:assert/strict');
const E = require('./dashboard.js');
// Fixtures stay independent of the user's changing statuses and collection size.
const header = '| ' + E.HEADERS.join(' | ') + ' |\n| ' + E.HEADERS.map(()=> '---').join(' | ') + ' |';
const fixtureRows = ['| [Test One.pdf](papers/Test%20One.pdf) | 2026 | #research/vla | One | 未标记 | — |', '| [Test Two.pdf](papers/Test%20Two.pdf) | 2025 | #research/rl | Two | 未标记 | — |'];
const library = ['Robotics Policies', 'Agentic/RSI', 'ML', '3DV', 'Generative'].map((c,i)=>'## '+c+'\n\n'+header+'\n'+(i===0?fixtureRows.join('\n'):'')).join('\n\n')+'\n<!-- library:end -->';
const review = '## VENUE 2026\n\n| '+E.TRACKING_HEADERS.join(' | ')+' |\n| '+E.TRACKING_HEADERS.map(()=> '---').join(' | ')+' |\n\n<!-- tracking:end -->';
const submit = review;
const initial = {rows:E.parseLibrary(library)};
assert.equal(initial.rows.length, 2);
assert(initial.rows.every(r => r.status === '未标记'));
// Publication dates are strings: October must not collapse to January.
for (const date of ['1998', '2026', '2026.1', '2026.5', '2026.10', '2026.12', '待核实']) {
  const parsed = E.parseLibrary(library.replace('| 2026 |', `| ${date} |`));
  assert.equal(parsed[0].published, date);
}
for (const date of ['2026.0', '2026.13', '2026.05', '2026.5.1', '2026-05', '26.5', '']) {
  assert.throws(()=>E.parseLibrary(library.replace('| 2026 |', `| ${date} |`)), /发表时间/);
}
const modified = library.replace('| 未标记 | — |', '| 在读 | 高 |');
assert.equal(E.parseLibrary(modified).find(r=>r.path==='papers/Test One.pdf').status,'在读');
// Obsidian table formatting pads cells; empty categories and CRLF must also work.
assert.deepEqual(E.parseLibrary(library.replaceAll(' | ', '   |   ').replaceAll('\n', '\r\n')), initial.rows);
assert.throws(()=>E.parseLibrary(library.replace('## Generative', '## ML')));
assert.equal(E.getCategories(library.replace('## Generative', '## Custom')).at(-1), 'Custom');
assert.throws(()=>E.parseLibrary(library.replace('<!-- library:end -->','')));
assert.throws(()=>E.parseLibrary(library.replace('| 未标记 | — |','| 读了一点 | — |')));
assert.throws(()=>E.parseLibrary(library.replace('papers/Test%20Two.pdf','papers/Test%20One.pdf')));
assert.throws(()=>E.parseLibrary(library.replace('| 未标记 | — |','| 未标记 | — | surplus |')));
const tracking = review.replace('<!-- tracking:end -->', '| Test paper | 待审 | 2026-11-01 23:59 -12:00 | Read | — |\n\n<!-- tracking:end -->').replace('\n\n| Test paper', '\n| Test paper');
assert.equal(E.parseTracker(tracking,'审稿')[0].filename,'Test paper');
assert.equal(E.deadline('2026-11-01 23:59 -12:00'), Date.parse('2026-11-02T11:59:00Z'));
assert.throws(()=>E.deadline('2026-11-01'));
assert.equal(E.parseTracker(tracking.replace('| 待审 |','| 已完成 |'),'审稿')[0].status,'已完成');
console.log('PASS: canonical parsing, month/year strings, reading statuses, padded tables, CRLF, malformed-source refusal, tracker deadlines and completed tasks.');
