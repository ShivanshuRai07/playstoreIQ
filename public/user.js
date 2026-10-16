/* ═══════════════════════════════════════════════════════════════
   PlayStoreIQ — user.js
   Normal User / App Discovery Portal Logic
   ═══════════════════════════════════════════════════════════════ */

"use strict";

const API = (window.location.protocol === "file:" || (window.location.port && window.location.port !== "5000" && window.location.port !== "80" && window.location.port !== "443"))
  ? "http://127.0.0.1:5000/api"
  : "/api";

const PALETTES = {
  light: {
    bg: "#F5F7FA", surface: "#FFFFFF", border: "#E5E8EE",
    text: "#1F2937", text2: "#4B5563", muted: "#9CA3AF",
    primary: "#10B981", green: "#10B981", amber: "#F59E0B", red: "#EF4444"
  },
  dark: {
    bg: "#0F172A", surface: "#111C33", border: "#1F2A44",
    text: "#E5E7EB", text2: "#9CA3AF", muted: "#4B5563",
    primary: "#34D399", green: "#34D399", amber: "#FBBF24", red: "#F87171"
  }
};

const CHART_COLORS = ["#10B981", "#06B6D4", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444"];

let charts = {};
let currentUser = null;
let currentToken = localStorage.getItem("playstore_iq_token") || null;
let currentTrendingWindow = "3M";

function isDark() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

function tok() {
  return isDark() ? PALETTES.dark : PALETTES.light;
}

function fmtNum(n) {
  if (n === null || n === undefined || Number.isNaN(+n)) return "—";
  n = +n;
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString();
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function revealChart(skId, canvasId) {
  const sk = document.getElementById(skId);
  const cv = document.getElementById(canvasId);
  if (sk) sk.style.display = "none";
  if (cv) cv.classList.remove("hidden");
}

function chartDefaults(extra = {}) {
  const t = tok();
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: {
        labels: { color: t.text2, font: { family: "'Inter',system-ui", size: 11 }, boxWidth: 10, padding: 14 }
      },
      tooltip: {
        backgroundColor: t.surface,
        titleColor: t.text,
        bodyColor: t.text2,
        borderColor: t.border,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8
      }
    },
    scales: {
      x: { grid: { color: t.border, drawBorder: false }, ticks: { color: t.muted, font: { size: 11 } } },
      y: { grid: { color: t.border, drawBorder: false }, ticks: { color: t.muted, font: { size: 11 } } }
    },
    ...extra
  };
}

/* ── Donut Distribution Callout Plugin (Leader Lines + Outer Percentages) ── */
const DIST_PALETTE = ["#334155", "#EF4444", "#F97316", "#8B5CF6", "#10B981", "#14B8A6", "#3B82F6", "#EC4899"];

