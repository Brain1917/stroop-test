const el = id => document.getElementById(id);
let phase, deck, cursor, rows, warmupHits, active, timer, frame, nextAction;
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
  el('feedback').textContent = '';
  updateCounts();
  screen('game');
  nextTrial();
}

function updateCounts() {
  const correct = phase === 0 ? warmupHits : rows.filter(t => t.choice === t.ink).length;
  const total = phase === 0 ? cursor : rows.length;
  el('counts').textContent = (phase === 0 ? 'Разминка' : 'За сессию') +
    ' · Верно ' + correct + ' · Ошибок ' + (total - correct);
}

function nextTrial() {
  active = null;
  frame = requestAnimationFrame(() => {
    if (document.hidden) { interrupt(); return; }
    const trial = deck[cursor];
    el('screen-game').removeAttribute('data-verdict');
    el('feedback').textContent = '';
    el('progress').textContent = (cursor + 1) + ' / ' + deck.length;
    el('stimulus').textContent = Stroop.colors[trial.word].label;
    el('stimulus').style.color = Stroop.colors[trial.ink].hex;
    active = performance.now();
  });
}

function answer(choice) {
  if (active == null || document.hidden) return;
  const rt = performance.now() - active;
  active = null;
  const trial = deck[cursor++];
  const correct = choice === trial.ink;
  el('stimulus').textContent = '';
  el('screen-game').dataset.verdict = correct ? 'correct' : 'wrong';
  el('feedback').textContent = correct ? 'Верно' : 'Ошибка · цвет букв: ' + Stroop.colors[trial.ink].label;
  if (phase === 0) {
    warmupHits += Number(correct);

  } else {
    rows.push({...trial, choice, rt});
  }
  updateCounts();
  if (cursor === deck.length && phase > 0) scoredDuration += performance.now() - blockStart;
  timer = setTimeout(() => cursor < deck.length ? nextTrial() : finishBlock(), correct ? 380 : 750);
}

function finishBlock() {
  if (phase === 0) {
    const passed = warmupHits >= 6;
    intermission('Разминка завершена', 'Верно ' + warmupHits + ' из 8. ' +
      (passed ? 'Теперь начинается зачёт. Ошибки разминки в него не входят.' :
        'Попробуй ещё раз. Для перехода нужны 6 верных ответов. Выбирай цвет букв.'),
      passed ? 'Начать первый блок' : 'Повторить разминку', () => startBlock(passed ? 1 : 0));
  } else if (phase === 1) {
    const hits = rows.filter(t => t.choice === t.ink).length;
    intermission('Первый блок завершён', 'Верно ' + hits + ' из 32. Ошибок: ' + (32 - hits) + '. Отдохни перед вторым блоком.',
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
    el('guidance').textContent = 'Положительная разница означает, что при конфликте верные ответы занимали больше времени. Сравнивай скорость вместе с точностью.';
    saveSession(s);
    screen('result');
    el('btn-again').focus();
  }
}

function interrupt() {
  if (typeof phase !== 'number') return;
  clearTimeout(timer);
  cancelAnimationFrame(frame);
  active = null;
  if (phase === 2 && cursor === deck.length) {
    finishBlock();
    return;
  }
  intermission('Сессия прервана', 'Вкладка была скрыта. Чтобы пауза не повлияла на результат, начни заново.',
    'Начать разминку', start);
}

Stroop.colors.forEach((color, index) => {
  const button = document.createElement('button');
  button.className = 'answer-swatch';
  button.type = 'button';
  button.title = color.label;
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
