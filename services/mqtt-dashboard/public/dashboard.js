const POLL_INTERVAL = 10_000;
let currentRange = "1h";
let tempChart, progressChart, fanChart, miscChart;

// --- Chart Setup ---

const chartDefaults = {
  responsive: true,
  animation: false,
  plugins: { legend: { labels: { color: "#9ca3af" } } },
  scales: {
    x: {
      type: "time",
      ticks: { color: "#6b7280", maxTicksLimit: 10 },
      grid: { color: "#2a2e42" },
    },
  },
};

const defaultDataset = {
  borderWidth: 1.5,
  pointRadius: 0,
  tension: 0.2,
};

// Bambu fan speeds are 0–15; scale to percentage
function fanPct(val) {
  return val != null ? Math.round((val / 15) * 100) : null;
}

function initCharts() {
  tempChart = new Chart(document.getElementById("temp-chart").getContext("2d"), {
    type: "line",
    data: {
      datasets: [
        { ...defaultDataset, label: "Nozzle", borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.1)", data: [] },
        { ...defaultDataset, label: "Nozzle Target", borderColor: "#ef4444", borderDash: [4, 4], backgroundColor: "transparent", data: [] },
        { ...defaultDataset, label: "Bed", borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.1)", data: [] },
        { ...defaultDataset, label: "Bed Target", borderColor: "#3b82f6", borderDash: [4, 4], backgroundColor: "transparent", data: [] },
        { ...defaultDataset, label: "Chamber", borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.1)", data: [] },
      ],
    },
    options: {
      ...chartDefaults,
      scales: {
        ...chartDefaults.scales,
        y: {
          min: 0, max: 300,
          ticks: { color: "#6b7280" },
          grid: { color: "#2a2e42" },
          title: { display: true, text: "\u00B0C", color: "#6b7280" },
        },
      },
    },
  });

  progressChart = new Chart(document.getElementById("progress-chart").getContext("2d"), {
    type: "line",
    data: {
      datasets: [
        { ...defaultDataset, label: "Progress", borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.1)", yAxisID: "y", data: [] },
        { ...defaultDataset, label: "Layer", borderColor: "#a78bfa", backgroundColor: "rgba(167,139,250,0.1)", yAxisID: "y1", data: [] },
        { ...defaultDataset, label: "ETA (min)", borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.1)", yAxisID: "y2", data: [] },
      ],
    },
    options: {
      ...chartDefaults,
      scales: {
        ...chartDefaults.scales,
        y: {
          min: 0, max: 100,
          ticks: { color: "#6b7280" },
          grid: { color: "#2a2e42" },
          title: { display: true, text: "%", color: "#6b7280" },
        },
        y1: {
          position: "right",
          min: 0,
          ticks: { color: "#6b7280" },
          grid: { drawOnChartArea: false },
          title: { display: true, text: "Layer", color: "#6b7280" },
        },
        y2: {
          position: "right",
          min: 0,
          ticks: { color: "#6b7280", display: false },
          grid: { drawOnChartArea: false },
        },
      },
    },
  });

  fanChart = new Chart(document.getElementById("fan-chart").getContext("2d"), {
    type: "line",
    data: {
      datasets: [
        { ...defaultDataset, label: "Part Fan", borderColor: "#06b6d4", backgroundColor: "rgba(6,182,212,0.1)", data: [] },
        { ...defaultDataset, label: "Aux Fan", borderColor: "#8b5cf6", backgroundColor: "rgba(139,92,246,0.1)", data: [] },
        { ...defaultDataset, label: "Chamber Fan", borderColor: "#ec4899", backgroundColor: "rgba(236,72,153,0.1)", data: [] },
        { ...defaultDataset, label: "Heatbreak Fan", borderColor: "#14b8a6", backgroundColor: "rgba(20,184,166,0.1)", data: [] },
      ],
    },
    options: {
      ...chartDefaults,
      scales: {
        ...chartDefaults.scales,
        y: {
          min: 0, max: 100,
          ticks: { color: "#6b7280" },
          grid: { color: "#2a2e42" },
          title: { display: true, text: "%", color: "#6b7280" },
        },
      },
    },
  });

  miscChart = new Chart(document.getElementById("misc-chart").getContext("2d"), {
    type: "line",
    data: {
      datasets: [
        { ...defaultDataset, label: "Speed Mag", borderColor: "#f97316", backgroundColor: "rgba(249,115,22,0.1)", yAxisID: "y", data: [] },
        { ...defaultDataset, label: "WiFi (dBm)", borderColor: "#64748b", backgroundColor: "rgba(100,116,139,0.1)", yAxisID: "y1", data: [] },
      ],
    },
    options: {
      ...chartDefaults,
      scales: {
        ...chartDefaults.scales,
        y: {
          min: 0,
          ticks: { color: "#6b7280" },
          grid: { color: "#2a2e42" },
          title: { display: true, text: "Speed", color: "#6b7280" },
        },
        y1: {
          position: "right",
          ticks: { color: "#6b7280" },
          grid: { drawOnChartArea: false },
          title: { display: true, text: "dBm", color: "#6b7280" },
        },
      },
    },
  });
}