const donutCalloutPlugin = {
  id: "donutCallout",
  afterDatasetsDraw(chart, _args, pluginOptions) {
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || !meta.data.length) return;
    const dataset = chart.data.datasets[0];
    if (!dataset || !dataset.data) return;

    const total = dataset.data.reduce((sum, v) => sum + (Number(v) || 0), 0);
    if (total <= 0) return;

    const ctx = chart.ctx;
    const minPct = pluginOptions?.minPercent ?? 1.5;

    const items = [];
    meta.data.forEach((element, i) => {
      const val = Number(dataset.data[i]) || 0;
      if (val <= 0 || element.hidden) return;

      const pct = (val / total) * 100;
      if (pct < minPct) return;

      const midAngle = (element.startAngle + element.endAngle) / 2;
      const cx = element.x;
      const cy = element.y;
      const r = element.outerRadius;

      const cos = Math.cos(midAngle);
      const sin = Math.sin(midAngle);

      // Start point at outer arc
      const x0 = cx + cos * (r + 2);
      const y0 = cy + sin * (r + 2);

      // Elbow point radially outward
      const elbowDist = r + 15;
      const x1 = cx + cos * elbowDist;
      const y1 = cy + sin * elbowDist;

      // Horizontal leader line
      const isRight = cos >= 0;
      const armLength = 11;
      const x2 = x1 + (isRight ? armLength : -armLength);
      const y2 = y1;

      // Slice color for line and percentage text
      let color = (dataset.calloutColors && dataset.calloutColors[i])
        || (Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[i] : null)
        || (Array.isArray(dataset.borderColor) ? dataset.borderColor[i] : null)
        || "#3B82F6";
      if (typeof color === "string") {
        color = color.replace(/cc$/, "").replace(/99$/, "");
      }

      items.push({
        x0, y0,
        x1, y1,
        x2, y2,
        isRight,
        color,
        pct: Math.round(pct),
        origY: y1
      });
    });

    if (!items.length) return;

    // Anti-collision separation for left and right callouts
    const leftItems = items.filter(it => !it.isRight).sort((a, b) => a.y2 - b.y2);
    const rightItems = items.filter(it => it.isRight).sort((a, b) => a.y2 - b.y2);

    function separateLabels(group) {
      for (let i = 1; i < group.length; i++) {
        if (group[i].y2 - group[i - 1].y2 < 16) {
          const shift = 16 - (group[i].y2 - group[i - 1].y2);
          group[i].y2 += shift;
          group[i].y1 += shift * 0.4;
        }
      }
    }
    separateLabels(leftItems);
    separateLabels(rightItems);

    ctx.save();
    items.forEach(it => {
      // 1. Draw leader line with elbow
      ctx.beginPath();
      ctx.moveTo(it.x0, it.y0);
      ctx.lineTo(it.x1, it.y1);
      ctx.lineTo(it.x2, it.y2);
      ctx.strokeStyle = it.color;
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      // 2. Draw percentage text matching slice color
      const textX = it.x2 + (it.isRight ? 4 : -4);
      const textY = it.y2;
      ctx.font = "700 11px 'Inter', system-ui, -apple-system, sans-serif";
      ctx.fillStyle = it.color;
      ctx.textAlign = it.isRight ? "left" : "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`${it.pct}%`, textX, textY);
    });
    ctx.restore();
  }
};

/* ─────────────────────────────────────────────────────────────────
   THEME TOGGLE
───────────────────────────────────────────────────────────────── */
const themeToggle = document.getElementById("themeToggle");
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    const sun = document.querySelector(".icon-sun");
    const moon = document.querySelector(".icon-moon");
    if (sun) sun.classList.toggle("hidden", next === "light");
    if (moon) moon.classList.toggle("hidden", next === "dark");
    setTimeout(renderAllCharts, 60);
  });
}

/* ─────────────────────────────────────────────────────────────────
   SIDEBAR & NAV
───────────────────────────────────────────────────────────────── */
const sidebar = document.getElementById("sidebar");
const collapseBtn = document.getElementById("sidebarCollapseBtn");
if (collapseBtn && sidebar) {
  collapseBtn.addEventListener("click", () => sidebar.classList.toggle("collapsed"));
}
const hamburger = document.getElementById("hamburger");
if (hamburger && sidebar) {
  hamburger.addEventListener("click", () => sidebar.classList.toggle("mobile-open"));
}

document.querySelectorAll(".sidebar-nav .nav-item").forEach(item => {
  item.addEventListener("click", e => {
    e.preventDefault();
    document.querySelectorAll(".sidebar-nav .nav-item").forEach(i => i.classList.remove("active"));
    item.classList.add("active");
    const sec = item.dataset.section;
    const target = document.getElementById(`section-${sec}`);
    if (target) target.scrollIntoView({ behavior: "smooth" });
    if (window.innerWidth <= 640 && sidebar) sidebar.classList.remove("mobile-open");
  });
});

/* ─────────────────────────────────────────────────────────────────
   AUTH CHECK
───────────────────────────────────────────────────────────────── */
async function checkUserAuth() {
  if (!currentToken) {
    window.location.href = "/login.html";
    return false;
  }
  try {
    const res = await fetch(`${API}/auth/me`, {
      headers: { "Authorization": `Bearer ${currentToken}` }
    });
    if (!res.ok) {
      localStorage.removeItem("playstore_iq_token");
      localStorage.removeItem("playstore_iq_user");
      window.location.href = "/login.html";
      return false;
    }
    const data = await res.json();
    currentUser = data.user;
    const nameEl = document.getElementById("userNameLabel");
    if (nameEl) nameEl.textContent = currentUser.name || "Normal User";

    // If logged in as analyst or admin, offer link to analyst suite
    if (currentUser.role === "analyst" || currentUser.role === "admin") {
      const linkWrap = document.getElementById("analystLinkWrap");
      if (linkWrap) linkWrap.classList.remove("hidden");
    }
    return true;
  } catch (e) {
    console.error("Auth check failed:", e);
    window.location.href = "/login.html";
    return false;
  }
}

