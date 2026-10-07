/* ═══════════════════════════════════════════════════════════════
   PlayStoreIQ — Administrator Console & ML Lab (admin.js)
   Dedicated logic for administrator operations:
   - Strict Admin Authentication Guard
   - Multi-Model ML Benchmarking & Retraining
   - Live Dataset In-Place Record Editor (CRUD)
   - Real-time System Telemetry & Diagnostics
   - User Management & RBAC Permissions
   - CSV Dataset Replacement & Export
   ═══════════════════════════════════════════════════════════════ */

"use strict";

const API = (window.location.protocol === "file:" || window.location.port === "5500" || window.location.port === "3000")
  ? "http://127.0.0.1:5000/api"
  : "/api";

/* ─────────────────────────────────────────────────────────────────
   PALETTES & THEME
───────────────────────────────────────────────────────────────── */
const PALETTES = {
  light: {
    bg:      "#F5F7FA",
    surface: "#FFFFFF",
    border:  "#E5E8EE",
    text:    "#1F2937",
    text2:   "#4B5563",
    muted:   "#9CA3AF",
    primary: "#2563EB",
    green:   "#10B981",
    amber:   "#F59E0B",
    red:     "#EF4444",
  },
  dark: {
    bg:      "#0F172A",
    surface: "#111C33",
    border:  "#1F2A44",
    text:    "#E5E7EB",
    text2:   "#9CA3AF",
    muted:   "#4B5563",
    primary: "#3B82F6",
    green:   "#34D399",
    amber:   "#FBBF24",
    red:     "#F87171",
  }
};

const ALGO_COLORS = {
  "Random Forest":       "#6366f1",
  "Gradient Boosting":   "#f59e0b",
  "Logistic Regression": "#10b981",
  "Decision Tree":       "#3b82f6",
  "KNN":                 "#ec4899",
  "Naive Bayes":         "#8b5cf6",
};

function isDark() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

function tok() {
  return isDark() ? PALETTES.dark : PALETTES.light;
}

function fmtNum(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  n = +n;
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString();
}

/* ─────────────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────────────── */
let currentToken = localStorage.getItem("playstore_iq_token") || null;
let currentUser = null;
let charts = {};
let selectedUploadFile = null;

// Dataset Editor state
let dsState = { page: 1, limit: 15, search: "", category: "", total: 0, pages: 1 };
let currentDsApps = [];
let dsDebounceTimer = null;

function getAuthHeaders(extra = {}) {
  const headers = { ...extra };
  if (currentToken) {
    headers["Authorization"] = `Bearer ${currentToken}`;
  }
  return headers;
}

/* ─────────────────────────────────────────────────────────────────
   TOAST NOTIFICATIONS
───────────────────────────────────────────────────────────────── */
function showToast(msg, type = "info") {
  let toast = document.getElementById("psToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "psToast";
    toast.className = "ps-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `ps-toast show ps-toast-${type}`;
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.className = "ps-toast";
  }, 4000);
}

