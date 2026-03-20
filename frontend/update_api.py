import re

with open("frontend/lib/api.ts", "r") as f:
    content = f.read()

content = re.sub(
    r'async submit\(payload: \{ description: string \}\): Promise<\{ result: CicdResult \}> \{',
    r'async submit(payload: any): Promise<{ result: CicdResult }> {',
    content
)

content = re.sub(
    r'async generateCicd\(description: string\): Promise<CicdResult> \{',
    r'async generateCicd(payload: any): Promise<CicdResult> {',
    content
)

content = re.sub(
    r'const \{ data \} = await api\.post<CicdResult>\("/generate-cicd", \{ description \}\);',
    r'const { data } = await api.post<CicdResult>("/generate-cicd", payload);',
    content
)

content = re.sub(
    r'const data = await apiClient\.generateCicd\(payload\.description\);',
    r'const data = await apiClient.generateCicd(payload);',
    content
)


with open("frontend/lib/api.ts", "w") as f:
    f.write(content)