function handleLogout() {
  currentUser = null;
  currentToken = null;
  localStorage.removeItem("playstore_iq_token");
  localStorage.removeItem("playstore_iq_user");
  window.location.href = "/login.html";
}
window.handleLogout = handleLogout;

/* ─────────────────────────────────────────────────────────────────
   DISCOVERY KPIS
───────────────────────────────────────────────────────────────── */
async function renderDiscoveryKPIs() {
  try {
    const res = await fetch(`${API}/kpis`);
    const data = await res.json();
    const grid = document.getElementById("kpiGrid");
    if (!grid) return;

    const cards = [
      { label: "Catalog Apps", val: fmtNum(data.totalApps?.value || 7242), icon: "📱", color: "#10b981", bg: "rgba(16,185,129,0.15)" },
      { label: "Average Rating", val: (+(data.avgRating?.value || 4.17)).toFixed(2) + " ★", icon: "⭐", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
      { label: "Total Installs", val: fmtNum(data.totalInstalls?.value || 72364556687), icon: "📥", color: "#06b6d4", bg: "rgba(6,182,212,0.15)" },
      { label: "Free Apps Share", val: (+(data.freePct?.value || 94.4)).toFixed(1) + "%", icon: "🎁", color: "#8b5cf6", bg: "rgba(139,92,246,0.15)" },
    ];

    grid.innerHTML = cards.map(c => `
      <div class="kpi-tile" style="display:flex;align-items:center;gap:14px;padding:18px;">
        <div style="width:44px;height:44px;border-radius:12px;background:${c.bg};color:${c.color};display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">
          ${c.icon}
        </div>
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">${c.label}</div>
          <div style="font-size:22px;font-weight:800;color:var(--text);margin-top:2px;">${c.val}</div>
        </div>
      </div>
    `).join("");
  } catch(e) {
    console.error("renderDiscoveryKPIs error:", e);
  }
}

/* ─────────────────────────────────────────────────────────────────
   DISCOVERY CHARTS
───────────────────────────────────────────────────────────────── */
async function renderUpdatedPerMonth() {
  try {
    const res = await fetch(`${API}/charts/apps_updated_per_month`);
    const data = await res.json();
    destroyChart("updatedMonth");
    revealChart("skUpdatedMonth", "updatedMonthChart");
    const cv = document.getElementById("updatedMonthChart");
    if (!cv) return;

    charts.updatedMonth = new Chart(cv.getContext("2d"), {
      type: "line",
      data: {
        labels: data.map(d => d.YearMonth),
        datasets: [{
          label: "Catalog Updates",
          data: data.map(d => d.count),
          borderColor: "#10B981",
          backgroundColor: "rgba(16,185,129,0.12)",
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 1,
        }]
      },
      options: chartDefaults()
    });
  } catch(e) {
    console.error("renderUpdatedPerMonth error:", e);
  }
}

async function renderFreePaid() {
  try {
    const res = await fetch(`${API}/charts/free_vs_paid`);
    const data = await res.json();
    destroyChart("freePaid");
    revealChart("skFreePaid", "freePaidChart");
    const cv = document.getElementById("freePaidChart");
    if (!cv) return;

    let freeCount = 6835;
    let paidCount = 407;
    if (Array.isArray(data)) {
      freeCount = data.find(d => d.Type === "Free")?.count || 6835;
      paidCount = data.find(d => d.Type === "Paid")?.count || 407;
    } else if (data && typeof data === "object") {
      freeCount = data.free ?? 6835;
      paidCount = data.paid ?? 407;
    }
    const total = freeCount + paidCount;
    const t = tok();
    const colors = ["#10B981", "#F97316"];

    charts.freePaid = new Chart(cv.getContext("2d"), {
      type: "doughnut",
      plugins: [donutCalloutPlugin],
      data: {
        labels: ["Free Apps", "Paid Apps"],
        datasets: [{
          data: [freeCount, paidCount],
          backgroundColor: colors,
          calloutColors: colors,
          borderColor: t.surface,
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "64%",
        layout: {
          padding: { top: 18, bottom: 18, left: 42, right: 14 }
        },
        plugins: {
          legend: {
            display: true,
            position: "right",
            align: "center",
            labels: {
              usePointStyle: true,
              pointStyle: "circle",
              boxWidth: 7,
              boxHeight: 7,
              padding: 12,
              color: t.text2,
              font: { family: "'Inter',system-ui,sans-serif", size: 11, weight: "500" }
            }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${Number(ctx.raw).toLocaleString()} (${total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0}%)`
            }
          }
        }
      }
    });
  } catch(e) {
    console.error("renderFreePaid error:", e);
  }
}

async function renderAppsPerCat() {
  try {
    const res = await fetch(`${API}/charts/apps_per_category`);
    const data = await res.json();
    destroyChart("appsPerCat");
    revealChart("skAppsPerCat", "appsPerCatChart");
    const cv = document.getElementById("appsPerCatChart");
    if (!cv) return;
    const top12 = data.slice(0, 12);

    charts.appsPerCat = new Chart(cv.getContext("2d"), {
      type: "bar",
      data: {
        labels: top12.map(d => d.Category.replace(/_/g, " ")),
        datasets: [{
          label: "Number of Apps",
          data: top12.map(d => d.count),
          backgroundColor: "rgba(16, 185, 129, 0.75)",
          borderRadius: 4
        }]
      },
      options: chartDefaults({
        plugins: { legend: { display: false } }
      })
    });
  } catch(e) {
    console.error("renderAppsPerCat error:", e);
  }
}

async function renderInstallsByCat() {
  try {
    const res = await fetch(`${API}/charts/installs_by_category`);
    const data = await res.json();
    destroyChart("installsByCat");
    revealChart("skInstallsByCat", "installsByCatChart");
    const cv = document.getElementById("installsByCatChart");
    if (!cv) return;
    const top12 = data.slice(0, 12);

    charts.installsByCat = new Chart(cv.getContext("2d"), {
      type: "bar",
      data: {
        labels: top12.map(d => d.Category.replace(/_/g, " ")),
        datasets: [{
          label: "Total Installs",
          data: top12.map(d => d.Installs),
          backgroundColor: "rgba(6, 182, 212, 0.75)",
          borderRadius: 4
        }]
      },
      options: chartDefaults({
        plugins: { legend: { display: false } }
      })
    });
  } catch(e) {
    console.error("renderInstallsByCat error:", e);
  }
}

async function renderRatingDist() {
  try {
    const res = await fetch(`${API}/charts/rating_distribution`);
    const data = await res.json();
    destroyChart("ratingDist");
    revealChart("skRatingDist", "ratingDistChart");
    const cv = document.getElementById("ratingDistChart");
    if (!cv) return;

    charts.ratingDist = new Chart(cv.getContext("2d"), {
      type: "bar",
      data: {
        labels: data.map(d => (+d.Rating).toFixed(1) + " ★"),
        datasets: [{
          label: "Apps with Rating",
          data: data.map(d => d.count),
          backgroundColor: "rgba(245, 158, 11, 0.75)",
          borderRadius: 4
        }]
      },
      options: chartDefaults({
        plugins: { legend: { display: false } }
      })
    });
  } catch(e) {
    console.error("renderRatingDist error:", e);
  }
}

async function renderSentiment() {
  try {
    const res = await fetch(`${API}/mining/sentiment`);
    const data = await res.json();
    destroyChart("sentDonut");
    revealChart("skSentimentDonut", "sentimentDonut");
    const cv = document.getElementById("sentimentDonut");
    if (!cv) return;

    const ov = data.overall || { Positive: 15754, Neutral: 3436, Negative: 5455 };
    const total = (ov.Positive || 0) + (ov.Neutral || 0) + (ov.Negative || 0);
    const t = tok();
    const sentColors = ["#10B981", "#EF4444", "#F59E0B"];

    charts.sentDonut = new Chart(cv.getContext("2d"), {
      type: "doughnut",
      plugins: [donutCalloutPlugin],
      data: {
        labels: ["Positive Sentiment", "Negative Sentiment", "Neutral Sentiment"],
        datasets: [{
          data: [ov.Positive || 0, ov.Negative || 0, ov.Neutral || 0],
          backgroundColor: sentColors,
          calloutColors: sentColors,
          borderColor: t.surface,
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        layout: {
          padding: { top: 18, bottom: 18, left: 40, right: 14 }
        },
        plugins: {
          legend: {
            display: true,
            position: "right",
            align: "center",
            labels: {
              usePointStyle: true,
              pointStyle: "circle",
              boxWidth: 7,
              boxHeight: 7,
              padding: 12,
              color: t.text2,
              font: { family: "'Inter',system-ui,sans-serif", size: 11, weight: "500" }
            }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${Number(ctx.raw).toLocaleString()} (${total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0}%)`
            }
          }
        }
      }
    });
  } catch(e) {
    console.error("renderSentiment error:", e);
  }
}

/* ─────────────────────────────────────────────────────────────────
   TRENDING VELOCITY TABLE
───────────────────────────────────────────────────────────────── */
window.filterTrendingTime = async function(windowVal) {
  currentTrendingWindow = windowVal;
  document.querySelectorAll(".time-filter-btn").forEach(b => {
    b.classList.toggle("active", b.textContent.trim() === windowVal);
  });

  const tbody = document.getElementById("trendingBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:16px;">Loading trending apps for ${windowVal}…</td></tr>`;

  try {
    const res = await fetch(`${API}/apps?limit=15&sortBy=Installs&sortDir=desc`);
    const data = await res.json();
    const apps = data.apps || [];

    if (!apps.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:16px;">No trending apps found.</td></tr>`;
      return;
    }

    tbody.innerHTML = apps.map((app, idx) => {
      const installs = +app.Installs || 0;
      let tierBadge = `<span class="badge" style="background:rgba(239,68,68,0.15);color:#ef4444;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;">Low (&lt;10K)</span>`;
      if (installs > 1000000) {
        tierBadge = `<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;">High (&gt;1M)</span>`;
      } else if (installs >= 10000) {
        tierBadge = `<span class="badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;">Medium (10K–1M)</span>`;
      }

      return `
        <tr>
          <td><strong style="color:var(--primary)">#${idx + 1}</strong></td>
          <td><strong>${app.App}</strong></td>
          <td><span class="cat-badge" style="font-size:11px;padding:2px 8px;background:rgba(255,255,255,0.06);border-radius:4px;">${(app.Category||"").replace(/_/g," ")}</span></td>
          <td class="td-num">${app.Rating != null ? (+app.Rating).toFixed(1) + " ★" : "—"}</td>
          <td class="td-num"><strong>${fmtNum(app.Installs)}</strong></td>
          <td class="td-right"><span style="color:${app.Type === 'Paid' ? '#f59e0b' : '#10b981'};font-weight:600;">${app.Type || 'Free'}</span></td>
          <td>${tierBadge}</td>
        </tr>
      `;
    }).join("");
  } catch(e) {
    console.error("filterTrendingTime error:", e);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:16px;color:#ef4444;">Error loading trending apps: ${e.message}</td></tr>`;
  }
};

/* ─────────────────────────────────────────────────────────────────
   GLOBAL SEARCH IN NORMAL USER PORTAL
───────────────────────────────────────────────────────────────── */
let searchTimer = null;
const gsInput = document.getElementById("globalSearch");
if (gsInput) {
  gsInput.addEventListener("input", e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      filterTrendingTime(currentTrendingWindow);
    }, 400);
  });
}

