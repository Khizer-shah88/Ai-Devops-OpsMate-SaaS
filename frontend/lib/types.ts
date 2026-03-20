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

export interface ReviewResult {
  bugs: string[];
  improvements: string[];
  optimizations: string[];
}

export interface DebugResult {
  explanation: string;
  rootCause: string;
  fixSteps: string[];
}

export interface CicdResult {
  dockerfile: string;
  dockerCompose: string;
  githubActions: string;
  kubernetes: string;
  env: string;
  validation: string;
  explanation: string;
  setupInstructions: string;
}

export interface RequestRecord {
  id: string;
  userId: string;
  type: "review" | "debug" | "cicd";
  input: unknown;
  output: unknown;
  createdAt: string;
}

export interface UsageStats {
  totalRequests: number;
  byType: {
    review: number;
    debug: number;
    cicd: number;
  };
}
