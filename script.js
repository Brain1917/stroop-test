const SESSION_DURATION_MS = 60000;
const HISTORY_KEY = "stroop-test.history.v1";
let sessionHistory = [];
let historyReadable = true;

const COLORS = [
  { key: "red", label: "красный", hex: "#e34948" },
  { key: "blue", label: "синий", hex: "#2a78d6" },
  { key: "green", label: "зелёный", hex: "#008300" },
  { key: "yellow", label: "жёлтый", hex: "#eda100" },
];

let sessionRunning = false;
let currentTrial = null;
let trials = [];
let scoreCorrect = 0;
let scoreTotal = 0;
let sessionEndAt = 0;
let timerIntervalId = null;

function showScreen(name) {
  ["start", "game", "result"].forEach((n) => {
    document.getElementById(`screen-${n}`).classList.toggle("hidden", n !== name);
  });
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function renderAnswers() {
  const container = document.getElementById("answers");
  container.innerHTML = "";
  shuffle([...COLORS]).forEach((color) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "answer-swatch";
    btn.style.background = color.hex;
    btn.setAttribute("aria-label", color.label);
    btn.addEventListener("click", () => handleAnswerClick(color.key));
    container.appendChild(btn);
  });
}

function generateTrial() {
  const wordColor = randomColor();
  const inkColor = randomColor();

  const stimulusEl = document.getElementById("stimulus");
  stimulusEl.textContent = wordColor.label;
  stimulusEl.style.color = inkColor.hex;

  renderAnswers();

  currentTrial = {
    wordKey: wordColor.key,
    inkKey: inkColor.key,
    congruent: wordColor.key === inkColor.key,
    startTime: performance.now(),
  };
}

function flashFeedback(correct) {
  const wrap = document.getElementById("stimulus-wrap");
  wrap.classList.remove("flash-correct", "flash-incorrect");
  void wrap.offsetWidth;
  wrap.classList.add(correct ? "flash-correct" : "flash-incorrect");
  setTimeout(() => {
    wrap.classList.remove("flash-correct", "flash-incorrect");
  }, 150);
}

function handleAnswerClick(chosenKey) {
  if (!sessionRunning || !currentTrial) return;
  if (performance.now() >= sessionEndAt) {
    endSession();
    return;
  }

  const rt = performance.now() - currentTrial.startTime;
  const correct = chosenKey === currentTrial.inkKey;
  trials.push({ ...currentTrial, chosenKey, correct, rt });

  scoreTotal += 1;
  if (correct) scoreCorrect += 1;
  document.getElementById("score-correct").textContent = String(scoreCorrect);
  document.getElementById("score-total").textContent = String(scoreTotal);

  flashFeedback(correct);

  if (sessionRunning) generateTrial();
}

function tickTimer() {
  const remainingMs = Math.max(0, sessionEndAt - performance.now());
  document.getElementById("timer").textContent = (remainingMs / 1000).toFixed(1);
  if (remainingMs <= 0) {
    endSession();
  }
}

function startSession() {
  trials = [];
  scoreCorrect = 0;
  scoreTotal = 0;
  document.getElementById("score-correct").textContent = "0";
  document.getElementById("score-total").textContent = "0";

  sessionRunning = true;
  sessionEndAt = performance.now() + SESSION_DURATION_MS;

  showScreen("game");
  generateTrial();

  clearInterval(timerIntervalId);
  timerIntervalId = setInterval(tickTimer, 100);
  tickTimer();
}

function average(list) {
  if (list.length === 0) return null;
  return list.reduce((sum, value) => sum + value, 0) / list.length;
}

function buildSessionSummary(finishedTrials, durationSec) {
  const total = finishedTrials.length;
  const correct = finishedTrials.filter((t) => t.correct).length;
  const incorrect = total - correct;
  const accuracyPct = total > 0 ? (correct / total) * 100 : 0;

  const congruentRts = finishedTrials.filter((t) => t.congruent).map((t) => t.rt);
  const incongruentRts = finishedTrials.filter((t) => !t.congruent).map((t) => t.rt);

  const avgRt = average(finishedTrials.map((t) => t.rt));
  const avgRtCongruent = average(congruentRts);
  const avgRtIncongruent = average(incongruentRts);
  const interference =
    avgRtCongruent != null && avgRtIncongruent != null
      ? avgRtIncongruent - avgRtCongruent
      : null;

  return {
    timestamp: new Date().toISOString(),
    duration_sec: durationSec,
    total_trials: total,
    correct,
    incorrect,
    accuracy_pct: accuracyPct,
    avg_rt_ms: avgRt,
    avg_rt_congruent_ms: avgRtCongruent,
    avg_rt_incongruent_ms: avgRtIncongruent,
    interference_ms: interference,
  };
}

function renderResult(summary) {
  const dl = document.getElementById("result-stats");
  const fmtMs = (v) => (v != null ? `${Math.round(v)} мс` : "-");
  dl.innerHTML = `
    <dt>Проб</dt><dd>${summary.total_trials}</dd>
    <dt>Верно / неверно</dt><dd>${summary.correct} / ${summary.incorrect}</dd>
    <dt>Точность</dt><dd>${summary.accuracy_pct.toFixed(0)}%</dd>
    <dt>Среднее время реакции</dt><dd>${fmtMs(summary.avg_rt_ms)}</dd>
    <dt>RT на конгруэнтных пробах</dt><dd>${fmtMs(summary.avg_rt_congruent_ms)}</dd>
    <dt>RT на неконгруэнтных пробах</dt><dd>${fmtMs(summary.avg_rt_incongruent_ms)}</dd>
    <dt>Индекс интерференции</dt><dd>${fmtMs(summary.interference_ms)}</dd>
  `;
}

