/* ═══════════════════════════════════════════════════════════════
   PlayStore Intelligence — app.js
   Professional SaaS BI Dashboard — complete frontend logic
   ═══════════════════════════════════════════════════════════════ */

"use strict";

const API = (window.location.protocol === "file:" || window.location.port === "5500" || window.location.port === "3000")
  ? "http://127.0.0.1:5000/api"
  : "/api";

/* ─────────────────────────────────────────────────────────────────
   DESIGN TOKENS (mirrored from CSS, used for Chart.js)
───────────────────────────────────────────────────────────────── */
const PALETTES = {
  light: {
    bg:        "#F5F7FA",
    surface:   "#FFFFFF",
    border:    "#E5E8EE",
    text:      "#1F2937",
    text2:     "#4B5563",
    muted:     "#9CA3AF",
    primary:   "#2563EB",
    green:     "#10B981",
    amber:     "#F59E0B",
    red:       "#EF4444",
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
  overview:   "Overview",
  categories: "Categories",
  ratings:    "Ratings & Reviews",
  pricing:    "Pricing",
  sentiment:  "Sentiment",
  clusters:   "Clusters & Insights",
  predictor:  "Rating Predictor",
  explorer:   "Data Explorer",
  admin:      "Admin Console & ML Lab"
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
document.getElementById("themeToggle").addEventListener("click", () => {
  const next = isDark() ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  document.querySelector(".icon-sun").classList.toggle("hidden", next === "light");
  document.querySelector(".icon-moon").classList.toggle("hidden", next === "dark");
  setTimeout(() => renderAll(false), 50); // re-render charts with new token colors
});

/* ─────────────────────────────────────────────────────────────────
   SIDEBAR
───────────────────────────────────────────────────────────────── */
const sidebar = document.getElementById("sidebar");
const mainWrapper = document.getElementById("mainWrapper");

document.getElementById("sidebarCollapseBtn").addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
});

document.getElementById("hamburger").addEventListener("click", () => {
  sidebar.classList.toggle("mobile-open");
});

// Nav items highlight on scroll
const sectionIds = ["overview","categories","ratings","pricing","sentiment","clusters","predictor","explorer","admin"];
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const sec = e.target.id.replace("section-", "");
      document.querySelectorAll(".nav-item").forEach(n => {
        n.classList.toggle("active", n.dataset.section === sec);
      });
      document.getElementById("pageTitle").textContent = NAV_TITLES[sec] || "Overview";
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
document.getElementById("globalSearch").addEventListener("input", e => {
  clearTimeout(searchTimer);
  state.search = e.target.value.trim();
  searchTimer = setTimeout(renderAll, 500);
});

// Cmd+K focus shortcut
document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    document.getElementById("globalSearch").focus();
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
  rMin.addEventListener("input", () => {
    updateRatingProgress();
    updateRatingChipLabel();
  });

  let ratingSliderTimer;
  rMin.addEventListener("change", () => {
    clearTimeout(ratingSliderTimer);
    ratingSliderTimer = setTimeout(() => { updateActiveChips(); updateResetBtn(); renderAll(); }, 300);
  });
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
      if (rMin) rMin.value = "1";
      updateRatingProgress(); updateRatingChipLabel();
      updateActiveChips(); updateResetBtn(); renderAll();
    });
  }
  if (state.timeRange === "custom" && state.customStart) {
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
      state.timeRange = "12";
      state.customStart = "";
      state.customEnd = "";
      if (monthSelectEl) monthSelectEl.value = "";
      document.querySelectorAll(".dr-btn").forEach(b => b.classList.toggle("active", b.dataset.val === "12"));
      updateActiveChips(); updateResetBtn(); renderAll();
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
      document.getElementById("globalSearch").value = "";
      updateActiveChips(); updateResetBtn(); renderAll();
    });
  }
}

function updateResetBtn() {
  const hasFilters = state.categories.length || state.freePaid || state.contentRating ||
    state.ratingMin !== "1" || state.ratingMax !== "5" || state.androidVersion || state.search;
  document.getElementById("resetBtn").classList.toggle("hidden", !hasFilters);
}

