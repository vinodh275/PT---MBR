const OWNERSHIPS = ["All", "1P Elite", "2P Elite", "1P Neo", "2P Neo"];
const METRICS = [
  { key: "revenue", label: "Rev (in L)", format: "lakhs" },
  { key: "aov", label: "AOV (in 000)", format: "number" },
  { key: "ppc", label: "PPC", format: "integer" },
  { key: "m0", label: "M0 Onboarding", format: "percent" },
  { key: "d30", label: "D30 Conv%", format: "percent" },
  { key: "utilisation", label: "Utilisation%", format: "percent" },
  { key: "d60", label: "D60 Retention%", format: "percent" },
  { key: "packUtilisation", label: "Pack utilisation%", format: "percent" },
  { key: "breakage", label: "Breakage", format: "percent" },
  { key: "extension", label: "Extension", format: "percent" }
];

// Demo values mirror the current MBR sheet. Replace this object with the server/API response later.
const DATA = {
  "1P Elite": {
    "2025-08": { revenue: 542.0, aov: 33.4, ppc: 940, m0: .276, d30: .121, utilisation: .874, d60: .386, packUtilisation: null, breakage: null, extension: null },
    "2026-08": { revenue: 858.6, aov: 38.4, ppc: 982, m0: .495, d30: .096, utilisation: .865, d60: .377, packUtilisation: null, breakage: null, extension: null },
    "2026-07": { revenue: 891.3, aov: 37.9, ppc: 982, m0: .489, d30: .124, utilisation: .873, d60: .442, packUtilisation: null, breakage: null, extension: null },
    "2026-06": { revenue: 885.1, aov: 38.5, ppc: 966, m0: .534, d30: .123, utilisation: .863, d60: .431, packUtilisation: null, breakage: null, extension: null }
  },
  "2P Elite": {
    "2025-08": { revenue: 56.7, aov: 22.4, ppc: 875, m0: .148, d30: .152, utilisation: null, d60: null, packUtilisation: null, breakage: null, extension: null },
    "2026-08": { revenue: 242.2, aov: 33.4, ppc: 878, m0: .362, d30: .118, utilisation: null, d60: null, packUtilisation: null, breakage: null, extension: null },
    "2026-07": { revenue: 224.8, aov: 31.9, ppc: 883, m0: .384, d30: .129, utilisation: null, d60: null, packUtilisation: null, breakage: null, extension: null },
    "2026-06": { revenue: 211.9, aov: 30.3, ppc: 878, m0: .371, d30: .145, utilisation: null, d60: null, packUtilisation: null, breakage: null, extension: null }
  },
  "1P Neo": {},
  "2P Neo": {}
};
let activeData = DATA;

const CITY_DATA = [
  ["1P Elite", "Bangalore", "2026-08", 205.4],
  ["1P Elite", "Chennai", "2026-08", 118.2],
  ["1P Elite", "Hyderabad", "2026-08", 106.7],
  ["1P Elite", "Mumbai", "2026-08", 94.3],
  ["2P Elite", "Bangalore", "2026-08", 66.1],
  ["2P Elite", "Chennai", "2026-08", 41.8],
  ["2P Elite", "Hyderabad", "2026-08", 35.6]
];

let selectedOwnership = "All";
const asOf = document.querySelector("#asOf");
// Use the latest month currently present in the prototype data. In production this
// will be replaced by the latest successful Metabase refresh month.
asOf.value = "2026-08";

const cityFilter = document.querySelector("#cityFilter");
[...new Set(CITY_DATA.map((row) => row[1]))].sort().forEach((city) => {
  const option = document.createElement("option");
  option.value = city;
  option.textContent = city;
  cityFilter.appendChild(option);
});

function monthKeys(asOfMonth) {
  const [year, month] = asOfMonth.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return [
    { key: key(new Date(year - 1, month - 1, 1)), label: "YoY month" },
    { key: key(date), label: "Current month" },
    { key: key(new Date(year, month - 2, 1)), label: "Previous month" },
    { key: key(new Date(year, month - 3, 1)), label: "Two months prior" }
  ];
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(new Date(y, m - 1, 1));
}

function formatValue(value, format) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (format === "percent") return `${(value * 100).toFixed(1)}%`;
  if (format === "lakhs") return value.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (format === "integer") return Math.round(value).toLocaleString("en-IN");
  return value.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function selectedOwners() { return selectedOwnership === "All" ? OWNERSHIPS.slice(1) : [selectedOwnership]; }

function aggregate(metric, periodKey) {
  const values = selectedOwners().map((owner) => activeData[owner]?.[periodKey]?.[metric.key]).filter((v) => v !== null && v !== undefined);
  if (!values.length) return null;
  // Revenue/PPC can be added across ownerships. AOV and percentage metrics
  // must use source numerators/denominators, so never average them blindly.
  if (["revenue", "ppc"].includes(metric.key)) return values.reduce((a, b) => a + b, 0);
  if (selectedOwnership === "All" && selectedOwners().length > 1) return null;
  return values[0];
}

