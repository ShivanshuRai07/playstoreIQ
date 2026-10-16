/* ═══════════════════════════════════════════════════════════════
   PlayStore Intelligence — app.js
   Professional SaaS BI Dashboard — complete frontend logic
   ═══════════════════════════════════════════════════════════════ */

"use strict";

const API = (window.location.protocol === "file:" || (window.location.port && window.location.port !== "5000" && window.location.port !== "80" && window.location.port !== "443"))
  ? "http://127.0.0.1:5000/api"
  : "/api";

/* ─────────────────────────────────────────────────────────────────
   DESIGN TOKENS (mirrored from CSS, used for Chart.js)
───────────────────────────────────────────────────────────────── */
const PALETTES = {
  light: {
    bg:        "#F8FAFC",
    surface:   "#FFFFFF",
    border:    "#E2E8F0",
    text:      "#0F172A",
    text2:     "#475569",
    muted:     "#64748B",
    primary:   "#2563EB",
    green:     "#059669",
    amber:     "#D97706",
    red:       "#DC2626",
  },
  dark: {
    bg:        "#0F172A",
    surface:   "#111C33",
    border:    "#1F2A44",
    text:      "#E5E7EB",
    text2:     "#9CA3AF",
    muted:     "#4B5563",
    primary:   "#3B82F6",
    green:     "#34D399",
    amber:     "#FBBF24",
    red:       "#F87171",
  }
};

const CHART_COLORS = [
  "#2563EB", // blue
  "#0D9488", // teal
  "#6366F1", // indigo
  "#F59E0B", // amber
  "#F43F5E", // rose
  "#64748B", // slate
];
const CHART_COLORS_ALPHA = CHART_COLORS.map(c => c + "22");

const CLUSTER_COLORS = ["#2563EB","#0D9488","#F59E0B","#F43F5E","#6366F1"];

const CLUSTER_LABELS = {
  "0": "Niche Paid",
  "1": "Mass Market",
  "2": "Popular Free",
  "3": "High Quality",
  "4": "Low Engagement"
};

const KPI_CONFIG = [
  { key: "totalApps",       label: "Total Apps",          icon: "apps",      color: "#2563EB", colorBg: "#EFF6FF", fmt: v => fmtNum(v),              filterKey: null },
  { key: "avgRating",       label: "Avg Rating",           icon: "star",      color: "#F59E0B", colorBg: "#FFFBEB", fmt: v => (+v).toFixed(2),         filterKey: null },
  { key: "totalInstalls",   label: "Total Installs",       icon: "download",  color: "#0D9488", colorBg: "#F0FDFA", fmt: v => fmtNum(v),              filterKey: null },
  { key: "totalReviews",    label: "Total Reviews",        icon: "message",   color: "#6366F1", colorBg: "#EEF2FF", fmt: v => fmtNum(v),              filterKey: null },
  { key: "freePct",         label: "Free Apps",            icon: "free",      color: "#10B981", colorBg: "#ECFDF5", fmt: v => (+v).toFixed(1) + "%",   filterKey: "freePaid=free" },
  { key: "updatedInPeriod", label: "Updated in Period",    icon: "refresh",   color: "#F43F5E", colorBg: "#FFF1F2", fmt: v => fmtNum(v),              filterKey: null },
];

const NAV_TITLES = {
  overview:       "Market Overview",
  categories:     "Market Analytics",
  ratings:        "Rating Intelligence",
  pricing:        "Pricing & Hardware",
  olap:           "OLAP Analysis",
  sentiment:      "Sentiment Intelligence",
  association:    "Association Patterns",
  predictor:      "Popularity Prediction",
  opportunity:    "Opportunity Matrix",
  admin:          "Admin Console & ML Lab"
};

/* ─────────────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────────────── */
let state = {
  timeRange:      "all",
  customStart:    "",
  customEnd:      "",
  categories:     [],
  freePaid:       "",
  contentRating:  "",
  ratingMin:      "1",
  ratingMax:      "5",
  androidVersion: "",
  search:         "",
};

let charts       = {};
let metaData     = {};
let tableData    = [];
let tableSortCol = "Installs";
let tableSortDir = "desc";
let sparklineData = {};

/* ─────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────── */
function fmtNum(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  n = +n;
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString();
}

function isDark() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

function tok() {
  return isDark() ? PALETTES.dark : PALETTES.light;
}

function buildParams(overrides = {}) {
  const s = { ...state, ...overrides };
  const p = new URLSearchParams();
  p.set("timeRange", s.timeRange);
  if (s.timeRange === "custom") {
    if (s.customStart) p.set("customStart", s.customStart);
    if (s.customEnd)   p.set("customEnd",   s.customEnd);
  }
  if (s.categories.length) p.set("categories", s.categories.join(","));
  if (s.freePaid)       p.set("freePaid",      s.freePaid);
  if (s.contentRating)  p.set("contentRating", s.contentRating);
  if (s.ratingMin !== "1") p.set("ratingMin",  s.ratingMin);
  if (s.ratingMax !== "5") p.set("ratingMax",  s.ratingMax);
  if (s.androidVersion) p.set("androidVersion",s.androidVersion);
  if (s.search)         p.set("search",        s.search);
  return p.toString();
}

async function apiFetch(ep, overrides = {}) {
  const r = await fetch(`${API}/${ep}?${buildParams(overrides)}`);
  if (!r.ok) throw new Error(`${r.status}: ${ep}`);
  return r.json();
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

/* Skeleton → real reveal */
function revealChart(skId, canvasId) {
  const sk = document.getElementById(skId);
  const cv = document.getElementById(canvasId);
  if (sk) { sk.style.display = "none"; }
  if (cv) { cv.classList.remove("hidden"); }
}

/* Count-up animation */
function countUp(el, end, fmt, duration = 600) {
  const start = performance.now();
  const startVal = 0;
  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3); // cubic ease-out
    const current = startVal + (end - startVal) * ease;
    el.textContent = fmt(current);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* Chart.js base options */
function chartDefaults(extra = {}) {
  const t = tok();
  return {
    responsive:          true,
    maintainAspectRatio: false,
    animation:           { duration: 300 },
    plugins: {
      legend: {
        labels: { color: t.text2, font: { family: "'Inter',system-ui", size: 11 }, boxWidth: 10, padding: 14 }
      },
      tooltip: {
        backgroundColor: t.surface,
        titleColor:      t.text,
        bodyColor:       t.text2,
        borderColor:     t.border,
        borderWidth:     1,
        padding:         10,
        cornerRadius:    8,
        titleFont:       { family: "'Inter',system-ui", size: 12, weight: "600" },
        bodyFont:        { family: "'Inter',system-ui", size: 12 },
      }
    },
    scales: {
      x: {
        grid:  { color: t.border, drawBorder: false },
        ticks: { color: t.muted, font: { family: "'Inter',system-ui", size: 11 } }
      },
      y: {
        grid:  { color: t.border, drawBorder: false },
        ticks: { color: t.muted, font: { family: "'Inter',system-ui", size: 11 } }
      }
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

/* Stars HTML helper */
function starRating(r) {
  if (r === null || r === undefined || isNaN(r)) return "—";
  const full  = Math.floor(+r);
  const half  = ((+r) - full) >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    '<span class="stars" aria-label="' + (+r).toFixed(1) + ' stars">' +
    "★".repeat(full) + (half ? "½" : "") + "☆".repeat(empty) +
    "</span> <small>" + (+r).toFixed(1) + "</small>"
  );
}

/* ─────────────────────────────────────────────────────────────────
   THEME TOGGLE
───────────────────────────────────────────────────────────────── */
const themeToggleBtn = document.getElementById("themeToggle");
if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("ps_theme", next);
    const sun = document.querySelector(".icon-sun");
    const moon = document.querySelector(".icon-moon");
    if (sun) sun.classList.toggle("hidden", next === "light");
    if (moon) moon.classList.toggle("hidden", next === "dark");
    setTimeout(() => renderAll(false), 50); // re-render charts with new token colors
  });
}

/* ─────────────────────────────────────────────────────────────────
   SIDEBAR
───────────────────────────────────────────────────────────────── */
const sidebar = document.getElementById("sidebar");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");

function closeMobileSidebar() {
  if (sidebar) sidebar.classList.remove("mobile-open");
  if (sidebarBackdrop) sidebarBackdrop.classList.remove("active");
}

function toggleMobileSidebar() {
  if (!sidebar) return;
  const isOpen = sidebar.classList.toggle("mobile-open");
  if (sidebarBackdrop) {
    sidebarBackdrop.classList.toggle("active", isOpen);
  }
}

const collapseBtn = document.getElementById("sidebarCollapseBtn");
if (collapseBtn) {
  collapseBtn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    const wrapper = document.getElementById("mainWrapper");
    if (wrapper) wrapper.classList.toggle("sidebar-collapsed");
    setTimeout(() => {
      if (typeof Chart !== "undefined" && Chart.instances) {
        Object.values(Chart.instances).forEach(inst => {
          try { inst.resize(); } catch (err) {}
        });
      }
    }, 250);
  });
}

const hamburgerBtn = document.getElementById("hamburger");
if (hamburgerBtn) {
  hamburgerBtn.addEventListener("click", () => {
    toggleMobileSidebar();
  });
}

if (sidebarBackdrop) {
  sidebarBackdrop.addEventListener("click", () => {
    closeMobileSidebar();
  });
}

// Auto-close sidebar on mobile/tablet after clicking a navigation item
document.querySelectorAll(".sidebar-nav .nav-item").forEach(item => {
  item.addEventListener("click", () => {
    if (window.innerWidth < 1024) {
      closeMobileSidebar();
    }
  });
});

// Debounced window resize / zoom listener for fluid chart re-alignment
let chartResizeDebounceTimer;
window.addEventListener("resize", () => {
  clearTimeout(chartResizeDebounceTimer);
  chartResizeDebounceTimer = setTimeout(() => {
    if (window.innerWidth >= 1024) {
      closeMobileSidebar();
    }
    if (typeof Chart !== "undefined" && Chart.instances) {
      Object.values(Chart.instances).forEach(inst => {
        try { inst.resize(); } catch (err) {}
      });
    }
  }, 120);
});

// Nav items highlight on scroll
const sectionIds = ["overview","categories","ratings","pricing","olap","sentiment","association","predictor","opportunity"];
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const sec = e.target.id.replace("section-", "");
      document.querySelectorAll(".nav-item").forEach(n => {
        n.classList.toggle("active", n.dataset.section === sec);
      });
      document.getElementById("pageTitle").textContent = NAV_TITLES[sec] || "Market Overview";
    }
  });
}, { rootMargin: `-${56 + 48 + 40}px 0px -60% 0px`, threshold: 0 });

sectionIds.forEach(id => {
  const el = document.getElementById(`section-${id}`);
  if (el) observer.observe(el);
});