document.getElementById("resetBtn").addEventListener("click", resetAllFilters);
function resetAllFilters() {
  state = { ...state, categories: [], freePaid: "", contentRating: "", ratingMin: "1", ratingMax: "5", androidVersion: "", search: "", timeRange: "12", customStart: "", customEnd: "" };
  document.getElementById("globalSearch").value = "";
  if (rMin) rMin.value = "1";
  if (monthSelectEl) monthSelectEl.value = "";
  document.querySelectorAll(".dr-btn").forEach(b => b.classList.toggle("active", b.dataset.val === "12"));
  updateRatingProgress();
  updateChipTrigger("catChipTrigger", "Category");
  updateChipTrigger("typeChipTrigger", "Type");
  updateChipTrigger("crChipTrigger", "Content Rating");
  updateChipTrigger("ratingChipTrigger", "Rating");
  updateChipTrigger("avChipTrigger", "Android Ver");
  document.getElementById("catChipTrigger").querySelectorAll("*").forEach(() => {});
  renderCatOptions(allCats);
  buildCROptions(metaData.contentRatings || []);
  buildAVOptions(metaData.androidVersions || []);
  document.querySelectorAll("#typeDropdown .chip-option").forEach(o => o.classList.toggle("selected", o.dataset.val === ""));
  updateActiveChips();
  updateResetBtn();
  // Reset time range to 12M
  state.timeRange = "12";
  document.querySelectorAll(".dr-btn").forEach(b => b.classList.toggle("active", b.dataset.val === "12"));
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

    if (meta.minDate) document.getElementById("dateStart").min = meta.minDate;
    if (meta.maxDate) {
      document.getElementById("dateEnd").max   = meta.maxDate;
      document.getElementById("dateEnd").value  = meta.maxDate;
      document.getElementById("dateStart").value = meta.minDate;
    }

    setConn(true);
  } catch(e) {
    setConn(false);
    console.error("Meta load failed:", e);
  }
}

