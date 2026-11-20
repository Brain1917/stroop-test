const test = require('node:test');
const assert = require('node:assert/strict');
const { block, practice, summarize } = require('./protocol.js');

test('each of the 16 word and ink pairs appears twice per scored block', () => {
  for (let run = 0; run < 50; run++) {
    const counts = new Map();
    for (const t of block()) {
      const key = [t.word, t.ink].join('/');
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    assert.equal(counts.size, 16);
    assert.deepEqual([...new Set(counts.values())], [2]);
  }
});
test('practice shows each ink both with and without conflict', () => {
  assert.equal(new Set(practice().map(t => t.ink + '/' + (t.word === t.ink))).size, 8);
});
test('errors count toward accuracy and never toward reaction times', () => {
  const rows = [[0,0,0,400],[0,1,1,600],[1,0,0,800],[1,0,1,10]].map(
    ([word,ink,choice,rt]) => ({word,ink,choice,rt}));
  const s = summarize(rows, 4);
  assert.equal(s.accuracy_pct, 75);
  assert.equal(s.avg_rt_ms, 600);
  assert.equal(s.interference_ms, 300);
  assert.equal(s.conflictCorrect, 2);
  assert.equal(s.conflictTotal, 3);
  assert.equal(summarize(rows.slice(-1), 1).interference_ms, null);
});