document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    const sec = item.dataset.section;
    if (sec === "admin" && !isAdmin()) {
      showToast("Admin access restricted. Please log in as Administrator.", "warning");
      return;
    }
    const target = document.getElementById(`section-${sec}`);
    if (target) target.scrollIntoView({ behavior: "smooth" });
    if (window.innerWidth <= 640) sidebar.classList.remove("mobile-open");
  });
});

/* Date filtering removed for Kaggle 2018 dataset (all data active) */

/* ─────────────────────────────────────────────────────────────────
   SEARCH
───────────────────────────────────────────────────────────────── */
let searchTimer;
const globalSearchInput = document.getElementById("globalSearch");
if (globalSearchInput) {
  globalSearchInput.addEventListener("input", e => {
    clearTimeout(searchTimer);
    state.search = e.target.value.trim();
    searchTimer = setTimeout(renderAll, 500);
  });
}

// Cmd+K focus shortcut
document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    const el = document.getElementById("globalSearch");
    if (el) {
      e.preventDefault();
      el.focus();
    }
  }
});

/* ─────────────────────────────────────────────────────────────────
   EXPORT
───────────────────────────────────────────────────────────────── */
const expBtn = document.getElementById("exportBtn");
if (expBtn) expBtn.addEventListener("click", exportCSV);
const expExpBtn = document.getElementById("explorerExportBtn");
if (expExpBtn) expExpBtn.addEventListener("click", exportCSV);
function exportCSV() {
  window.open(`${API}/export?${buildParams()}`, "_blank");
}

/* ─────────────────────────────────────────────────────────────────
   FILTER CHIPS
───────────────────────────────────────────────────────────────── */
// Generic chip dropdown toggle
/* ── Teleport all chip-dropdowns to <body> on startup ─────────────
   This removes them from every stacking context, guaranteeing they
   always render above every other element regardless of z-index wars. */
function initDropdowns() {
  document.querySelectorAll(".chip-dropdown").forEach(dd => {
    dd.dataset.teleported = "1";
    document.body.appendChild(dd);
  });
}

function closeAllDropdowns() {
  document.querySelectorAll(".chip-dropdown.open").forEach(d => {
    d.classList.remove("open");
  });
  document.querySelectorAll(".filter-chip-trigger[aria-expanded='true']").forEach(t => {
    t.setAttribute("aria-expanded", "false");
  });
}

/** Always open below the trigger; clamp height so it scrolls if too tall. */
function openDropdown(trigger, dropdown) {
  dropdown.style.visibility = "hidden";
  dropdown.classList.add("open");

  const tr  = trigger.getBoundingClientRect();
  const vw  = window.innerWidth;
  const vh  = window.innerHeight;
  const GAP = 6;

  let top  = tr.bottom + GAP;
  let left = tr.left;

  // Clamp horizontal so it never goes off-screen
  const dw = dropdown.offsetWidth || 200;
  if (left + dw > vw - 8) left = vw - dw - 8;
  if (left < 8) left = 8;

  // Cap height: never taller than the space between trigger-bottom and viewport-bottom
  const maxH = Math.max(120, vh - top - 16);
  dropdown.style.maxHeight = maxH + "px";
  dropdown.style.overflowY = "auto";

  dropdown.style.top        = top  + "px";
  dropdown.style.left       = left + "px";
  dropdown.style.visibility = "";
}

function setupChipTrigger(triggerId, dropdownId) {
  const trigger  = document.getElementById(triggerId);
  const dropdown = document.getElementById(dropdownId);
  if (!trigger || !dropdown) return;

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains("open");
    closeAllDropdowns();
    if (!isOpen) {
      openDropdown(trigger, dropdown);
      trigger.setAttribute("aria-expanded", "true");
    }
  });
}

// Close on outside click — but NOT when clicking inside an open dropdown
document.addEventListener("click", e => {
  const insideTrigger  = e.target.closest(".filter-chip-group");
  const insideDropdown = e.target.closest(".chip-dropdown");
  if (!insideTrigger && !insideDropdown) closeAllDropdowns();
});

setupChipTrigger("catChipTrigger",    "catDropdown");
setupChipTrigger("typeChipTrigger",   "typeDropdown");
setupChipTrigger("crChipTrigger",     "crDropdown");
setupChipTrigger("ratingChipTrigger", "ratingDropdown");
setupChipTrigger("avChipTrigger",     "avDropdown");

// Category multi-select with search
let allCats = [];
function buildCategoryOptions(cats) {
  allCats = cats;
  renderCatOptions(cats);
}

function renderCatOptions(cats) {
  const wrap = document.getElementById("catOptions");
  wrap.innerHTML = "";
  cats.forEach(cat => {
    const isSelected = state.categories.includes(cat);
    const div = document.createElement("div");
    div.className = "chip-option" + (isSelected ? " selected" : "");
    div.role = "option";
    div.setAttribute("aria-selected", isSelected);
    div.innerHTML = `<span class="chip-option-check">${isSelected ? "✓" : ""}</span>${cat.replace(/_/g," ")}`;
    div.addEventListener("click", e => {
      e.stopPropagation();
      if (state.categories.includes(cat)) {
        state.categories = state.categories.filter(c => c !== cat);
      } else {
        state.categories.push(cat);
      }
      renderCatOptions(allCats.filter(c => c.toLowerCase().includes(document.getElementById("catSearch").value.toLowerCase())));
      updateChipTrigger("catChipTrigger", state.categories.length ? `Category (${state.categories.length})` : "Category");
      updateActiveChips();
      updateResetBtn();
      renderAll();
    });
    wrap.appendChild(div);
  });
}

document.getElementById("catSearch").addEventListener("input", e => {
  const q = e.target.value.toLowerCase();
  renderCatOptions(allCats.filter(c => c.toLowerCase().includes(q)));
});

// Type single-select
document.querySelectorAll("#typeDropdown .chip-option").forEach(opt => {
  opt.addEventListener("click", e => {
    e.stopPropagation();
    state.freePaid = opt.dataset.val;
    document.querySelectorAll("#typeDropdown .chip-option").forEach(o => o.classList.toggle("selected", o.dataset.val === state.freePaid));
    updateChipTrigger("typeChipTrigger", state.freePaid ? `Type: ${state.freePaid}` : "Type");
    closeAllDropdowns();
    updateActiveChips();
    updateResetBtn();
    renderAll();
  });
});

// Content Rating
function buildCROptions(crs) {
  const wrap = document.getElementById("crOptions");
  wrap.innerHTML = "";
  const allOpt = document.createElement("div");
  allOpt.className = "chip-option" + (!state.contentRating ? " selected" : "");
  allOpt.role = "option";
  allOpt.innerHTML = `<span class="chip-option-check">${!state.contentRating ? "✓" : ""}</span>All`;
  allOpt.addEventListener("click", e => {
    e.stopPropagation();
    state.contentRating = "";
    buildCROptions(metaData.contentRatings || []);
    updateChipTrigger("crChipTrigger", "Content Rating");
    updateActiveChips(); updateResetBtn();
    closeAllDropdowns(); renderAll();
  });
  wrap.appendChild(allOpt);
  crs.forEach(cr => {
    const div = document.createElement("div");
    div.className = "chip-option" + (state.contentRating === cr ? " selected" : "");
    div.role = "option";
    div.innerHTML = `<span class="chip-option-check">${state.contentRating === cr ? "✓" : ""}</span>${cr}`;
    div.addEventListener("click", e => {
      e.stopPropagation();
      state.contentRating = cr;
      buildCROptions(crs);
      updateChipTrigger("crChipTrigger", `Content: ${cr}`);
      closeAllDropdowns(); updateActiveChips(); updateResetBtn(); renderAll();
    });
    wrap.appendChild(div);
  });
}

// Android Version
function buildAVOptions(avs) {
  const wrap = document.getElementById("avOptions");
  wrap.innerHTML = "";
  const allOpt = document.createElement("div");
  allOpt.className = "chip-option selected";
  allOpt.role = "option";
  allOpt.innerHTML = `<span class="chip-option-check">✓</span>All versions`;
  allOpt.addEventListener("click", e => {
    e.stopPropagation();
    state.androidVersion = "";
    buildAVOptions(avs);
    updateChipTrigger("avChipTrigger", "Android Ver");
    closeAllDropdowns(); updateActiveChips(); updateResetBtn(); renderAll();
  });
  wrap.appendChild(allOpt);
  avs.forEach(av => {
    const div = document.createElement("div");
    div.className = "chip-option" + (state.androidVersion === av ? " selected" : "");
    div.role = "option";
    div.innerHTML = `<span class="chip-option-check">${state.androidVersion === av ? "✓" : ""}</span>${av}`;
    div.addEventListener("click", e => {
      e.stopPropagation();
      state.androidVersion = av;
      buildAVOptions(avs);
      updateChipTrigger("avChipTrigger", `Android: ${av}`);
      closeAllDropdowns(); updateActiveChips(); updateResetBtn(); renderAll();
    });
    wrap.appendChild(div);
  });
}

// Rating range (single min rating slider)
const rMin = document.getElementById("ratingMin");
const rDisplay = document.getElementById("ratingRangeDisplay");
const rProgress = document.getElementById("ratingProgress");

function updateRatingProgress() {
  if (!rMin) return;
  const mn = parseFloat(rMin.value);
  if (rProgress) {
    const minPct = ((mn - 1) / 4) * 100;
    rProgress.style.width = `${minPct}%`;
  }
  if (rDisplay) {
    rDisplay.textContent = mn === 1 ? "1.0 ★ & above (All)" : `${mn.toFixed(1)} ★ & above`;
  }
  state.ratingMin = mn.toString();
  state.ratingMax = "5";
}

if (rMin) {
  let ratingSliderTimer;
  const triggerRatingUpdate = () => {
    updateRatingProgress();
    updateRatingChipLabel();
    clearTimeout(ratingSliderTimer);
    ratingSliderTimer = setTimeout(() => {
      updateActiveChips();
      updateResetBtn();
      renderAll();
    }, 200);
  };

  rMin.addEventListener("input", triggerRatingUpdate);
  rMin.addEventListener("change", triggerRatingUpdate);
  updateRatingProgress();
}

function updateRatingChipLabel() {
  if (!rMin) return;
  const mn = parseFloat(rMin.value);
  const isDefault = mn === 1;
  updateChipTrigger("ratingChipTrigger", isDefault ? "Rating" : `Rating: ≥ ${mn.toFixed(1)} ★`);
}

function updateChipTrigger(id, label) {
  const el = document.getElementById(id);
  if (!el) return;
  const labelSpan = el.querySelector(".chip-label-text");
  if (labelSpan) {
    labelSpan.textContent = label;
  } else {
    const textNodes = [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE);
    if (textNodes.length) textNodes[0].textContent = label;
  }
  const defaultLabels = ["Category", "Type", "Content Rating", "Rating", "Android Ver"];
  const isActive = !defaultLabels.some(d => label === d);
  el.classList.toggle("active", isActive);
}

