'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch,
  Copy,
  CheckCheck,
  Workflow,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  Play,
  FileSearch,
  Box,
  XCircle,
  Save,
  ShieldAlert,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { AiLoader } from '@/components/shared/AiLoader';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { RepoSelect } from '@/components/shared/RepoSelect';
import { GithubShipPanel } from '@/components/shared/GithubShipPanel';
import { devopsApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { cn } from '@/lib/utils';
import type {
  GeneratedFile,
  GithubRepo,
  GithubStatus,
  AnalysisResult,
  CloudTarget,
  RepoReadinessResult,
} from '@/lib/types';

const CICD_STATE_KEY = 'devmate_state_CICD';
const CICD_CLEARED_VERSION_KEY = 'devmate_cicd_cleared_version';
const CICD_HISTORY_KEY = 'devmate_history_CICD';

const labelCls = 'block text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-1.5';

const inputCls = cn(
  'w-full h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl border border-border bg-secondary/30',
  'text-[12px] sm:text-[13px] text-foreground placeholder:text-muted-foreground/40',
  'outline-none transition-all duration-200',
  'focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/45 hover:border-border/80',
);

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1800);
      }}
      className={cn(
        'flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg',
        'text-[10px] sm:text-[11px] font-semibold transition-all duration-200',
        ok
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
          : 'bg-secondary/70 text-muted-foreground hover:text-foreground border border-border hover:bg-secondary',
      )}
    >
      {ok ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {ok ? 'Copied!' : 'Copy'}
    </button>
  );
}

