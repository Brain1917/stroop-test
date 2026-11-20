const Stroop = (() => {
  const colors = [
    { label: 'красный', hex: '#c3323c' }, { label: 'синий', hex: '#2467bf' },
    { label: 'зелёный', hex: '#138143' }, { label: 'жёлтый', hex: '#bc9400' }
  ];
  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
  function practice() {
    return shuffle(colors.flatMap((_, ink) => [
      {word: ink, ink}, {word: (ink + 1) % colors.length, ink}
    ]));
  }
  function block() {
    const pairs = colors.flatMap((_, ink) => colors.map((_, word) => ({word, ink})));
    return shuffle([...pairs, ...pairs]);
  }
  function mean(rows) {
    return rows.length ? rows.reduce((sum, row) => sum + row.rt, 0) / rows.length : null;
  }
  function summarize(rows, duration) {
    const correct = rows.filter(t => t.ink === t.choice);
    const match = correct.filter(t => t.word === t.ink);
    const conflict = correct.filter(t => t.word !== t.ink);
    const a = mean(match), b = mean(conflict);
    return {
      timestamp: new Date().toISOString(), duration_sec: duration,
      total_trials: rows.length, correct: correct.length, incorrect: rows.length - correct.length,
      accuracy_pct: 100 * correct.length / rows.length,
      avg_rt_ms: mean(correct), avg_rt_congruent_ms: a, avg_rt_incongruent_ms: b,
      interference_ms: a === null || b === null ? null : b - a,
      conflictCorrect: conflict.length, conflictTotal: rows.filter(t => t.word !== t.ink).length
    };
  }
  return {colors, block, practice, summarize};
})();
if (typeof module !== 'undefined') module.exports = Stroop;
