import os
import re

def test_ui_and_responsiveness():
    # 1. style.css
    with open('frontend/style.css', 'r', encoding='utf-8') as f:
        css = f.read()

    assert 'calc(100% - var(--sidebar-w))' in css, "main-wrapper must be constrained to calc(100% - var(--sidebar-w))"
    assert '.admin-charts-grid' in css, "style.css must define .admin-charts-grid"
    assert '.algo-cards-grid' in css, "style.css must define .algo-cards-grid"
    assert 'minmax(0, 1fr)' in css, "style.css must use minmax(0, 1fr) for grid items"
    print("[PASS] style.css responsiveness and grid rules verified")

    # 2. admin.html
    with open('frontend/admin.html', 'r', encoding='utf-8') as f:
        admin_html = f.read()

    assert 'data-theme="light"' in admin_html, "admin.html must default to data-theme='light'"
    assert 'admin-charts-grid' in admin_html, "admin.html must contain admin-charts-grid wrapper"
    assert 'mlCompareChart' in admin_html, "admin.html must contain mlCompareChart"
    assert 'mlRadarChart' in admin_html, "admin.html must contain mlRadarChart"
    assert 'algoCardsGrid' in admin_html, "admin.html must contain algoCardsGrid"
    assert 'How It Works' not in admin_html, "admin.html must have 'How It Works' removed"
    assert 'dwm-view-switcher' not in admin_html, "admin.html must have dwm-view-switcher removed"
    assert 'class-tech-view' not in admin_html, "admin.html must have class-tech-view removed"
    assert 'clusters-tech-view' not in admin_html, "admin.html must have clusters-tech-view removed"
    print("[PASS] admin.html markup, light theme, and removal of 'How It Works' verified")

    # 3. admin.js
    with open('frontend/admin.js', 'r', encoding='utf-8') as f:
        admin_js = f.read()

    assert 'autoSkip: false' in admin_js, "admin.js must specify autoSkip: false to prevent 6th classifier from being skipped"
    assert 'maxRotation: 25' in admin_js, "admin.js must set maxRotation: 25 for x-ticks readability"
    assert 'ps_theme' in admin_js, "admin.js must manage ps_theme"
    assert 'adminResizeTimer' in admin_js, "admin.js must include window resize debouncer"
    print("[PASS] admin.js Chart.js options and responsive handlers verified")

    # 4. analyst.html
    with open('frontend/analyst.html', 'r', encoding='utf-8') as f:
        analyst_html = f.read()

    assert 'data-theme="light"' in analyst_html, "analyst.html must default to data-theme='light'"
    assert 'tfBtn7d' not in analyst_html, "analyst.html must have Weekly (7d) removed"
    assert 'data-range="3m"' in analyst_html, "analyst.html must contain 3M (3m) timeframe tab"
    assert 'data-range="1m"' in analyst_html, "analyst.html must contain Monthly (1m) timeframe tab"
    assert 'data-range="6m"' in analyst_html, "analyst.html must contain 6M (6m) timeframe tab"
    assert 'data-range="1y"' in analyst_html, "analyst.html must contain 1Yr (1y) timeframe tab"
    assert 'How It Works' not in analyst_html, "analyst.html must have 'How It Works' removed"
    assert 'dwm-view-switcher' not in analyst_html, "analyst.html must have dwm-view-switcher removed"
    assert 'olap-tech-view' not in analyst_html, "analyst.html must have olap-tech-view removed"
    assert 'sent-tech-view' not in analyst_html, "analyst.html must have sent-tech-view removed"
    assert 'assoc-tech-view' not in analyst_html, "analyst.html must have assoc-tech-view removed"
    assert 'pred-tech-view' not in analyst_html, "analyst.html must have pred-tech-view removed"
    assert 'opp-tech-view' not in analyst_html, "analyst.html must have opp-tech-view removed"
    print("[PASS] analyst.html timeframe tabs (Monthly, 3M, 6M, 1Yr) and removal of 'How It Works' verified")

    # 5. analyst.js
    with open('frontend/analyst.js', 'r', encoding='utf-8') as f:
        analyst_js = f.read()

    assert 'ps_theme' in analyst_js, "analyst.js must persist ps_theme"
    assert '"3m": "3 Months"' in analyst_js, "analyst.js must contain 3m range label"
    assert '"7d"' not in analyst_js, "analyst.js must not contain 7d range label"
    assert 'chartResizeDebounceTimer' in analyst_js, "analyst.js must debounce chart resize"
    print("[PASS] analyst.js theme persistence, 3m range label, and resize handling verified")

    # 6. Verify public mirror files are in sync
    for fn in ['style.css', 'admin.html', 'admin.js', 'analyst.html', 'analyst.js']:
        with open(os.path.join('frontend', fn), 'r', encoding='utf-8') as f1:
            c1 = f1.read()
        with open(os.path.join('public', fn), 'r', encoding='utf-8') as f2:
            c2 = f2.read()
        assert c1 == c2, f"public/{fn} is not identical to frontend/{fn}"
    print("[PASS] public/ mirrored files are synchronized 1:1 with frontend/")

    print("\nALL UI RESPONSIVENESS, TIMEFRAME TABS, AND HOW-IT-WORKS REMOVAL VERIFICATIONS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    test_ui_and_responsiveness()
