export interface User {
  id: string;
  name?: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export type Bug = "high" | "medium" | "low";

export interface CodeReviewBugItem {
  line?: number;
  description: string;
  severity: Bug;
}

export interface CodeReviewResult {
  score: number;
  summary: string;
  bugs: CodeReviewBugItem[];
  improvements: string[];
  optimizations: string[];
}

export interface DebugResult {
  explanation: string;
  rootCause: string;
  fixSteps: string[];
  relatedConcepts: string[];
}

export interface CicdResult {
  dockerfile: string;
  dockerCompose: string;
  githubActions: string;
  kubernetes: string;
  env: string;
  setupInstructions: string;
}

export interface HistoryItem {
  id: string;
  type: "REVIEW" | "DEBUG" | "CICD";
  input: Record<string, unknown>;
  output: unknown;
  createdAt: string;
}

export interface UsageStats {
  total: number;
  review: number;
  debug: number;
  cicd: number;
}