/* ─────────────────────────────────────────────────────────────────
   AUTHENTICATION GUARD (Admin Only)
───────────────────────────────────────────────────────────────── */
async function checkAdminAuth() {
  if (!currentToken) {
    window.location.href = "/login.html";
    return false;
  }

  try {
    const res = await fetch(`${API}/auth/me`, {
      headers: getAuthHeaders()
    });

    if (!res.ok) {
      localStorage.removeItem("playstore_iq_token");
      window.location.href = "/login.html";
      return false;
    }

    const data = await res.json();
    currentUser = data.user;

    if (!currentUser || currentUser.role !== "admin") {
      alert("Access Denied: Only administrators have access to the Admin Console. Redirecting to user analytics.");
      window.location.href = "/user.html";
      return false;
    }

    // Display admin name
    const adminLabel = document.getElementById("adminNameLabel");
    if (adminLabel) {
      adminLabel.textContent = currentUser.name || "Administrator";
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
  window.location.href = "/login.html";
}

/* ─────────────────────────────────────────────────────────────────
   TAB NAVIGATION
───────────────────────────────────────────────────────────────── */
function switchAdminTab(tabName) {
  const tabs = ["ml", "dataset", "diag", "users", "upload"];
  tabs.forEach(t => {
    const cap = t.charAt(0).toUpperCase() + t.slice(1);
    const sideBtn = document.getElementById(`sideNav${cap}`);
    const tabBtn = document.getElementById(`tabAdm${cap}`);
    const pane = document.getElementById(`paneAdm${cap}`);

    if (sideBtn) sideBtn.classList.toggle("active", t === tabName);
    if (tabBtn) tabBtn.classList.toggle("active", t === tabName);
    if (pane) pane.classList.toggle("hidden", t !== tabName);
  });

  if (tabName === "ml") {
    renderMLCompare();
  } else if (tabName === "dataset") {
    loadDatasetTable(dsState.page);
  } else if (tabName === "diag") {
    loadAdminDiagnostics();
  } else if (tabName === "users") {
    loadUsersTable();
  }
}

/* ─────────────────────────────────────────────────────────────────
   CHART UTILITIES
───────────────────────────────────────────────────────────────── */
function destroyChart(id) {
  if (charts[id]) {
    try { charts[id].destroy(); } catch (_) {}
    delete charts[id];
  }
}

function revealChart(skId, cvId) {
  const sk = document.getElementById(skId);
  const cv = document.getElementById(cvId);
  if (sk) sk.classList.add("hidden");
  if (cv) cv.classList.remove("hidden");
}

/* ─────────────────────────────────────────────────────────────────
   TAB 1: ML ALGORITHM BENCHMARKING & RETRAINING
───────────────────────────────────────────────────────────────── */
async function renderMLCompare() {
  let data;
  try {
    const res = await fetch(`${API}/mining/ml_compare`, {
      headers: getAuthHeaders()
    });
    data = await res.json();
  } catch (e) {
    console.error("ML compare error:", e);
    return;
  }

  if (!data || data.error) {
    console.warn("ML compare error:", data ? data.error : "No data");
    return;
  }

  const algos = data.algorithms || [];
  const P = tok();

  // Champion Banner
  const banner = document.getElementById("bestAlgoBanner");
  const bName  = document.getElementById("bestAlgoName");
  const bTip   = document.getElementById("bestAlgoTip");
  const bBadge = document.getElementById("bestAlgoBadge");
  if (banner && data.bestAlgorithm) {
    if (bName)  bName.textContent = data.bestAlgorithm;
    if (bTip)   bTip.textContent = data.bestTip || "";
    if (bBadge) bBadge.textContent = (data.bestAccuracy || 0).toFixed(1) + "%";
    banner.classList.remove("hidden");
  }

  // ML Meta Pills
  const mlMeta = document.getElementById("mlMeta");
  if (mlMeta && data.totalSamples) {
    mlMeta.innerHTML = `
      <span class="ml-meta-pill">📊 ${data.totalSamples.toLocaleString()} samples</span>
      <span class="ml-meta-pill">🎯 ${data.targetLabel || "Rating ≥ 4.3"}</span>
      <span class="ml-meta-pill">✅ ${data.highRatedPct || 0}% high-rated</span>
    `;
    mlMeta.classList.remove("hidden");
  }

  // Accuracy Bar Chart
  const accCtx = document.getElementById("mlCompareChart");
  if (accCtx && algos.length) {
    revealChart("skMlCompare", "mlCompareChart");
    destroyChart("mlCompare");
    charts.mlCompare = new Chart(accCtx, {
      type: "bar",
      data: {
        labels: algos.map(a => a.name),
        datasets: [{
          label: "Accuracy (%)",
          data: algos.map(a => a.accuracy || 0),
          backgroundColor: algos.map(a => (a.isBest ? (ALGO_COLORS[a.name] || P.primary) : (ALGO_COLORS[a.name] || P.primary) + "bb")),
          borderColor:     algos.map(a => ALGO_COLORS[a.name] || P.primary),
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.parsed.y.toFixed(2)}% test accuracy`,
            }
          }
        },
        scales: {
          x: {
            grid: { color: P.border + "44" },
            ticks: { color: P.text2, font: { family: "'Inter',system-ui", size: 12, weight: "500" } }
          },
          y: {
            min: 0, max: 100,
            grid: { color: P.border + "44" },
            ticks: {
              color: P.text2,
              font: { family: "'Inter',system-ui", size: 12 },
              callback: v => v + "%"
            }
          }
        },
        animation: { duration: 800, easing: "easeOutQuart" }
      }
    });
  }

  // Multi-Metric Scorecard Grouped Bar
  const radCtx = document.getElementById("mlRadarChart");
  if (radCtx && algos.length) {
    revealChart("skMlRadar", "mlRadarChart");

    const metricDefs = [
      { key: "accuracy",  label: "Accuracy",  color: "#6366f1" },
      { key: "precision", label: "Precision", color: "#10b981" },
      { key: "recall",    label: "Recall",    color: "#f59e0b" },
      { key: "f1",        label: "F1 Score",  color: "#ec4899" },
    ];

    destroyChart("mlRadar");
    charts.mlRadar = new Chart(radCtx, {
      type: "bar",
      data: {
        labels: algos.map(a => a.name),
        datasets: metricDefs.map(m => ({
          label: m.label,
          data: algos.map(a => a[m.key] || 0),
          backgroundColor: m.color + "cc",
          borderColor: m.color,
          borderWidth: 1.5,
          borderRadius: 4,
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: { color: P.text2, font: { family: "'Inter',system-ui", size: 12, weight: "500" }, boxWidth: 14 }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`
            }
          }
        },
        scales: {
          x: {
            grid: { color: P.border + "33" },
            ticks: { color: P.text2, font: { family: "'Inter',system-ui", size: 11, weight: "500" } }
          },
          y: {
            min: 0, max: 100,
            grid: { color: P.border + "33" },
            ticks: { color: P.text2, font: { family: "'Inter',system-ui", size: 11 }, callback: v => v + "%" }
          }
        },
        animation: { duration: 900, easing: "easeOutQuart" }
      }
    });
  }

  // Algorithm Cards Grid
  const grid = document.getElementById("algoCardsGrid");
  if (grid && algos.length) {
    grid.innerHTML = algos.map(a => {
      const color     = ALGO_COLORS[a.name] || "#6366f1";
      const bestBadge = a.isBest ? `<span class="algo-card-best-badge">👑 Best Model</span>` : "";
      const speedClass = (a.trainTimeMs || 0) < 100 ? "var(--green)" : (a.trainTimeMs || 0) < 500 ? "var(--amber)" : "var(--red)";
      return `
        <div class="algo-card ${a.isBest ? "best" : ""}">
          <div class="algo-card-accent" style="background:${color}"></div>
          <div class="algo-card-header">
            <span class="algo-card-icon">${a.icon || "🤖"}</span>
            <span class="algo-card-name">${a.name}</span>
            ${bestBadge}
          </div>
          <p class="algo-card-desc">${a.description || ""}</p>
          <div class="algo-metrics">
            <div class="algo-metric">
              <span class="algo-metric-val" style="color:${color}">${(a.accuracy||0).toFixed(1)}%</span>
              <span class="algo-metric-lbl">Accuracy</span>
            </div>
            <div class="algo-metric">
              <span class="algo-metric-val">${(a.precision||0).toFixed(1)}%</span>
              <span class="algo-metric-lbl">Precision</span>
            </div>
            <div class="algo-metric">
              <span class="algo-metric-val">${(a.recall||0).toFixed(1)}%</span>
              <span class="algo-metric-lbl">Recall</span>
            </div>
            <div class="algo-metric">
              <span class="algo-metric-val">${(a.f1||0).toFixed(1)}%</span>
              <span class="algo-metric-lbl">F1 Score</span>
            </div>
          </div>
          <div class="algo-speed">
            <span class="algo-speed-dot" style="background:${speedClass}"></span>
            Train time: <strong>${a.trainTimeMs != null ? a.trainTimeMs.toFixed(0)+"ms" : "—"}</strong> &nbsp;|&nbsp;
            AUC: <strong>${a.auc != null ? a.auc.toFixed(1)+"%" : "—"}</strong>
          </div>
        </div>
      `;
    }).join("");
  }

  // Feature Importance of Champion
  const fiCtx   = document.getElementById("featImpChart");
  const fiBadge = document.getElementById("fiAlgoName");
  const bestAlgo = algos.find(a => a.isBest) || algos[0];
  if (fiCtx && bestAlgo && bestAlgo.featureImportance && bestAlgo.featureImportance.length) {
    revealChart("skFeatImp", "featImpChart");
    if (fiBadge) fiBadge.textContent = bestAlgo.name;

    const fi       = bestAlgo.featureImportance;
    const fiColor  = ALGO_COLORS[bestAlgo.name] || P.primary;
    const fiLabels = fi.map(f => f.feature.replace("LogInstalls","Log(Installs)").replace("LogReviews","Log(Reviews)").replace("IsFree_int","Is Free"));

    destroyChart("featImp");
    charts.featImp = new Chart(fiCtx, {
      type: "bar",
      data: {
        labels: fiLabels,
        datasets: [{
          label: "Importance",
          data: fi.map(f => +(f.importance * 100).toFixed(2)),
          backgroundColor: fi.map((_, i) => fiColor + (i === 0 ? "" : "aa")),
          borderColor: fiColor,
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => ` ${ctx.parsed.x.toFixed(2)}% relative importance` }
          }
        },
        scales: {
          x: {
            min: 0,
            grid: { color: P.border + "44" },
            ticks: { color: P.text2, font: { family: "'Inter',system-ui", size: 12 }, callback: v => v + "%" }
          },
          y: {
            grid: { display: false },
            ticks: { color: P.text, font: { family: "'Inter',system-ui", size: 13, weight: "600" } }
          }
        },
        animation: { duration: 800 }
      }
    });
  }
}

