'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bot,
  CheckCircle2,
  Clipboard,
  FolderGit2,
  GitBranch,
  Loader2,
  Rocket,
  SendHorizontal,
  Sparkles,
  TerminalSquare,
  Unplug,
  User,
  Wand2,
  Save,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { RepoSelect } from '@/components/shared/RepoSelect';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { devopsApi } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import type {
  AnalysisResult,
  CloudTarget,
  DevopsProject,
  GeneratedFile,
  GithubRepo,
  GithubStatus,
  OnboardRepoResult,
} from '@/lib/types';
import { useRequireAuth } from '@/hooks/useRequireAuth';

const DEVOPS_STATE_KEY = 'devmate_state_DEVOPS';
const DEVOPS_CLEARED_VERSION_KEY = 'devmate_devops_cleared_version';
const DEVOPS_HISTORY_KEY = 'devmate_history_DEVOPS';

const CLOUDS: { value: CloudTarget; label: string }[] = [
  { value: 'ecs', label: 'AWS ECS (Fargate)' },
  { value: 'eks', label: 'AWS EKS' },
  { value: 'vercel', label: 'Vercel' },
  { value: 'digitalocean', label: 'DigitalOcean' },
  { value: 'local', label: 'Local (docker-compose)' },
];

const CHAT_QUICK_PROMPTS = [
  'Create production CI/CD workflow for this repo',
  'Fix failing GitHub Actions deploy step',
  'Harden pipeline security and secrets',
  'Suggest rollback-safe deployment strategy',
];

interface DevopsChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

function cleanAssistantReply(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  const lines = trimmed
    .split('\n')
    .filter((line) => {
      const lower = line.trim().toLowerCase();
      if (lower.startsWith('the user has')) return false;
      if (lower.startsWith('you requested')) return false;
      if (lower.startsWith('you asked')) return false;
      if (lower.startsWith('the goal is to')) return false;
      if (lower.startsWith('based on the request')) return false;
      return true;
    });

  return lines.join('\n').trim();
}

function FileCard({ file }: { file: GeneratedFile }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/80 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{file.path}</p>
          <p className="text-[11px] text-muted-foreground uppercase tracking-[0.12em]">{file.kind ?? 'file'}</p>
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-border hover:bg-secondary"
        >
          <Clipboard className="w-3.5 h-3.5" /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="rounded-xl border border-border bg-secondary/45 p-3 text-[12px] max-h-64 overflow-auto whitespace-pre-wrap">
        {file.content}
      </pre>
    </div>
  );
}

function StackPills({ analysis }: { analysis: AnalysisResult }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {analysis.services.map((svc) => (
        <div key={svc.name + svc.kind + (svc.framework ?? '')} className="px-3 py-1.5 rounded-full border border-border bg-secondary/40 text-xs text-foreground">
          {svc.framework ?? svc.name} <span className="text-muted-foreground">({svc.kind})</span>
        </div>
      ))}
    </div>
  );
}