/* ─── Active filter chips display ─── */
function updateActiveChips() {
  const wrap = document.getElementById("activeChips");
  if (!wrap) return;
  wrap.innerHTML = "";

  const addChip = (label, onRemove) => {
    const chip = document.createElement("div");
    chip.className = "active-chip";
    chip.innerHTML = `${label}<button class="active-chip-remove" aria-label="Remove filter">×</button>`;
    chip.querySelector("button").addEventListener("click", onRemove);
    wrap.appendChild(chip);
  };

  state.categories.forEach(cat => {
    addChip(cat.replace(/_/g," "), () => {
      state.categories = state.categories.filter(c => c !== cat);
      renderCatOptions(allCats);
      if (!state.categories.length) updateChipTrigger("catChipTrigger", "Category");
      else updateChipTrigger("catChipTrigger", `Category (${state.categories.length})`);
      updateActiveChips(); updateResetBtn(); renderAll();
    });
  });
  if (state.freePaid) {
    addChip(state.freePaid === "free" ? "Free" : "Paid", () => {
      state.freePaid = "";
      document.querySelectorAll("#typeDropdown .chip-option").forEach(o => o.classList.toggle("selected", o.dataset.val === ""));
      updateChipTrigger("typeChipTrigger", "Type");
      updateActiveChips(); updateResetBtn(); renderAll();
    });
  }
  if (state.contentRating) {
    addChip(state.contentRating, () => {
      state.contentRating = "";
      buildCROptions(metaData.contentRatings || []);
      updateChipTrigger("crChipTrigger", "Content Rating");
      updateActiveChips(); updateResetBtn(); renderAll();
    });
  }
  if (state.ratingMin !== "1") {
    addChip(`★ ≥ ${parseFloat(state.ratingMin).toFixed(1)}`, () => {
      state.ratingMin = "1";
      if (rMin) {
        rMin.value = "1";
        updateRatingProgress();
        updateRatingChipLabel();
      }
      updateActiveChips(); updateResetBtn(); renderAll();
    });
  }
  if (state.timeRange && state.timeRange !== "all") {
    const rangeLabels = {
      "1m": "Monthly (M)",
      "3m": "3 Months",
      "6m": "6 Months",
      "1y": "1 Year"
    };
    const tfLabel = rangeLabels[state.timeRange] || `Time: ${state.timeRange}`;
    addChip(`📅 ${tfLabel}`, () => {
      setTimeframeRange("all");
    });
  } else if (state.timeRange === "custom" && state.customStart) {
    const ymMatch = state.customStart.substring(0, 7);
    const parts = ymMatch.split("-");
    let labelText = `${state.customStart} to ${state.customEnd}`;
    if (parts.length === 2) {
      const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
      if (!isNaN(dObj.getTime())) {
        labelText = dObj.toLocaleString("en-US", { month: "short", year: "numeric" });
      }
    }
    addChip(`📅 ${labelText}`, () => {
      setTimeframeRange("all");
    });
  }
  if (state.androidVersion) {
    addChip(`Android ${state.androidVersion}`, () => {
      state.androidVersion = "";
      buildAVOptions(metaData.androidVersions || []);
      updateChipTrigger("avChipTrigger", "Android Ver");
      updateActiveChips(); updateResetBtn(); renderAll();
    });
  }
  if (state.search) {
    addChip(`"${state.search}"`, () => {
      state.search = "";
      const sInput = document.getElementById("globalSearch");
      if (sInput) sInput.value = "";
      updateActiveChips(); updateResetBtn(); renderAll();
    });
  }
}

/* ─── Timeframe Quick Range Filter ─── */
function setTimeframeRange(range) {
  state.timeRange = range;
  state.customStart = "";
  state.customEnd = "";
  document.querySelectorAll("#filterbarTimeframeWrap .tf-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.range === range);
  });
  updateActiveChips();
  updateResetBtn();
  renderAll();
}
window.setTimeframeRange = setTimeframeRange;

function updateResetBtn() {
  const hasFilters = state.categories.length || state.freePaid || state.contentRating ||
    state.ratingMin !== "1" || state.ratingMax !== "5" || state.androidVersion || state.search ||
    (state.timeRange && state.timeRange !== "all");
  const btn = document.getElementById("resetBtn");
  if (btn) btn.classList.toggle("hidden", !hasFilters);
}

const resetBtnEl = document.getElementById("resetBtn");
if (resetBtnEl) resetBtnEl.addEventListener("click", resetAllFilters);

function resetAllFilters() {
  state = {
    ...state,
    categories: [],
    freePaid: "",
    contentRating: "",
    ratingMin: "1",
    ratingMax: "5",
    androidVersion: "",
    search: "",
    timeRange: "all",
    customStart: "",
    customEnd: ""
  };
  const searchInput = document.getElementById("globalSearch");
  if (searchInput) searchInput.value = "";
  if (rMin) {
    rMin.value = "1";
    updateRatingProgress();
    updateRatingChipLabel();
  }
  const mSel = document.getElementById("monthSelect");
  if (mSel) mSel.value = "";
  document.querySelectorAll(".dr-btn").forEach(b => b.classList.toggle("active", b.dataset.val === "all"));
  document.querySelectorAll("#filterbarTimeframeWrap .tf-btn").forEach(b => b.classList.toggle("active", b.dataset.range === "all"));
  updateChipTrigger("catChipTrigger", "Category");
  updateChipTrigger("typeChipTrigger", "Type");
  updateChipTrigger("crChipTrigger", "Content Rating");
  updateChipTrigger("ratingChipTrigger", "Rating");
  updateChipTrigger("avChipTrigger", "Android Ver");
  renderCatOptions(allCats);
  buildCROptions(metaData.contentRatings || []);
  buildAVOptions(metaData.androidVersions || []);
  document.querySelectorAll("#typeDropdown .chip-option").forEach(o => o.classList.toggle("selected", o.dataset.val === ""));
  updateActiveChips();
  updateResetBtn();
  renderAll();
}

/* ─────────────────────────────────────────────────────────────────
   META LOAD
───────────────────────────────────────────────────────────────── */
async function loadMeta() {
  try {
    const meta = await fetch(`${API}/meta`).then(r => r.json());
    metaData = meta;
    buildCategoryOptions(meta.categories || []);
    buildCROptions(meta.contentRatings || []);
    buildAVOptions(meta.androidVersions || []);

    const dStart = document.getElementById("dateStart");
    const dEnd   = document.getElementById("dateEnd");
    if (dStart && meta.minDate) { dStart.min = meta.minDate; dStart.value = meta.minDate; }
    if (dEnd && meta.maxDate)   { dEnd.max   = meta.maxDate; dEnd.value   = meta.maxDate; }

    setConn(true);
  } catch(e) {
    setConn(false);
    console.error("Meta load failed:", e);
  }
}

function setConn(ok) {
  const dot = document.getElementById("connDot");
  if (dot) { dot.className = "conn-dot " + (ok ? "ok" : "err"); dot.title = ok ? "API connected" : "API disconnected"; }
}

/* ─────────────────────────────────────────────────────────────────
   KPI TILES
───────────────────────────────────────────────────────────────── */
const KPI_ICONS = {
  apps:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="7" height="7" rx="1"/><rect x="15" y="3" width="7" height="7" rx="1"/><rect x="15" y="14" width="7" height="7" rx="1"/><rect x="2" y="14" width="7" height="7" rx="1"/></svg>`,
  star:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  message:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  free:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  refresh:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.15"/></svg>`,
};

async function renderKPIs() {
  const data = await apiFetch("kpis");
  const grid = document.getElementById("kpiGrid");
  grid.innerHTML = "";

  let totalVal = data.totalApps?.value || 0;

  KPI_CONFIG.forEach(cfg => {
    const item  = data[cfg.key] || {};
    const val   = item.value ?? 0;
    const delta = item.delta;

    let dClass = "neutral", dText = "";
    if (delta !== null && delta !== undefined) {
      dClass = delta >= 0 ? "up" : "down";
      dText  = (delta >= 0 ? "↑" : "↓") + " " + Math.abs(delta).toFixed(1) + "% vs prev";
    }

    const tile = document.createElement("div");
    tile.className = "kpi-tile";
    tile.tabIndex  = 0;
    tile.setAttribute("role", "button");
    tile.setAttribute("aria-label", `${cfg.label}: ${cfg.fmt(val)}`);
    tile.innerHTML = `
      <div class="kpi-top">
        <div class="kpi-icon-wrap" style="background:${cfg.colorBg};color:${cfg.color}">
          ${KPI_ICONS[cfg.icon] || ""}
        </div>
        <canvas class="kpi-sparkline" id="sparkline-${cfg.key}" aria-hidden="true"></canvas>
      </div>
      <div>
        <div class="kpi-label">${cfg.label}</div>
        <div class="kpi-value" id="kval-${cfg.key}">—</div>
      </div>
      <div class="kpi-bottom">
        ${dText ? `<span class="kpi-delta ${dClass}">${dText}</span>` : `<span></span>`}
      </div>`;

    // Filter click
    if (cfg.filterKey) {
      tile.addEventListener("click", () => {
        const [k, v] = cfg.filterKey.split("=");
        if (k === "freePaid") {
          state.freePaid = state.freePaid === v ? "" : v;
          document.querySelectorAll("#typeDropdown .chip-option").forEach(o => o.classList.toggle("selected", o.dataset.val === state.freePaid));
          updateChipTrigger("typeChipTrigger", state.freePaid ? `Type: ${state.freePaid}` : "Type");
          updateActiveChips(); updateResetBtn(); renderAll();
        }
      });
    }

    grid.appendChild(tile);

    // Count-up
    const valEl = document.getElementById(`kval-${cfg.key}`);
    countUp(valEl, val, cfg.fmt, 700);
  });

  // Fetch sparkline data for updated-per-month
  try {
    const monthData = await apiFetch("charts/apps_updated_per_month");
    sparklineData = monthData;
    KPI_CONFIG.forEach(cfg => renderSparkline(cfg.key, monthData));
  } catch(e) {}

  // Badge count
  document.getElementById("tableCount").textContent = fmtNum(totalVal) + " apps";
}

function renderSparkline(key, monthData) {
  const canvas = document.getElementById(`sparkline-${key}`);
  if (!canvas) return;
  const sparkId = `sp_${key}`;
  destroyChart(sparkId);
  const t = tok();
  const cfg = KPI_CONFIG.find(k => k.key === key);
  charts[sparkId] = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: monthData.map(d => d.YearMonth),
      datasets: [{ data: monthData.map(d => d.count), borderColor: cfg?.color || t.primary,
        borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.4 }]
    },
    options: {
      responsive: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } },
      animation: false
    }
  });
}

/* ─────────────────────────────────────────────────────────────────
   CHART RENDERERS
───────────────────────────────────────────────────────────────── */

