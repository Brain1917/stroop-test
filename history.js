const HISTORY_KEY = "stroop-test.history.v2";
const SESSION_PREFIX = "stroop-test.feedback-session.";
const unsavedSessions = [];
let sessionHistory = [];

function saveSession(summary) {
  summary.feedback = true;
  summary.immediate = true;
  try {
    // Separate keys let two open tabs finish independently.
    localStorage.setItem(SESSION_PREFIX + crypto.randomUUID(), JSON.stringify(summary));
  } catch {
    unsavedSessions.push(summary);
  }
  loadHistory();
}

function loadHistory() {
  try {
    let previous;
    try { previous = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { previous = null; }
    const validPrevious = Array.isArray(previous) ? previous.filter(isValidSession) : [];
    let damaged = !Array.isArray(previous) || validPrevious.length !== previous.length;
    const recent = [];
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(SESSION_PREFIX)) continue;
      try {
        const row = JSON.parse(localStorage.getItem(key));
        if (!isValidSession(row)) throw Error();
        recent.push(row);
      } catch { damaged = true; }
    }
    sessionHistory = [...validPrevious, ...recent];
    showStorageMessage(damaged ? "Часть записей истории не удалось прочитать." : "");
  } catch {
    showStorageMessage("Часть истории недоступна в этом браузере.");
  }
  if (unsavedSessions.length) {
    showStorageMessage("Часть результатов доступна только до закрытия этой страницы.");
  }
  const rows = [...sessionHistory, ...unsavedSessions].sort((a,b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  renderHistory(rows);
}

window.addEventListener("storage", event => {
  if (event.key === null || event.key === HISTORY_KEY || event.key.startsWith(SESSION_PREFIX)) loadHistory();
});

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

function renderHistoryTable(history, legacy = false) {
  const tbody = document.getElementById(legacy ? "legacy-body" : "history-body");
  const table = tbody.closest("table");
  const emptyEl = document.getElementById(legacy ? "empty-legacy" : "empty-history");

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
      <td>${formatDate(s.timestamp)}${legacy || s.immediate ? "" : s.feedback ? "<small>С паузой</small>" : "<small>До подсказок</small>"}</td>
      ${legacy ? "<td>" + s.total_trials + "</td>" :
        "<td>" + s.correct + " / " + s.total_trials + "</td><td>" + s.incorrect + "</td>"}
      <td>${s.accuracy_pct.toFixed(0)}%</td>
      <td>${s.avg_rt_ms != null ? Math.round(s.avg_rt_ms) + " мс" : "-"}</td>
      <td>${s.interference_ms != null ? Math.round(s.interference_ms) + " мс" : "-"}</td>
    `;
    tbody.appendChild(tr);
  });
}

function drawTrendChart(canvas, noteEl, points, color, formatValue, sessionCount, percent = false) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  if (points.length === 0) {
    noteEl.textContent = "Пока нет данных.";
    return;
  }
  noteEl.textContent = "";

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

  minV = percent ? 0 : Math.max(0, minV);
  if (percent) maxV = 100;

  const xForIndex = (i) =>
    sessionCount === 1
      ? padding.left + plotW / 2
      : padding.left + (plotW * i) / (sessionCount - 1);
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
      const x = xForIndex(p.index);
      const y = yForValue(p.value);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  points.forEach((p, i) => {
    const x = xForIndex(p.index);
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
    .map((s, i) => ({ index: i, value: s.avg_rt_ms }))
    .filter((p) => p.value != null);

  drawTrendChart(
    document.getElementById("chart-accuracy"),
    document.getElementById("chart-accuracy-note"),
    accuracyPoints,
    "#2a78d6",
    (v) => `${Math.round(v)}%`, history.length, true
  );

  drawTrendChart(
    document.getElementById("chart-rt"),
    document.getElementById("chart-rt-note"),
    rtPoints,
    "#1baf7a",
    (v) => `${Math.round(v)} мс`, history.length
  );
}

function renderHistory(history) {
  renderHistoryTable(history);
  const immediate = history.filter(s => s.immediate === true);
  document.getElementById("trends").hidden = immediate.length === 0;
  renderCharts(immediate);
}


function loadArchive() {
  try {
    const rows = JSON.parse(localStorage.getItem("stroop-test.history.v1") || "[]");
    if (!Array.isArray(rows) || !rows.every(isValidSession)) throw Error();
    if (!rows.length) return;
    renderHistoryTable(rows, true);
  } catch {
    document.getElementById("empty-legacy").textContent = "Архив недоступен в этом браузере.";
  }
  document.getElementById("legacy").hidden = false;
}
loadHistory();
loadArchive();
