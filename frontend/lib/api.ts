import axios, { AxiosError } from "axios";
import { clearToken, getToken } from "./auth";
import {
  AuthResponse,
  CicdResult,
  DebugResult,
  RequestRecord,
  ReviewResult,
  UsageStats,
  AnalysisResult,
  DevopsProject,
  GeneratedFile,
  GithubRepo,
  GithubStatus,
  OnboardRepoResult,
  LatestBundleResponse,
  RepoReadinessResult,
  RepoDiffResult,
  ApplyPrResult,
  ActionsRun,
  ActionsDebugResult,
  RepoMemory,
} from "./types";
import type {
  CicdResult as RichCicdResult,
  CodeReviewResult,
  DebugResult as RichDebugResult,
  HistoryItem,
  UsageStats as DashboardUsageStats,
} from "@/types";

const USER_STORAGE_KEY = "devmate_user";

interface RegisterPayload {
  name?: string;
  email: string;
  password: string;
}

interface LoginPayload {
  email: string;
  password: string;
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  headers: {
    "Content-Type": "application/json",
  },
});

const normalizeErrorMessage = (error: AxiosError) => {
  const payload = error.response?.data as any;

  if (typeof payload === "string") return payload;
  if (payload?.message) {
    if (Array.isArray(payload.message)) return payload.message.join(", ");
    return payload.message;
  }

  return error.message || "Request failed";
};

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      // Clear stale session and force re-authentication when the backend rejects the token.
      clearToken();
      window.localStorage.removeItem(USER_STORAGE_KEY);

      if (!window.location.pathname.startsWith("/auth")) {
        window.location.href = "/auth";
      }
    }

    return Promise.reject(new Error(normalizeErrorMessage(error)));
  }
);