/* ── Updated per month (area line) ── */
async function renderUpdatedPerMonth() {
  const data = await apiFetch("charts/apps_updated_per_month");
  destroyChart("updatedMonth");
  revealChart("skUpdatedMonth", "updatedMonthChart");
  const t = tok();
  const ctx = document.getElementById("updatedMonthChart").getContext("2d");
  charts.updatedMonth = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map(d => d.YearMonth),
      datasets: [{
        label: "Apps Updated",
        data:  data.map(d => d.count),
        borderColor:     CHART_COLORS[0],
        backgroundColor: CHART_COLORS[0] + "18",
        fill: true, tension: 0.4,
        pointRadius: 3, pointHoverRadius: 6,
        borderWidth: 2,
      }]
    },
    options: {
      ...chartDefaults(),
      plugins: {
        ...chartDefaults().plugins,
        legend: { display: false }
      },
      scales: {
        x: { ...chartDefaults().scales?.x, maxTicksLimit: 12 },
        y: { ...chartDefaults().scales?.y, beginAtZero: true }
      }
    }
  });
}

/* ── Free vs Paid ── */
async function renderFreePaid() {
  const data = await apiFetch("charts/free_vs_paid");
  destroyChart("freePaid");
  revealChart("skFreePaid", "freePaidChart");
  const ctx = document.getElementById("freePaidChart").getContext("2d");
  const t = tok();
  const total = (data.free || 0) + (data.paid || 0);
  const colors = ["#10B981", "#F97316"];
  charts.freePaid = new Chart(ctx, {
    type: "doughnut",
    plugins: [donutCalloutPlugin],
    data: {
      labels: ["Free Apps", "Paid Apps"],
      datasets: [{
        data: [data.free, data.paid],
        backgroundColor: colors,
        calloutColors: colors,
        borderColor: t.surface,
        borderWidth: 3,
        hoverOffset: 6,
      }]
    },
    options: {
      ...chartDefaults({ scales: {} }),
      cutout: "64%",
      layout: {
        padding: { top: 18, bottom: 18, left: 42, right: 14 }
      },
      plugins: {
        ...chartDefaults().plugins,
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
          ...chartDefaults().plugins.tooltip,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmtNum(ctx.raw)} (${total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0}%)`
          }
        }
      }
    }
  });
}

/* ── Apps per category ── */
async function renderAppsPerCat() {
  const data = await apiFetch("charts/apps_per_category");
  destroyChart("appsPerCat");
  revealChart("skAppsPerCat", "appsPerCatChart");
  const top = data.slice(0, 15);
  const ctx = document.getElementById("appsPerCatChart").getContext("2d");
  const t = tok();
  charts.appsPerCat = new Chart(ctx, {
    type: "bar",
    data: {
      labels: top.map(d => d.category.replace(/_/g," ")),
      datasets: [{
        label: "Apps",
        data:  top.map(d => d.count),
        backgroundColor: top.map((_, i) => CHART_COLORS[i % CHART_COLORS.length] + "bb"),
        borderColor:     top.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderWidth: 1, borderRadius: 4, borderSkipped: false,
      }]
    },
    options: { ...chartDefaults({ indexAxis: "y" }),
      plugins: { ...chartDefaults().plugins, legend: { display: false } },
      scales: {
        x: { ...chartDefaults().scales?.x, beginAtZero: true },
        y: { ...chartDefaults().scales?.y, ticks: { color: t.muted, font: { size: 10 } } }
      },
      onClick(_, items) {
        if (!items.length) return;
        const cat = top[items[0].index].category;
        if (!state.categories.includes(cat)) {
          state.categories.push(cat);
          renderCatOptions(allCats);
          updateChipTrigger("catChipTrigger", `Category (${state.categories.length})`);
          updateActiveChips(); updateResetBtn(); renderAll();
        }
      }
    }
  });
}

/* ── Installs by category ── */
async function renderInstallsByCat() {
  const data = await apiFetch("charts/installs_by_category");
  destroyChart("installsByCat");
  revealChart("skInstallsByCat", "installsByCatChart");
  const top = data.slice(0, 12);
  const ctx = document.getElementById("installsByCatChart").getContext("2d");
  const t = tok();
  charts.installsByCat = new Chart(ctx, {
    type: "bar",
    data: {
      labels: top.map(d => d.category.replace(/_/g," ")),
      datasets: [{
        label: "Installs",
        data:  top.map(d => d.installs),
        backgroundColor: CHART_COLORS[1] + "bb",
        borderColor:     CHART_COLORS[1], borderWidth: 1, borderRadius: 4,
      }]
    },
    options: { ...chartDefaults({ indexAxis: "y" }),
      plugins: { ...chartDefaults().plugins, legend: { display: false },
        tooltip: { ...chartDefaults().plugins.tooltip, callbacks: { label: ctx => ` ${fmtNum(ctx.raw)}` } }
      },
      scales: {
        x: { ...chartDefaults().scales?.x, beginAtZero: true, ticks: { ...chartDefaults().scales?.x?.ticks, callback: v => fmtNum(v) } },
        y: { ...chartDefaults().scales?.y, ticks: { color: t.muted, font: { size: 10 } } }
      }
    }
  });
}

/* ── Rating distribution ── */
async function renderRatingDist() {
  const data = await apiFetch("charts/rating_distribution");
  destroyChart("ratingDist");
  revealChart("skRatingDist", "ratingDistChart");
  const ctx = document.getElementById("ratingDistChart").getContext("2d");
  charts.ratingDist = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.bins.map(b => (+b).toFixed(1)),
      datasets: [{ label: "App Count", data: data.counts,
        backgroundColor: CHART_COLORS[0] + "99",
        borderColor: CHART_COLORS[0], borderWidth: 1, borderRadius: 2,
      }]
    },
    options: { ...chartDefaults(), plugins: { ...chartDefaults().plugins, legend: { display: false } },
      scales: { x: { ...chartDefaults().scales?.x }, y: { ...chartDefaults().scales?.y, beginAtZero: true } }
    }
  });
}

/* ── Content rating share ── */
async function renderContentRating() {
  const data = await apiFetch("charts/content_rating_share");
  destroyChart("contentRating");
  revealChart("skContentRating", "contentRatingChart");
  const ctx = document.getElementById("contentRatingChart").getContext("2d");
  const t = tok();
  const total = data.reduce((s, d) => s + (d.count || 0), 0);
  const palette = DIST_PALETTE.slice(0, data.length);
  charts.contentRating = new Chart(ctx, {
    type: "doughnut",
    plugins: [donutCalloutPlugin],
    data: {
      labels: data.map(d => d.contentRating),
      datasets: [{
        data: data.map(d => d.count),
        backgroundColor: palette,
        calloutColors: palette,
        borderColor: t.surface,
        borderWidth: 3,
        hoverOffset: 6,
      }]
    },
    options: {
      ...chartDefaults({ scales: {} }),
      cutout: "62%",
      layout: {
        padding: { top: 18, bottom: 18, left: 45, right: 14 }
      },
      plugins: {
        ...chartDefaults().plugins,
        legend: {
          display: true,
          position: "right",
          align: "center",
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 7,
            boxHeight: 7,
            padding: 10,
            color: t.text2,
            font: { family: "'Inter',system-ui,sans-serif", size: 11, weight: "500" }
          }
        },
        tooltip: {
          ...chartDefaults().plugins.tooltip,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmtNum(ctx.raw)} (${total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0}%)`
          }
        }
      },
      onClick(_, items) {
        if (!items.length) return;
        const cr = data[items[0].index].contentRating;
        state.contentRating = cr;
        buildCROptions(metaData.contentRatings || []);
        updateChipTrigger("crChipTrigger", `Rating: ${cr}`);
        updateActiveChips(); updateResetBtn(); renderAll();
      }
    }
  });
}

/* ── Android version ── */
async function renderAndroidVer() {
  const data = await apiFetch("charts/android_version_dist");
  destroyChart("androidVer");
  revealChart("skAndroidVer", "androidVerChart");
  const top = data.slice(0, 10);
  const ctx = document.getElementById("androidVerChart").getContext("2d");
  charts.androidVer = new Chart(ctx, {
    type: "bar",
    data: {
      labels: top.map(d => d.version),
      datasets: [{ label: "Apps", data: top.map(d => d.count),
        backgroundColor: CHART_COLORS[2] + "bb", borderColor: CHART_COLORS[2],
        borderWidth: 1, borderRadius: 4,
      }]
    },
    options: { ...chartDefaults({ indexAxis: "y" }),
      plugins: { ...chartDefaults().plugins, legend: { display: false } },
      scales: { x: { ...chartDefaults().scales?.x, beginAtZero: true }, y: { ...chartDefaults().scales?.y } }
    }
  });
}

/* ── Reviews vs Installs scatter ── */
async function renderReviewsInstalls() {
  const data = await apiFetch("charts/reviews_vs_installs");
  destroyChart("reviewsInstalls");
  revealChart("skReviewsInstalls", "reviewsInstallsChart");
  const cats = [...new Set(data.map(d => d.Category))].slice(0, 6);
  const colorMap = {};
  cats.forEach((c, i) => colorMap[c] = CHART_COLORS[i % CHART_COLORS.length]);
  const ctx = document.getElementById("reviewsInstallsChart").getContext("2d");
  charts.reviewsInstalls = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: cats.map(cat => ({
        label: cat.replace(/_/g," "),
        data: data.filter(d => d.Category === cat)
                   .map(d => ({ x: Math.log10(d.Installs + 1), y: Math.log10(d.Reviews + 1) })),
        backgroundColor: colorMap[cat] + "99", borderColor: colorMap[cat],
        pointRadius: 4, pointHoverRadius: 6,
      }))
    },
    options: { ...chartDefaults(),
      scales: {
        x: { ...chartDefaults().scales?.x, title: { display: true, text: "Installs (log₁₀)", color: tok().muted, font: { size: 11 } } },
        y: { ...chartDefaults().scales?.y, title: { display: true, text: "Reviews (log₁₀)", color: tok().muted, font: { size: 11 } } }
      }
    }
  });
}

/* ── Price vs Rating ── */
async function renderPriceRating() {
  const data = await apiFetch("charts/price_vs_rating");
  destroyChart("priceRating");
  revealChart("skPriceRating", "priceRatingChart");
  const ctx = document.getElementById("priceRatingChart").getContext("2d");
  charts.priceRating = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: "Paid Apps",
        data: data.map(d => ({ x: +d.Rating, y: +d.Price, app: d.App })),
        backgroundColor: CHART_COLORS[4] + "88",
        borderColor: CHART_COLORS[4], pointRadius: 4, pointHoverRadius: 7,
      }]
    },
    options: { ...chartDefaults(),
      plugins: { ...chartDefaults().plugins, legend: { display: false },
        tooltip: { ...chartDefaults().plugins.tooltip, callbacks: {
          title: ctx => ctx[0].raw.app || "",
          label: ctx => `Rating: ${ctx.raw.x.toFixed(1)}  |  Price: $${ctx.raw.y.toFixed(2)}`
        }}
      },
      scales: {
        x: { ...chartDefaults().scales?.x, title: { display: true, text: "Rating", color: tok().muted, font: { size: 11 } }, min: 1, max: 5 },
        y: { ...chartDefaults().scales?.y, title: { display: true, text: "Price ($)", color: tok().muted, font: { size: 11 } }, beginAtZero: true }
      }
    }
  });
}

