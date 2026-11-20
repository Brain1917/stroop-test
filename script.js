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
  screen('game');
  nextTrial();
}

function nextTrial() {
  active = null;
  el('feedback').textContent = '';
  el('stimulus').textContent = '+';
  el('stimulus').style.color = '#767676';
  el('progress').textContent = (cursor + 1) + ' / ' + deck.length;
  timer = setTimeout(() => {
    frame = requestAnimationFrame(() => {
      if (document.hidden) { interrupt(); return; }
      const trial = deck[cursor];
      el('stimulus').textContent = Stroop.colors[trial.word].label;
      el('stimulus').style.color = Stroop.colors[trial.ink].hex;
      active = performance.now();
    });
  }, 250);
}

function answer(choice) {
  if (active == null || document.hidden) return;
  const rt = performance.now() - active;
  active = null;
  const trial = deck[cursor++];
  const correct = choice === trial.ink;
  el('stimulus').textContent = '·';
  if (phase === 0) {
    warmupHits += Number(correct);
    el('feedback').textContent = correct ? 'Верно' : 'Цвет букв — ' + Stroop.colors[trial.ink].label;
  } else {
    rows.push({...trial, choice, rt});
  }
  if (cursor === deck.length && phase > 0) scoredDuration += performance.now() - blockStart;
  timer = setTimeout(() => cursor < deck.length ? nextTrial() : finishBlock(), phase === 0 ? 850 : 0);
}

function finishBlock() {
  if (phase === 0) {
    const passed = warmupHits >= 6;
    intermission('Разминка завершена', 'Верно ' + warmupHits + ' из 8. ' +
      (passed ? 'Дальше отвечай точно и быстро. Результат появится в конце.' :
        'Попробуй ещё раз. Для перехода нужны 6 верных ответов. Выбирай цвет букв.'),
      passed ? 'Начать первый блок' : 'Повторить разминку', () => startBlock(passed ? 1 : 0));
  } else if (phase === 1) {
    intermission('Первый блок завершён', 'Отдохни и продолжай, когда будешь готов.',
      'Начать второй блок', () => startBlock(2));
  } else {
    phase = 'result';
    const s = Stroop.summarize(rows, scoredDuration / 1000);
    const ms = n => n === null ? 'Нет верных ответов' : Math.round(n) + ' мс';
    const dif = s.interference_ms === null ? 'Недостаточно данных' : ms(s.interference_ms);
    const display = [
      ['Точность', s.correct + ' из 64 (' + s.accuracy_pct.toFixed(0) + '%)'],
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