async function triggerAdminRetrain() {
  const btn = document.getElementById("retrainBtn");
  const splitSelect = document.getElementById("retrainTestSplit");
  const testSplit = splitSelect ? parseFloat(splitSelect.value) : 0.2;

  btn.disabled = true;
  btn.innerHTML = `Training 6 Algorithms (${Math.round((1-testSplit)*100)}/${Math.round(testSplit*100)} split)...`;

  try {
    const res = await fetch(`${API}/mining/ml_retrain`, {
      method: "POST",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ testSize: testSplit })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Retrained all 6 models! Champion: ${data.bestAlgorithm} (${data.bestAccuracy}%)`, "success");
      await renderMLCompare();
      loadAdminDiagnostics();
    } else {
      alert("Retraining failed: " + (data.error || "Unknown error"));
    }
  } catch (e) {
    alert("Retraining error: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Retrain 6 Models`;
  }
}

/* ─────────────────────────────────────────────────────────────────
   TAB 2: LIVE DATASET IN-PLACE EDITOR (CRUD)
───────────────────────────────────────────────────────────────── */
async function loadDatasetTable(page = 1) {
  dsState.page = Math.max(1, page);
  const searchInput = document.getElementById("dsSearchInput");
  const catSelect   = document.getElementById("dsCategorySelect");
  if (searchInput) dsState.search = searchInput.value.trim();
  if (catSelect)   dsState.category = catSelect.value;

  const tbody = document.getElementById("dsAppsTableBody");
  if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted)">Loading records…</td></tr>`;

  try {
    const qs = new URLSearchParams({
      page: dsState.page,
      limit: dsState.limit,
      search: dsState.search,
      category: dsState.category
    });
    const res = await fetch(`${API}/admin/dataset/apps?${qs}`, {
      headers: getAuthHeaders()
    });

    if (!res.ok) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--red)">Failed to load dataset apps</td></tr>`;
      return;
    }

    const data = await res.json();
    currentDsApps = data.apps || [];
    dsState.total = data.total || 0;
    dsState.pages = data.pages || 1;

    // Populate category dropdowns
    if (data.categories && data.categories.length) {
      if (catSelect && catSelect.children.length <= 1) {
        catSelect.innerHTML = `<option value="">All Categories</option>` +
          data.categories.map(c => `<option value="${c}">${c.replace(/_/g, " ")}</option>`).join("");
      }
      const addCat = document.getElementById("addAppCategory");
      if (addCat && addCat.children.length === 0) {
        addCat.innerHTML = data.categories.map(c => `<option value="${c}">${c.replace(/_/g, " ")}</option>`).join("");
      }
      const editCat = document.getElementById("editAppCategory");
      if (editCat && editCat.children.length === 0) {
        editCat.innerHTML = data.categories.map(c => `<option value="${c}">${c.replace(/_/g, " ")}</option>`).join("");
      }
    }

    // Update count and pagination
    const countPill = document.getElementById("dsCountPill");
    if (countPill) countPill.textContent = `${dsState.total.toLocaleString()} total apps`;

    const pageInfo = document.getElementById("dsPageInfo");
    if (pageInfo) pageInfo.textContent = `Page ${dsState.page} of ${dsState.pages}`;

    const prevBtn = document.getElementById("dsPrevBtn");
    const nextBtn = document.getElementById("dsNextBtn");
    if (prevBtn) prevBtn.disabled = dsState.page <= 1;
    if (nextBtn) nextBtn.disabled = dsState.page >= dsState.pages;

    // Render Table Body
    if (tbody) {
      if (currentDsApps.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted)">No matching apps found in dataset.</td></tr>`;
        return;
      }

      tbody.innerHTML = currentDsApps.map(a => `
        <tr>
          <td><strong title="${a.App || ''}">${a.App || '—'}</strong></td>
          <td><span style="font-size:12px;color:var(--text-2)">${(a.Category || '').replace(/_/g, ' ')}</span></td>
          <td class="th-num"><span style="color:#f59e0b;font-weight:700">★ ${a.Rating != null ? (+a.Rating).toFixed(1) : '—'}</span></td>
          <td class="th-num">${a.Reviews != null ? fmtNum(a.Reviews) : '0'}</td>
          <td class="th-num">${a.Installs != null ? fmtNum(a.Installs) : '0'}</td>
          <td class="th-right"><span class="badge-${(a.Type || 'Free').toLowerCase()}">${a.Type || 'Free'}</span></td>
          <td class="th-num">${a.Price ? '$' + (+a.Price).toFixed(2) : '$0'}</td>
          <td style="font-size:12px;color:var(--text-muted)">${a["Last Updated"] || '—'}</td>
          <td class="th-right">
            <button type="button" class="ds-action-btn ds-btn-edit" onclick="openEditAppModal('${encodeURIComponent(a.App)}')">✏️ Edit</button>
            <button type="button" class="ds-action-btn ds-btn-del" onclick="deleteDatasetApp('${encodeURIComponent(a.App)}')">🗑️</button>
          </td>
        </tr>
      `).join("");
    }
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--red)">Error: ${e.message}</td></tr>`;
  }
}