function setConn(ok) {
  const dot = document.getElementById("connDot");
  dot.className = "conn-dot " + (ok ? "ok" : "err");
  dot.title = ok ? "API connected" : "API disconnected";
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
  charts.freePaid = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Free","Paid"],
      datasets: [{
        data: [data.free, data.paid],
        backgroundColor: [CHART_COLORS[0]+"cc", CHART_COLORS[3]+"cc"],
        borderColor: [CHART_COLORS[0], CHART_COLORS[3]], borderWidth: 2,
        hoverOffset: 6,
      }]
    },
    options: { ...chartDefaults({ scales: {} }), cutout: "68%",
      plugins: { ...chartDefaults().plugins,
        tooltip: { ...chartDefaults().plugins.tooltip,
          callbacks: { label: ctx => ` ${ctx.label}: ${fmtNum(ctx.raw)}` }
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
  charts.contentRating = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: data.map(d => d.contentRating),
      datasets: [{ data: data.map(d => d.count),
        backgroundColor: CHART_COLORS.map(c => c + "cc"),
        borderColor: CHART_COLORS, borderWidth: 2, hoverOffset: 6,
      }]
    },
    options: { ...chartDefaults({ scales: {} }), cutout: "58%",
      plugins: { ...chartDefaults().plugins,
        legend: { ...chartDefaults().plugins.legend, position: "bottom" },
        tooltip: { ...chartDefaults().plugins.tooltip, callbacks: { label: ctx => ` ${ctx.label}: ${fmtNum(ctx.raw)}` } }
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

/* ── Category × Rating Heatmap ── */
async function renderHeatmap() {
  const data = await apiFetch("charts/category_rating_heatmap");
  document.getElementById("skHeatmap").style.display = "none";
  const wrap = document.getElementById("heatmapWrap");
  if (!wrap) return;
  wrap.innerHTML = "";
  if (!data.categories?.length) return;
  const maxV = Math.max(...data.data.flat(), 1);
  const table = document.createElement("table");
  table.className = "heatmap-table";
  const thead = document.createElement("thead");
  thead.innerHTML = `<tr><th class="heatmap-th-row">Category</th>${data.buckets.map(b => `<th>${b}</th>`).join("")}</tr>`;
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  data.categories.forEach((cat, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `<th class="heatmap-th-row">${cat.replace(/_/g," ")}</th>` +
      data.data[i].map(v => {
        const a = v / maxV;
        const bg = `rgba(37,99,235,${(a * 0.85).toFixed(2)})`;
        const fg = a > 0.45 ? "#fff" : "var(--text-muted)";
        return `<td style="background:${bg};color:${fg}">${v || ""}</td>`;
      }).join("");
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
}

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
  document.getElementById("reviewCount").textContent = fmtNum(total);

  // Donut
  destroyChart("sentDonut");
  revealChart("skSentimentDonut", "sentimentDonut");
  const ctx1 = document.getElementById("sentimentDonut").getContext("2d");
  charts.sentDonut = new Chart(ctx1, {
    type: "doughnut",
    data: {
      labels: ["Positive","Negative","Neutral"],
      datasets: [{
        data: [ov.Positive, ov.Negative, ov.Neutral],
        backgroundColor: ["#10B981cc","#EF4444cc","#F59E0Bcc"],
        borderColor: ["#10B981","#EF4444","#F59E0B"], borderWidth: 2, hoverOffset: 6,
      }]
    },
    options: { ...chartDefaults({ scales: {} }), cutout: "65%",
      plugins: { ...chartDefaults().plugins, legend: { display: false } }
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
   CLUSTERING
───────────────────────────────────────────────────────────────── */
async function renderClustering() {
  const data = await apiFetch("mining/clustering");
  destroyChart("cluster");
  revealChart("skCluster", "clusterChart");
  const clusters = [...new Set(data.points.map(p => p.Cluster))].sort();
  const ctx = document.getElementById("clusterChart").getContext("2d");
  charts.cluster = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: clusters.map((cl, i) => ({
        label: `${data.clusterLabels[cl] || "Cluster " + cl}`,
        data: data.points.filter(p => p.Cluster === cl)
                  .map(p => ({ x: +p.Rating, y: Math.log10(+p.Installs + 1), app: p.App, cat: p.Category })),
        backgroundColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length] + "99",
        borderColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length],
        pointRadius: 5, pointHoverRadius: 7,
      }))
    },
    options: { ...chartDefaults(),
      plugins: { ...chartDefaults().plugins,
        tooltip: { ...chartDefaults().plugins.tooltip, callbacks: {
          title: ctx => ctx[0].raw.app || "",
          label: ctx => `Rating: ${ctx.raw.x.toFixed(1)}  |  Installs: ${fmtNum(Math.pow(10, ctx.raw.y))}`
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
  legend.innerHTML = clusters.map((cl, i) => `
    <div class="cluster-item">
      <span class="cluster-dot" style="background:${CLUSTER_COLORS[i % CLUSTER_COLORS.length]}"></span>
      <span>${data.clusterLabels[cl] || "Cluster " + cl}</span>
    </div>`).join("");
}

/* ─────────────────────────────────────────────────────────────────
   INSIGHTS
───────────────────────────────────────────────────────────────── */
async function renderInsights() {
  document.getElementById("refreshInsights").disabled = true;
  const data = await apiFetch("insights");
  const list = document.getElementById("insightsList");
  list.innerHTML = (data.insights || []).map(msg => `
    <div class="insight-item">${msg}</div>`).join("");
  document.getElementById("refreshInsights").disabled = false;
}

document.getElementById("refreshInsights").addEventListener("click", renderInsights);

/* ─────────────────────────────────────────────────────────────────
   ML MODEL
───────────────────────────────────────────────────────────────── */
async function renderMLModel() {
  const data = await apiFetch("mining/ml_model");
  if (data.error) return;
  destroyChart("featureImport");
  revealChart("skML", "featureImportChart");
  const ctx = document.getElementById("featureImportChart").getContext("2d");
  charts.featureImport = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.featureImportance.map(f => f.feature),
      datasets: [{
        label: "Importance",
        data: data.featureImportance.map(f => +(f.importance * 100).toFixed(1)),
        backgroundColor: CHART_COLORS.map(c => c + "cc"),
        borderColor: CHART_COLORS, borderWidth: 1, borderRadius: 4,
      }]
    },
    options: { ...chartDefaults({ indexAxis: "y" }),
      plugins: { ...chartDefaults().plugins, legend: { display: false },
        tooltip: { ...chartDefaults().plugins.tooltip, callbacks: { label: ctx => ` ${ctx.raw.toFixed(1)}%` } }
      },
      scales: { x: { ...chartDefaults().scales?.x, beginAtZero: true }, y: { ...chartDefaults().scales?.y } }
    }
  });

  const badges = document.getElementById("mlBadges");
  badges.classList.remove("hidden");
  badges.innerHTML = `
    <div class="ml-badge">
      <div class="ml-badge-label">Model Accuracy</div>
      <div class="ml-badge-value">${data.accuracy}%</div>
    </div>
    <div class="ml-badge">
      <div class="ml-badge-label">High Rated (≥4.3)</div>
      <div class="ml-badge-value">${data.highRatedPct}%</div>
    </div>`;
}

/* ─────────────────────────────────────────────────────────────────
   ASSOCIATION
───────────────────────────────────────────────────────────────── */
async function renderAssociation() {
  const data = await apiFetch("mining/association");
  const grid = document.getElementById("assocGrid");
  if (!grid) return;
  const typeCfg = {
    paid_category: { label: "Paid Trend",    color: "var(--amber)", bg: "var(--amber-bg)" },
    high_rated:    { label: "High Rated",     color: "var(--green)", bg: "var(--green-bg)" },
    high_installs: { label: "Top Installs",   color: "var(--primary)", bg: "var(--primary-bg)" },
  };
  grid.innerHTML = data.insights.map(ins => {
    const cfg = typeCfg[ins.type] || { label: ins.type, color: "var(--text-2)", bg: "var(--bg)" };
    return `<div class="assoc-card">
      <div class="assoc-type-badge" style="color:${cfg.color}">${cfg.label}</div>
      <div class="assoc-cat">${ins.category.replace(/_/g," ")}</div>
      <div class="assoc-metric">${ins.metric}</div>
      <div class="assoc-detail">${ins.detail}</div>
    </div>`;
  }).join("");
}

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
      renderClustering(),
      renderExplorer(),
    ]);
    setConn(true);
  } catch(e) {
    setConn(false);
    console.error("renderAll error:", e);
  }
}

/* ─────────────────────────────────────────────────────────────────
   PREDICTION FORM
───────────────────────────────────────────────────────────────── */

window.runPrediction = async function() {
  const btn = document.getElementById("predictBtn");
  const res = document.getElementById("predictResult");

  btn.classList.add("loading");
  btn.textContent = "Predicting…";

  const payload = {
    installs:  parseFloat(document.getElementById("pInstalls").value) || 100000,
    reviews:   parseFloat(document.getElementById("pReviews").value)  || 1000,
    size_mb:   parseFloat(document.getElementById("pSize").value)     || 25,
    price:     parseFloat(document.getElementById("pPrice").value)    || 0,
    is_free:   parseInt(document.getElementById("pType").value)       || 1,
    category:  document.getElementById("pCategory").value             || "",
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
    res.classList.remove("hidden");

    const isHigh = data.prediction === 1;
    document.getElementById("prEmoji").textContent   = isHigh ? "⭐" : "📉";
    document.getElementById("prLabel").textContent   = data.label || (isHigh ? "High Rated" : "Needs Improvement");
    document.getElementById("prRating").textContent  = `Est. Rating: ${data.estimatedRating} ★  (Category avg: ${data.categoryAvgRating} ★)`;
    document.getElementById("prConf").innerHTML      = `${data.confidence}%<span>confidence</span>`;
    document.getElementById("prPctHigh").textContent = data.probHighRated + "%";
    document.getElementById("prPctLow").textContent  = data.probLowRated  + "%";

    // Animate bars
    setTimeout(() => {
      const bh = document.getElementById("prBarHigh");
      const bl = document.getElementById("prBarLow");
      if (bh) bh.style.width = data.probHighRated + "%";
      if (bl) bl.style.width = data.probLowRated  + "%";
    }, 100);

    // Similar apps
    const simWrap = document.getElementById("prSimilar");
    if (data.similarApps && data.similarApps.length) {
      simWrap.innerHTML = `
        <div class="pr-similar-title">Similar Real Apps in Dataset</div>
        <div class="pr-similar-list">
          ${data.similarApps.map(a => `
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
    } else {
      simWrap.innerHTML = "";
    }

  } catch(e) {
    alert("Network error: " + e.message);
  } finally {
    btn.classList.remove("loading");
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run Prediction`;
  }
};

/* ─────────────────────────────────────────────────────────────────

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
    if (nameEl) nameEl.textContent = currentUser.name || "Analyst";

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
