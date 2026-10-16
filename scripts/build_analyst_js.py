import re

with open('frontend/user.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 1. Null-safe globalSearch
old_search = '''let searchTimer;
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
});'''

new_search = '''let searchTimer;
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
});'''

js = js.replace(old_search, new_search)

# 2. Null-safe dateStart and dateEnd in loadMeta
old_dates = '''    if (meta.minDate) document.getElementById("dateStart").min = meta.minDate;
    if (meta.maxDate) {
      document.getElementById("dateEnd").max   = meta.maxDate;
      document.getElementById("dateEnd").value  = meta.maxDate;
      document.getElementById("dateStart").value = meta.minDate;
    }'''

new_dates = '''    const dStart = document.getElementById("dateStart");
    const dEnd   = document.getElementById("dateEnd");
    if (dStart && meta.minDate) { dStart.min = meta.minDate; dStart.value = meta.minDate; }
    if (dEnd && meta.maxDate)   { dEnd.max   = meta.maxDate; dEnd.value   = meta.maxDate; }'''

js = js.replace(old_dates, new_dates)

# 3. Null-safe reviewCount
js = js.replace(
    'document.getElementById("reviewCount").textContent = fmtNum(total);',
    'const rcEl = document.getElementById("reviewCount"); if (rcEl) rcEl.textContent = fmtNum(total);'
)

# 4. Remove trending from renderAll in analyst
js = js.replace('filterTrendingTime(currentTrendingWindow),', '// filterTrendingTime removed for analyst view')

# 5. Null-safe connDot
js = js.replace(
    'const dot = document.getElementById("connDot");\n  dot.className = "conn-dot " + (ok ? "ok" : "err");\n  dot.title = ok ? "API connected" : "API disconnected";',
    'const dot = document.getElementById("connDot");\n  if (dot) { dot.className = "conn-dot " + (ok ? "ok" : "err"); dot.title = ok ? "API connected" : "API disconnected"; }'
)

# 6. Auth check for analyst
old_auth = '''async function checkUserAuth() {
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
}'''

new_auth = '''async function checkUserAuth() {
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
    
    // Role check: Normal users should not access the Analyst DWM suite
    if (currentUser.role === "user") {
      window.location.href = "/user.html";
      return false;
    }

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
}'''

js = js.replace(old_auth, new_auth)

with open('frontend/analyst.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("Created frontend/analyst.js successfully!")
