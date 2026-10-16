import re

with open('frontend/analyst.js', 'r', encoding='utf-8') as f:
    js = f.read()

with open('frontend/analyst.html', 'r', encoding='utf-8') as f:
    html = f.read()

ids = set(re.findall(r'document\.getElementById\(["\']([^"\']+)["\']\)', js))
missing = [i for i in ids if f'id="{i}"' not in html and f"id='{i}'" not in html]

print(f"Total unique getElementById: {len(ids)}")
print(f"Missing count: {len(missing)}")
for m in sorted(missing):
    lines_with_id = [line.strip() for line in js.splitlines() if f'document.getElementById("{m}")' in line or f"document.getElementById('{m}')" in line]
    print(f"  - {m}: {lines_with_id}")