document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    const el = document.getElementById("globalSearch");
    if (el) { e.preventDefault(); el.focus(); }
  }
});

/* ─────────────────────────────────────────────────────────────────
   STORE CROSS-TABULATION HEATMAP (SCREENSHOT STYLE & THEME)
───────────────────────────────────────────────────────────────── */
let currentHeatmapDim = "rating";
let heatmapCache = null;
let heatmapShowAll = false;
let heatmapSearchQuery = "";

function getHeatmapPillColor(val, maxVal) {
  if (!val || val <= 0) return null;
  const ratio = val / maxVal;
  if (ratio >= 0.70) return { bg: "#EF4444", fg: "#FFFFFF" }; // Red
  if (ratio >= 0.45) return { bg: "#F97316", fg: "#FFFFFF" }; // Orange
  if (ratio >= 0.25) return { bg: "#EAB308", fg: "#FFFFFF" }; // Amber
  if (ratio >= 0.10) return { bg: "#84CC16", fg: "#FFFFFF" }; // Lime
  return { bg: "#22C55E", fg: "#FFFFFF" }; // Green
}

async function renderHeatmap() {
  const sk = document.getElementById("skHeatmap");
  if (sk) sk.style.display = "none";
  const wrap = document.getElementById("heatmapWrap");
  if (!wrap) return;

  try {
    const res = await fetch(`${API}/charts/category_rating_heatmap?dim_x=${currentHeatmapDim}`);
    const data = await res.json();
    heatmapCache = data;
    renderHeatmapView();
  } catch (e) {
    console.error("renderHeatmap error:", e);
    wrap.innerHTML = `<div style="text-align:center;padding:24px;color:var(--red);">Failed to load heatmap data.</div>`;
  }
}