// --- Data Fetching ---

async function fetchData() {
  try {
    const res = await fetch(`/api/telemetry?range=${currentRange}`);
    if (!res.ok) return;
    const { points } = await res.json();
    updateCharts(points);
    if (points.length > 0) updateStatus(points[points.length - 1]);
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

function updateCharts(points) {
  const nozzle = [], nozzleTarget = [], bed = [], bedTarget = [], chamber = [];
  const progress = [], layers = [], eta = [];
  const partFan = [], auxFan = [], chamberFan = [], heatbreakFan = [];
  const spdMag = [], wifi = [];

  for (const p of points) {
    const t = new Date(p.timestamp);
    if (p.nozzleTemper != null) nozzle.push({ x: t, y: p.nozzleTemper });
    if (p.nozzleTargetTemper != null) nozzleTarget.push({ x: t, y: p.nozzleTargetTemper });
    if (p.bedTemper != null) bed.push({ x: t, y: p.bedTemper });
    if (p.bedTargetTemper != null) bedTarget.push({ x: t, y: p.bedTargetTemper });
    if (p.chamberTemper != null) chamber.push({ x: t, y: p.chamberTemper });
    if (p.mcPercent != null) progress.push({ x: t, y: p.mcPercent });
    if (p.layerNum != null) layers.push({ x: t, y: p.layerNum });
    if (p.mcRemainingTime != null) eta.push({ x: t, y: p.mcRemainingTime });

    const pf = fanPct(p.coolingFanSpeed);
    const af = fanPct(p.bigFan1Speed);
    const cf = fanPct(p.bigFan2Speed);
    const hf = fanPct(p.heatbreakFanSpeed);
    if (pf != null) partFan.push({ x: t, y: pf });
    if (af != null) auxFan.push({ x: t, y: af });
    if (cf != null) chamberFan.push({ x: t, y: cf });
    if (hf != null) heatbreakFan.push({ x: t, y: hf });

    if (p.spdMag != null) spdMag.push({ x: t, y: p.spdMag });
    if (p.wifiSignal != null) wifi.push({ x: t, y: p.wifiSignal });
  }

  // Temperature
  tempChart.data.datasets[0].data = nozzle;
  tempChart.data.datasets[1].data = nozzleTarget;
  tempChart.data.datasets[2].data = bed;
  tempChart.data.datasets[3].data = bedTarget;
  tempChart.data.datasets[4].data = chamber;
  tempChart.update();

  // Progress
  progressChart.data.datasets[0].data = progress;
  progressChart.data.datasets[1].data = layers;
  progressChart.data.datasets[2].data = eta;
  const maxLayer = layers.reduce((m, l) => Math.max(m, l.y), 0);
  progressChart.options.scales.y1.max = maxLayer > 0 ? maxLayer : undefined;
  progressChart.update();

  // Fans
  fanChart.data.datasets[0].data = partFan;
  fanChart.data.datasets[1].data = auxFan;
  fanChart.data.datasets[2].data = chamberFan;
  fanChart.data.datasets[3].data = heatbreakFan;
  fanChart.update();

  // Speed & WiFi
  miscChart.data.datasets[0].data = spdMag;
  miscChart.data.datasets[1].data = wifi;
  miscChart.update();
}

function updateStatus(p) {
  const state = p.gcodeState ?? "--";
  const stEl = document.getElementById("st-state");
  stEl.textContent = state;
  stEl.className = "value " + (state.toLowerCase().includes("running") ? "running" : "idle");

  document.getElementById("st-job").textContent = p.subtaskName ?? "--";
  document.getElementById("st-progress").textContent =
    p.mcPercent != null ? `${p.mcPercent}%` : "--";
  document.getElementById("st-layer").textContent =
    p.layerNum != null && p.totalLayerNum != null
      ? `${p.layerNum} / ${p.totalLayerNum}`
      : p.layerNum ?? "--";
  document.getElementById("st-nozzle").textContent =
    p.nozzleTemper != null ? `${p.nozzleTemper}\u00B0C` : "--";
  document.getElementById("st-bed").textContent =
    p.bedTemper != null ? `${p.bedTemper}\u00B0C` : "--";
  document.getElementById("st-eta").textContent =
    p.mcRemainingTime != null ? `${p.mcRemainingTime} min` : "--";
  document.getElementById("st-wifi").textContent =
    p.wifiSignal != null ? `${p.wifiSignal} dBm` : "--";
}

// --- Range Buttons ---

document.querySelectorAll(".range-buttons button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelector(".range-buttons .active").classList.remove("active");
    btn.classList.add("active");
    currentRange = btn.dataset.range;
    fetchData();
  });
});

// --- Init ---

initCharts();
fetchData();
setInterval(fetchData, POLL_INTERVAL);