function endSession() {
  if (!sessionRunning) return;
  sessionRunning = false;
  clearInterval(timerIntervalId);
  currentTrial = null;

  const summary = buildSessionSummary(trials, SESSION_DURATION_MS / 1000);
  renderResult(summary);
  showScreen("result");
  saveSession(summary);
}

function saveSession(summary) {
  sessionHistory.push(summary);
  renderHistory(sessionHistory);
  try {
    if (!historyReadable) throw new Error("History unavailable");
    localStorage.setItem(HISTORY_KEY, JSON.stringify(sessionHistory));
    showStorageMessage("");
  } catch {
    showStorageMessage("Результат не сохранён в браузере. Он доступен до закрытия или перезагрузки страницы.");
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const history = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(history) || !history.every(isValidSession)) {
      throw new Error("Invalid history");
    }
    sessionHistory = history;
  } catch {
    historyReadable = false;
    showStorageMessage("История недоступна или повреждена. Можно играть, но новые результаты будут доступны только до перезагрузки страницы.");
  }
  renderHistory(sessionHistory);
}

function isValidSession(s) {
  if (!s || typeof s !== "object" || typeof s.timestamp !== "string" ||
      !Number.isFinite(Date.parse(s.timestamp))) return false;
  const counts = [s.total_trials, s.correct, s.incorrect];
  const times = [s.avg_rt_ms, s.avg_rt_congruent_ms, s.avg_rt_incongruent_ms];
  return counts.every((n) => Number.isInteger(n) && n >= 0) &&
    s.correct + s.incorrect === s.total_trials &&
    Number.isFinite(s.duration_sec) && s.duration_sec > 0 &&
    Number.isFinite(s.accuracy_pct) && s.accuracy_pct >= 0 && s.accuracy_pct <= 100 &&
    times.every((n) => n === null || (Number.isFinite(n) && n >= 0)) &&
    (s.interference_ms === null || Number.isFinite(s.interference_ms));
}

function showStorageMessage(message) {
  const el = document.getElementById("storage-message");
  el.textContent = message;
  el.classList.toggle("hidden", !message);
}

function formatDate(iso) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderHistoryTable(history) {
  const tbody = document.getElementById("history-body");
  const table = document.getElementById("history-table");
  const emptyEl = document.getElementById("empty-history");

  tbody.innerHTML = "";

  if (history.length === 0) {
    table.classList.add("hidden");
    emptyEl.classList.remove("hidden");
    return;
  }

  table.classList.remove("hidden");
  emptyEl.classList.add("hidden");

  [...history].reverse().forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(s.timestamp)}</td>
      <td>${s.total_trials}</td>
      <td>${s.accuracy_pct.toFixed(0)}%</td>
      <td>${s.avg_rt_ms != null ? Math.round(s.avg_rt_ms) + " мс" : "-"}</td>
      <td>${s.interference_ms != null ? Math.round(s.interference_ms) + " мс" : "-"}</td>
    `;
    tbody.appendChild(tr);
  });
}

function drawTrendChart(canvas, noteEl, points, color, formatValue) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  if (points.length === 0) {
    noteEl.textContent = "Пока нет данных.";
    return;
  }
  noteEl.textContent =
    points.length === 1
      ? "Нужна ещё минимум одна сессия, чтобы построить линию тренда."
      : "";

  const padding = { left: 42, right: 12, top: 12, bottom: 20 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const values = points.map((p) => p.value);
  let minV = Math.min(...values);
  let maxV = Math.max(...values);
  if (minV === maxV) {
    minV -= 1;
    maxV += 1;
  }
  const rangePad = (maxV - minV) * 0.1;
  minV -= rangePad;
  maxV += rangePad;

  const xForIndex = (i) =>
    points.length === 1
      ? padding.left + plotW / 2
      : padding.left + (plotW * i) / (points.length - 1);
  const yForValue = (v) => padding.top + plotH - ((v - minV) / (maxV - minV)) * plotH;

  ctx.strokeStyle = "#e1e0d9";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#898781";
  ctx.font = "11px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "middle";
  const gridSteps = 3;
  for (let s = 0; s <= gridSteps; s++) {
    const v = minV + ((maxV - minV) * s) / gridSteps;
    const y = yForValue(v);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText(formatValue(v), 2, y);
  }

  ctx.strokeStyle = "#c3c2b7";
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top + plotH);
  ctx.lineTo(width - padding.right, padding.top + plotH);
  ctx.stroke();

  if (points.length >= 2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = xForIndex(i);
      const y = yForValue(p.value);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  points.forEach((p, i) => {
    const x = xForIndex(i);
    const y = yForValue(p.value);
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#fcfcfb";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });

  const last = points[points.length - 1];
  ctx.fillStyle = "#0b0b0b";
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(formatValue(last.value), width - padding.right, yForValue(last.value) - 12);
  ctx.textAlign = "left";
}

function renderCharts(history) {
  const accuracyPoints = history.map((s, i) => ({ index: i, value: s.accuracy_pct }));
  const rtPoints = history
    .filter((s) => s.avg_rt_ms != null)
    .map((s, i) => ({ index: i, value: s.avg_rt_ms }));

  drawTrendChart(
    document.getElementById("chart-accuracy"),
    document.getElementById("chart-accuracy-note"),
    accuracyPoints,
    "#2a78d6",
    (v) => `${Math.round(v)}%`
  );

  drawTrendChart(
    document.getElementById("chart-rt"),
    document.getElementById("chart-rt-note"),
    rtPoints,
    "#1baf7a",
    (v) => `${Math.round(v)} мс`
  );
}

function renderHistory(history) {
  renderHistoryTable(history);
  renderCharts(history);
}

document.getElementById("btn-start").addEventListener("click", startSession);
document.getElementById("btn-again").addEventListener("click", startSession);

loadHistory();
