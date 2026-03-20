import re

with open("backend/src/modules/ai/ai.service.ts", "r") as f:
    content = f.read()

# Update CicdOutput interface
output_pattern = r"export interface CicdOutput \{[^}]+\}"
new_output = """export interface CicdOutput {
\tdockerfile: string;
\tdockerCompose: string;
\tgithubActions: string;
\tkubernetes: string;
\tenv: string;
\tvalidation: string;
\texplanation: string;
\tsetupInstructions: string;
}"""
content = re.sub(output_pattern, new_output, content)

# Update generateCicd method
def replace_generato(match):
    before = content[:match.start()]
    after = content[match.end():]
    new_method = """\tasync generateCicd(payload: any): Promise<CicdOutput> {
\t\tif (!this.client) {
\t\t\treturn {
\t\t\t\tdockerfile: 'FROM node:20-alpine\\nWORKDIR /app\\nCOPY . .\\nRUN npm ci\\nCMD ["npm","start"]',
\t\t\t\tdockerCompose: 'version: "3"\\nservices:\\n  app:\\n    build: .\\n    ports:\\n      - "3000:3000"\\n',
\t\t\t\tgithubActions: 'name: CI\\non: [push]\\njobs:\\n  build:\\n    runs-on: ubuntu-latest\\n    steps:\\n      - uses: actions/checkout@v4\\n',
\t\t\t\tkubernetes: 'apiVersion: apps/v1\\nkind: Deployment\\n...',
\t\t\t\tenv: 'PORT=3000\\nNODE_ENV=production',
\t\t\t\tvalidation: 'No validation issues found',
\t\t\t\texplanation: 'Explanation of the setup',
\t\t\t\tsetupInstructions: '1. Configure env\\n2. Run docker-compose up',
\t\t\t};
\t\t}

\t\tconst prompt = [
\t\t\t'You are a senior DevOps engineer, cloud architect, and infrastructure automation expert.',
\t\t\t'Your job is to intelligently assist with DevOps configurations for real-world production systems.',
\t\t\t'',
\t\t\t'-------------------------',
\t\t\t'CONTEXT',
\t\t\t'-------------------------',
\t\t\t`Project Description: ${payload.projectDescription || 'N/A'}`,
\t\t\t`Tech Stack: ${payload.stackInfo || 'N/A'}`,
\t\t\t`Cloud Target: ${payload.cloudProvider || 'N/A'}`,
\t\t\t`Mode: ${payload.mode || 'N/A'}`,
\t\t\t`Existing Configuration (if any): ${payload.existingConfig || 'N/A'}`,
\t\t\t`User Request: ${payload.userRequest || 'N/A'}`,
\t\t\t`Action Type: ${payload.actionType || 'generate'}`,
\t\t\t'',
\t\t\t'-------------------------',
\t\t\t'INSTRUCTIONS',
\t\t\t'-------------------------',
\t\t\t'Step 1: Understand the architecture (frontend, backend, database, services)',
\t\t\t'Step 2: Based on Action Type:',
\t\t\t'### IF ACTION_TYPE = "generate"',
\t\t\t'- Generate complete production-ready setup including Dockerfile, docker-compose, CI/CD, Kubernetes, .env',
\t\t\t'### IF ACTION_TYPE = "modify"',
\t\t\t'- Update ONLY the necessary parts. Keep existing structure intact.',
\t\t\t'### IF ACTION_TYPE = "validate"',
\t\t\t'- Identify security issues, missing env variables, bad practices, incorrect ports',
\t\t\t'### IF ACTION_TYPE = "explain"',
\t\t\t'- Explain each part of the configuration',
\t\t\t'',
\t\t\t'-------------------------',
\t\t\t'RULES',
\t\t\t'-------------------------',
\t\t\t'- Use best practices (security, scalability)',
\t\t\t'- Avoid hardcoding secrets. Use environment variables',
\t\t\t'- Keep configs clean and readable',
\t\t\t'',
\t\t\t'IMPORTANT: Return strict JSON with the following exact keys: dockerfile, dockerCompose, githubActions, kubernetes, env, validation, explanation, setupInstructions.',
\t\t\t'For keys that are not relevant to the user request or action type, return "Not required" or "Not applicable".'
\t\t].join('\\n');

\t\treturn this.generateJson<CicdOutput>(prompt);
\t}"""
    return new_method

content = re.sub(r'async generateCicd\(description: string\): Promise<CicdOutput> \{[\s\S]*?\n\t}', replace_generato, content)

with open("backend/src/modules/ai/ai.service.ts", "w") as f:
    f.write(content)

