import re

with open("frontend/lib/types.ts", "r") as f:
    content = f.read()

cicd_result_pattern = r"export interface CicdResult \{[\s\S]*?\n\}"
new_cicd_result = """export interface CicdResult {
  dockerfile: string;
  dockerCompose: string;
  githubActions: string;
  kubernetes: string;
  env: string;
  validation: string;
  explanation: string;
  setupInstructions: string;
}"""
content = re.sub(cicd_result_pattern, new_cicd_result, content)

with open("frontend/lib/types.ts", "w") as f:
    f.write(content)
