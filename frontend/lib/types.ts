export interface User {
  id: string;
  name?: string;
  email: string;
  githubUsername?: string | null;
  githubAvatarUrl?: string | null;
  githubConnectedAt?: string | null;
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

export type CloudTarget = 'ecs' | 'eks' | 'vercel' | 'digitalocean' | 'local';

export interface DetectedService {
  name: string;
  kind: 'frontend' | 'backend' | 'database' | 'worker' | 'unknown';
  framework?: string;
  language?: string;
  portHint?: number;
  envHints?: string[];
}

export interface AnalysisResult {
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';
  services: DetectedService[];
  dependencies: string[];
  devDependencies: string[];
  notes?: string[];
}

export interface GeneratedFile {
  id: string;
  projectVersionId: string;
  path: string;
  content: string;
  kind?:
    | 'dockerfile'
    | 'dockerCompose'
    | 'githubActions'
    | 'kubernetes'
    | 'env'
    | 'readme'
    | 'cost'
    | 'security'
    | null;
  createdAt: string;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  label?: string | null;
  cloudTarget?: CloudTarget | null;
  analysis: AnalysisResult;
  generatedAt: string;
  files: GeneratedFile[];
}

export interface DevopsProject {
  id: string;
  name: string;
  repoUrl?: string | null;
  cloudTarget?: CloudTarget | null;
  summary?: string | null;
  detectedStack?: AnalysisResult;
  createdAt: string;
  updatedAt: string;
  versions?: ProjectVersion[];
}

export interface RepoHealthCheck {
  id: string;
  title: string;
  status: 'pass' | 'warn';
  details: string;
  fix: string;
}

export interface SecretRisk {
  severity: 'low' | 'medium' | 'high';
  path: string;
  finding: string;
  recommendation: string;
}

export interface RepoReadinessResult {
  analysis: AnalysisResult;
  readinessScore: number;
  maturity: 'production-ready' | 'staging-ready' | 'development-ready' | 'early';
  checks: RepoHealthCheck[];
  secretRisks: SecretRisk[];
}

export interface GithubStatus {
  connected: boolean;
  username: string | null;
  avatarUrl: string | null;
  connectedAt: string | null;
}

export interface GithubRepo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
  updatedAt: string;
  language: string | null;
}

export interface RepoInsights {
  owner: string;
  repo: string;
  defaultBranch: string;
  stars: number;
  openIssues: number;
  languages: string[];
  hasCi: boolean;
  hasDocker: boolean;
  hasKubernetes: boolean;
  hasTerraform: boolean;
  healthScore: number;
  checks: RepoHealthCheck[];
}

export interface OnboardRepoResult {
  project: DevopsProject;
  analysis: AnalysisResult;
  versionId: string;
  repoInsights: RepoInsights;
  autoFixPlan: string[];
  rolloutGuidance: string;
  generatedInfra: {
    versionId: string;
    files: GeneratedFile[];
    costEstimate: string;
    securityFindings: string;
  } | null;
}

export interface LatestBundleResponse {
  projectId?: string;
  projectName?: string;
  versionId?: string;
  analysis?: AnalysisResult;
  cloudTarget?: CloudTarget | null;
  files: GeneratedFile[];
}

export interface RepoDiffFile {
  path: string;
  status: "added" | "modified" | "unchanged";
  before: string;
  after: string;
  beforeSha: string | null;
  beforeLines: number;
  afterLines: number;
  hunks: string[];
}

export interface RepoDiffResult {
  repoUrl: string;
  branch: string;
  summary: { added: number; modified: number; unchanged: number };
  files: RepoDiffFile[];
}

export interface ApplyPrResult {
  repoUrl: string;
  baseBranch: string;
  headBranch: string;
  commitSha: string;
  prNumber: number;
  prUrl: string;
  files: string[];
}

export interface ActionsRun {
  id: string;
  name: string;
  title: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  headBranch: string;
  event: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActionsDebugResult {
  repoUrl: string;
  run: {
    id: string;
    name?: string;
    title?: string;
    status?: string;
    conclusion?: string | null;
    htmlUrl?: string;
    headBranch?: string;
  };
  job: {
    id: string;
    name: string;
    status: string;
    conclusion: string | null;
    htmlUrl: string;
  };
  logExcerpt: string;
  diagnosis: DebugResult;
}

export interface RepoMemoryEvent {
  id: string;
  type: string;
  summary: string;
  payload?: unknown;
  createdAt: string;
}

export interface RepoMemory {
  id: string;
  repoUrl: string;
  owner: string;
  repo: string;
  defaultBranch?: string | null;
  lastBranch?: string | null;
  cloudTarget?: CloudTarget | null;
  analysis?: AnalysisResult | null;
  readiness?: RepoReadinessResult | null;
  lastVersionId?: string | null;
  lastPrUrl?: string | null;
  lastPrNumber?: number | null;
  lastActionsRunId?: string | null;
  lastActionsStatus?: string | null;
  notes?: string | null;
  updatedAt: string;
  events?: RepoMemoryEvent[];
}
