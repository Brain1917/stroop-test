const el = id => document.getElementById(id);
let phase, deck, cursor, rows, warmupHits, active, nextAction;
let scoredDuration, blockStart;

function screen(name) {
  for (const s of ['start','game','break','result']) {
    el('screen-' + s).classList.toggle('hidden', s !== name);
  }
  document.body.classList.toggle('playing', name === 'game');
}

function intermission(title, text, label, action) {
  phase = 'break';
  nextAction = action;
  el('break-title').textContent = title;
  el('break-text').textContent = text;
  el('continue').textContent = label;
  screen('break');
  el('continue').focus();
}

function start() {
  rows = [];
  scoredDuration = 0;
  startBlock(0);
}

function startBlock(n) {
  phase = n;
  cursor = 0;
  warmupHits = 0;
  deck = n ? Stroop.block() : Stroop.practice();
  blockStart = performance.now();
  el('phase').textContent = n ? 'Блок ' + n + ' из 2' : 'Разминка';
  el('screen-game').removeAttribute('data-verdict');
  updateCounts();
  screen('game');
  nextTrial();
}

function updateCounts() {
  const correct = phase === 0 ? warmupHits : rows.filter(t => t.choice === t.ink).length;
  const total = phase === 0 ? cursor : rows.length;
  el('counts').textContent = 'Верно ' + correct + ' · Ошибок ' + (total - correct);
}

function nextTrial() {
  if (document.hidden) { interrupt(); return; }
  const trial = deck[cursor];
  el('progress').textContent = (cursor + 1) + ' / ' + deck.length;
  el('stimulus').textContent = Stroop.colors[trial.word].label;
  el('stimulus').style.color = Stroop.colors[trial.ink].hex;
  active = performance.now();
}

function answer(choice) {
  if (active == null || document.hidden) return;
  const rt = performance.now() - active;
  active = null;
  const trial = deck[cursor++];
  const correct = choice === trial.ink;
  el('screen-game').dataset.verdict = correct ? 'correct' : 'wrong';
  if (phase === 0) {
    warmupHits += Number(correct);

  } else {
    rows.push({...trial, choice, rt});
  }
  updateCounts();
  if (cursor === deck.length && phase > 0) scoredDuration += performance.now() - blockStart;
  if (cursor < deck.length) nextTrial();
  else finishBlock();
}

function finishBlock() {
  if (phase === 0) {
    const passed = warmupHits >= 6;
    intermission('Разминка завершена', 'Верно ' + warmupHits + ' из 8. ' +
      (passed ? 'Дальше ответы идут в зачёт.' :
        'Для перехода нужны 6 верных ответов.'),
      passed ? 'Начать первый блок' : 'Повторить разминку', () => startBlock(passed ? 1 : 0));
  } else if (phase === 1) {
    const hits = rows.filter(t => t.choice === t.ink).length;
    intermission('Первый блок завершён', 'Верно ' + hits + ' из 32. Ошибок ' + (32 - hits) + '.',
      'Начать второй блок', () => startBlock(2));
  } else {
    phase = 'result';
    const s = Stroop.summarize(rows, scoredDuration / 1000);
    const ms = n => n === null ? 'Нет верных ответов' : Math.round(n) + ' мс';
    const dif = s.interference_ms === null ? 'Недостаточно данных' : ms(s.interference_ms);
    const display = [
      ['Точность', s.correct + ' из 64 (' + s.accuracy_pct.toFixed(0) + '%)'],
      ['Ошибки', s.incorrect],
      ['Слово совпало с цветом', (s.correct - s.conflictCorrect) + '/16 · ' + ms(s.avg_rt_congruent_ms)],
      ['Слово отличалось от цвета', s.conflictCorrect + '/48 · ' + ms(s.avg_rt_incongruent_ms)],
      ['Разница времени', dif]
    ];
    el('result-stats').replaceChildren();
    for (const [label,value] of display) {
      for (const [tag,content] of [['dt',label],['dd',value]]) {
        const node = document.createElement(tag);
        node.textContent = content;
        el('result-stats').append(node);
      }
    }
    el('guidance').textContent = 'Плюс означает, что при несовпадении цвета и слова ты отвечал медленнее.';
    saveSession(s);
    screen('result');
    el('btn-again').focus();
  }
}

function interrupt() {
  if (typeof phase !== 'number') return;
  active = null;
  intermission('Сессия прервана', 'Вкладка была скрыта. Эта попытка не сохранена.',
    'Начать разминку', start);
}

Stroop.colors.forEach((color, index) => {
  const button = document.createElement('button');
  button.className = 'answer-swatch';
  button.type = 'button';
  button.setAttribute('aria-label', color.label + ', клавиша ' + (index + 1));
  button.style.backgroundColor = color.hex;
  const key = document.createElement('span');
  key.textContent = index + 1;
  button.append(key);
  button.onclick = () => answer(index);
  el('answers').append(button);
});
document.addEventListener('keydown', e => {
  if (typeof phase !== 'number' || e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
  if (/^[1-4]$/.test(e.key)) {
    e.preventDefault();
    answer(Number(e.key) - 1);
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) interrupt(); });
el('continue').onclick = () => { if (phase === 'break') nextAction(); };
el('btn-start').onclick = start;
el('btn-again').onclick = start;
