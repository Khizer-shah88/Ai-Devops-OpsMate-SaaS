import axios from "axios";
import { getToken } from "./auth";
import {
  AuthResponse,
  CicdResult,
  DebugResult,
  RequestRecord,
  ReviewResult,
  UsageStats,
} from "./types";
import type {
  CicdResult as RichCicdResult,
  CodeReviewResult,
  DebugResult as RichDebugResult,
  HistoryItem,
  UsageStats as DashboardUsageStats,
} from "@/types";

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

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
  async get(_params?: { limit?: number }): Promise<{ stats: DashboardUsageStats; data: HistoryItem[] }> {
    const [stats, history] = await Promise.all([apiClient.getStats(), apiClient.getHistory()]);

    const mappedStats: DashboardUsageStats = {
      total: stats.totalRequests,
      review: stats.byType.review,
      debug: stats.byType.debug,
      cicd: stats.byType.cicd,
    };

    const mappedHistory: HistoryItem[] = history.map((item) => ({
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
};