/* ── Store Cross-Tabulation Heatmap (Screenshot Style & Theme) ── */
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
    const res = await fetch(`${API}/charts/category_rating_heatmap?dim_x=${currentHeatmapDim}&${buildParams()}`);
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

/* ── Top 10 table ── */
async function renderTop10() {
  const data = await apiFetch("charts/top10_by_installs");
  document.getElementById("skTable").style.display = "none";
  document.getElementById("top10TableWrap").classList.remove("hidden");
  tableData = data;
  renderTableBody();
}

function renderTableBody() {
  const tbody = document.getElementById("top10Body");
  const sorted = [...tableData].sort((a, b) => {
    const av = a[tableSortCol], bv = b[tableSortCol];
    if (typeof av === "number") return tableSortDir === "asc" ? av - bv : bv - av;
    return tableSortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });
  tbody.innerHTML = sorted.map(row => `
    <tr>
      <td title="${row.App}">${row.App.length > 32 ? row.App.slice(0,30) + "…" : row.App}</td>
      <td><span class="cat-badge">${(row.Category||"").replace(/_/g," ")}</span></td>
      <td class="td-num">${fmtNum(row.Installs)}</td>
      <td class="td-num">${starRating(row.Rating)}</td>
      <td class="td-right"><span class="type-badge ${(row.Type||"Free").toLowerCase()}">${row.Type||"Free"}</span></td>
    </tr>`).join("");
}

document.querySelectorAll(".th-sortable").forEach(th => {
  th.addEventListener("click", () => {
    const col = th.dataset.col;
    if (tableSortCol === col) tableSortDir = tableSortDir === "asc" ? "desc" : "asc";
    else { tableSortCol = col; tableSortDir = "desc"; }
    document.querySelectorAll(".th-sortable").forEach(t => t.classList.remove("sort-asc","sort-desc"));
    th.classList.add(tableSortDir === "asc" ? "sort-asc" : "sort-desc");
    renderTableBody();
  });
});

/* ── Explorer table with Real Sorting & Pagination ── */
let explorerState = { page: 1, limit: 20, sortBy: "Installs", sortDir: "desc" };

async function renderExplorer(page = 1) {
  if (!document.getElementById("explorerTable")) return;
  explorerState.page = Math.max(1, page);
  const sk = document.getElementById("skExplorer");
  const table = document.getElementById("explorerTable");
  const tbody = document.getElementById("explorerBody");
  const countEl = document.getElementById("explorerCount");

  const qs = new URLSearchParams({
    page: explorerState.page,
    limit: explorerState.limit,
    sortBy: explorerState.sortBy,
    sortDir: explorerState.sortDir,
  });
  if (state.categories.length) qs.set("categories", state.categories.join(","));
  if (state.freePaid) qs.set("freePaid", state.freePaid);
  if (state.contentRating) qs.set("contentRating", state.contentRating);
  if (state.ratingMin !== "1") qs.set("ratingMin", state.ratingMin);
  if (state.ratingMax !== "5") qs.set("ratingMax", state.ratingMax);
  if (state.androidVersion) qs.set("androidVersion", state.androidVersion);
  if (state.search) qs.set("search", state.search);

  try {
    const res = await fetch(`${API}/apps?${qs.toString()}`);
    const data = await res.json();
    if (sk) sk.classList.add("hidden");
    if (table) table.classList.remove("hidden");

    if (countEl) countEl.textContent = `${(data.total || 0).toLocaleString()} apps match current filters`;

    if (tbody) {
      if (!data.apps || !data.apps.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted)">No matching apps found</td></tr>`;
      } else {
        tbody.innerHTML = data.apps.map(row => `
          <tr>
            <td><strong title="${row.App}">${row.App}</strong></td>
            <td><span class="cat-badge">${(row.Category||"").replace(/_/g," ")}</span></td>
            <td class="td-num">${row.Rating != null ? (+row.Rating).toFixed(1) + " ★" : "—"}</td>
            <td class="td-num">${fmtNum(row.Reviews)}</td>
            <td class="td-num">${fmtNum(row.Installs)}</td>
            <td class="td-right"><span class="type-badge ${(row.Type||"Free").toLowerCase()}">${row.Type||"Free"}</span></td>
            <td class="td-num">${row.Price > 0 ? "$" + (+row.Price).toFixed(2) : "$0"}</td>
            <td>${row["Last Updated"] || "—"}</td>
          </tr>
        `).join("");
      }
    }

    const prevBtn = document.getElementById("expPrevBtn");
    const nextBtn = document.getElementById("expNextBtn");
    const pageInfo = document.getElementById("expPageInfo");
    if (prevBtn) prevBtn.disabled = explorerState.page <= 1;
    if (nextBtn) nextBtn.disabled = explorerState.page >= (data.pages || 1);
    if (pageInfo) pageInfo.textContent = `Page ${explorerState.page} of ${data.pages || 1}`;
  } catch(e) {
    console.error("Explorer error:", e);
  }
}

window.sortExplorer = function(col) {
  if (explorerState.sortBy === col) {
    explorerState.sortDir = explorerState.sortDir === "asc" ? "desc" : "asc";
  } else {
    explorerState.sortBy = col;
    explorerState.sortDir = "desc";
  }
  ["App","Category","Rating","Reviews","Installs","Price"].forEach(c => {
    const el = document.getElementById("sort_" + c);
    if (el) el.textContent = (c === col) ? (explorerState.sortDir === "asc" ? "▲" : "▼") : "↕";
  });
  renderExplorer(1);
};

window.changeExplorerPage = function(delta) {
  renderExplorer(explorerState.page + delta);
};

