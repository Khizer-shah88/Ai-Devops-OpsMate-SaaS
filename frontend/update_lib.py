import os

with open("lib/api.ts", "r") as f:
    orig = f.read()

s1 = """  async generateCicd(stack: "mern" | "nextjs" | "node"): Promise<CicdResult> {
    const { data } = await api.post<CicdResult>("/generate-cicd", { stack });
    return data;
  },"""
r1 = """  async generateCicd(description: string): Promise<CicdResult> {
    const { data } = await api.post<CicdResult>("/generate-cicd", { description });
    return data;
  },"""

s2 = """export const cicdApi = {
  async submit(payload: { stack: string }): Promise<{ result: RichCicdResult }> {
    const stack = ["mern", "nextjs", "node"].includes(payload.stack)
      ? (payload.stack as "mern" | "nextjs" | "node")
      : "node";

    const data = await apiClient.generateCicd(stack);

    return {
      result: {
        explanation: `Generated CI/CD scaffolding for ${stack.toUpperCase()} stack.`,
        githubActionsYaml: data.githubActionsYaml,
        dockerfileContent: data.dockerfileSuggestion,
        additionalNotes: [
          "Configure repository secrets for production deployment.",
          "Add environment-specific variables for staging and production.",
          "Run security and lint checks before deployment steps.",
        ],
      },
    };
  },
};"""
r2 = """export const cicdApi = {
  async submit(payload: { description: string }): Promise<{ result: CicdResult }> {
    const data = await apiClient.generateCicd(payload.description);
    return {
      result: data,
    };
  },
};"""

if s1 in orig and s2 in orig:
    fixed = orig.replace(s1, r1).replace(s2, r2)
    with open("lib/api.ts", "w") as f:
        f.write(fixed)
    print("SUCCESS")
else:
    print("NOT FOUND")
