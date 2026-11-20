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

test('two open tabs keep both new sessions alongside the previous format', () => {
  const vm = require('node:vm');
  const source = require('node:fs').readFileSync(require.resolve('./history.js'), 'utf8');
  const row = summarize([{word: 0, ink: 0, choice: 1, rt: 300}], 1);
  const storage = {'stroop-test.history.v2': JSON.stringify([row])};
  Object.defineProperties(storage, {
    getItem: {value(k) {return this[k] ?? null;}},
    setItem: {value(k, v) {this[k] = v;}}
  });
  function openTab() {
    const tab = vm.createContext({localStorage: storage, crypto: require('node:crypto'),
      window: {addEventListener() {}}, document: {}});
    vm.runInContext(source.replace(/loadHistory\(\);\s*loadArchive\(\);\s*$/, ''), tab);
    vm.runInContext('renderHistory = rows => globalThis.visible = rows; showStorageMessage = () => {}; loadHistory()', tab);
    return tab;
  }
  const first = openTab(), second = openTab();
  for (const tab of [first, second]) {
    tab.row = {...row};
    vm.runInContext('saveSession(row)', tab);
  }
  const reloaded = openTab();
  assert.equal(reloaded.visible.length, 3);
  assert.equal(reloaded.visible.filter(s => s.feedback).length, 2);
  assert.ok(reloaded.visible.every(s => s.incorrect === 1));
});