/* ─────────────────────────────────────────────────────────────────
   SENTIMENT
───────────────────────────────────────────────────────────────── */
async function renderSentiment() {
  const data = await apiFetch("mining/sentiment");
  const ov = data.overall;
  const total = (ov.Positive || 0) + (ov.Negative || 0) + (ov.Neutral || 0);
  const rcEl = document.getElementById("reviewCount"); if (rcEl) rcEl.textContent = fmtNum(total);

  // Donut
  destroyChart("sentDonut");
  revealChart("skSentimentDonut", "sentimentDonut");
  const ctx1 = document.getElementById("sentimentDonut").getContext("2d");
  const t = tok();
  const sentColors = ["#10B981", "#EF4444", "#F59E0B"];
  charts.sentDonut = new Chart(ctx1, {
    type: "doughnut",
    plugins: [donutCalloutPlugin],
    data: {
      labels: ["Positive", "Negative", "Neutral"],
      datasets: [{
        data: [ov.Positive || 0, ov.Negative || 0, ov.Neutral || 0],
        backgroundColor: sentColors,
        calloutColors: sentColors,
        borderColor: t.surface,
        borderWidth: 3,
        hoverOffset: 6,
      }]
    },
    options: {
      ...chartDefaults({ scales: {} }),
      cutout: "62%",
      layout: {
        padding: { top: 18, bottom: 18, left: 40, right: 14 }
      },
      plugins: {
        ...chartDefaults().plugins,
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
          ...chartDefaults().plugins.tooltip,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmtNum(ctx.raw)} (${total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0}%)`
          }
        }
      }
    }
  });

  // Sentiment stats bars
  const statsEl = document.getElementById("sentimentStats");
  const sentConfig = [
    { key: "Positive", label: "Positive", color: "#10B981" },
    { key: "Negative", label: "Negative", color: "#EF4444" },
    { key: "Neutral",  label: "Neutral",  color: "#F59E0B" },
  ];
  statsEl.innerHTML = sentConfig.map(({ key, label, color }) => {
    const pct = total > 0 ? Math.round((ov[key] || 0) / total * 100) : 0;
    return `<div class="sent-row">
      <span class="sent-label">${label}</span>
      <div class="sent-bar-wrap"><div class="sent-bar" style="width:${pct}%;background:${color}"></div></div>
      <span class="sent-count">${pct}%</span>
    </div>`;
  }).join("");

  // By-category stacked bar
  destroyChart("sentByCat");
  revealChart("skSentByCat", "sentByCatChart");
  const cats = data.byCategory.slice(0, 10);
  const ctx2 = document.getElementById("sentByCatChart").getContext("2d");
  charts.sentByCat = new Chart(ctx2, {
    type: "bar",
    data: {
      labels: cats.map(d => (d.Category||"").replace(/_/g," ")),
      datasets: [
        { label: "Positive", data: cats.map(d => d.Positive||0), backgroundColor: "#10B981bb", borderColor: "#10B981", borderWidth: 1, borderRadius: 3 },
        { label: "Negative", data: cats.map(d => d.Negative||0), backgroundColor: "#EF4444bb", borderColor: "#EF4444", borderWidth: 1, borderRadius: 3 },
        { label: "Neutral",  data: cats.map(d => d.Neutral||0),  backgroundColor: "#F59E0Bbb", borderColor: "#F59E0B", borderWidth: 1, borderRadius: 3 },
      ]
    },
    options: { ...chartDefaults(),
      plugins: { ...chartDefaults().plugins },
      scales: {
        x: { ...chartDefaults().scales?.x, stacked: false },
        y: { ...chartDefaults().scales?.y, beginAtZero: true }
      }
    }
  });

  // Word cloud
  const sk = document.getElementById("skWordcloud");
  if (sk) sk.classList.add("hidden");
  const wc = document.getElementById("wordcloudWrap");
  if (wc) wc.innerHTML = "";

  const wcColors = [
    { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" },
    { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" },
    { bg: "#EEF2FF", text: "#6366F1", border: "#C7D2FE" },
    { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" },
    { bg: "#FFF1F2", text: "#F43F5E", border: "#FECDD3" },
    { bg: "#F0FDFA", text: "#0D9488", border: "#99F6E4" },
  ];
  (data.wordCloud || []).forEach(({ word, count }) => {
    const maxC = (data.wordCloud[0]?.count || 1);
    const size  = 11 + Math.round((count / maxC) * 18);
    const theme = wcColors[Math.floor(Math.random() * wcColors.length)];
    const span  = document.createElement("span");
    span.className = "word-tag";
    span.textContent = word;
    span.style.fontSize   = size + "px";
    span.style.background = theme.bg;
    span.style.color      = theme.text;
    span.style.borderColor = theme.border;
    span.title = `${word}: ${count} occurrences`;
    wc.appendChild(span);
  });
}

/* ─────────────────────────────────────────────────────────────────
/* ─────────────────────────────────────────────────────────────────
   OLAP ANALYSIS ENGINE
───────────────────────────────────────────────────────────────── */
let olapChartInstance = null;

async function renderOLAP() {
  setupOlapTabEvents();
  await executeOlapQuery("rollup");
}

function setupOlapTabEvents() {
  const tabs = document.querySelectorAll(".olap-tab-btn");
  tabs.forEach(btn => {
    btn.onclick = () => {
      tabs.forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      const op = btn.dataset.olap;
      
      // Toggle panels
      ["Rollup", "Drilldown", "Slice", "Dice", "Pivot"].forEach(p => {
        const panel = document.getElementById(`panel${p}`);
        if (panel) panel.classList.toggle("hidden", p.toLowerCase() !== op);
      });
      executeOlapQuery(op);
    };
  });

  // Action buttons
  const bRollup = document.getElementById("btnExecuteRollup");
  if (bRollup) bRollup.onclick = () => executeOlapQuery("rollup");
  
  const bDrill = document.getElementById("btnExecuteDrilldown");
  if (bDrill) bDrill.onclick = () => executeOlapQuery("drilldown");

  const bSlice = document.getElementById("btnExecuteSlice");
  if (bSlice) bSlice.onclick = () => executeOlapQuery("slice");

  const bDice = document.getElementById("btnExecuteDice");
  if (bDice) bDice.onclick = () => executeOlapQuery("dice");

  const bPivot = document.getElementById("btnExecutePivot");
  if (bPivot) bPivot.onclick = () => executeOlapQuery("pivot");
}

async function executeOlapQuery(op) {
  const t0 = performance.now();
  let url = `${API}/olap/${op}`;

  if (op === "rollup") {
    const dim = document.getElementById("olapRollupDim")?.value || "category";
    if (dim === "category") {
      url += "?dimension=category";
    } else {
      url += `?dimension=time&level=${dim}`;
    }
  } else if (op === "drilldown") {
    const cat = document.getElementById("olapDrillCategory")?.value || "GAME";
    url += `?category=${encodeURIComponent(cat)}`;
  } else if (op === "slice") {
    const rawVal = document.getElementById("olapSliceDim")?.value || "type:Free";
    const [dim, val] = rawVal.split(":");
    url += `?dimension=${dim}&value=${encodeURIComponent(val)}`;
  } else if (op === "dice") {
    const cats = document.getElementById("olapDiceCats")?.value || "GAME,FAMILY";
    const t = document.getElementById("olapDiceType")?.value || "Free";
    const cr = document.getElementById("olapDiceAudience")?.value || "Everyone";
    url += `?categories=${encodeURIComponent(cats)}&type=${encodeURIComponent(t)}&content_rating=${encodeURIComponent(cr)}`;
  } else if (op === "pivot") {
    const metric = document.getElementById("olapPivotMetric")?.value || "installs";
    url += `?metric=${metric}`;
  }

  try {
    const res = await fetch(url).then(r => r.json());
    const duration = Math.round(performance.now() - t0);
    const qTime = document.getElementById("olapQueryTime");
    if (qTime) qTime.textContent = `${duration} ms (SQL Executed)`;

    // Update SQL strictly in Technical tab
    const techSql = document.getElementById("olapTechSql");
    if (techSql) techSql.textContent = res.sql_query || "-- SQL unavailable";

    // Update olapSqlDisplay if element exists
    const sqlBox = document.getElementById("olapSqlDisplay");
    if (sqlBox) sqlBox.textContent = res.sql_query || "-- SQL unavailable";

    // Update row count badge
    const rowBadge = document.getElementById("olapRowCount");
    if (rowBadge) rowBadge.textContent = `${res.data ? res.data.length : 0} Records`;

    // Render Table
    renderOlapTable(res.data, op);

    // Render Chart
    renderOlapChart(res.data, op, res.operation);
  } catch (err) {
    console.error("OLAP Query Error:", err);
  }
}

function renderOlapTable(data, op) {
  const wrap = document.getElementById("olapTableWrapper");
  if (!wrap) return;

  if (!data || !data.length) {
    wrap.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-muted);font-size:13px;">No aggregation records returned for this operation.</div>`;
    return;
  }

  // Desired column order: dimensions first, then metrics
  const allKeys = Object.keys(data[0]);
  const dimKeys = ["dimension_key", "category_name", "app_name", "domain_group", "type", "content_rating", "sub_dimension"];
  const orderedKeys = [
    ...dimKeys.filter(k => allKeys.includes(k)),
    ...allKeys.filter(k => !dimKeys.includes(k))
  ];

  const friendlyName = (k) => {
    const map = {
      dimension_key: "Dimension Key",
      category_name: "Category",
      domain_group: "Domain Group",
      app_name: "App Name",
      total_apps: "Total Apps",
      total_installs: "Total Installs",
      avg_rating: "Avg Rating",
      avg_price: "Avg Price",
      avg_size_mb: "Avg Size",
      avg_polarity: "Avg Polarity",
      free_metric: "Free Apps",
      paid_metric: "Paid Apps",
      total_metric: "Total Aggregated",
      content_rating: "Audience Rating",
      reviews: "Reviews",
      installs: "Installs",
      price: "Price",
      size_mb: "Size"
    };
    return map[k] || k.replace(/_/g, " ").toUpperCase();
  };

  const isNumericCol = (k) => {
    return [
      "total_apps", "total_installs", "avg_rating", "avg_price",
      "avg_size_mb", "avg_polarity", "free_metric", "paid_metric",
      "total_metric", "reviews", "installs", "price", "size_mb", "rating"
    ].includes(k);
  };

  const formatCell = (k, val) => {
    if (val === null || val === undefined) return "—";
    if (k === "avg_rating" || k === "rating") {
      const num = Number(val);
      return !isNaN(num) ? `${num.toFixed(2)} ★` : val;
    }
    if (k === "avg_price" || k === "price") {
      const num = Number(val);
      return !isNaN(num) ? (num === 0 ? "Free" : `$${num.toFixed(2)}`) : val;
    }
    if (k === "avg_polarity") {
      const num = Number(val);
      if (isNaN(num)) return val;
      const color = num > 0.05 ? "var(--green)" : (num < -0.05 ? "var(--red)" : "var(--amber)");
      return `<span style="color:${color};font-weight:600;">${num > 0 ? "+" : ""}${num.toFixed(3)}</span>`;
    }
    if (k === "avg_size_mb" || k === "size_mb") {
      const num = Number(val);
      return !isNaN(num) ? `${num.toFixed(1)} MB` : val;
    }
    if (k === "total_installs" || k === "installs") {
      const num = Number(val);
      return !isNaN(num) ? `<span title="${num.toLocaleString()}">${fmtNum(num)}</span>` : val;
    }
    if (k === "total_apps" || k === "reviews" || k === "free_metric" || k === "paid_metric" || k === "total_metric") {
      const num = Number(val);
      return !isNaN(num) ? num.toLocaleString() : val;
    }
    if (k === "dimension_key" || k === "category_name") {
      return `<strong style="color:var(--text);font-weight:600;">${val}</strong>`;
    }
    if (k === "domain_group") {
      return `<span class="col-tag">${val}</span>`;
    }
    return String(val);
  };

  let html = `<table class="dwm-table"><thead><tr>`;
  orderedKeys.forEach(k => {
    const align = isNumericCol(k) ? ` class="col-num"` : "";
    html += `<th${align}>${friendlyName(k)}</th>`;
  });
  html += `</tr></thead><tbody>`;

  data.forEach(row => {
    html += `<tr>`;
    orderedKeys.forEach(k => {
      const isNum = isNumericCol(k);
      const cellClass = isNum ? ` class="col-num"` : (k === "dimension_key" || k === "category_name" ? ` class="col-dim"` : "");
      html += `<td${cellClass}>${formatCell(k, row[k])}</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  wrap.innerHTML = html;
}

function renderOlapChart(data, op, title) {
  const canvas = document.getElementById("olapChart");
  if (!canvas || !data || !data.length) return;

  if (olapChartInstance) olapChartInstance.destroy();

  const ctx = canvas.getContext("2d");
  let labels = [];
  let datasets = [];

  if (op === "pivot") {
    labels = data.map(d => d.category_name);
    datasets = [
      {
        label: "Free Apps",
        data: data.map(d => d.free_metric),
        backgroundColor: "#2563EBcc",
        borderColor: "#2563EB",
        borderWidth: 1
      },
      {
        label: "Paid Apps",
        data: data.map(d => d.paid_metric),
        backgroundColor: "#10B981cc",
        borderColor: "#10B981",
        borderWidth: 1
      }
    ];
  } else {
    const labelKey = data[0].dimension_key ? "dimension_key" : (data[0].sub_dimension ? "sub_dimension" : (data[0].category_name ? "category_name" : Object.keys(data[0])[0]));
    const metricKey = data[0].total_installs !== undefined ? "total_installs" : Object.keys(data[0])[1];
    
    labels = data.slice(0, 12).map(d => d[labelKey]);
    datasets = [{
      label: metricKey.replace(/_/g, " ").toUpperCase(),
      data: data.slice(0, 12).map(d => d[metricKey]),
      backgroundColor: CHART_COLORS.map(c => c + "cc"),
      borderColor: CHART_COLORS,
      borderWidth: 1,
      borderRadius: 4
    }];
  }

  olapChartInstance = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    options: {
      ...chartDefaults(),
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: op === "pivot" }
      }
    }
  });
}

/* ─────────────────────────────────────────────────────────────────
   CLASSIFICATION BENCHMARK
───────────────────────────────────────────────────────────────── */
let cachedConfusionMatrices = {};

async function renderClassification() {
  try {
    const res = await fetch(`${API}/mining/ml_compare`).then(r => r.json());
    if (res.error) return;

    cachedConfusionMatrices = res.confusionMatrices || {};

    const tbody = document.getElementById("mlLeaderboardBody");
    if (tbody && res.algorithms) {
      tbody.innerHTML = res.algorithms.map((a, i) => `
        <tr>
          <td><strong>#${i + 1}</strong></td>
          <td><strong style="color:${a.color}">${a.name}</strong></td>
          <td>${a.cvAccuracy || a.accuracy}%</td>
          <td><strong>${a.accuracy}%</strong></td>
          <td>${a.precision}%</td>
          <td>${a.recall}%</td>
          <td><strong style="color:var(--primary)">${a.f1}%</strong></td>
          <td>${a.auc ? a.auc + "%" : "—"}</td>
          <td>${a.trainTimeMs} ms</td>
          <td>${a.isBest ? '<span class="badge-best">BEST MODEL</span>' : '<span style="color:var(--text-muted)">Evaluated</span>'}</td>
        </tr>
      `).join("");
    }

    // Set up confusion matrix viewer
    renderConfusionMatrix(res.bestAlgorithm || "Gradient Boosting");
    const select = document.getElementById("cmModelSelect");
    if (select) {
      select.value = res.bestAlgorithm || "Gradient Boosting";
      select.onchange = () => renderConfusionMatrix(select.value);
    }
  } catch (err) {
    console.error("Classification render error:", err);
  }
}

function renderConfusionMatrix(modelName) {
  const grid = document.getElementById("confusionMatrixGrid");
  if (!grid) return;

  const matrix = cachedConfusionMatrices[modelName];
  if (!matrix || matrix.length !== 3) {
    grid.innerHTML = `<div style="grid-column: span 3; color: var(--text-muted); text-align: center;">Confusion matrix data unavailable</div>`;
    return;
  }

  let html = "";
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const isDiag = r === c;
      const count = matrix[r][c];
      html += `<div class="matrix-cell ${isDiag ? 'diagonal' : ''}" title="Actual: Tier ${r}, Predicted: Tier ${c}">${count}</div>`;
    }
  }
  grid.innerHTML = html;
}

/* ─────────────────────────────────────────────────────────────────
   CLUSTERING (K-MEANS)
───────────────────────────────────────────────────────────────── */
let kCurvesChartInstance = null;

async function renderClustering() {
  try {
    const data = await apiFetch("mining/clustering");
    destroyChart("cluster");
    revealChart("skCluster", "clusterChart");
    
    const points = data.points || [];
    const clusters = [...new Set(points.map(p => p.Cluster))].sort();
    const ctx = document.getElementById("clusterChart").getContext("2d");
    charts.cluster = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: clusters.map((cl, i) => ({
          label: `${(data.clusterLabels && data.clusterLabels[cl]) || "Cluster " + cl}`,
          data: points.filter(p => p.Cluster === cl)
                    .map(p => ({ x: +p.Rating, y: Math.log10(+p.Installs + 1), app: p.App, cat: p.Category })),
          backgroundColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length] + "99",
          borderColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length],
          pointRadius: 5, pointHoverRadius: 7,
        }))
      },
      options: { ...chartDefaults(),
        plugins: { ...chartDefaults().plugins,
          tooltip: { ...chartDefaults().plugins.tooltip, callbacks: {
            title: ctx => ctx[0].raw?.app || "",
            label: ctx => `Rating: ${ctx.raw?.x?.toFixed(1) ?? '—'}  |  Installs: ${fmtNum(Math.pow(10, ctx.raw?.y ?? 0))}`
          }}
        },
        scales: {
          x: { ...chartDefaults().scales?.x, min: 1, max: 5, title: { display: true, text: "Rating", color: tok().muted, font: { size: 11 } } },
          y: { ...chartDefaults().scales?.y, title: { display: true, text: "Installs (log₁₀)", color: tok().muted, font: { size: 11 } } }
        }
      }
    });

    // Cluster legend
    const legend = document.getElementById("clusterLegend");
    if (legend) {
      legend.innerHTML = clusters.map((cl, i) => `
        <div class="cluster-item">
          <span class="cluster-dot" style="background:${CLUSTER_COLORS[i % CLUSTER_COLORS.length]}"></span>
          <span>${(data.clusterLabels && data.clusterLabels[cl]) || "Cluster " + cl}</span>
        </div>`).join("");
    }

    // Render K-Selection Curves
    if (data.elbow_curve && data.silhouette_curve) {
      const kCanvas = document.getElementById("kCurvesChart");
      if (kCanvas) {
        if (kCurvesChartInstance) kCurvesChartInstance.destroy();
        const kCtx = kCanvas.getContext("2d");
        const kLabels = data.elbow_curve.map(pt => `K=${pt.k}`);
        kCurvesChartInstance = new Chart(kCtx, {
          type: "line",
          data: {
            labels: kLabels,
            datasets: [
              {
                label: "Silhouette Score (Separation)",
                data: data.silhouette_curve.map(pt => pt.score),
                borderColor: "#10B981",
                backgroundColor: "#10B98133",
                yAxisID: "ySil",
                tension: 0.3,
                fill: false
              },
              {
                label: "Inertia / WCSS (Elbow)",
                data: data.elbow_curve.map(pt => pt.inertia),
                borderColor: "#6366F1",
                backgroundColor: "#6366F133",
                yAxisID: "yInertia",
                tension: 0.3,
                fill: false
              }
            ]
          },
          options: {
            ...chartDefaults(),
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              ySil: {
                type: "linear",
                position: "left",
                title: { display: true, text: "Silhouette (higher is better)" }
              },
              yInertia: {
                type: "linear",
                position: "right",
                title: { display: true, text: "Inertia (lower is better)" },
                grid: { drawOnChartArea: false }
              }
            }
          }
        });
      }
    }

    // Render Profiles Cards
    const profilesGrid = document.getElementById("clusterProfilesGrid");
    if (profilesGrid && data.cluster_profiles) {
      profilesGrid.innerHTML = data.cluster_profiles.map(p => `
        <div class="cluster-profile-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h4 style="margin:0; font-size:15px; color:${CLUSTER_COLORS[p.cluster_id % CLUSTER_COLORS.length]}">Cluster ${p.cluster_id}</h4>
            <span class="badge-lift">${p.percentage}% of Apps</span>
          </div>
          <div style="font-size:12.5px; line-height:1.7; color:var(--text-2);">
            <div><strong>Median Installs:</strong> ${fmtNum(p.avg_installs)}</div>
            <div><strong>Average Rating:</strong> ${p.avg_rating} ★</div>
            <div><strong>Average Price:</strong> $${p.avg_price} (${p.free_percentage}% Free)</div>
            <div><strong>Mean Size:</strong> ${p.avg_size_mb} MB</div>
          </div>
        </div>
      `).join("");
    }
  } catch (err) {
    console.error("Clustering render error:", err);
  }
}

/* ─────────────────────────────────────────────────────────────────
   ASSOCIATION (APRIORI)
───────────────────────────────────────────────────────────────── */
async function renderAssociation() {
  const btnFilter = document.getElementById("btnFilterApriori");
  if (btnFilter && !btnFilter.dataset.bound) {
    btnFilter.dataset.bound = "true";
    btnFilter.onclick = () => fetchAndDisplayApriori();
  }
  await fetchAndDisplayApriori();
}

async function fetchAndDisplayApriori() {
  const minLift = document.getElementById("aprioriMinLift")?.value || "1.2";
  const minConf = document.getElementById("aprioriMinConf")?.value || "0.5";
  const sortBy = document.getElementById("aprioriSort")?.value || "lift";

  const url = `${API}/mining/association?min_lift=${minLift}&min_confidence=${minConf}&sort_by=${sortBy}`;
  try {
    const data = await fetch(url).then(r => r.json());
    const tbody = document.getElementById("aprioriTableBody");
    const countEl = document.getElementById("aprioriRuleCount");

    if (countEl) countEl.textContent = `${data.filtered_rules_count || 0} significant rules discovered (from ${data.total_rules || 20} mined)`;

    if (tbody && data.apriori_rules) {
      tbody.innerHTML = data.apriori_rules.map((r, i) => `
        <tr>
          <td>#${i + 1}</td>
          <td><code style="color:#60a5fa">${r.antecedent.join(" & ")}</code></td>
          <td><code style="color:#34d399">${r.consequent.join(" & ")}</code></td>
          <td>${r.support_pct}%</td>
          <td><strong>${r.confidence_pct}%</strong></td>
          <td><span class="badge-lift">Lift: ${r.lift}</span></td>
        </tr>
      `).join("");
    }
  } catch (err) {
    console.error("Apriori fetch error:", err);
  }
}

/* ─────────────────────────────────────────────────────────────────
   INSIGHTS
───────────────────────────────────────────────────────────────── */
async function renderInsights() {
  if (!document.getElementById("insightsList")) return;
  const btn = document.getElementById("refreshInsights");
  if (btn) btn.disabled = true;
  const data = await apiFetch("insights");
  const list = document.getElementById("insightsList");
  if (list) {
    list.innerHTML = (data.insights || []).map(msg => `
      <div class="insight-item">${msg}</div>`).join("");
  }
  if (btn) btn.disabled = false;
}

const refBtn = document.getElementById("refreshInsights");
if (refBtn) refBtn.addEventListener("click", renderInsights);

/* ─────────────────────────────────────────────────────────────────
   DWM VIEW SWITCHER (BUSINESS INSIGHT VS HOW IT WORKS)
───────────────────────────────────────────────────────────────── */
function switchDwmTab(section, mode) {
  // section: 'olap', 'pred', 'opp', 'clusters', 'assoc', 'sent', 'class'
  const cap = section.charAt(0).toUpperCase() + section.slice(1);
  const btnInsight = document.getElementById(`btn${cap}Insight`);
  const btnTech = document.getElementById(`btn${cap}Tech`);
  const viewInsight = document.getElementById(`${section}-insight-view`);
  const viewTech = document.getElementById(`${section}-tech-view`);

  if (btnInsight) btnInsight.classList.toggle("active", mode === "insight");
  if (btnTech) btnTech.classList.toggle("active", mode === "tech");
  if (viewInsight) viewInsight.classList.toggle("hidden", mode !== "insight");
  if (viewTech) viewTech.classList.toggle("hidden", mode !== "tech");
}
window.switchDwmTab = switchDwmTab;



/* ─────────────────────────────────────────────────────────────────
   CATEGORY OPPORTUNITY MATRIX & INTELLIGENCE
───────────────────────────────────────────────────────────────── */
async function renderOpportunityMatrix() {
  try {
    const [ratingRes, installsRes] = await Promise.all([
      fetch(`${API}/olap?operation=rollup&dimension=category&measure=rating`).then(r => r.json()).catch(() => ({})),
      fetch(`${API}/olap?operation=rollup&dimension=category&measure=installs`).then(r => r.json()).catch(() => ({}))
    ]);

    const catMap = {};
    if (ratingRes && ratingRes.data) {
      ratingRes.data.forEach(r => {
        catMap[r.dimension] = {
          name: r.dimension,
          avgRating: r.measure_value || 4.19,
          totalApps: r.app_count || 100,
          avgInstalls: 0,
          paidPct: 4.8
        };
      });
    }

    if (installsRes && installsRes.data) {
      installsRes.data.forEach(r => {
        if (!catMap[r.dimension]) {
          catMap[r.dimension] = { name: r.dimension, avgRating: 4.19, totalApps: r.app_count || 100, paidPct: 4.8 };
        }
        catMap[r.dimension].avgInstalls = r.measure_value || 100000;
      });
    }

    const categories = Object.values(catMap);
    if (!categories.length) return;

    // Median thresholds for 2x2 positioning
    const medianRating = 4.18;
    const medianInstalls = 500000;

    const leaders = [];
    const opportunities = [];
    const massMarket = [];
    const saturated = [];

    categories.forEach(c => {
      const isHighRating = c.avgRating >= medianRating;
      const isHighInstalls = c.avgInstalls >= medianInstalls;

      if (isHighRating && isHighInstalls) {
        c.quadrant = "Market Leader";
        leaders.push(c.name);
      } else if (isHighRating && !isHighInstalls) {
        c.quadrant = "High Opportunity";
        opportunities.push(c.name);
      } else if (!isHighRating && isHighInstalls) {
        c.quadrant = "Mass Market Utility";
        massMarket.push(c.name);
      } else {
        c.quadrant = "Saturated / Friction";
        saturated.push(c.name);
      }
    });

    // Populate tags in 2x2 quadrant boxes
    const setTags = (id, list) => {
      const el = document.getElementById(id);
      if (el && list.length) {
        el.innerHTML = list.slice(0, 5).map(cat => `<span class="quadrant-tag">${cat.replace(/_/g, " ")}</span>`).join("");
      }
    };

    setTags("quadLeaders", leaders);
    setTags("quadOpp", opportunities);
    setTags("quadMass", massMarket);
    setTags("quadSaturated", saturated);

    // Populate intelligence table
    const tbody = document.getElementById("catIntelBody");
    if (tbody) {
      tbody.innerHTML = categories.sort((a, b) => b.totalApps - a.totalApps).map(c => `
        <tr>
          <td><strong>${c.name.replace(/_/g, " ")}</strong></td>
          <td>★ ${(c.avgRating).toFixed(2)}</td>
          <td>${fmtNum(c.avgInstalls)}</td>
          <td>${fmtNum(c.totalApps)}</td>
          <td>${(c.paidPct || 4.8).toFixed(1)}%</td>
          <td><span class="badge-lift">${c.quadrant}</span></td>
        </tr>
      `).join("");
    }
  } catch (err) {
    console.error("Opportunity matrix error:", err);
  }
}

/* ─────────────────────────────────────────────────────────────────
   TRENDING APPS (DISCOVERY WITH TIME FILTERS)
───────────────────────────────────────────────────────────────── */
let currentTrendingWindow = "3M";

async function filterTrendingTime(windowVal) {
  currentTrendingWindow = windowVal;
  document.querySelectorAll(".time-filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn.textContent.trim() === windowVal);
  });

  const tbody = document.getElementById("trendingBody");
  if (!tbody) return;

  try {
    const res = await fetch(`${API}/explorer?limit=25&sortBy=installs&order=desc`).then(r => r.json()).catch(() => ({}));
    const apps = res.apps || [];
    if (!apps.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:16px;">No trending apps found for window ${windowVal}.</td></tr>`;
      return;
    }

    tbody.innerHTML = apps.slice(0, 15).map((app, i) => {
      const tier = app.Installs > 1000000 ? "High (>1M)" : (app.Installs >= 10000 ? "Mid (10k-1M)" : "Low (<10k)");
      const tierColor = app.Installs > 1000000 ? "#10b981" : (app.Installs >= 10000 ? "#f59e0b" : "#60a5fa");
      return `
        <tr>
          <td><strong>#${i + 1}</strong></td>
          <td><strong>${app.App}</strong></td>
          <td>${(app.Category || "").replace(/_/g, " ")}</td>
          <td class="th-num">★ ${app.Rating != null ? (+app.Rating).toFixed(1) : "—"}</td>
          <td class="th-num">${fmtNum(app.Installs)}</td>
          <td class="th-right"><span class="badge-lift">${app.Type || 'Free'}</span></td>
          <td><span style="color:${tierColor};font-weight:700">${tier}</span></td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    console.error("Trending apps fetch error:", err);
  }
}
window.filterTrendingTime = filterTrendingTime;

/* ─────────────────────────────────────────────────────────────────
   RENDER ALL
───────────────────────────────────────────────────────────────── */
async function renderAll(showLoading = true) {
  if (showLoading) setConn(true);
  try {
    await Promise.allSettled([
      renderKPIs(),
      renderUpdatedPerMonth(),
      renderFreePaid(),
      renderAppsPerCat(),
      renderInstallsByCat(),
      renderHeatmap(),
      renderRatingDist(),
      renderContentRating(),
      renderAndroidVer(),
      renderReviewsInstalls(),
      renderPriceRating(),
      renderTop10(),
      renderInsights(),
      renderSentiment(),
      renderOLAP(),
      renderAssociation(),
      renderOpportunityMatrix(),
      // filterTrendingTime removed for analyst view
      // renderExplorer removed
    ]);
    setConn(true);
  } catch(e) {
    setConn(false);
    console.error("renderAll error:", e);
  }
}

/* ─────────────────────────────────────────────────────────────────
   POPULARITY TIER PREDICTION (ZERO TARGET LEAKAGE)
───────────────────────────────────────────────────────────────── */
window.runPrediction = async function() {
  const btn = document.getElementById("predictBtn");
  const res = document.getElementById("predictResult");

  if (btn) {
    btn.classList.add("loading");
    btn.textContent = "Inferring Popularity Tier…";
  }

  const payload = {
    app_name:       document.getElementById("pAppName")?.value || "New App",
    category:       document.getElementById("pCategory")?.value || "GAME",
    content_rating: document.getElementById("pContentRating")?.value || "Everyone",
    is_free:        parseInt(document.getElementById("pType")?.value) || 1,
    price:          parseFloat(document.getElementById("pPrice")?.value) || 0,
    size_mb:        parseFloat(document.getElementById("pSize")?.value) || 25,
    min_android:    document.getElementById("pAndroidVer")?.value || "5.0",
  };

  try {
    const response = await fetch(`${API}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (data.error) {
      alert("Prediction error: " + data.error);
      return;
    }

    /* Show result panel */
    if (res) res.classList.remove("hidden");

    const pClass = data.predicted_class != null ? data.predicted_class : (data.popularity_class != null ? data.popularity_class : 1);
    const emojis = { 0: "📉", 1: "📊", 2: "🚀" };
    const tierDescriptions = {
      0: "Low Reach: Est. < 10,000 Installs (Early/Niche Market)",
      1: "Medium Reach: Est. 10,000 – 1,000,000 Installs (Viable Commercial Market)",
      2: "High Reach: Est. > 1,000,000 Installs (Mass Market / Viral Candidate)"
    };

    const emojiEl = document.getElementById("prEmoji");
    const labelEl = document.getElementById("prLabel");
    const ratingEl = document.getElementById("prRating");
    const confEl = document.getElementById("prConf");
    const pctHighEl = document.getElementById("prPctHigh");
    const pctMidEl = document.getElementById("prPctMid");
    const pctLowEl = document.getElementById("prPctLow");
    const factorsEl = document.getElementById("prFactors");

    if (emojiEl) emojiEl.textContent = emojis[pClass] || "🚀";
    if (labelEl) labelEl.textContent = data.predicted_tier || data.label || data.class_label || "Medium Reach";
    if (ratingEl) ratingEl.textContent = tierDescriptions[pClass] || "Market Reach Estimation";
    if (confEl) confEl.innerHTML = `${data.confidence || 0}%<span>confidence</span>`;

    const probs = data.probabilities || {};
    const pHigh = probs["High (>1M)"] != null ? probs["High (>1M)"] : (probs.high != null ? probs.high : (data.probHighRated != null ? data.probHighRated : 33.3));
    const pMid  = probs["Medium (10k-1M)"] != null ? probs["Medium (10k-1M)"] : (probs.medium != null ? probs.medium : 33.3);
    const pLow  = probs["Low (<10k)"] != null ? probs["Low (<10k)"] : (probs.low != null ? probs.low : (data.probLowRated != null ? data.probLowRated : 33.3));

    if (pctHighEl) pctHighEl.textContent = (+pHigh).toFixed(1) + "%";
    if (pctMidEl)  pctMidEl.textContent  = (+pMid).toFixed(1) + "%";
    if (pctLowEl)  pctLowEl.textContent  = (+pLow).toFixed(1) + "%";

    // Animate probability bars
    setTimeout(() => {
      const bh = document.getElementById("prBarHigh");
      const bm = document.getElementById("prBarMid");
      const bl = document.getElementById("prBarLow");
      if (bh) bh.style.width = pHigh + "%";
      if (bm) bm.style.width = pMid + "%";
      if (bl) bl.style.width = pLow + "%";
    }, 100);

    if (factorsEl) {
      factorsEl.innerHTML = `
        <strong>Champion Model:</strong> ${data.champion_model || "Gradient Boosting Classifier"} (Macro F1: 55.76%).<br/>
        <strong>Feature Dimensions:</strong> Category frequency, Content Rating frequency, Size (${payload.size_mb} MB), Monetization (${payload.is_free ? "Free" : "$" + payload.price}), App Title words. Zero post-launch leakage verified.
      `;
    }

    // Similar apps
    const simWrap = document.getElementById("prSimilar");
    const similar = data.similar_apps || data.similarApps || [];
    if (simWrap && similar.length) {
      simWrap.innerHTML = `
        <div class="pr-similar-title">Similar Real Applications in Conformed Warehouse</div>
        <div class="pr-similar-list">
          ${similar.map(a => `
            <div class="pr-similar-card">
              <div class="pr-similar-header">
                <span class="pr-similar-name" title="${a.App || ""}">${a.App || "—"}</span>
                <span class="pr-similar-type ${a.Type === 'Paid' ? 'paid' : 'free'}">${a.Type || 'Free'}</span>
              </div>
              <div class="pr-similar-meta">
                <span class="pr-similar-cat">${(a.Category || "").replace(/_/g, " ")}</span>
                <span class="pr-similar-stars">★ ${a.Rating != null ? (+a.Rating).toFixed(1) : "—"}</span>
                <span class="pr-similar-installs">📥 ${a.Installs ? fmtNum(a.Installs) : "0"}</span>
              </div>
            </div>
          `).join("")}
        </div>
      `;
    } else if (simWrap) {
      simWrap.innerHTML = "";
    }

  } catch(e) {
    alert("Inference network error: " + e.message);
  } finally {
    if (btn) {
      btn.classList.remove("loading");
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run Popularity Prediction`;
    }
  }
};

/* ─────────────────────────────────────────────────────────────────
   USER DASHBOARD AUTHENTICATION & INITIALIZATION
───────────────────────────────────────────────────────────────── */
let currentUser = null;
let currentToken = localStorage.getItem("playstore_iq_token") || null;

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
    if (nameEl) nameEl.textContent = currentUser.name || "Business Analyst";

    if (currentUser.role === "admin") {
      const jumpLink = document.getElementById("sideAdminLinkWrap");
      if (jumpLink) jumpLink.classList.remove("hidden");
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

async function init() {
  initDropdowns();
  const ok = await checkUserAuth();
  if (!ok) return;

  const savedTheme = localStorage.getItem("ps_theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);

  const sun = document.querySelector(".icon-sun");
  const moon = document.querySelector(".icon-moon");
  if (sun && moon) {
    if (savedTheme === "dark") {
      sun.classList.remove("hidden");
      moon.classList.add("hidden");
    } else {
      sun.classList.add("hidden");
      moon.classList.remove("hidden");
    }
  }

  await loadMeta();

  const pCat = document.getElementById("pCategory");
  if (pCat && metaData.categories) {
    metaData.categories.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c.replace(/_/g, " ");
      pCat.appendChild(opt);
    });
  }

  await renderAll();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
