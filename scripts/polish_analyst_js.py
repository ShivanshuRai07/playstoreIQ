import re

with open('frontend/analyst.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 1. Null-safe guard for renderExplorer
js = js.replace(
    'async function renderExplorer(page = 1) {',
    'async function renderExplorer(page = 1) {\n  if (!document.getElementById("explorerTable")) return;'
)

# 2. Null-safe guard for renderInsights
js = js.replace(
    'async function renderInsights() {',
    'async function renderInsights() {\n  if (!document.getElementById("insightsList")) return;'
)

# 3. Clean up switchUserRole
old_switch = '''function switchUserRole(role) {
  currentRoleView = role;
  const analystNav = document.getElementById("analystNavGroup");
  const normalNav = document.getElementById("normalNavGroup");
  const btnAnalyst = document.getElementById("btnRoleAnalyst");
  const btnNormal = document.getElementById("btnRoleNormal");

  if (role === "analyst") {
    if (analystNav) analystNav.classList.remove("hidden");
    if (normalNav) normalNav.classList.add("hidden");
    if (btnAnalyst) btnAnalyst.classList.add("active");
    if (btnNormal) btnNormal.classList.remove("active");

    const secOlap = document.getElementById("section-olap");
    if (secOlap) secOlap.classList.remove("hidden");
    const secPred = document.getElementById("section-predictor");
    if (secPred) secPred.classList.remove("hidden");
    const secClus = document.getElementById("section-clusters");
    if (secClus) secClus.classList.remove("hidden");
    const secAssoc = document.getElementById("section-association");
    if (secAssoc) secAssoc.classList.remove("hidden");
    const secSent = document.getElementById("section-sentiment");
    if (secSent) secSent.classList.remove("hidden");
    const secOpp = document.getElementById("section-opportunity");
    if (secOpp) secOpp.classList.remove("hidden");
    const secClass = document.getElementById("section-classification");
    if (secClass) secClass.classList.remove("hidden");
    const secTrend = document.getElementById("section-trending");
    if (secTrend) secTrend.classList.add("hidden");
  } else {
    if (analystNav) analystNav.classList.add("hidden");
    if (normalNav) normalNav.classList.remove("hidden");
    if (btnAnalyst) btnAnalyst.classList.remove("active");
    if (btnNormal) btnNormal.classList.add("active");

    const secOlap = document.getElementById("section-olap");
    if (secOlap) secOlap.classList.add("hidden");
    const secPred = document.getElementById("section-predictor");
    if (secPred) secPred.classList.add("hidden");
    const secClus = document.getElementById("section-clusters");
    if (secClus) secClus.classList.add("hidden");
    const secAssoc = document.getElementById("section-association");
    if (secAssoc) secAssoc.classList.add("hidden");
    const secSent = document.getElementById("section-sentiment");
    if (secSent) secSent.classList.add("hidden");
    const secOpp = document.getElementById("section-opportunity");
    if (secOpp) secOpp.classList.add("hidden");
    const secClass = document.getElementById("section-classification");
    if (secClass) secClass.classList.add("hidden");
    const secTrend = document.getElementById("section-trending");
    if (secTrend) secTrend.classList.remove("hidden");
  }
}
window.switchUserRole = switchUserRole;'''

new_switch = '''function switchUserRole(role) {
  if (role === "user") {
    window.location.href = "/user.html";
  }
}
window.switchUserRole = switchUserRole;'''

js = js.replace(old_switch, new_switch)

# 4. Remove renderExplorer from renderAll
js = js.replace('renderExplorer(),', '// renderExplorer removed')

with open('frontend/analyst.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("Polished frontend/analyst.js successfully!")
