import re

with open("backend/src/modules/cicd/cicd.service.ts", "r") as f:
    content = f.read()

content = re.sub(
    r'aiService\.generateCicd\(dto\.description\)',
    r'aiService.generateCicd(dto)',
    content
)

with open("backend/src/modules/cicd/cicd.service.ts", "w") as f:
    f.write(content)