function renderFilters() {
  const root = document.querySelector("#ownershipFilters");
  root.innerHTML = OWNERSHIPS.map((owner) => `<button class="chip ${owner === selectedOwnership ? "active" : ""}" data-owner="${owner}">${owner}</button>`).join("");
  root.querySelectorAll(".chip").forEach((button) => button.addEventListener("click", () => { selectedOwnership = button.dataset.owner; render(); }));
}

function renderScorecard(periods) {
  const head = document.querySelector("#scorecard thead");
  const body = document.querySelector("#scorecard tbody");
  head.innerHTML = `<tr><th>Metric</th>${periods.map((p, i) => `<th class="${i === 1 ? "current" : ""}">${monthLabel(p.key)}<br><small>${p.label}</small></th>`).join("")}</tr>`;
  body.innerHTML = METRICS.map((metric) => `<tr><td class="metric-label">${metric.label}</td>${periods.map((p, i) => { const value = aggregate(metric, p.key); return `<td class="${i === 1 ? "current" : ""} ${value === null ? "na" : ""}">${formatValue(value, metric.format)}</td>`; }).join("")}</tr>`).join("");
}

function renderCityTable(periods) {
  const selectedCity = cityFilter.value;
  const filteredCityRows = CITY_DATA.filter((r) => (selectedOwnership === "All" || r[0] === selectedOwnership) && (selectedCity === "all" || r[1] === selectedCity));
  const groups = [...new Map(filteredCityRows.map((r) => [`${r[0]}||${r[1]}`, { owner: r[0], city: r[1] }])).values()];
  const head = document.querySelector("#cityTable thead");
  const body = document.querySelector("#cityTable tbody");
  head.innerHTML = `<tr><th>Metric</th>${periods.map((p, i) => `<th class="${i === 1 ? "current" : ""}">${monthLabel(p.key)}<br><small>Value</small></th>`).join("")}</tr>`;
  body.innerHTML = groups.flatMap((group) => {
    const heading = `<tr class="city-group"><th colspan="${periods.length + 1}">${group.owner} · ${group.city}</th></tr>`;
    const metricRows = METRICS.map((metric) => {
      const cells = periods.map((p, i) => {
        const rows = CITY_DATA.filter((r) => r[0] === group.owner && r[1] === group.city && r[2] === p.key);
        const value = metric.key === "revenue" ? rows.reduce((sum, r) => sum + r[3], 0) || null : null;
        return `<td class="${i === 1 ? "current" : ""} ${value === null ? "na" : ""}">${formatValue(value, metric.format)}</td>`;
      }).join("");
      return `<tr class="city-metric"><td>${metric.label}</td>${cells}</tr>`;
    });
    return [heading, ...metricRows];
  }).join("") || `<tr><td colspan="5" class="na">No city data available for this selection yet.</td></tr>`;
}

function render() {
  renderFilters();
  const periods = monthKeys(asOf.value);
  renderScorecard(periods);
  renderCityTable(periods);
  const current = periods[1].key;
  const revenue = aggregate(METRICS[0], current);
  const aov = aggregate(METRICS[1], current);
  const utilisation = aggregate(METRICS[5], current);
  document.querySelector("#heroRevenue").textContent = revenue === null ? "—" : `₹${formatValue(revenue, "lakhs")}L`;
  document.querySelector("#heroAov").textContent = aov === null ? "—" : `₹${formatValue(aov, "number")}`;
  document.querySelector("#heroUtilisation").textContent = formatValue(utilisation, "percent");
  document.querySelector("#heroMonth").textContent = `${monthLabel(current)} · ${selectedOwnership}`;
  document.querySelector("#heroChange").textContent = "Live comparison view";
  document.querySelector("#lastUpdated").textContent = `Rendered ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`;
}

async function loadPublishedData() {
  try {
    const response = await fetch(`data/mbr.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`data/mbr.json returned ${response.status}`);
    const payload = await response.json();
    if (!payload.data || typeof payload.data !== "object") throw new Error("Published data has no data object");
    activeData = payload.data;
    const stamp = payload.updatedAt ? ` · Updated ${new Date(payload.updatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : "";
    document.querySelector(".toolbar-note span:last-child").textContent = `Live published data${stamp}`;
    render();
  } catch (error) {
    document.querySelector(".toolbar-note span:last-child").textContent = "Demo data · waiting for first Metabase publish";
  }
}

document.querySelector("#cityFilter").addEventListener("change", render);
asOf.addEventListener("change", render);
document.querySelector("#refreshBtn").addEventListener("click", render);
render();
loadPublishedData();
