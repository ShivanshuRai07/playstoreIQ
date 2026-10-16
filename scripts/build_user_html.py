# -*- coding: utf-8 -*-
user_html = """<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PlayStoreIQ — App Discovery &amp; Trends</title>
  <meta name="description" content="Discover Google Play Store apps, market trends, top categories, and trending apps." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="style.css" />
  <style>
    .user-topbar-profile {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .user-role-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      padding: 5px 12px;
      border-radius: 999px;
      border: 1px solid rgba(16, 185, 129, 0.35);
    }
    .btn-user-logout {
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text-2);
      border-radius: var(--radius-sm);
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s ease;
    }
    .btn-user-logout:hover {
      background: #fee2e2;
      border-color: #ef4444;
      color: #b91c1c;
    }
    .time-filter-wrap {
      display: inline-flex;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 3px;
      gap: 3px;
    }
    .time-filter-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .time-filter-btn.active {
      background: var(--primary);
      color: #fff;
    }
  </style>
</head>
<body>

  <!-- APP SHELL -->
  <div class="app-shell" id="appShell">

    <!-- ══════════════════════════════════════════════
         USER SIDEBAR (NORMAL DISCOVERY)
    ══════════════════════════════════════════════ -->
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <div class="brand-icon" style="background: linear-gradient(135deg, #10b981, #06b6d4);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
        <span class="brand-name sidebar-text">PlayStore<strong>IQ</strong></span>
      </div>

      <nav class="sidebar-nav" role="navigation" aria-label="Main discovery navigation">
        <div class="sidebar-group-title" style="font-size:10.5px;font-weight:700;text-transform:uppercase;color:var(--text-muted);padding:8px 16px;letter-spacing:0.5px">
          App Discovery
        </div>
        <a href="#section-home" class="nav-item active" data-section="home" aria-label="Home Discovery">
          <span class="nav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
          <span class="nav-label sidebar-text">Home Discovery</span>
        </a>
        <a href="#section-trending" class="nav-item" data-section="trending" aria-label="Trending Apps">
          <span class="nav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></span>
          <span class="nav-label sidebar-text">Trending Apps</span>
        </a>
        <a href="#section-categories" class="nav-item" data-section="categories" aria-label="Categories">
          <span class="nav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>
          <span class="nav-label sidebar-text">Categories</span>
        </a>
        <a href="#section-insights" class="nav-item" data-section="insights" aria-label="App Insights">
          <span class="nav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span>
          <span class="nav-label sidebar-text">App Insights</span>
        </a>

        <!-- Switch to Analyst suite if privileged -->
        <div id="analystLinkWrap" class="hidden" style="margin-top:auto;border-top:1px solid var(--border);padding-top:10px;">
          <a href="/analyst.html" title="Jump to Business Analyst DWM Suite" style="display:flex;align-items:center;gap:8px;padding:8px 16px;color:#3b82f6;text-decoration:none;font-size:12.5px;font-weight:700;">
            <span>💼 Analyst Suite ↗</span>
          </a>
        </div>
      </nav>

      <button class="sidebar-collapse-btn" id="sidebarCollapseBtn" aria-label="Collapse sidebar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
    </aside>

    <!-- ══════════════════════════════════════════════
         MAIN CONTENT WRAPPER
    ══════════════════════════════════════════════ -->
    <div class="main-wrapper" id="mainWrapper">

      <!-- TOP BAR -->
      <header class="topbar" role="banner">
        <div class="topbar-left">
          <button class="hamburger" id="hamburger" aria-label="Toggle sidebar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div>
            <h1 class="page-title" id="pageTitle">App Discovery &amp; Trends</h1>
          </div>
        </div>

        <!-- Global Search Bar -->
        <div class="topbar-center" style="max-width:380px;width:100%;">
          <div style="position:relative;width:100%;">
            <svg style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="globalSearch" placeholder="Search applications (Ctrl+K)..." style="width:100%;padding:7px 12px 7px 34px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;outline:none;" />
          </div>
        </div>

        <div class="topbar-right">
          <button class="icon-btn" id="themeToggle" aria-label="Toggle theme" title="Toggle theme">
            <svg class="icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            <svg class="icon-moon hidden" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>

          <!-- User Profile & Sign Out -->
          <div class="user-topbar-profile">
            <div class="user-role-pill">
              <span>👤</span>
              <span id="userNameLabel">Normal User</span>
            </div>
            <button type="button" class="btn-user-logout" onclick="handleLogout()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign Out
            </button>
          </div>

          <!-- Connection status -->
          <div class="conn-status" id="connStatus" title="API connection status">
            <span class="conn-dot" id="connDot"></span>
          </div>
        </div>
      </header>

      <!-- MAIN CONTENT -->
      <main class="content" id="mainContent" role="main">

        <!-- ─────────── SECTION 1: HOME DISCOVERY ─────────── -->
        <section id="section-home" class="content-section">
          <!-- KPI TILES -->
          <div class="kpi-grid" id="kpiGrid" role="region" aria-label="Discovery indicators">
            <div class="kpi-tile skeleton"><div class="skeleton-block h-8 w-24 mb-2"></div><div class="skeleton-block h-4 w-16"></div></div>
            <div class="kpi-tile skeleton"><div class="skeleton-block h-8 w-24 mb-2"></div><div class="skeleton-block h-4 w-16"></div></div>
            <div class="kpi-tile skeleton"><div class="skeleton-block h-8 w-24 mb-2"></div><div class="skeleton-block h-4 w-16"></div></div>
            <div class="kpi-tile skeleton"><div class="skeleton-block h-8 w-24 mb-2"></div><div class="skeleton-block h-4 w-16"></div></div>
          </div>

          <!-- Charts Row -->
          <div class="grid-2-1" style="margin-top:20px;">
            <div class="card">
              <div class="card-header">
                <div>
                  <h3 class="card-title">Apps Catalog Updates Over Time</h3>
                  <p class="card-subtitle">Monthly store update rhythm across Google Play Store</p>
                </div>
              </div>
              <div class="card-body chart-area">
                <div class="skeleton-chart" id="skUpdatedMonth"></div>
                <canvas id="updatedMonthChart" class="hidden"></canvas>
              </div>
            </div>

            <div class="card">
              <div class="card-header">
                <div>
                  <h3 class="card-title">Free vs Paid Apps</h3>
                  <p class="card-subtitle">Monetization split across consumer applications</p>
                </div>
              </div>
              <div class="card-body chart-donut-wrap">
                <div class="skeleton-chart" id="skFreePaid"></div>
                <canvas id="freePaidChart" class="hidden"></canvas>
              </div>
            </div>
          </div>
        </section>

        <!-- ─────────── SECTION 2: TRENDING APPS ─────────── -->
        <section id="section-trending" class="content-section" style="margin-top:32px;">
          <div class="section-heading" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <div>
              <h2 class="section-title">🚀 Trending Applications</h2>
              <p class="section-desc">Fast-moving applications filtered by time-window and popularity acceleration</p>
            </div>
            <div class="time-filter-wrap" role="group" aria-label="Time Filter">
              <button type="button" class="time-filter-btn" onclick="filterTrendingTime('7D')">7D</button>
              <button type="button" class="time-filter-btn" onclick="filterTrendingTime('1M')">1M</button>
              <button type="button" class="time-filter-btn active" onclick="filterTrendingTime('3M')">3M</button>
              <button type="button" class="time-filter-btn" onclick="filterTrendingTime('6M')">6M</button>
              <button type="button" class="time-filter-btn" onclick="filterTrendingTime('1Y')">1Y</button>
            </div>
          </div>

          <div class="card">
            <div class="card-body table-wrap">
              <table class="data-table" id="trendingTable">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>App Name</th>
                    <th>Category</th>
                    <th class="th-num">Rating</th>
                    <th class="th-num">Installs</th>
                    <th class="th-right">Type</th>
                    <th>Popularity Tier</th>
                  </tr>
                </thead>
                <tbody id="trendingBody">
                  <tr><td colspan="7" style="text-align:center;padding:16px;">Loading trending apps…</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- ─────────── SECTION 3: CATEGORIES ─────────── -->
        <section id="section-categories" class="content-section" style="margin-top:32px;">
          <div class="section-heading">
            <h2 class="section-title">📂 Category Exploration</h2>
            <p class="section-desc">App density, total installs, and user rating trends across 33 categories</p>
          </div>

          <div class="grid-2">
            <div class="card">
              <div class="card-header">
                <div>
                  <h3 class="card-title">Apps per Category</h3>
                  <p class="card-subtitle">Volume of applications published per sector</p>
                </div>
              </div>
              <div class="card-body chart-area">
                <div class="skeleton-chart" id="skAppsPerCat"></div>
                <canvas id="appsPerCatChart" class="hidden"></canvas>
              </div>
            </div>

            <div class="card">
              <div class="card-header">
                <div>
                  <h3 class="card-title">Installs by Category</h3>
                  <p class="card-subtitle">Total download reach across top categories</p>
                </div>
              </div>
              <div class="card-body chart-area">
                <div class="skeleton-chart" id="skInstallsByCat"></div>
                <canvas id="installsByCatChart" class="hidden"></canvas>
              </div>
            </div>
          </div>

          <div class="card" style="margin-top:20px;">
            <div class="card-header">
              <div>
                <h3 class="card-title">Rating Distribution</h3>
                <p class="card-subtitle">How user satisfaction is distributed across apps</p>
              </div>
            </div>
            <div class="card-body chart-area">
              <div class="skeleton-chart" id="skRatingDist"></div>
              <canvas id="ratingDistChart" class="hidden"></canvas>
            </div>
          </div>
        </section>

        <!-- ─────────── SECTION 4: APP INSIGHTS ─────────── -->
        <section id="section-insights" class="content-section" style="margin-top:32px;">
          <div class="section-heading">
            <h2 class="section-title">💡 App Insights &amp; Market Sentiments</h2>
            <p class="section-desc">Key takeaways from user reviews and store market dynamics</p>
          </div>

          <div class="grid-2-1">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">Key Market Highlights</h3>
              </div>
              <div class="card-body">
                <div id="insightsList" class="insights-list">
                  <div class="insight-item">Games and Family apps account for the highest volume of total store installs.</div>
                  <div class="insight-item">Over 94% of top apps on Google Play Store operate on the Free-to-download model.</div>
                  <div class="insight-item">Positive user review sentiment correlates strongly with consistent monthly updates.</div>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-header">
                <h3 class="card-title">User Opinion Distribution</h3>
                <p class="card-subtitle">Sentiment extracted from real reviews</p>
              </div>
              <div class="card-body chart-donut-wrap">
                <div class="skeleton-chart" id="skSentimentDonut"></div>
                <canvas id="sentimentDonut" class="hidden"></canvas>
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  </div>

  <div id="psToast" class="ps-toast"></div>

  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="user.js?v=4"></script>
</body>
</html>
"""

with open('frontend/user.html', 'w', encoding='utf-8') as f:
    f.write(user_html)

print("Generated clean frontend/user.html successfully!")