function renderHeatmapView() {
  const wrap = document.getElementById("heatmapWrap");
  if (!wrap || !heatmapCache || !heatmapCache.categories?.length) return;

  const data = heatmapCache;
  const maxV = data.max_val || Math.max(...data.data.flat(), 1);

  // Filter categories
  let rows = data.categories.map((cat, i) => ({
    category: cat,
    values: data.data[i],
    total: data.row_totals ? data.row_totals[i] : data.data[i].reduce((a, b) => a + b, 0),
    originalIndex: i
  }));

  if (heatmapSearchQuery) {
    rows = rows.filter(r => r.category.toLowerCase().replace(/_/g, " ").includes(heatmapSearchQuery));
  }

  // Sort by total descending
  rows.sort((a, b) => b.total - a.total);

  // Apply limit if not show all
  const displayRows = heatmapShowAll ? rows : rows.slice(0, 12);

  let html = `
    <table class="heatmap-table-modern" aria-label="Store Cross-Tabulation Matrix">
      <thead>
        <tr>
          <th style="text-align:left;padding-left:14px;min-width:140px;">Category</th>
  `;

  // Column headers with count below
  data.buckets.forEach((b, colIdx) => {
    const colCount = data.col_totals ? data.col_totals[colIdx] : "";
    html += `
      <th class="th-heatmap-col">
        <div class="col-name">${b}</div>
        <div class="col-count">${colCount ? fmtNum(colCount) : "—"}</div>
      </th>
    `;
  });

  html += `
          <th class="th-heatmap-total">Total</th>
        </tr>
      </thead>
      <tbody>
  `;

  if (!displayRows.length) {
    html += `<tr><td colspan="${data.buckets.length + 2}" style="text-align:center;padding:24px;color:var(--text-muted);">No categories match search filter.</td></tr>`;
  } else {
    displayRows.forEach(row => {
      const catName = row.category.replace(/_/g, " ");
      html += `<tr>`;
      html += `<td class="td-heatmap-cat" title="${catName}">${catName.length > 22 ? catName.slice(0, 20) + "…" : catName}</td>`;

      row.values.forEach((v, bIdx) => {
        const bucketName = data.buckets[bIdx];
        const color = getHeatmapPillColor(v, maxV);
        if (color) {
          const pct = row.total > 0 ? ((v / row.total) * 100).toFixed(1) : "0";
          html += `
            <td class="td-heatmap-cell">
              <span class="heatmap-pill" 
                    style="background:${color.bg};color:${color.fg};" 
                    onclick="drilldownHeatmapCell('${row.category}', '${bucketName}')" 
                    title="${catName} · ${bucketName}: ${v.toLocaleString()} Apps (${pct}% of category)">
                ${v}
              </span>
            </td>
          `;
        } else {
          html += `<td class="td-heatmap-cell"><span class="heatmap-empty">—</span></td>`;
        }
      });

      html += `<td class="td-heatmap-rowtotal">${fmtNum(row.total)}</td>`;
      html += `</tr>`;
    });
  }

  html += `</tbody></table>`;
  wrap.innerHTML = html;
}