export default function DevopsPage() {
  useRequireAuth();

  const [cloud, setCloud] = useState<CloudTarget>('ecs');
  const [githubStatus, setGithubStatus] = useState<GithubStatus | null>(null);
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [selectedRepoUrl, setSelectedRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [onboardResult, setOnboardResult] = useState<OnboardRepoResult | null>(null);
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [cost, setCost] = useState('');
  const [security, setSecurity] = useState('');
  const [logInput, setLogInput] = useState('');
  const [logResult, setLogResult] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatting, setChatting] = useState(false);
  const [chatMessages, setChatMessages] = useState<DevopsChatMessage[]>([
    {
      id: 'intro',
      role: 'assistant',
      content:
        'I am your Pro DevOps Engineer assistant. Ask me about CI/CD failures, Docker errors, deployment strategy, cloud rollout, security checks, and production hardening.',
      createdAt: new Date().toISOString(),
    },
  ]);
  const [versionOptions, setVersionOptions] = useState<Array<{
    versionId: string;
    label: string;
    generatedAt: string;
    files: GeneratedFile[];
    analysis: AnalysisResult;
    projectId: string;
    cloudTarget?: CloudTarget | null;
    projectName: string;
    repoUrl?: string | null;
  }>>([]);
  const [selectedVersionId, setSelectedVersionId] = useState('');

  const [connectingGithub, setConnectingGithub] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analyzingLogs, setAnalyzingLogs] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [error, setError] = useState('');
  const [historyNotice, setHistoryNotice] = useState('');

  const persistState = (next: {
    files: GeneratedFile[];
    analysis?: AnalysisResult | null;
    projectId?: string | null;
    cloud?: CloudTarget;
    selectedRepoUrl?: string;
    branch?: string;
    versionId?: string | null;
  }) => {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(
      DEVOPS_STATE_KEY,
      JSON.stringify({
        files: next.files,
        analysis: next.analysis ?? analysis,
        projectId: next.projectId ?? projectId,
        cloud: next.cloud ?? cloud,
        selectedRepoUrl: next.selectedRepoUrl ?? selectedRepoUrl,
        branch: next.branch ?? branch,
        versionId: next.versionId ?? currentVersionId,
      }),
    );
  };

  const restoreFromSavedState = () => {
    if (typeof window === 'undefined') return false;

    try {
      const raw = window.localStorage.getItem(DEVOPS_STATE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as {
        files?: GeneratedFile[];
        analysis?: AnalysisResult | null;
        projectId?: string | null;
        cloud?: CloudTarget;
        selectedRepoUrl?: string;
        branch?: string;
        versionId?: string | null;
      };

      if (parsed.cloud) setCloud(parsed.cloud);
      if (parsed.selectedRepoUrl) setSelectedRepoUrl(parsed.selectedRepoUrl);
      if (parsed.branch) setBranch(parsed.branch);
      if (typeof parsed.projectId === 'string') setProjectId(parsed.projectId);
      if (parsed.analysis) setAnalysis(parsed.analysis);
      if (parsed.versionId) setCurrentVersionId(parsed.versionId);
      if (Array.isArray(parsed.files) && parsed.files.length > 0) {
        setFiles(parsed.files);
        return true;
      }
    } catch {
      // Ignore invalid saved payload.
    }

    return false;
  };

  const clearCurrentBundle = () => {
    setFiles([]);
    setCost('');
    setSecurity('');
    setError('');

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DEVOPS_STATE_KEY);
      if (currentVersionId) {
        window.localStorage.setItem(DEVOPS_CLEARED_VERSION_KEY, currentVersionId);
      }
    }
  };

  const saveHistory = () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(DEVOPS_HISTORY_KEY);
      const existing = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      const next = [
        {
          createdAt: new Date().toISOString(),
          repoUrl: selectedRepoUrl,
          branch,
          cloud,
          analysis,
          files,
          projectId,
          versionId: currentVersionId,
          cost,
          security,
        },
        ...existing,
      ].slice(0, 20);
      window.localStorage.setItem(DEVOPS_HISTORY_KEY, JSON.stringify(next));
      setHistoryNotice('Saved to history.');
      window.setTimeout(() => setHistoryNotice(''), 1800);
    } catch {
      setHistoryNotice('Unable to save history.');
    }
  };

  const loadGithubContext = async () => {
    setLoadingRepos(true);
    try {
      const status = await devopsApi.githubStatus();
      setGithubStatus(status);
      if (status.connected) {
        const repoRes = await devopsApi.listGithubRepos(30);
        setRepos(repoRes.repos);
        if (!selectedRepoUrl && repoRes.repos[0]) {
          setSelectedRepoUrl(repoRes.repos[0].htmlUrl);
          setBranch(repoRes.repos[0].defaultBranch || 'main');
        }
      } else {
        setRepos([]);
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Failed to fetch GitHub status.');
    } finally {
      setLoadingRepos(false);
    }
  };

  const loadLatestBundle = async (skipIfStateRestored: boolean) => {
    if (skipIfStateRestored) return;

    try {
      const latest = await devopsApi.getLatestGeneratedBundle();
      if (latest.files?.length && latest.versionId) {
        const clearedVersion = typeof window !== 'undefined'
          ? window.localStorage.getItem(DEVOPS_CLEARED_VERSION_KEY)
          : null;

        if (clearedVersion && clearedVersion === latest.versionId) {
          return;
        }

        setCurrentVersionId(latest.versionId);
        setFiles(latest.files);
        setAnalysis(latest.analysis ?? null);
        setProjectId(latest.projectId ?? null);
        if (latest.cloudTarget) setCloud(latest.cloudTarget);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadVersionHistory = async (hint?: { projectId?: string | null; repoUrl?: string }) => {
    setLoadingVersions(true);
    try {
      const projects = await devopsApi.listProjects();

      let scopedProjects = projects;
      if (hint?.projectId) {
        scopedProjects = projects.filter((p) => p.id === hint.projectId);
      } else if (hint?.repoUrl) {
        scopedProjects = projects.filter((p) => p.repoUrl === hint.repoUrl);
      }

      if (scopedProjects.length === 0) scopedProjects = projects;

      const flattened = scopedProjects
        .flatMap((project: DevopsProject) =>
          (project.versions || []).map((version) => ({
            versionId: version.id,
            label: version.label || `infra-${new Date(version.generatedAt).toISOString()}`,
            generatedAt: version.generatedAt,
            files: version.files || [],
            analysis: version.analysis,
            projectId: project.id,
            cloudTarget: version.cloudTarget ?? project.cloudTarget,
            projectName: project.name,
            repoUrl: project.repoUrl,
          })),
        )
        .filter((item) => item.files.length > 0)
        .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());

      setVersionOptions(flattened);

      if (flattened.length > 0) {
        setSelectedVersionId((prev) => {
          if (prev && flattened.some((v) => v.versionId === prev)) return prev;
          if (currentVersionId && flattened.some((v) => v.versionId === currentVersionId)) return currentVersionId;
          return flattened[0].versionId;
        });
      } else {
        setSelectedVersionId('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingVersions(false);
    }
  };

  const restoreVersion = (versionId: string) => {
    const found = versionOptions.find((v) => v.versionId === versionId);
    if (!found) return;

    setSelectedVersionId(versionId);
    setCurrentVersionId(found.versionId);
    setProjectId(found.projectId);
    setAnalysis(found.analysis);
    setFiles(found.files);
    if (found.cloudTarget) setCloud(found.cloudTarget);

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DEVOPS_CLEARED_VERSION_KEY);
    }

    persistState({
      files: found.files,
      analysis: found.analysis,
      projectId: found.projectId,
      cloud: (found.cloudTarget ?? cloud) as CloudTarget,
      selectedRepoUrl: found.repoUrl ?? selectedRepoUrl,
      versionId: found.versionId,
    });
  };

  useEffect(() => {
    loadGithubContext();
    const restored = restoreFromSavedState();
    loadLatestBundle(restored);
    loadVersionHistory({ projectId, repoUrl: selectedRepoUrl });
  }, []);

  const startGithubOauth = async () => {
    setError('');
    setConnectingGithub(true);
    try {
      const { url } = await devopsApi.getGithubOauthUrl('/devops');
      if (typeof window !== 'undefined') {
        window.location.href = url;
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Unable to start GitHub OAuth.');
      setConnectingGithub(false);
    }
  };

  const disconnectGithub = async () => {
    setError('');
    setConnectingGithub(true);
    try {
      await devopsApi.disconnectGithub();
      setGithubStatus({ connected: false, username: null, avatarUrl: null, connectedAt: null });
      setRepos([]);
      setSelectedRepoUrl('');
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Failed to disconnect GitHub.');
    } finally {
      setConnectingGithub(false);
    }
  };

  const onboardRepo = async () => {
    if (!selectedRepoUrl.trim()) {
      setError('Select a repo from the list or enter a GitHub repository URL.');
      return;
    }

    setError('');
    setOnboarding(true);
    try {
      const result = await devopsApi.onboardRepo({
        repoUrl: selectedRepoUrl.trim(),
        branch: branch.trim() || 'main',
        cloudTarget: cloud,
        autoGenerateInfra: true,
      });
      setOnboardResult(result);
      setAnalysis(result.analysis);
      setProjectId(result.project.id);
      if (result.generatedInfra) {
        setCurrentVersionId(result.generatedInfra.versionId);
        setFiles(result.generatedInfra.files);
        setCost(result.generatedInfra.costEstimate);
        setSecurity(result.generatedInfra.securityFindings);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(DEVOPS_CLEARED_VERSION_KEY);
        }
        persistState({
          files: result.generatedInfra.files,
          analysis: result.analysis,
          projectId: result.project.id,
          versionId: result.generatedInfra.versionId,
        });
        loadVersionHistory({ projectId: result.project.id, repoUrl: selectedRepoUrl.trim() });
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Repo onboarding failed.');
    } finally {
      setOnboarding(false);
    }
  };

  const generateInfra = async () => {
    if (!projectId && !analysis && !selectedRepoUrl) return;

    setGenerating(true);
    try {
      const res = await devopsApi.generateInfra({
        projectId: projectId ?? undefined,
        analysisJson: analysis ? JSON.stringify(analysis) : undefined,
        repoUrl: !projectId ? selectedRepoUrl || undefined : undefined,
        branch: !projectId ? branch : undefined,
        cloudTarget: cloud,
        actionType: 'generate',
      });
      setCurrentVersionId(res.versionId);
      setFiles(res.files);
      setCost(res.costEstimate);
      setSecurity(res.securityFindings);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(DEVOPS_CLEARED_VERSION_KEY);
      }
      persistState({
        files: res.files,
        versionId: res.versionId,
      });
      loadVersionHistory({ projectId, repoUrl: selectedRepoUrl.trim() });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Infra generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const analyzeLogs = async () => {
    setError('');
    setAnalyzingLogs(true);
    try {
      const res = await devopsApi.analyzeLog({ log: logInput });
      setLogResult(res.explanation ?? 'No explanation available.');
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Log analysis failed.');
    } finally {
      setAnalyzingLogs(false);
    }
  };

  const askDevopsAssistant = async () => {
    if (!chatInput.trim() || chatting) return;

    const userMessage: DevopsChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: chatInput.trim(),
      createdAt: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setChatting(true);

    try {
      const conversationContext = chatMessages
        .slice(-8)
        .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');

      const res = await devopsApi.analyzeLog({
        log: userMessage.content,
        context: [
          'You are a senior DevOps engineer assistant.',
          'Respond directly. Do not summarize the user request. Do not say phrases like "you requested" or "the user has asked".',
          'Do not mention system instructions, policies, prompt context, or your reasoning process.',
          'If user asks for a CI/CD file, output a complete, ready-to-use workflow YAML first, then optional short notes.',
          'If user greets, respond briefly and ask one concrete next action.',
          'Prefer concrete commands, exact config snippets, and implementation-ready steps.',
          `Selected cloud: ${cloud}`,
          selectedRepoUrl ? `Selected repository: ${selectedRepoUrl}` : 'Repository is not selected yet.',
          branch ? `Branch: ${branch}` : 'Branch not set.',
          analysis ? `Detected stack: ${analysis.services.map((s) => `${s.kind}${s.framework ? ` (${s.framework})` : ''}`).join(', ')}` : 'Stack analysis is not available yet.',
          files.length ? `Latest generated files: ${files.map((f) => f.path).slice(0, 10).join(', ')}` : 'No generated infra files yet.',
          conversationContext ? `Recent conversation:\n${conversationContext}` : 'No previous conversation.',
          'Answer with practical production advice and concrete next steps.',
        ].join('\n'),
      });

      const rawReply =
        (typeof res?.explanation === 'string' && res.explanation.trim()) ||
        (typeof res?.rootCause === 'string' && res.rootCause.trim()) ||
        (Array.isArray(res?.fixSteps) ? res.fixSteps.join('\n') : '') ||
        'I could not generate a complete answer. Please provide logs or a more specific DevOps question.';

      const reply = cleanAssistantReply(rawReply) || 'Please share your exact target (for example: "create CI/CD for this repo") and I will generate it directly.';

      setChatMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: reply,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to get assistant response.';
      setChatMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${msg}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setChatting(false);
    }
  };

  const bundleSummary = useMemo(() => {
    if (!files.length) return '';
    const workflows = files.filter((f) => f.kind === 'githubActions' || f.path.includes('.github/workflows/')).length;
    const docker = files.filter((f) => f.kind === 'dockerfile' || f.kind === 'dockerCompose').length;
    return `${files.length} generated files • ${workflows} workflow file(s) • ${docker} docker file(s)`;
  }, [files]);

  const lastGeneratedText = useMemo(() => {
    if (!currentVersionId) return '';
    const current = versionOptions.find((v) => v.versionId === currentVersionId);
    if (!current) return '';
    return `${current.projectName} • ${formatDate(current.generatedAt)} • ${current.label}`;
  }, [currentVersionId, versionOptions]);

  return (
    <AppShell>
      <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-sky-600 dark:text-cyan-400 font-bold">DevMat DevOps Studio</p>
                <h1 className="text-2xl md:text-3xl font-extrabold mt-1 text-foreground">GitHub-Native AI DevOps Engineer</h1>
                <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
                  Connect GitHub, auto-analyze repositories, get prioritized fixes, and generate deployment-ready CI/CD + infra in one workflow.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <select
                  value={cloud}
                  onChange={(e) => setCloud(e.target.value as CloudTarget)}
                  className="rounded-xl border border-border bg-secondary/70 px-3 py-2 text-sm text-foreground"
                >
                  {CLOUDS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>

          {error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-1 rounded-2xl border border-border bg-card/80 p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <GitBranch className="w-4 h-4 text-sky-600 dark:text-cyan-400" /> GitHub Connection
              </div>

              <div className="rounded-xl border border-border bg-secondary/30 p-3 text-sm">
                <p className="text-muted-foreground">Status</p>
                <p className="font-semibold text-foreground mt-1">
                  {githubStatus?.connected ? `Connected as ${githubStatus.username}` : 'Not connected'}
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                We use the GitHub OAuth App flow (repo, read:org, workflow scopes). You will be redirected to GitHub to approve access; no PAT needed.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={startGithubOauth}
                  disabled={connectingGithub}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold',
                    'border-cyan-500/30 text-sky-700 dark:text-cyan-300 hover:bg-cyan-500/10',
                    connectingGithub && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  {connectingGithub ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Continue with GitHub
                </button>
                <button
                  onClick={disconnectGithub}
                  disabled={connectingGithub || !githubStatus?.connected}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold',
                    'border-border hover:bg-secondary',
                    (connectingGithub || !githubStatus?.connected) && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <Unplug className="w-4 h-4" /> Disconnect
                </button>
              </div>

              <button
                onClick={loadGithubContext}
                disabled={loadingRepos}
                className={cn(
                  'w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-secondary',
                  loadingRepos && 'opacity-60 cursor-not-allowed',
                )}
              >
                {loadingRepos ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderGit2 className="w-4 h-4" />} Refresh repo list
              </button>
            </div>

            <div className="xl:col-span-2 rounded-2xl border border-border bg-card/80 p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Rocket className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Repository Onboarding
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <RepoSelect
                    repos={repos}
                    value={selectedRepoUrl}
                    placeholder="Select connected repository…"
                    onChange={(url, repo) => {
                      setSelectedRepoUrl(url);
                      if (repo) setBranch(repo.defaultBranch || 'main');
                    }}
                  />
                </div>
                <input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm"
                  placeholder="Branch (main)"
                />
              </div>

              <input
                value={selectedRepoUrl}
                onChange={(e) => setSelectedRepoUrl(e.target.value)}
                className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm"
                placeholder="Or paste any GitHub repo URL: https://github.com/org/repo"
              />

              <button
                onClick={onboardRepo}
                disabled={onboarding}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10',
                  onboarding && 'opacity-60 cursor-not-allowed',
                )}
              >
                {onboarding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Auto-onboard & analyze
              </button>
            </div>
          </div>

          {onboardResult ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card/80 p-5 space-y-4">
              <p className="text-sm font-semibold text-foreground">Detected Stack</p>
              <StackPills analysis={onboardResult.analysis} />
              <p className="text-[12px] text-muted-foreground">
                Repository: {onboardResult.repoInsights.owner}/{onboardResult.repoInsights.repo} • Default branch: {onboardResult.repoInsights.defaultBranch}
              </p>
              <p className="text-[12px] text-muted-foreground">
                Languages: {onboardResult.repoInsights.languages.join(', ') || 'n/a'}
              </p>
            </motion.div>
          ) : null}

          {onboardResult ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card/80 p-5 space-y-3">
              <p className="text-sm font-semibold text-foreground">AI Rollout Guidance</p>
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{onboardResult.rolloutGuidance}</p>
            </motion.div>
          ) : null}

          {analysis ? (
            <div className="rounded-2xl border border-border bg-card/80 p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">Infra Studio</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={generateInfra}
                    disabled={generating}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-cyan-500/30 text-sky-700 dark:text-cyan-300 hover:bg-cyan-500/10',
                      generating && 'opacity-60 cursor-not-allowed',
                    )}
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />} Regenerate infra bundle
                  </button>
                  <button
                    onClick={saveHistory}
                    disabled={generating || files.length === 0}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-cyan-500/30 text-sky-700 dark:text-cyan-300 hover:bg-cyan-500/10',
                      (generating || files.length === 0) && 'opacity-60 cursor-not-allowed',
                    )}
                  >
                    <Save className="w-4 h-4" /> Save history
                  </button>
                  <button
                    onClick={clearCurrentBundle}
                    disabled={generating || files.length === 0}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-border hover:bg-secondary',
                      (generating || files.length === 0) && 'opacity-60 cursor-not-allowed',
                    )}
                  >
                    Clear Current
                  </button>
                </div>
              </div>

              {historyNotice ? (
                <p className="text-[12px] text-sky-700 dark:text-cyan-300">{historyNotice}</p>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2.5">
                <select
                  value={selectedVersionId}
                  onChange={(e) => restoreVersion(e.target.value)}
                  disabled={loadingVersions || versionOptions.length === 0}
                  className={cn(
                    'rounded-xl border border-border bg-secondary/30 px-3 py-2 text-sm',
                    (loadingVersions || versionOptions.length === 0) && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <option value="">{loadingVersions ? 'Loading versions…' : 'Select previous generated bundle'}</option>
                  {versionOptions.map((v) => (
                    <option key={v.versionId} value={v.versionId}>
                      {formatDate(v.generatedAt)} • {v.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => loadVersionHistory({ projectId, repoUrl: selectedRepoUrl.trim() })}
                  disabled={loadingVersions}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-secondary',
                    loadingVersions && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  {loadingVersions ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderGit2 className="w-4 h-4" />} Refresh versions
                </button>
              </div>

              {lastGeneratedText ? (
                <p className="text-[12px] text-muted-foreground">Last generated: {lastGeneratedText}</p>
              ) : null}

              {bundleSummary ? <p className="text-[12px] text-muted-foreground">{bundleSummary}</p> : null}

              {(cost || security) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-secondary/20 p-3">
                    <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Cost Estimate</p>
                    <p className="text-sm text-muted-foreground mt-1">{cost}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-secondary/20 p-3">
                    <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Security Checklist</p>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{security}</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {files.length > 0 ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {files.map((file) => (
                  <FileCard key={file.id ?? file.path} file={file} />
                ))}
              </div>

              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
                <p className="text-[12px] font-bold uppercase tracking-[0.09em] text-amber-700 dark:text-amber-300 mb-2">Precaution</p>
                <p className="text-[13px] text-amber-800 dark:text-amber-200/95 leading-relaxed">
                  Review generated files before deployment. Update image/service names, domain/host values, secret names,
                  environment variables, branch filters, cloud account IDs, and deploy credentials for your repository.
                </p>
              </div>
            </motion.div>
          ) : null}

          <div className="rounded-3xl border border-cyan-500/25 bg-card p-6 sm:p-7 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2.5 text-base font-semibold text-foreground">
                <div className="w-8 h-8 rounded-xl border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center">
                  <Bot className="w-4.5 h-4.5 text-sky-700 dark:text-cyan-300" />
                </div>
                Pro DevOps Engineer Chat
              </div>
              <p className="text-[12px] text-sky-700 dark:text-cyan-200/70">Ask architecture, CI/CD, security, or incident questions</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {CHAT_QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setChatInput(prompt)}
                  className="px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-[12px] text-sky-800 dark:text-cyan-100/90 hover:bg-cyan-500/20 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-secondary/40 p-4 sm:p-5 h-[380px] sm:h-[440px] overflow-y-auto space-y-3">
              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'max-w-[92%] rounded-2xl px-4 py-3',
                    message.role === 'assistant'
                      ? 'bg-cyan-500/10 border border-cyan-500/30 text-sky-900 dark:text-cyan-50'
                      : 'ml-auto bg-card border border-border text-foreground shadow-sm',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {message.role === 'assistant' ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                    <span className="text-[11px] uppercase tracking-[0.08em] font-semibold opacity-80">
                      {message.role === 'assistant' ? 'DevOps Engineer' : 'You'}
                    </span>
                  </div>
                  <p className="text-[13px] sm:text-[14px] whitespace-pre-wrap leading-relaxed">{message.content}</p>
                </div>
              ))}

              {chatting ? (
                <div className="max-w-[92%] rounded-2xl px-4 py-3 bg-cyan-500/10 border border-cyan-500/25 text-sky-800 dark:text-cyan-100">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Thinking through your DevOps question…</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-2.5">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="w-full min-h-[120px] rounded-2xl border border-border bg-background p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/40"
                placeholder="Ask anything, for example: My GitHub Actions deploy fails with permission denied on SSH key"
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-[12px] text-muted-foreground">Tip: include error logs, cloud target, and what changed recently.</p>
                <button
                  onClick={askDevopsAssistant}
                  disabled={chatting || !chatInput.trim()}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-cyan-500/35 text-sky-700 dark:text-cyan-300 hover:bg-cyan-500/10',
                    (chatting || !chatInput.trim()) && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  {chatting ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />} Ask DevOps Engineer
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/80 p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <TerminalSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Incident Log Doctor
            </div>
            <textarea
              value={logInput}
              onChange={(e) => setLogInput(e.target.value)}
              className="w-full min-h-[120px] rounded-xl border border-border bg-secondary/40 p-3 text-sm font-mono"
              placeholder="Paste CI/CD, Docker, or runtime logs for root-cause analysis"
            />
            <button
              onClick={analyzeLogs}
              disabled={analyzingLogs || !logInput.trim()}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-border hover:bg-secondary',
                (analyzingLogs || !logInput.trim()) && 'opacity-60 cursor-not-allowed',
              )}
            >
              {analyzingLogs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Analyze logs
            </button>
            {logResult ? <p className="text-sm text-muted-foreground whitespace-pre-line">{logResult}</p> : null}
          </div>
      </div>
    </AppShell>
  );
}
