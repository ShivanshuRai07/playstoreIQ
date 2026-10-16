import re

with open('frontend/user.html', 'r', encoding='utf-8') as f:
    content = f.read()

sections = re.findall(r'<section\s+id=[\'"]([^\'"]+)[\'"]', content)
print("Sections found in user.html:", sections)
