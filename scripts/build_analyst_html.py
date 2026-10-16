import re

with open('frontend/user.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Title
html = html.replace(
    '<title>PlayStoreIQ — Market Analytics &amp; Insights</title>',
    '<title>PlayStoreIQ — Market Intelligence &amp; DWM Suite</title>'
)

# 2. Sidebar Navigation: replace sidebar-nav contents
analyst_nav = '''      <nav class="sidebar-nav" role="navigation" aria-label="Analyst navigation">
        <div class="sidebar-group-title" style="font-size:10.5px;font-weight:700;text-transform:uppercase;color:var(--text-muted);padding:8px 16px;letter-spacing:0.5px">
          DWM Analytics Suite
        </div>
        <a href="#section-overview" class="nav-item active" data-section="overview" aria-label="Market Overview">
          <span class="nav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></span>
          <span class="nav-label sidebar-text">Market Overview</span>
        </a>
        <a href="#section-olap" class="nav-item" data-section="olap" aria-label="OLAP Analysis">
          <span class="nav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg></span>
          <span class="nav-label sidebar-text">OLAP Analysis</span>
        </a>
        <a href="#section-predictor" class="nav-item" data-section="predictor" aria-label="Popularity Prediction">
          <span class="nav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>
          <span class="nav-label sidebar-text">Popularity Prediction</span>
        </a>
        <a href="#section-clusters" class="nav-item" data-section="clusters" aria-label="Market Segments">
          <span class="nav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="2"/><circle cx="12" cy="5" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="12" cy="19" r="1"/><circle cx="5" cy="12" r="1"/><line x1="12" y1="7" x2="12" y2="10"/><line x1="14" y1="12" x2="17" y2="12"/><line x1="12" y1="14" x2="12" y2="17"/><line x1="7" y1="12" x2="10" y2="12"/></svg></span>
          <span class="nav-label sidebar-text">Market Segments</span>
        </a>
        <a href="#section-association" class="nav-item" data-section="association" aria-label="Association Rules">
          <span class="nav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></span>
          <span class="nav-label sidebar-text">Association Patterns</span>
        </a>
        <a href="#section-sentiment" class="nav-item" data-section="sentiment" aria-label="Sentiment Intelligence">
          <span class="nav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
          <span class="nav-label sidebar-text">Sentiment Intelligence</span>
        </a>
        <a href="#section-opportunity" class="nav-item" data-section="opportunity" aria-label="Opportunity Matrix">
          <span class="nav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="3" x2="12" y2="21"/></svg></span>
          <span class="nav-label sidebar-text">Opportunity Matrix</span>
        </a>
        <a href="#section-classification" class="nav-item" data-section="classification" aria-label="Model Benchmark">
          <span class="nav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>
          <span class="nav-label sidebar-text">Model Benchmark</span>
        </a>

        <!-- Portal jump links -->
        <div class="nav-admin-jump hidden" id="sideAdminLinkWrap" style="margin-top:auto;border-top:1px solid var(--border);padding-top:10px;">
          <a href="/admin.html" title="Jump to Admin Console & ML Lab" style="display:flex;align-items:center;gap:10px;padding:8px 16px;color:#f59e0b;text-decoration:none;font-size:12.5px;font-weight:700;">
            <span>👑 Admin Console ↗</span>
          </a>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:8px;margin-top:6px;">
          <a href="/user.html" title="Switch to App Discovery Mode" style="display:flex;align-items:center;gap:8px;padding:8px 16px;color:var(--text-muted);text-decoration:none;font-size:12px;font-weight:600;">
            <span>👤 Normal User Discovery ↗</span>
          </a>
        </div>
      </nav>'''

html = re.sub(r'<nav class="sidebar-nav".*?</nav>', analyst_nav, html, flags=re.DOTALL)

# 3. Topbar: Replace topbar-center (role switcher) with globalSearch input
topbar_center = '''        <!-- Global Search Bar -->
        <div class="topbar-center" style="max-width:380px;width:100%;">
          <div style="position:relative;width:100%;">
            <svg style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="globalSearch" placeholder="Search applications (Ctrl+K)..." style="width:100%;padding:7px 12px 7px 34px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;outline:none;" />
          </div>
        </div>'''

html = re.sub(r'<!-- Role Switcher -->\s*<div class="topbar-center".*?</div>\s*</div>', topbar_center, html, flags=re.DOTALL)

# 4. Badge in topbar
html = html.replace('<span id="userNameLabel">Analyst</span>', '<span id="userNameLabel">Business Analyst</span>')

# 5. Remove section-trending from analyst.html
html = re.sub(r'<!-- ─────────── SECTION 11: TRENDING APPS ─────────── -->.*?<!-- ─────────── SECTION', '<!-- ─────────── SECTION', html, flags=re.DOTALL)
html = re.sub(r'<section id="section-trending".*?</section>', '', html, flags=re.DOTALL)

# 6. Add hidden dateStart and dateEnd inputs if not present
if 'id="dateStart"' not in html:
    html = html.replace('</main>', '<input type="hidden" id="dateStart" /><input type="hidden" id="dateEnd" /></main>')

# 7. Update script tag
html = html.replace('<script src="user.js?v=3"></script>', '<script src="analyst.js?v=1"></script>')

with open('frontend/analyst.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Created frontend/analyst.html successfully!")