export const apiClient = {
  async register(email: string, password: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>("/auth/register", {
      email,
      password,
    });
    return data;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>("/auth/login", {
      email,
      password,
    });
    return data;
  },

  async reviewCode(code: string, language: string): Promise<ReviewResult> {
    const { data } = await api.post<ReviewResult>("/review-code", {
      code,
      language,
    });
    return data;
  },

  async debugError(errorLog: string): Promise<DebugResult> {
    const { data } = await api.post<DebugResult>("/debug-error", { errorLog });
    return data;
  },

  async generateCicd(payload: any): Promise<CicdResult> {
    const { data } = await api.post<CicdResult>("/generate-cicd", payload);
    return data;
  },

  async getHistory(): Promise<RequestRecord[]> {
    const { data } = await api.get<RequestRecord[]>("/history");
    return data;
  },

  async getStats(): Promise<UsageStats> {
    const { data } = await api.get<UsageStats>("/history?stats=true");
    return data;
  },

  async deleteHistoryItem(id: string): Promise<{ deleted: boolean }> {
    const { data } = await api.delete<{ deleted: boolean }>(`/history/${id}`);
    return data;
  },

  async clearHistory(): Promise<{ deletedCount: number }> {
    const { data } = await api.delete<{ deletedCount: number }>("/history");
    return data;
  },

  async analyzePackage(payload: {
    packageJson: string;
    projectName?: string;
    repoUrl?: string;
    cloudTarget?: string;
    sourceType?: string;
  }): Promise<{ project: DevopsProject; analysis: AnalysisResult; versionId: string }> {
    const { data } = await api.post<{ project: DevopsProject; analysis: AnalysisResult; versionId: string }>("/devops/analyze-package", payload);
    return data;
  },

  async analyzeRepo(payload: {
    repoUrl: string;
    branch?: string;
    githubToken?: string;
    cloudTarget?: string;
    projectName?: string;
  }): Promise<{ project: DevopsProject; analysis: AnalysisResult; versionId: string }> {
    const { data } = await api.post<{ project: DevopsProject; analysis: AnalysisResult; versionId: string }>("/devops/analyze-repo", payload);
    return data;
  },

  async readinessScan(payload: {
    repoUrl: string;
    branch?: string;
    githubToken?: string;
    projectName?: string;
  }): Promise<RepoReadinessResult> {
    const { data } = await api.post<RepoReadinessResult>("/devops/readiness-scan", payload);
    return data;
  },

  async generateInfra(payload: any): Promise<{ versionId: string; files: GeneratedFile[]; costEstimate: string; securityFindings: string }> {
    const { data } = await api.post<{ versionId: string; files: GeneratedFile[]; costEstimate: string; securityFindings: string }>("/devops/generate-infra", payload);
    return data;
  },

  async improveConfig(payload: { projectVersionId: string; filePath: string; currentContent: string; userRequest?: string; cloudTarget?: string }): Promise<{ content: string }> {
    const { data } = await api.post<{ content: string }>("/devops/improve-config", payload);
    return data;
  },

  async analyzeLog(payload: { log: string; context?: string }) {
    const { data } = await api.post("/devops/log-analyzer", payload);
    return data;
  },

  async listProjects(): Promise<DevopsProject[]> {
    const { data } = await api.get<DevopsProject[]>("/devops/projects");
    return data;
  },

  async getLatestGeneratedBundle(): Promise<LatestBundleResponse> {
    const { data } = await api.get<LatestBundleResponse>("/devops/generated/latest");
    return data;
  },

  async githubStatus(): Promise<GithubStatus> {
    const { data } = await api.get<GithubStatus>("/devops/github/status");
    return data;
  },

  async getGithubOauthUrl(redirectPath?: string): Promise<{ url: string }> {
    const suffix = redirectPath ? `?redirectPath=${encodeURIComponent(redirectPath)}` : "";
    const { data } = await api.get<{ url: string }>(`/devops/github/oauth/start${suffix}`);
    return data;
  },

  async connectGithub(payload: { accessToken: string }): Promise<GithubStatus> {
    const { data } = await api.post<GithubStatus>("/devops/github/connect", payload);
    return data;
  },

  async disconnectGithub(): Promise<{ disconnected: boolean }> {
    const { data } = await api.delete<{ disconnected: boolean }>("/devops/github/connect");
    return data;
  },

  async listGithubRepos(limit = 20): Promise<{ repos: GithubRepo[] }> {
    const { data } = await api.get<{ repos: GithubRepo[] }>(`/devops/github/repos?limit=${limit}`);
    return data;
  },

  async onboardRepo(payload: {
    repoUrl: string;
    branch?: string;
    projectName?: string;
    githubToken?: string;
    cloudTarget?: string;
    autoGenerateInfra?: boolean;
  }): Promise<OnboardRepoResult> {
    const { data } = await api.post<OnboardRepoResult>("/devops/onboard-repo", payload);
    return data;
  },

  async diffGithub(payload: {
    repoUrl: string;
    branch?: string;
    files: Array<{ path: string; content: string }>;
  }): Promise<RepoDiffResult> {
    const { data } = await api.post<RepoDiffResult>("/devops/github/diff", payload);
    return data;
  },

  async applyPullRequest(payload: {
    repoUrl: string;
    baseBranch?: string;
    headBranch?: string;
    title?: string;
    body?: string;
    versionId?: string;
    files: Array<{ path: string; content: string }>;
  }): Promise<ApplyPrResult> {
    const { data } = await api.post<ApplyPrResult>("/devops/github/apply-pr", payload);
    return data;
  },

  async listActionRuns(repoUrl: string, branch?: string, limit = 10): Promise<{ runs: ActionsRun[] }> {
    const params = new URLSearchParams({
      repoUrl,
      limit: String(limit),
      ...(branch ? { branch } : {}),
    });
    const { data } = await api.get<{ runs: ActionsRun[] }>(`/devops/github/actions/runs?${params.toString()}`);
    return data;
  },

  async debugActions(payload: {
    repoUrl: string;
    branch?: string;
    runId?: string;
  }): Promise<ActionsDebugResult> {
    const { data } = await api.post<ActionsDebugResult>("/devops/github/actions/debug", payload);
    return data;
  },

  async listRepoMemory(limit = 20): Promise<RepoMemory[]> {
    const { data } = await api.get<RepoMemory[]>(`/devops/repo-memory?limit=${limit}`);
    return data;
  },

  async getRepoMemory(repoUrl: string): Promise<RepoMemory> {
    const { data } = await api.get<RepoMemory>(
      `/devops/repo-memory/by-repo?repoUrl=${encodeURIComponent(repoUrl)}`,
    );
    return data;
  },
};