function PipelinePanel({ file }: { file: GeneratedFile }) {
  const content = (file.content || '').replace(/\\n/g, '\n').trim();
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-2.5">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <Workflow className="w-3.5 h-3.5" />
          <p className="text-[12px] sm:text-[12.5px] font-medium">Repository-aware CI/CD pipeline generated.</p>
        </div>
        <CopyBtn text={content} />
      </div>

      {!content ? (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[12px] sm:text-[13px] text-amber-600 dark:text-amber-400">
            Pipeline file was not returned. Try running Generate again after Analyze Repo.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-violet-500/20 bg-card overflow-hidden">
          <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 border-b border-violet-500/20 bg-violet-500/5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center flex-shrink-0 border border-violet-500/20 bg-violet-500/5">
                <Workflow className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-[12px] sm:text-[13px] font-semibold truncate text-violet-600 dark:text-violet-400">{file.path}</span>
            </div>
            <span className="text-[10px] sm:text-[11px] text-muted-foreground font-mono hidden sm:block">{content.split('\n').length} lines</span>
          </div>
          <pre className="px-3.5 sm:px-4 py-3 sm:py-4 text-[11px] sm:text-[12.5px] font-mono leading-[1.65] overflow-x-auto overflow-y-auto scrollbar-hide max-h-[480px] text-foreground/80 whitespace-pre">
            {content}
          </pre>
        </div>
      )}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CicdPage() {
  useRequireAuth();

  const [githubStatus,    setGithubStatus]    = useState<GithubStatus | null>(null);
  const [repos,           setRepos]           = useState<GithubRepo[]>([]);
  const [selectedRepoUrl, setSelectedRepoUrl] = useState('');
  const [branch,          setBranch]          = useState('main');
  const [cloudTarget,     setCloudTarget]     = useState<CloudTarget>('local');

  const [analysis,        setAnalysis]        = useState<AnalysisResult | null>(null);
  const [pipelineFiles,   setPipelineFiles]   = useState<GeneratedFile[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [readiness,       setReadiness]       = useState<RepoReadinessResult | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [previousPipelineFiles, setPreviousPipelineFiles] = useState<GeneratedFile[]>([]);

  const [connecting,      setConnecting]      = useState(false);
  const [loadingRepos,    setLoadingRepos]    = useState(false);
  const [analyzingRepo,   setAnalyzingRepo]   = useState(false);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);

  const stackSummary = useMemo(() => {
    if (!analysis) return 'Run Analyze Repo to detect stack from files and dependencies.';
    const services = analysis.services.map((s) => `${s.kind}${s.framework ? ` (${s.framework})` : ''}`).join(', ');
    return `Detected: ${services || 'unknown'} • Package manager: ${analysis.packageManager}`;
  }, [analysis]);

  const diffSummary = useMemo(() => {
    if (pipelineFiles.length === 0) {
      return null;
    }

    const previousByPath = new Map(previousPipelineFiles.map((file) => [file.path, file.content]));
    let added = 0;
    let changed = 0;
    let unchanged = 0;
    const changedPaths: Array<{ path: string; beforeLines: number; afterLines: number }> = [];

    for (const file of pipelineFiles) {
      const previous = previousByPath.get(file.path);
      const beforeLines = previous ? previous.split('\n').length : 0;
      const afterLines = file.content.split('\n').length;

      if (!previous) {
        added += 1;
        changedPaths.push({ path: file.path, beforeLines, afterLines });
      } else if (previous !== file.content) {
        changed += 1;
        changedPaths.push({ path: file.path, beforeLines, afterLines });
      } else {
        unchanged += 1;
      }
    }

    return { added, changed, unchanged, changedPaths };
  }, [pipelineFiles, previousPipelineFiles]);

  const loadGithub = async () => {
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load GitHub status.');
    } finally {
      setLoadingRepos(false);
    }
  };

  const restoreFromSavedState = () => {
    if (typeof window === 'undefined') return false;

    try {
      const raw = window.localStorage.getItem(CICD_STATE_KEY);
      if (!raw) return false;
      const state = JSON.parse(raw) as {
        versionId?: string;
        pipelineFiles?: GeneratedFile[];
        repoUrl?: string;
        branch?: string;
        cloudTarget?: CloudTarget;
      };

      if (state.repoUrl) setSelectedRepoUrl(state.repoUrl);
      if (state.branch) setBranch(state.branch);
      if (state.cloudTarget) setCloudTarget(state.cloudTarget);

      if (state.versionId) setCurrentVersionId(state.versionId);
      if (Array.isArray(state.pipelineFiles) && state.pipelineFiles.length > 0) {
        setPipelineFiles(state.pipelineFiles);
        return true;
      }
    } catch {
      // Ignore invalid persisted state.
    }

    return false;
  };

  const restoreLatestHistorySnapshot = () => {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(CICD_HISTORY_KEY);
      if (!raw) return;
      const history = JSON.parse(raw) as Array<{ pipelineFiles?: GeneratedFile[] }>;
      const latest = history.find((item) => Array.isArray(item.pipelineFiles) && item.pipelineFiles.length > 0);
      if (latest?.pipelineFiles) {
        setPreviousPipelineFiles(latest.pipelineFiles);
      }
    } catch {
      // Ignore malformed history snapshots.
    }
  };

  const loadLatestBundle = async (skipIfStateRestored: boolean) => {
    if (skipIfStateRestored) return;

    try {
      const latest = await devopsApi.getLatestGeneratedBundle();
      if (!latest.files?.length || !latest.versionId) return;

      const clearedVersion = typeof window !== 'undefined'
        ? window.localStorage.getItem(CICD_CLEARED_VERSION_KEY)
        : null;

      if (clearedVersion && clearedVersion === latest.versionId) {
        return;
      }

      setCurrentVersionId(latest.versionId);
      setPipelineFiles(latest.files.filter((file) =>
        file.kind === 'githubActions' || file.path.includes('.github/workflows/'),
      ));
    } catch {
      // Ignore restore failures; user can generate again.
    }
  };

  useEffect(() => {
    loadGithub();
    const restored = restoreFromSavedState();
    restoreLatestHistorySnapshot();
    loadLatestBundle(restored);
  }, []); // eslint-disable-line

  const startGithubOauth = async () => {
    setError(null);
    setConnecting(true);
    try {
      const { url } = await devopsApi.getGithubOauthUrl('/cicd');
      if (typeof window !== 'undefined') window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start GitHub OAuth.');
      setConnecting(false);
    }
  };

  const analyzeRepo = async () => {
    if (!selectedRepoUrl) { setError('Select a repository first.'); return; }
    setAnalyzingRepo(true); setError(null);
    try {
      const res = await devopsApi.analyzeRepo({ repoUrl: selectedRepoUrl, branch });
      setAnalysis(res.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Repo analysis failed.');
    } finally {
      setAnalyzingRepo(false);
    }
  };

  const runReadinessScan = async () => {
    if (!selectedRepoUrl) {
      setError('Select a repository first.');
      return;
    }

    setReadinessLoading(true);
    setError(null);
    try {
      const result = await devopsApi.readinessScan({ repoUrl: selectedRepoUrl, branch });
      setReadiness(result);
      setAnalysis(result.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Readiness scan failed.');
    } finally {
      setReadinessLoading(false);
    }
  };

  const generatePipeline = async () => {
    if (!selectedRepoUrl.trim()) {
      setError('Select a repository first.');
      return;
    }

    setLoading(true); setError(null); setPipelineFiles([]);
    try {
      const res = await devopsApi.generateInfra({
        repoUrl: selectedRepoUrl,
        branch,
        cloudTarget,
        actionType: 'generate',
        userRequest: [
          'Generate ONLY production-grade GitHub Actions CI/CD workflows for this repository.',
          'Use detected project folders, scripts, dependencies, Dockerfile paths, and lockfiles.',
          'Follow a real-world structure: build/test job, Docker job with PR build-only and main branch push behavior, and deploy-to-EC2 job via SSH.',
          'Use Docker Hub login + conditional push (if credentials exist), include secure key/secret validation, and avoid placeholder-only deploy steps.',
          'If monorepo has frontend/backend, generate separate frontend-ci.yml and backend-ci.yml with service-specific paths and working directories.',
          'Do not return docker-compose, kubernetes, or generic placeholder content in workflow YAML.',
        ].join('\n'),
      });

      const workflows = res.files.filter((file) =>
        file.kind === 'githubActions' || file.path.includes('.github/workflows/'),
      );

      setCurrentVersionId(res.versionId);
      setPipelineFiles(workflows);

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(CICD_CLEARED_VERSION_KEY);
        window.localStorage.setItem(CICD_STATE_KEY, JSON.stringify({
          versionId: res.versionId,
          pipelineFiles: workflows,
          repoUrl: selectedRepoUrl,
          branch,
          cloudTarget,
        }));

        restoreLatestHistorySnapshot();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pipeline generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const clearCurrent = () => {
    setPipelineFiles([]);
    setError(null);

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CICD_STATE_KEY);
      if (currentVersionId) {
        window.localStorage.setItem(CICD_CLEARED_VERSION_KEY, currentVersionId);
      }
    }
  };

  const saveHistory = () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(CICD_HISTORY_KEY);
      const existing = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      const next = [
        {
          createdAt: new Date().toISOString(),
          repoUrl: selectedRepoUrl,
          branch,
          cloudTarget,
          analysis,
          pipelineFiles,
          versionId: currentVersionId,
        },
        ...existing,
      ].slice(0, 20);
      window.localStorage.setItem(CICD_HISTORY_KEY, JSON.stringify(next));
      setPreviousPipelineFiles(pipelineFiles);
      setHistoryNotice('Saved to history.');
      window.setTimeout(() => setHistoryNotice(null), 1800);
    } catch {
      setHistoryNotice('Unable to save history.');
    }
  };

  return (
    <AppShell>
      <div className="w-full max-w-[1400px] mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <PageHeader
            icon={GitBranch}
            title="CI/CD Generator"
            description="Connect GitHub, analyze your repository, and generate a production-ready GitHub Actions pipeline."
            badge="AI"
          />
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-5 lg:gap-6 items-start">
          {/* ── Controls ─────────────────────────────────────────────── */}
          <aside className="space-y-4 xl:sticky xl:top-4">
            <section className="rounded-2xl border border-border/80 bg-card/90 overflow-visible shadow-sm">
              <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-border/70">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={cn(
                    'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border',
                    githubStatus?.connected
                      ? 'bg-emerald-500/10 border-emerald-500/25'
                      : 'bg-secondary border-border',
                  )}>
                    <GitBranch className={cn('w-3.5 h-3.5', githubStatus?.connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground leading-none">GitHub Repo</p>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                      {githubStatus?.connected
                        ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">Connected as @{githubStatus.username}</span>
                        : 'Connect to pick a repository'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button" onClick={startGithubOauth} disabled={connecting}
                    className={cn(
                      'flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] font-semibold border transition-all duration-200',
                      'border-cyan-500/30 text-sky-600 dark:text-cyan-400 hover:bg-cyan-500/10',
                      connecting && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    {connecting
                      ? <motion.span className="w-3 h-3 rounded-full border border-cyan-400/30 border-t-cyan-400"
                          animate={{ rotate: 360 }} transition={{ duration: 0.75, repeat: Infinity, ease: 'linear' }} />
                      : <Sparkles className="w-3 h-3" />}
                    {githubStatus?.connected ? 'Reconnect' : 'Connect'}
                  </button>
                  <button
                    type="button" onClick={loadGithub} disabled={loadingRepos}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary border border-border transition-all duration-200 disabled:opacity-40"
                    aria-label="Refresh repositories"
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', loadingRepos && 'animate-spin')} />
                  </button>
                </div>
              </div>

              {githubStatus?.connected ? (
                <div className="p-4 space-y-3.5 overflow-visible">
                  <div className="space-y-1.5">
                    <label className={labelCls}>Repository</label>
                      <RepoSelect
                        repos={repos}
                        value={selectedRepoUrl}
                        onChange={async (url, repo) => {
                          setSelectedRepoUrl(url);
                          if (repo) setBranch(repo.defaultBranch || 'main');
                          try {
                            const memory = await devopsApi.getRepoMemory(url);
                            if (memory.lastBranch) setBranch(memory.lastBranch);
                            if (memory.cloudTarget) setCloudTarget(memory.cloudTarget);
                            if (memory.analysis) setAnalysis(memory.analysis);
                            if (memory.readiness) setReadiness(memory.readiness);
                            if (memory.lastVersionId) setCurrentVersionId(memory.lastVersionId);
                          } catch {
                            // First-time repo has no memory yet.
                          }
                        }}
                      />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5 min-w-0">
                      <label className={labelCls}>Branch</label>
                      <input
                        value={branch}
                        onChange={e => setBranch(e.target.value)}
                        placeholder="main"
                        className={cn(inputCls, 'h-11')}
                      />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <label className={labelCls}>Target</label>
                      <select
                        value={cloudTarget}
                        onChange={e => setCloudTarget(e.target.value as CloudTarget)}
                        className={cn(inputCls, 'h-11 appearance-none cursor-pointer')}
                      >
                        <option value="local">Local / EC2</option>
                        <option value="ecs">AWS ECS</option>
                        <option value="eks">AWS EKS</option>
                        <option value="vercel">Vercel</option>
                        <option value="digitalocean">DigitalOcean</option>
                      </select>
                    </div>
                  </div>

                  {selectedRepoUrl && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground rounded-lg bg-secondary/40 border border-border/60 px-2.5 py-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <span className="truncate">
                        Using <span className="text-foreground font-medium">{selectedRepoUrl.split('/').slice(-2).join('/')}</span>
                        {' '}({branch || 'main'} · {cloudTarget})
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button" onClick={analyzeRepo}
                      disabled={analyzingRepo || !selectedRepoUrl}
                      className={cn(
                        'inline-flex items-center justify-center gap-2 h-10 px-3 rounded-xl text-[12px] font-semibold border transition-all duration-200',
                        'border-emerald-500/25 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10',
                        (analyzingRepo || !selectedRepoUrl) && 'opacity-40 cursor-not-allowed',
                      )}
                    >
                      {analyzingRepo
                        ? <><motion.span className="w-3.5 h-3.5 rounded-full border border-emerald-400/30 border-t-emerald-400"
                            animate={{ rotate: 360 }} transition={{ duration: 0.75, repeat: Infinity, ease: 'linear' }} />
                          Analyzing…</>
                        : <><FileSearch className="w-3.5 h-3.5" /> Analyze Repo</>}
                    </button>

                    <button
                      type="button"
                      onClick={runReadinessScan}
                      disabled={readinessLoading || !selectedRepoUrl}
                      className={cn(
                        'inline-flex items-center justify-center gap-2 h-10 px-3 rounded-xl text-[12px] font-semibold border transition-all duration-200',
                        'border-amber-500/25 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10',
                        (readinessLoading || !selectedRepoUrl) && 'opacity-40 cursor-not-allowed',
                      )}
                    >
                      {readinessLoading
                        ? <><motion.span className="w-3.5 h-3.5 rounded-full border border-amber-400/30 border-t-amber-400"
                            animate={{ rotate: 360 }} transition={{ duration: 0.75, repeat: Infinity, ease: 'linear' }} />
                          Scanning…</>
                        : <><ShieldAlert className="w-3.5 h-3.5" /> Readiness + Secret Scan</>}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="px-4 py-4 text-[12px] text-muted-foreground/80 leading-relaxed">
                  Connect GitHub to browse repositories and generate an accurate CI/CD pipeline from real project files.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-border/80 bg-card/90 p-4 space-y-3">
              <div>
                <label className={labelCls}>Repository Analysis</label>
                <div className="rounded-xl border border-border/70 bg-secondary/25 px-3.5 py-3">
                  <div className="flex items-start gap-2.5 text-[12px] text-muted-foreground leading-relaxed">
                    <Box className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-sky-600 dark:text-sky-400" />
                    <span>{stackSummary}</span>
                  </div>
                </div>
              </div>

              {readiness && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300">Deployment Readiness</p>
                    <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">{readiness.readinessScore}/100 · {readiness.maturity}</span>
                  </div>
                  <div className="space-y-1.5">
                    {readiness.checks.slice(0, 4).map((check) => (
                      <div key={check.id} className="flex items-start gap-2 text-[11px]">
                        <span className={cn('mt-1 h-2 w-2 rounded-full flex-shrink-0', check.status === 'pass' ? 'bg-emerald-400' : 'bg-amber-400')} />
                        <p className="text-muted-foreground leading-relaxed">
                          <span className="text-foreground font-medium">{check.title}:</span> {check.details}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-red-500/8 border border-red-500/15"
                  >
                    <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={generatePipeline}
                  disabled={loading || !selectedRepoUrl}
                  className={cn(
                    'w-full h-11 rounded-xl font-bold text-[13.5px] text-white',
                    'flex items-center justify-center gap-2',
                    'bg-sky-600 hover:bg-sky-500 active:scale-[0.99]',
                    'transition-all duration-200 shadow-lg shadow-sky-600/20',
                    'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
                  )}
                >
                  {loading ? (
                    <>
                      <motion.span
                        className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.75, repeat: Infinity, ease: 'linear' }}
                      />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Generate CI/CD Pipeline
                    </>
                  )}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={saveHistory}
                    disabled={loading || pipelineFiles.length === 0}
                    className={cn(
                      'h-10 rounded-xl text-[12px] font-semibold',
                      'border border-sky-500/30 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-all duration-200',
                      'inline-flex items-center justify-center gap-1.5',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    <Save className="w-3.5 h-3.5" /> Save
                  </button>
                  <button
                    type="button"
                    onClick={clearCurrent}
                    disabled={loading || pipelineFiles.length === 0}
                    className={cn(
                      'h-10 rounded-xl text-[12px] font-semibold',
                      'border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    Clear
                  </button>
                </div>

                {historyNotice && (
                  <p className="text-[11px] text-sky-600 dark:text-sky-400">{historyNotice}</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border/80 bg-card/90 p-4 hidden xl:block">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground/45 mb-3">
                Pipeline includes
              </p>
              <div className="space-y-2.5">
                {[
                  { icon: Workflow, label: 'Repo-specific GitHub Actions workflow', color: 'text-violet-600 dark:text-violet-400' },
                  { icon: Box, label: 'Scripts detected from package.json', color: 'text-sky-600 dark:text-sky-400' },
                  { icon: GitBranch, label: 'Branch and deploy target aware', color: 'text-emerald-600 dark:text-emerald-400' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2.5">
                    <item.icon className={cn('w-3.5 h-3.5 flex-shrink-0', item.color)} />
                    <p className="text-[12px] text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          {/* ── Output ───────────────────────────────────────────────── */}
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              {loading && (
                <motion.div
                  key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="rounded-2xl border border-border bg-card p-10 min-h-[420px] flex items-center justify-center"
                >
                  <AiLoader message="Building repository-specific CI/CD pipeline…" />
                </motion.div>
              )}

              {!loading && pipelineFiles.length > 0 && (
                <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <GithubShipPanel
                    enabled={Boolean(githubStatus?.connected && selectedRepoUrl)}
                    repoUrl={selectedRepoUrl}
                    branch={branch || 'main'}
                    versionId={currentVersionId}
                    files={pipelineFiles}
                  />

                  {diffSummary && (
                    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-sky-700 dark:text-cyan-300">Diff Preview</p>
                        <p className="text-[11px] text-sky-800 dark:text-cyan-100/90">
                          New: {diffSummary.added} · Changed: {diffSummary.changed} · Unchanged: {diffSummary.unchanged}
                        </p>
                      </div>
                      {diffSummary.changedPaths.length > 0 ? (
                        <div className="space-y-1.5">
                          {diffSummary.changedPaths.slice(0, 4).map((item) => (
                            <div key={item.path} className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="truncate text-foreground/90">{item.path}</span>
                              <span className="text-muted-foreground whitespace-nowrap">
                                {item.beforeLines}L → {item.afterLines}L
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">No changes detected against your latest saved history snapshot.</p>
                      )}
                    </div>
                  )}

                  {pipelineFiles.map((file) => (
                    <PipelinePanel key={file.id || file.path} file={file} />
                  ))}

                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 px-5 sm:px-6 py-5">
                    <p className="text-[12px] font-extrabold uppercase tracking-[0.09em] text-amber-700 dark:text-amber-300 mb-2">
                      Precaution
                    </p>
                    <p className="text-[13px] text-amber-800 dark:text-amber-200/95 leading-relaxed">
                      Review this pipeline carefully before production use. Verify image names, secrets, branch rules,
                      ports, and deploy credentials for your repository.
                    </p>
                  </div>
                </motion.div>
              )}

              {!loading && pipelineFiles.length === 0 && (
                <motion.div
                  key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className={cn(
                    'rounded-2xl border border-dashed border-border/80 bg-card/40',
                    'flex flex-col items-center justify-center text-center',
                    'min-h-[420px] p-8 sm:p-12',
                  )}
                >
                  <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-4">
                    <Workflow className="w-6 h-6 text-sky-600 dark:text-sky-400" />
                  </div>
                  <p className="text-[15px] font-semibold text-foreground mb-1.5">No CI/CD pipeline yet</p>
                  <p className="text-[13px] text-muted-foreground max-w-[280px] leading-relaxed">
                    Select a repository, run <strong className="text-foreground font-semibold">Analyze Repo</strong>, then generate your pipeline.
                  </p>

                  {githubStatus?.connected && selectedRepoUrl && (
                    <div className="mt-5 flex items-center gap-1.5 text-[12px] text-muted-foreground rounded-full border border-border/70 bg-secondary/40 px-3 py-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      {selectedRepoUrl.split('/').slice(-2).join('/')} · {branch || 'main'}
                    </div>
                  )}

                  {!githubStatus?.connected && (
                    <button
                      type="button" onClick={startGithubOauth} disabled={connecting}
                      className={cn(
                        'mt-5 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold border transition-all duration-200',
                        'border-cyan-500/30 text-sky-600 dark:text-cyan-400 bg-cyan-500/5 hover:bg-cyan-500/10',
                        connecting && 'opacity-50 cursor-not-allowed',
                      )}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {connecting ? 'Connecting…' : 'Connect GitHub'}
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </AppShell>
  );
}