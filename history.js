const HISTORY_KEY = "stroop-test.history.v2";
let sessionHistory = [];
let historyReadable = true;
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