function debounceDatasetSearch() {
  clearTimeout(dsDebounceTimer);
  dsDebounceTimer = setTimeout(() => {
    loadDatasetTable(1);
  }, 300);
}

function changeDatasetPage(delta) {
  loadDatasetTable(dsState.page + delta);
}

function openEditAppModal(encodedName) {
  const name = decodeURIComponent(encodedName);
  const app = currentDsApps.find(a => a.App === name);
  if (!app) return;

  document.getElementById("editOriginalAppName").value = app.App;
  document.getElementById("editAppName").value = app.App;
  document.getElementById("editAppCategory").value = app.Category || "";
  document.getElementById("editAppRating").value = app.Rating != null ? app.Rating : 4.0;
  document.getElementById("editAppReviews").value = app.Reviews != null ? app.Reviews : 0;
  document.getElementById("editAppInstalls").value = app.Installs != null ? app.Installs : 0;
  document.getElementById("editAppSize").value = app.Size != null ? app.Size : 20.0;
  document.getElementById("editAppType").value = app.Type === "Paid" ? "Paid" : "Free";
  document.getElementById("editAppPrice").value = app.Price != null ? app.Price : 0;

  const modal = document.getElementById("modalEditApp");
  const back  = document.getElementById("modalEditAppBackdrop");
  if (modal) modal.classList.remove("hidden");
  if (back)  back.classList.remove("hidden");
}