window.switchHeatmapDim = function(dim) {
  currentHeatmapDim = dim;
  document.querySelectorAll(".btn-heatmap-dim").forEach(btn => {
    const idMap = { "rating": "btnDimRating", "content_rating": "btnDimContent", "type": "btnDimType", "popularity": "btnDimPop" };
    btn.classList.toggle("active", btn.id === idMap[dim]);
  });
  renderHeatmap();
};

window.onHeatmapSearch = function(query) {
  heatmapSearchQuery = query.toLowerCase().trim();
  renderHeatmapView();
};

window.toggleHeatmapLimit = function() {
  heatmapShowAll = !heatmapShowAll;
  const btn = document.getElementById("btnHeatmapLimit");
  if (btn) btn.textContent = heatmapShowAll ? "Show Top 12" : "Show All (33)";
  renderHeatmapView();
};

window.drilldownHeatmapCell = async function(category, bucket) {
  const modal = document.getElementById("heatmapDrillModal");
  if (!modal) return;
  modal.style.display = "flex";

  const titleEl = document.getElementById("drillModalTitle");
  const descEl = document.getElementById("drillModalDesc");
  const bodyEl = document.getElementById("drillModalBody");

  if (titleEl) titleEl.textContent = `${category.replace(/_/g, " ")} × ${bucket}`;
  if (descEl) descEl.textContent = `Loading application records for ${category.replace(/_/g, " ")} in tier ${bucket}…`;
  if (bodyEl) bodyEl.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;">Fetching records from warehouse…</td></tr>`;

  try {
    const url = `${API}/charts/heatmap_cell_apps?category=${encodeURIComponent(category)}&bucket=${encodeURIComponent(bucket)}&dim_x=${currentHeatmapDim}`;
    const res = await fetch(url);
    const data = await res.json();

    if (descEl) descEl.textContent = `${data.total_count.toLocaleString()} matching applications in warehouse · Showing top ${data.apps.length} by installs`;

    if (!data.apps.length) {
      bodyEl.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">No matching apps found in this cell.</td></tr>`;
      return;
    }

    bodyEl.innerHTML = data.apps.map(app => `
      <tr>
        <td><strong>${app.App}</strong></td>
        <td><span class="cat-badge">${(app.Category || "").replace(/_/g, " ")}</span></td>
        <td class="td-num">${app.Rating != null ? (+app.Rating).toFixed(1) + " ★" : "—"}</td>
        <td class="td-num"><strong>${fmtNum(app.Installs)}</strong></td>
        <td class="td-num">${fmtNum(app.Reviews)}</td>
        <td class="td-right"><span class="type-badge ${(app.Type || "Free").toLowerCase()}">${app.Type || "Free"}</span></td>
      </tr>
    `).join("");
  } catch (err) {
    if (bodyEl) bodyEl.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--red);">Error loading cell apps: ${err.message}</td></tr>`;
  }
};