export const authApi = {
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    // Backend DTO currently accepts email/password only.
    const { email, password } = payload;
    return apiClient.register(email, password);
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    return apiClient.login(payload.email, payload.password);
  },
};

function normalizeSeverity(text: string): "high" | "medium" | "low" {
  const value = text.toLowerCase();
  if (value.includes("critical") || value.includes("high")) return "high";
  if (value.includes("medium")) return "medium";
  return "low";
}

export const reviewApi = {
  async submit(payload: { code: string; language: string }): Promise<{ result: CodeReviewResult }> {
    const data = await apiClient.reviewCode(payload.code, payload.language);

    const bugItems = data.bugs.map((bug) => ({
      description: bug,
      severity: normalizeSeverity(bug),
    }));

    const totalSignals = data.bugs.length + data.improvements.length + data.optimizations.length;
    const score = Math.max(30, Math.min(100, 100 - data.bugs.length * 12 - data.improvements.length * 5 + data.optimizations.length * 2));

    return {
      result: {
        score,
        summary:
          totalSignals > 0
            ? `Detected ${data.bugs.length} bug findings, ${data.improvements.length} improvements, and ${data.optimizations.length} optimizations.`
            : "No notable issues were found.",
        bugs: bugItems,
        improvements: data.improvements,
        optimizations: data.optimizations,
      },
    };
  },
};

export const debugApi = {
  async submit(payload: { errorLog: string }): Promise<{ result: RichDebugResult }> {
    const data = await apiClient.debugError(payload.errorLog);

    return {
      result: {
        explanation: data.explanation,
        rootCause: data.rootCause,
        fixSteps: data.fixSteps,
        relatedConcepts: ["Logging", "Input validation", "Error handling"],
      },
    };
  },
};

export const cicdApi = {
  async submit(payload: any): Promise<{ result: CicdResult }> {
    const data = await apiClient.generateCicd(payload);
    return {
      result: data,
    };
  },
};

export const historyApi = {
  async get(params?: { limit?: number }): Promise<{ stats: DashboardUsageStats; data: HistoryItem[] }> {
    const limit = params?.limit && params.limit > 0 ? params.limit : undefined;
    const historyPath = limit ? `/history?limit=${limit}` : "/history";

    const [stats, historyResponse] = await Promise.all([
      apiClient.getStats(),
      api.get<RequestRecord[]>(historyPath),
    ]);

    const mappedStats: DashboardUsageStats = {
      total: stats.totalRequests,
      review: stats.byType.review,
      debug: stats.byType.debug,
      cicd: stats.byType.cicd,
    };

    const mappedHistory: HistoryItem[] = historyResponse.data.map((item) => ({
      id: item.id,
      type: (item.type.toUpperCase() as "REVIEW" | "DEBUG" | "CICD"),
      input: (item.input as Record<string, unknown>) ?? {},
      output: item.output,
      createdAt: item.createdAt,
    }));

    return {
      stats: mappedStats,
      data: mappedHistory,
    };
  },

  async deleteOne(id: string): Promise<{ deleted: boolean }> {
    return apiClient.deleteHistoryItem(id);
  },

  async clearAll(): Promise<{ deletedCount: number }> {
    return apiClient.clearHistory();
  },
};

export const devopsApi = {
  analyzePackage: apiClient.analyzePackage,
  analyzeRepo: apiClient.analyzeRepo,
  readinessScan: apiClient.readinessScan,
  onboardRepo: apiClient.onboardRepo,
  generateInfra: apiClient.generateInfra,
  improveConfig: apiClient.improveConfig,
  analyzeLog: apiClient.analyzeLog,
  listProjects: apiClient.listProjects,
  getLatestGeneratedBundle: apiClient.getLatestGeneratedBundle,
  githubStatus: apiClient.githubStatus,
  getGithubOauthUrl: apiClient.getGithubOauthUrl,
  connectGithub: apiClient.connectGithub,
  disconnectGithub: apiClient.disconnectGithub,
  listGithubRepos: apiClient.listGithubRepos,
  diffGithub: apiClient.diffGithub,
  applyPullRequest: apiClient.applyPullRequest,
  listActionRuns: apiClient.listActionRuns,
  debugActions: apiClient.debugActions,
  listRepoMemory: apiClient.listRepoMemory,
  getRepoMemory: apiClient.getRepoMemory,
};
