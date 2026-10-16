# -*- coding: utf-8 -*-
login_html = """<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PlayStoreIQ — Authentication Portal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="style.css" />
  <style>
    body {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      background: radial-gradient(circle at 50% 15%, #1e293b 0%, #0f172a 60%, #090d16 100%);
      font-family: 'Inter', system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #f1f5f9;
    }
    .login-wrapper {
      max-width: 1200px;
      width: 100%;
      padding: 30px 20px;
      margin: auto;
    }
    .login-brand-header {
      text-align: center;
      margin-bottom: 28px;
    }
    .lb-logo {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .lb-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      box-shadow: 0 4px 18px rgba(37,99,235,0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .lb-title {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #ffffff;
      margin: 0;
    }
    .lb-title strong {
      background: linear-gradient(135deg, #60a5fa, #c084fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .lb-sub {
      font-size: 15px;
      color: #94a3b8;
      margin: 0 0 12px;
    }
    .lb-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 999px;
      padding: 5px 14px;
      font-size: 12px;
      color: #cbd5e1;
      font-weight: 500;
    }
    .lb-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
    }
    .login-alert {
      padding: 12px 16px;
      border-radius: 10px;
      margin-bottom: 24px;
      font-size: 13.5px;
      font-weight: 500;
      text-align: center;
    }
    .login-alert-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #fca5a5;
    }
    .login-alert-success {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #6ee7b7;
    }

    .login-cards-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 24px;
    }
    @media (max-width: 960px) {
      .login-cards-grid {
        grid-template-columns: 1fr;
      }
    }
    .portal-box {
      background: rgba(30, 41, 59, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 18px;
      padding: 24px 22px;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .portal-box:hover {
      transform: translateY(-2px);
    }
    .user-portal {
      border-color: rgba(16, 185, 129, 0.4);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35), 0 0 20px rgba(16, 185, 129, 0.1);
    }
    .analyst-portal {
      border-color: rgba(59, 130, 246, 0.4);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35), 0 0 20px rgba(37, 99, 235, 0.15);
    }
    .admin-portal {
      border-color: rgba(245, 158, 11, 0.4);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35), 0 0 20px rgba(245, 158, 11, 0.15);
    }

    .portal-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 4px 10px;
      border-radius: 999px;
      margin-bottom: 12px;
      align-self: flex-start;
    }
    .pill-user {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.35);
    }
    .pill-analyst {
      background: rgba(37, 99, 235, 0.15);
      color: #93c5fd;
      border: 1px solid rgba(59, 130, 246, 0.35);
    }
    .pill-admin {
      background: rgba(245, 158, 11, 0.15);
      color: #fcd34d;
      border: 1px solid rgba(245, 158, 11, 0.35);
    }

    .portal-h {
      font-size: 18px;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 6px;
    }
    .portal-p {
      font-size: 12.5px;
      color: #94a3b8;
      line-height: 1.45;
      margin: 0 0 14px;
      min-height: 36px;
    }
    .portal-features {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 12px;
      color: #cbd5e1;
    }
    .portal-features .f-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .user-portal .f-item span { color: #34d399; font-weight: 700; }
    .analyst-portal .f-item span { color: #38bdf8; font-weight: 700; }
    .admin-portal .f-item span { color: #fbbf24; font-weight: 700; }

    .portal-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .portal-form label {
      color: #cbd5e1;
      font-size: 11.5px;
      font-weight: 600;
      margin-bottom: 3px;
      display: block;
    }
    .portal-form input {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #ffffff;
      border-radius: 8px;
      padding: 9px 12px;
      font-size: 13px;
      outline: none;
      box-sizing: border-box;
      width: 100%;
    }
    .user-portal input:focus { border-color: #10b981; }
    .analyst-portal input:focus { border-color: #3b82f6; }
    .admin-portal input:focus { border-color: #f59e0b; }

    .btn-submit-portal {
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 10px;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      margin-top: 4px;
    }
    .btn-user { background: linear-gradient(135deg, #10b981, #059669); }
    .btn-analyst { background: linear-gradient(135deg, #2563eb, #1d4ed8); }
    .btn-admin { background: linear-gradient(135deg, #f59e0b, #d97706); }

    .quick-bar {
      background: rgba(30, 41, 59, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }
    .quick-label {
      font-size: 13px;
      color: #94a3b8;
      font-weight: 500;
    }
    .quick-btns {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .btn-quick {
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #e2e8f0;
      padding: 7px 14px;
      border-radius: 8px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-quick:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
      transform: translateY(-1px);
    }
  </style>
</head>
<body>

  <div class="login-wrapper">
    <!-- Brand Header -->
    <div class="login-brand-header">
      <div class="lb-logo">
        <div class="lb-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
        <h1 class="lb-title">PlayStore<strong>IQ</strong></h1>
      </div>
      <p class="lb-sub">Data Warehouse &amp; Business Intelligence Platform · 7,242 Clean Analytical Applications</p>
      <div class="lb-badge">
        <span class="lb-dot"></span>
        <span>Three-Tier RBAC Architecture · Direct Role Routing</span>
      </div>
    </div>

    <!-- Dynamic Alert Banner -->
    <div id="loginAlert" class="login-alert hidden"></div>

    <!-- Three Portal Cards Grid -->
    <div class="login-cards-grid">

      <!-- PORTAL 1: NORMAL USER -->
      <div class="portal-box user-portal">
        <div class="portal-pill pill-user">👤 Normal User</div>
        <h2 class="portal-h">App Discovery Portal</h2>
        <p class="portal-p">Discover store trends, time-window momentum, and category rankings.</p>
        <div class="portal-features">
          <div class="f-item"><span>✓</span> Home Discovery &amp; Catalog Trends</div>
          <div class="f-item"><span>✓</span> Trending Apps (7D, 1M, 3M, 6M, 1Y)</div>
          <div class="f-item"><span>✓</span> 33 Category Breakdowns</div>
          <div class="f-item"><span>✓</span> Zero ML Clutter / Consumer UX</div>
        </div>
        <form class="portal-form" onsubmit="handlePortalLogin(event, 'user')">
          <div>
            <label for="uEmail">Email</label>
            <input type="text" id="uEmail" value="user@playstore.io" required />
          </div>
          <div>
            <label for="uPass">Password</label>
            <input type="password" id="uPass" value="user" required />
          </div>
          <button type="submit" class="btn-submit-portal btn-user" id="uBtn">
            Sign In to Discovery →
          </button>
        </form>
      </div>

      <!-- PORTAL 2: BUSINESS ANALYST -->
      <div class="portal-box analyst-portal">
        <div class="portal-pill pill-analyst">💼 Business Analyst</div>
        <h2 class="portal-h">Market Intelligence &amp; DWM</h2>
        <p class="portal-p">Investigate multidimensional OLAP cubes, data mining, and zero-leakage ML.</p>
        <div class="portal-features">
          <div class="f-item"><span>✓</span> ROLAP Engine (Roll-up, Slice, Dice, Pivot)</div>
          <div class="f-item"><span>✓</span> 2x2 Category Opportunity Matrix</div>
          <div class="f-item"><span>✓</span> K-Means (K=5) &amp; Apriori Mining</div>
          <div class="f-item"><span>✓</span> Dual View: [ Insights | How It Works ]</div>
        </div>
        <form class="portal-form" onsubmit="handlePortalLogin(event, 'analyst')">
          <div>
            <label for="aEmail">Email</label>
            <input type="text" id="aEmail" value="analyst@playstore.io" required />
          </div>
          <div>
            <label for="aPass">Password</label>
            <input type="password" id="aPass" value="analyst" required />
          </div>
          <button type="submit" class="btn-submit-portal btn-analyst" id="aBtn">
            Sign In to Analyst Suite →
          </button>
        </form>
      </div>

      <!-- PORTAL 3: ADMINISTRATOR -->
      <div class="portal-box admin-portal">
        <div class="portal-pill pill-admin">👑 Administrator</div>
        <h2 class="portal-h">Warehouse Governance</h2>
        <p class="portal-p">Oversee Star Schema health, canonical ETL audits, and model versions.</p>
        <div class="portal-features">
          <div class="f-item"><span>✓</span> Star Schema &amp; Referential Integrity</div>
          <div class="f-item"><span>✓</span> Canonical ETL Conservation Audit</div>
          <div class="f-item"><span>✓</span> Live Fact_App Record Editor</div>
          <div class="f-item"><span>✓</span> Model Registry &amp; V&amp;V Matrix</div>
        </div>
        <form class="portal-form" onsubmit="handlePortalLogin(event, 'admin')">
          <div>
            <label for="admEmail">Email</label>
            <input type="text" id="admEmail" value="admin@playstore.io" required />
          </div>
          <div>
            <label for="admPass">Password</label>
            <input type="password" id="admPass" value="admin" required />
          </div>
          <button type="submit" class="btn-submit-portal btn-admin" id="admBtn">
            Sign In to Admin Console →
          </button>
        </form>
      </div>

    </div>

    <!-- Quick Demo Bar -->
    <div class="quick-bar">
      <div class="quick-label">⚡ 1-Click Instant Evaluation Demo:</div>
      <div class="quick-btns">
        <button type="button" class="btn-quick" onclick="quickLogin('user')">👤 Demo Normal User</button>
        <button type="button" class="btn-quick" onclick="quickLogin('analyst')">💼 Demo Business Analyst</button>
        <button type="button" class="btn-quick" onclick="quickLogin('admin')">👑 Demo Administrator</button>
      </div>
    </div>

  </div>

  <script>
    const API = (window.location.protocol === "file:" || window.location.port === "5500" || window.location.port === "3000")
      ? "http://127.0.0.1:5000/api"
      : "/api";

    function showAlert(msg, type = "error") {
      const el = document.getElementById("loginAlert");
      if (!el) return;
      el.textContent = msg;
      el.className = `login-alert login-alert-${type}`;
      el.classList.remove("hidden");
    }

    function clearAlert() {
      const el = document.getElementById("loginAlert");
      if (el) el.classList.add("hidden");
    }

    function redirectByRole(role) {
      if (role === "admin") {
        window.location.href = "/admin.html";
      } else if (role === "analyst") {
        window.location.href = "/analyst.html";
      } else {
        window.location.href = "/user.html";
      }
    }

    async function handlePortalLogin(e, expectedRole) {
      e.preventDefault();
      clearAlert();
      let email = "", pass = "", btn = null;

      if (expectedRole === "user") {
        email = document.getElementById("uEmail").value.trim();
        pass = document.getElementById("uPass").value.trim();
        btn = document.getElementById("uBtn");
      } else if (expectedRole === "analyst") {
        email = document.getElementById("aEmail").value.trim();
        pass = document.getElementById("aPass").value.trim();
        btn = document.getElementById("aBtn");
      } else {
        email = document.getElementById("admEmail").value.trim();
        pass = document.getElementById("admPass").value.trim();
        btn = document.getElementById("admBtn");
      }

      if (btn) { btn.disabled = true; btn.textContent = "Authenticating…"; }

      try {
        const res = await fetch(`${API}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: pass })
        });
        const data = await res.json();
        if (res.ok) {
          localStorage.setItem("playstore_iq_token", data.token);
          localStorage.setItem("playstore_iq_user", JSON.stringify(data.user));
          const role = data.user.role || expectedRole;
          showAlert(`Welcome, ${data.user.name}! Redirecting to ${role.toUpperCase()} workspace…`, "success");
          setTimeout(() => redirectByRole(role), 350);
        } else {
          showAlert(data.error || "Authentication failed. Please verify credentials.", "error");
        }
      } catch (err) {
        showAlert("Network error: " + err.message, "error");
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = expectedRole === "user" ? "Sign In to Discovery →" : expectedRole === "analyst" ? "Sign In to Analyst Suite →" : "Sign In to Admin Console →";
        }
      }
    }

    async function quickLogin(role) {
      clearAlert();
      const creds = role === "admin"
        ? { email: "admin@playstore.io", password: "admin" }
        : role === "analyst"
        ? { email: "analyst@playstore.io", password: "analyst" }
        : { email: "user@playstore.io", password: "user" };

      try {
        const res = await fetch(`${API}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(creds)
        });
        const data = await res.json();
        if (res.ok) {
          localStorage.setItem("playstore_iq_token", data.token);
          localStorage.setItem("playstore_iq_user", JSON.stringify(data.user));
          showAlert(`Logged in as ${data.user.name}! Redirecting…`, "success");
          setTimeout(() => redirectByRole(data.user.role || role), 300);
        } else {
          showAlert(data.error || "Quick login failed", "error");
        }
      } catch (err) {
        showAlert("Connection error: " + err.message, "error");
      }
    }
  </script>
</body>
</html>
"""

with open('frontend/login.html', 'w', encoding='utf-8') as f:
    f.write(login_html)

print("Generated clean 3-door frontend/login.html successfully!")