window.closeHeatmapDrillModal = function() {
  const modal = document.getElementById("heatmapDrillModal");
  if (modal) modal.style.display = "none";
};

window.exportHeatmapCSV = function() {
  if (!heatmapCache || !heatmapCache.categories) return;
  const d = heatmapCache;
  let csv = "Category," + d.buckets.map(b => `"${b}"`).join(",") + ",Total\n";
  d.categories.forEach((cat, i) => {
    const row = d.data[i];
    const total = d.row_totals ? d.row_totals[i] : row.reduce((a, b) => a + b, 0);
    csv += `"${cat.replace(/_/g, " ")}",` + row.join(",") + `,${total}\n`;
  });
  csv += `"Total",` + (d.col_totals ? d.col_totals.join(",") : "") + `,${d.grand_total || ""}\n`;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `playstore_heatmap_${currentHeatmapDim}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/* ─────────────────────────────────────────────────────────────────
   RENDER ALL CHARTS
───────────────────────────────────────────────────────────────── */
async function renderAllCharts() {
  await Promise.allSettled([
    renderDiscoveryKPIs(),
    renderUpdatedPerMonth(),
    renderFreePaid(),
    renderAppsPerCat(),
    renderInstallsByCat(),
    renderRatingDist(),
    renderSentiment(),
    renderHeatmap(),
    filterTrendingTime(currentTrendingWindow)
  ]);
  const dot = document.getElementById("connDot");
  if (dot) { dot.className = "conn-dot ok"; dot.title = "Connected to PlayStoreIQ Engine"; }
}

/* ─────────────────────────────────────────────────────────────────
   INITIALIZATION
───────────────────────────────────────────────────────────────── */
async function init() {
  const ok = await checkUserAuth();
  if (!ok) return;

  const sun = document.querySelector(".icon-sun");
  const moon = document.querySelector(".icon-moon");
  if (sun && moon) {
    const theme = document.documentElement.getAttribute("data-theme") || "dark";
    if (theme === "dark") {
      sun.classList.remove("hidden");
      moon.classList.add("hidden");
    } else {
      sun.classList.add("hidden");
      moon.classList.remove("hidden");
    }
  }

  await renderAllCharts();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
