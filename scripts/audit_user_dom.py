import re

with open('frontend/user.js', 'r', encoding='utf-8') as f:
    js = f.read()

with open('frontend/user.html', 'r', encoding='utf-8') as f:
    html = f.read()

pattern = r'document\.getElementById\(["\']([^"\']+)["\']\)(\.[a-zA-Z0-9_]+|\.addEventListener)'
unsafe_lookups = re.findall(pattern, js)
print(f"Total direct/chained lookups found in user.js: {len(unsafe_lookups)}")

for id_name, chain in unsafe_lookups:
    in_html = f'id="{id_name}"' in html or f"id='{id_name}'" in html
    if not in_html:
        print(f"CRITICAL HAZARD: document.getElementById('{id_name}'){chain} is in user.js but '{id_name}' is NOT in user.html!")

print("Audit of user.js DOM lookups complete.")