function closeEditAppModal() {
  const modal = document.getElementById("modalEditApp");
  const back  = document.getElementById("modalEditAppBackdrop");
  if (modal) modal.classList.add("hidden");
  if (back)  back.classList.add("hidden");
}

async function handleEditAppSubmit(event) {
  event.preventDefault();
  const submitBtn = document.getElementById("editAppSubmitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving to CSV...";

  const origName = document.getElementById("editOriginalAppName").value;
  const payload = {
    originalApp: origName,
    App: document.getElementById("editAppName").value.trim(),
    Category: document.getElementById("editAppCategory").value,
    Rating: parseFloat(document.getElementById("editAppRating").value),
    Reviews: parseInt(document.getElementById("editAppReviews").value),
    Installs: parseInt(document.getElementById("editAppInstalls").value),
    Size: parseFloat(document.getElementById("editAppSize").value),
    Type: document.getElementById("editAppType").value,
    Price: parseFloat(document.getElementById("editAppPrice").value),
  };

  try {
    const res = await fetch(`${API}/admin/dataset/app`, {
      method: "PUT",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Saved changes for '${payload.App}'!`, "success");
      closeEditAppModal();
      await loadDatasetTable(dsState.page);
      loadAdminDiagnostics();
    } else {
      alert("Save failed: " + (data.error || "Unknown error"));
    }
  } catch (e) {
    alert("Network error: " + e.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Changes to Dataset";
  }
}

function openAddAppModal() {
  const form = document.getElementById("addAppForm");
  if (form) form.reset();
  const modal = document.getElementById("modalAddApp");
  const back  = document.getElementById("modalAddAppBackdrop");
  if (modal) modal.classList.remove("hidden");
  if (back)  back.classList.remove("hidden");
}

function closeAddAppModal() {
  const modal = document.getElementById("modalAddApp");
  const back  = document.getElementById("modalAddAppBackdrop");
  if (modal) modal.classList.add("hidden");
  if (back)  back.classList.add("hidden");
}

async function handleAddAppSubmit(event) {
  event.preventDefault();
  const submitBtn = document.getElementById("addAppSubmitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Adding App & Updating CSV...";

  const payload = {
    App: document.getElementById("addAppName").value.trim(),
    Category: document.getElementById("addAppCategory").value,
    Rating: parseFloat(document.getElementById("addAppRating").value),
    Reviews: parseInt(document.getElementById("addAppReviews").value),
    Installs: parseInt(document.getElementById("addAppInstalls").value),
    Size: parseFloat(document.getElementById("addAppSize").value),
    Type: document.getElementById("addAppType").value,
    Price: parseFloat(document.getElementById("addAppPrice").value),
  };

  try {
    const res = await fetch(`${API}/admin/dataset/app`, {
      method: "POST",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Added '${payload.App}' to dataset!`, "success");
      closeAddAppModal();
      await loadDatasetTable(1);
      loadAdminDiagnostics();
    } else {
      alert("Failed to add app: " + (data.error || "Unknown error"));
    }
  } catch (e) {
    alert("Network error: " + e.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Add App & Rebuild Dashboard Cache";
  }
}

async function deleteDatasetApp(encodedName) {
  const name = decodeURIComponent(encodedName);
  if (!confirm(`Are you sure you want to permanently delete '${name}' from the dataset?`)) return;

  try {
    const res = await fetch(`${API}/admin/dataset/app`, {
      method: "DELETE",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ App: name })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Deleted '${name}' from dataset.`, "info");
      await loadDatasetTable(dsState.page);
      loadAdminDiagnostics();
    } else {
      alert("Delete failed: " + (data.error || "Unknown error"));
    }
  } catch (e) {
    alert("Network error: " + e.message);
  }
}

async function resetDatasetToBackup() {
  if (!confirm("Are you sure you want to reset the dataset to the pristine Kaggle 2018 dataset? Any manual modifications will be restored.")) return;

  try {
    const res = await fetch(`${API}/admin/dataset/reset`, {
      method: "POST",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message || "Dataset reset to pristine Kaggle 2018 dataset!", "success");
      await loadDatasetTable(1);
      loadAdminDiagnostics();
    } else {
      alert("Reset failed: " + (data.error || "Unknown error"));
    }
  } catch (e) {
    alert("Network error: " + e.message);
  }
}

async function downloadDatasetCsv() {
  try {
    const res = await fetch(`${API}/export`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      alert("Failed to export dataset");
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `googleplaystore_admin_export_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    showToast("Dataset exported successfully!", "success");
  } catch (e) {
    alert("Export error: " + e.message);
  }
}

/* ─────────────────────────────────────────────────────────────────
   TAB 3: SYSTEM DIAGNOSTICS & TELEMETRY
───────────────────────────────────────────────────────────────── */
async function loadAdminDiagnostics() {
  try {
    const res = await fetch(`${API}/admin/diagnostics`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return;
    const data = await res.json();

    const dApps = document.getElementById("diagAppsCount");
    const dPath = document.getElementById("diagDatasetPath");
    const dUpt  = document.getElementById("diagUptime");
    const dPy   = document.getElementById("diagPythonVer");
    const dMod  = document.getElementById("diagModelCached");
    const dType = document.getElementById("diagModelType");

    if (dApps) dApps.textContent = (data.dataset.totalApps || 0).toLocaleString();
    if (dPath) dPath.textContent = data.dataset.filePath ? data.dataset.filePath.split(/[\\/]/).pop() : "googleplaystore.csv";
    if (dUpt)  {
      const sec = data.uptime || 0;
      const m = Math.floor(sec / 60);
      const s = Math.round(sec % 60);
      dUpt.textContent = `${m}m ${s}s`;
    }
    if (dPy)   dPy.textContent = `Python ${data.system.pythonVersion} · sklearn ${data.system.sklearnVersion}`;
    if (dMod)  dMod.textContent = data.ml.modelCached ? "Ready (Active)" : "Auto-Initialized";
    if (dType) dType.textContent = `${(data.ml.availableAlgorithms || []).length} ML Algorithms`;

    // Extended telemetry
    const dRev = document.getElementById("diagReviewsCount");
    const dSize = document.getElementById("diagFileSize");
    const dCats = document.getElementById("diagCategoriesCount");
    const dEnv  = document.getElementById("diagEnvSpec");

    if (dRev)  dRev.textContent = (data.dataset.reviewsCount || 0).toLocaleString();
    if (dSize) dSize.textContent = `${data.dataset.fileSizeMb || 0} MB`;
    if (dCats) dCats.textContent = `${data.dataset.uniqueCategories || 0} categories`;
    if (dEnv)  dEnv.textContent = `Python ${data.system.pythonVersion} · Pandas ${data.system.pandasVersion} · scikit-learn ${data.system.sklearnVersion}`;
  } catch (e) {
    console.error("Admin diagnostics error:", e);
  }
}

/* ─────────────────────────────────────────────────────────────────
   TAB 4: USERS & PERMISSIONS MANAGEMENT
───────────────────────────────────────────────────────────────── */
async function loadUsersTable() {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:15px;color:var(--text-muted)">Loading user records...</td></tr>`;

  try {
    const res = await fetch(`${API}/auth/users`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="5" style="color:var(--red);text-align:center">Failed to load users</td></tr>`;
      return;
    }
    const data = await res.json();
    const users = data.users || [];

    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center">No users registered yet</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => {
      const isMe = currentUser && currentUser.id === u.id;
      const nextRole = u.role === "admin" ? "user" : "admin";
      const actionBtn = isMe
        ? `<span style="font-size:12px;color:var(--text-muted);font-weight:600">(Your Account)</span>`
        : `<button class="btn-xs btn-outline" onclick="toggleUserRole('${u.id}', '${nextRole}')">
             Make ${nextRole.toUpperCase()}
           </button>`;

      return `
        <tr>
          <td><strong>${u.name || "—"}</strong></td>
          <td><code>${u.email}</code></td>
          <td>
            <span class="user-role-badge badge-${u.role}">
              ${u.role === "admin" ? "👑 Admin" : "👤 User"}
            </span>
          </td>
          <td>${u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
          <td class="th-right">${actionBtn}</td>
        </tr>
      `;
    }).join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--red);text-align:center">Error: ${e.message}</td></tr>`;
  }
}

async function toggleUserRole(userId, newRole) {
  if (!confirm(`Are you sure you want to change this user's role to ${newRole.toUpperCase()}?`)) return;
  try {
    const res = await fetch(`${API}/auth/users/${userId}/role`, {
      method: "PATCH",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ role: newRole })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`User role updated to ${newRole}`, "success");
      loadUsersTable();
    } else {
      alert(data.error || "Failed to update role");
    }
  } catch (e) {
    alert("Network error: " + e.message);
  }
}

/* ─────────────────────────────────────────────────────────────────
   TAB 5: REPLACE DATASET (CSV UPLOAD)
───────────────────────────────────────────────────────────────── */
function handleFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  selectedUploadFile = file;

  const preview = document.getElementById("uploadPreview");
  const nameEl  = document.getElementById("upFilename");
  const sizeEl  = document.getElementById("upFilesize");
  const statusEl = document.getElementById("uploadStatus");

  if (preview) preview.classList.remove("hidden");
  if (nameEl)  nameEl.textContent = file.name;
  if (sizeEl)  sizeEl.textContent = (file.size / 1024).toFixed(1) + " KB";
  if (statusEl) statusEl.classList.add("hidden");
}

async function submitDatasetUpload() {
  if (!selectedUploadFile) {
    alert("Please select a CSV file first.");
    return;
  }
  const btn = document.getElementById("upSubmitBtn");
  const statusEl = document.getElementById("uploadStatus");
  btn.disabled = true;
  btn.textContent = "Uploading & Rebuilding Cache...";

  const formData = new FormData();
  formData.append("file", selectedUploadFile);

  try {
    const res = await fetch(`${API}/admin/upload_dataset`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData
    });
    const data = await res.json();
    if (res.ok) {
      statusEl.className = "upload-status upload-success";
      statusEl.textContent = `Success! Loaded ${data.appsCount.toLocaleString()} apps from new dataset. Dashboard reloaded.`;
      statusEl.classList.remove("hidden");
      showToast("Dataset successfully replaced!", "success");

      await loadAdminDiagnostics();
      await loadDatasetTable(1);
    } else {
      statusEl.className = "upload-status upload-error";
      statusEl.textContent = `Upload failed: ${data.error}`;
      statusEl.classList.remove("hidden");
    }
  } catch (e) {
    statusEl.className = "upload-status upload-error";
    statusEl.textContent = `Network error: ${e.message}`;
    statusEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload &amp; Reload Application`;
  }
}

/* ─────────────────────────────────────────────────────────────────
   THEME & SIDEBAR TOGGLE
───────────────────────────────────────────────────────────────── */
function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;

  const saved = localStorage.getItem("ps_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeIcons(saved);

  btn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("ps_theme", next);
    updateThemeIcons(next);

    // Re-render charts with new theme colors
    renderMLCompare();
  });
}

function updateThemeIcons(theme) {
  const sun  = document.querySelector(".icon-sun");
  const moon = document.querySelector(".icon-moon");
  if (sun && moon) {
    if (theme === "dark") {
      sun.classList.remove("hidden");
      moon.classList.add("hidden");
    } else {
      sun.classList.add("hidden");
      moon.classList.remove("hidden");
    }
  }
}

function initSidebar() {
  const collapseBtn = document.getElementById("sidebarCollapseBtn");
  const hamburger   = document.getElementById("hamburger");
  const sidebar     = document.getElementById("sidebar");
  const wrapper     = document.getElementById("mainWrapper");

  if (collapseBtn && sidebar) {
    collapseBtn.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
      if (wrapper) wrapper.classList.toggle("sidebar-collapsed");
    });
  }

  if (hamburger && sidebar) {
    hamburger.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }
}

/* ─────────────────────────────────────────────────────────────────
   INIT
───────────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  initThemeToggle();
  initSidebar();

  const authenticated = await checkAdminAuth();
  if (authenticated) {
    // Initial load: Tab 1 (ML Algorithm Lab)
    renderMLCompare();
    loadAdminDiagnostics();
  }
});
