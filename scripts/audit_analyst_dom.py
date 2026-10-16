import re

with open('frontend/analyst.js', 'r', encoding='utf-8') as f:
    js = f.read()

with open('frontend/analyst.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Check every getElementById that is accessed without a null check
pattern = r'document\.getElementById\(["\']([^"\']+)["\']\)(\.[a-zA-Z0-9_]+|\.addEventListener)'
unsafe_lookups = re.findall(pattern, js)
print(f"Total direct/chained lookups found: {len(unsafe_lookups)}")

for id_name, chain in unsafe_lookups:
    in_html = f'id="{id_name}"' in html or f"id='{id_name}'" in html
    if not in_html:
        print(f"CRITICAL HAZARD: document.getElementById('{id_name}'){chain} is in analyst.js but '{id_name}' is NOT in analyst.html!")
    else:
        # It exists in html
        pass

print("Audit of chained DOM lookups complete.")
