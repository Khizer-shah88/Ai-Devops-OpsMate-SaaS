'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clipboard,
  FileCode2,
  FolderGit2,
  GitBranch,
  Loader2,
  Rocket,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Wand2,
  Save,
  Trash2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { RepoSelect } from '@/components/shared/RepoSelect';
import { devopsApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { cn } from '@/lib/utils';
import type {
  AnalysisResult,
  CloudTarget,
  DebugResult,
  GeneratedFile,
  GithubRepo,
  GithubStatus,
  OnboardRepoResult,
  RepoHealthCheck,
} from '@/lib/types';

const CLOUD_OPTIONS: { value: CloudTarget; label: string }[] = [
  { value: 'ecs', label: 'AWS ECS (Fargate)' },
  { value: 'eks', label: 'AWS EKS' },
  { value: 'vercel', label: 'Vercel' },
  { value: 'digitalocean', label: 'DigitalOcean' },
  { value: 'local', label: 'Local (docker-compose)' },
];

const RULE_PACK_ISSUES = [
  'Missing Dockerfile',
  'No CI/CD pipeline',
  'No .env.example',
  'No health checks',
];

const AUTOFIX_HISTORY_KEY = 'devmate_history_DEVOPS_AUTOFIX';

const labelClass = 'block text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-1.5';
const inputClass = cn(
  'w-full h-10 px-3.5 rounded-xl border border-border bg-secondary/25',
  'text-[13px] text-foreground placeholder:text-muted-foreground/45',
  'outline-none transition-all duration-200',
  'focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/45 hover:border-border/80',
);

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors',
        copied
          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
          : 'bg-secondary/60 border-border text-muted-foreground hover:text-foreground hover:bg-secondary',
      )}
    >
      <Clipboard className="w-3.5 h-3.5" />
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function HealthBadge({ check }: { check: RepoHealthCheck }) {
  const pass = check.status === 'pass';
  return (
    <div
      className={cn(
        'rounded-xl border px-3.5 py-3 space-y-1.5',
        pass
          ? 'border-emerald-500/20 bg-emerald-500/8'
          : 'border-amber-500/20 bg-amber-500/8',
      )}
    >
      <div className="flex items-center gap-2">
        {pass ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        )}
        <p className={cn('text-[12.5px] font-semibold', pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
          {check.title}
        </p>
      </div>
      <p className="text-[12px] text-muted-foreground leading-relaxed">{check.details}</p>
      {!pass && <p className="text-[12px] text-foreground/90">Fix: {check.fix}</p>}
    </div>
  );
}

function FileOutputCard({ file }: { file: GeneratedFile }) {
  const content = (file.content || '').replace(/\\n/g, '\n').trim();
  return (
    <div className="rounded-2xl border border-border bg-card/80 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/70 bg-secondary/25">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-foreground truncate">{file.path}</p>
          <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            {file.kind ?? 'generated'}
          </p>
        </div>
        <CopyButton text={content} />
      </div>
      <pre className="p-4 text-[12px] leading-[1.6] font-mono max-h-[360px] overflow-auto whitespace-pre text-foreground/90">
        {content || 'No content returned for this file.'}
      </pre>
    </div>
  );
}

function getDetectedIssues(checks: RepoHealthCheck[]): string[] {
  const set = new Set<string>();

  for (const check of checks) {
    if (check.status === 'pass') continue;
    if (check.id === 'containerization') set.add('Missing Dockerfile');
    if (check.id === 'ci') set.add('No CI/CD pipeline');
    if (check.id === 'env-template') set.add('No .env.example');
    if (check.id === 'orchestration' || check.id === 'tests') set.add('No health checks');
  }

  return Array.from(set);
}

export default function DevopsAutoFixPage() {
  useRequireAuth();

  const [githubStatus, setGithubStatus] = useState<GithubStatus | null>(null);
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [selectedRepoUrl, setSelectedRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [cloudTarget, setCloudTarget] = useState<CloudTarget>('ecs');

  const [repoResult, setRepoResult] = useState<OnboardRepoResult | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [detectedIssues, setDetectedIssues] = useState<string[]>([]);

  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [costEstimate, setCostEstimate] = useState('');
  const [securityFindings, setSecurityFindings] = useState('');

  const [logInput, setLogInput] = useState('');
  const [debugContext, setDebugContext] = useState('CI/CD failure while deploying to staging.');
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null);
  const [debugTimeline, setDebugTimeline] = useState<string[]>([]);

  const [loadingRepos, setLoadingRepos] = useState(false);
  const [connectingGithub, setConnectingGithub] = useState(false);
  const [analyzingRepo, setAnalyzingRepo] = useState(false);
  const [fixingSetup, setFixingSetup] = useState(false);
  const [debugging, setDebugging] = useState(false);
  const [error, setError] = useState('');
  const [historyNotice, setHistoryNotice] = useState('');

  const debugTickerRef = useRef<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoadingRepos(true);
      try {
        const status = await devopsApi.githubStatus();
        setGithubStatus(status);
        if (status.connected) {
          const repoRes = await devopsApi.listGithubRepos(40);
          setRepos(repoRes.repos);
          if (!selectedRepoUrl && repoRes.repos[0]) {
            setSelectedRepoUrl(repoRes.repos[0].htmlUrl);
            setBranch(repoRes.repos[0].defaultBranch || 'main');
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load GitHub context.');
      } finally {
        setLoadingRepos(false);
      }
    };

    load();

    return () => {
      if (debugTickerRef.current) {
        window.clearInterval(debugTickerRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setupPayloadPreview = useMemo(() => {
    return {
      repo_analysis: analysis
        ? {
            packageManager: analysis.packageManager,
            services: analysis.services,
            notes: analysis.notes ?? [],
          }
        : 'Run Repo Analysis first',
      issues: detectedIssues,
      existing_configs:
        repoResult?.repoInsights?.checks?.map((check) => ({
          id: check.id,
          status: check.status,
          title: check.title,
        })) ?? [],
      action: 'fix',
    };
  }, [analysis, detectedIssues, repoResult]);

  const filteredOutput = useMemo(() => {
    return generatedFiles.filter((file) => {
      if (file.path.toLowerCase().includes('.env.example')) return true;
      if (file.path.includes('Dockerfile')) return true;
      if (file.path.includes('.github/workflows/')) return true;
      if (file.kind === 'readme') return true;
      return false;
    });
  }, [generatedFiles]);

  const connectGithub = async () => {
    setError('');
    setConnectingGithub(true);
    try {
      const { url } = await devopsApi.getGithubOauthUrl('/devops-autofix');
      if (typeof window !== 'undefined') {
        window.location.href = url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start GitHub OAuth.');
      setConnectingGithub(false);
    }
  };

  const analyzeRepository = async () => {
    if (!selectedRepoUrl) {
      setError('Select a GitHub repository first.');
      return;
    }

    setError('');
    setAnalyzingRepo(true);
    try {
      const result = await devopsApi.onboardRepo({
        repoUrl: selectedRepoUrl,
        branch,
        cloudTarget,
        autoGenerateInfra: false,
      });

      setRepoResult(result);
      setAnalysis(result.analysis);
      setDetectedIssues(getDetectedIssues(result.repoInsights.checks));
      setGeneratedFiles([]);
      setCostEstimate('');
      setSecurityFindings('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Repository analysis failed.');
    } finally {
      setAnalyzingRepo(false);
    }
  };

  const fixMyDevops = async () => {
    if (!selectedRepoUrl) {
      setError('Select a repository before generating fixes.');
      return;
    }

    setError('');
    setFixingSetup(true);
    try {
      const prompt = [
        'Fix the DevOps setup:',
        '- Add missing files',
        '- Improve existing configs',
        '- Follow production best practices',
        '',
        'Ensure output includes:',
        '- Dockerfile (added or fixed)',
        '- CI/CD YAML workflow',
        '- .env.example',
        '- setup instructions',
        '',
        `Detected issues: ${detectedIssues.join(', ') || 'none from checks'}`,
      ].join('\n');

      const generated = await devopsApi.generateInfra({
        projectId: repoResult?.project.id,
        repoUrl: selectedRepoUrl,
        branch,
        cloudTarget,
        actionType: 'generate',
        userRequest: prompt,
        analysisJson: analysis ? JSON.stringify(analysis) : undefined,
        existingConfig: repoResult?.repoInsights?.checks
          ? JSON.stringify(repoResult.repoInsights.checks)
          : undefined,
      });

      setGeneratedFiles(generated.files);
      setCostEstimate(generated.costEstimate);
      setSecurityFindings(generated.securityFindings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto fix generation failed.');
    } finally {
      setFixingSetup(false);
    }
  };

  const runRealtimeDebugger = async () => {
    if (!logInput.trim()) {
      setError('Paste CI/CD logs first.');
      return;
    }

    setError('');
    setDebugResult(null);
    setDebugging(true);

    const rollingMessages = [
      'Ingesting pipeline logs from latest run...',
      'Mapping stack traces to failing workflow jobs...',
      'Correlating failure with build and deploy stages...',
      'Drafting remediation steps with rollout safety checks...',
    ];

    let i = 0;
    setDebugTimeline([`[${new Date().toLocaleTimeString()}] Starting CI/CD debugger...`]);
    debugTickerRef.current = window.setInterval(() => {
      const next = rollingMessages[i % rollingMessages.length];
      setDebugTimeline((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${next}`]);
      i += 1;
    }, 1200);

    try {
      const result = await devopsApi.analyzeLog({
        log: logInput,
        context: debugContext,
      });
      setDebugResult(result as DebugResult);
      setDebugTimeline((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Analysis completed successfully.`]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to debug CI/CD logs.');
      setDebugTimeline((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Analysis failed.`]);
    } finally {
      if (debugTickerRef.current) {
        window.clearInterval(debugTickerRef.current);
        debugTickerRef.current = null;
      }
      setDebugging(false);
    }
  };

  const saveHistory = () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(AUTOFIX_HISTORY_KEY);
      const existing = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      const next = [
        {
          createdAt: new Date().toISOString(),
          repoUrl: selectedRepoUrl,
          branch,
          cloudTarget,
          analysis,
          detectedIssues,
          generatedFiles,
          costEstimate,
          securityFindings,
          debugContext,
          debugResult,
        },
        ...existing,
      ].slice(0, 20);
      window.localStorage.setItem(AUTOFIX_HISTORY_KEY, JSON.stringify(next));
      setHistoryNotice('Saved to history.');
      window.setTimeout(() => setHistoryNotice(''), 1800);
    } catch {
      setHistoryNotice('Unable to save history.');
    }
  };

  const clearCurrent = () => {
    setRepoResult(null);
    setAnalysis(null);
    setDetectedIssues([]);
    setGeneratedFiles([]);
    setCostEstimate('');
    setSecurityFindings('');
    setLogInput('');
    setDebugResult(null);
    setDebugTimeline([]);
    setError('');
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">
        <div className="flex items-start justify-between gap-3">
          <PageHeader
            icon={Wand2}
            title="Auto Fix DevOps Setup"
            description="Connect a GitHub repository, detect missing DevOps essentials, and generate production-ready fixes with one click."
            badge="Pro"
          />
          <ThemeToggle />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-border bg-card"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.14),transparent_38%)] pointer-events-none" />
          <div className="relative grid grid-cols-1 xl:grid-cols-[390px_1fr] gap-4 p-4 sm:p-5">
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-secondary/15 p-4 space-y-3.5">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                  <FolderGit2 className="w-4 h-4 text-brand" />
                  Step 1: Connect and Analyze Repository
                </div>

                <div className="rounded-xl border border-border/80 bg-card/70 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold text-foreground">GitHub status</p>
                    <span
                      className={cn(
                        'text-[11px] px-2 py-1 rounded-full border font-semibold',
                        githubStatus?.connected
                          ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                          : 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25',
                      )}
                    >
                      {githubStatus?.connected ? 'Connected' : 'Not connected'}
                    </span>
                  </div>

                  {!githubStatus?.connected ? (
                    <button
                      type="button"
                      onClick={connectGithub}
                      disabled={connectingGithub}
                      className="mt-3 w-full h-10 rounded-xl bg-brand text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-60 transition"
                    >
                      {connectingGithub ? 'Redirecting...' : 'Connect GitHub'}
                    </button>
                  ) : (
                    <p className="mt-3 text-[12px] text-muted-foreground">
                      Connected as <span className="font-semibold text-foreground">{githubStatus.username}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Repository</label>
                  <RepoSelect
                    repos={repos}
                    value={selectedRepoUrl}
                    disabled={loadingRepos || !githubStatus?.connected}
                    placeholder={repos.length ? 'Select repository…' : 'No repositories available'}
                    onChange={(url, repo) => {
                      setSelectedRepoUrl(url);
                      if (repo) setBranch(repo.defaultBranch || 'main');
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Branch</label>
                    <input
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className={inputClass}
                      placeholder="main"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Target</label>
                    <select
                      value={cloudTarget}
                      onChange={(e) => setCloudTarget(e.target.value as CloudTarget)}
                      className={inputClass}
                    >
                      {CLOUD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={analyzeRepository}
                  disabled={analyzingRepo || !selectedRepoUrl}
                  className="w-full h-10 rounded-xl border border-cyan-500/35 bg-cyan-500/12 text-sky-600 dark:text-cyan-400 text-[13px] font-semibold hover:bg-cyan-500/18 disabled:opacity-60 transition"
                >
                  {analyzingRepo ? 'Analyzing repository...' : 'Analyze Repository'}
                </button>
              </div>

              <div className="rounded-2xl border border-border bg-card/70 p-4 space-y-3">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                  <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  Step 2: AI Input Payload
                </div>
                <pre className="rounded-xl border border-border bg-secondary/30 p-3 text-[11.5px] leading-[1.55] max-h-[230px] overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(setupPayloadPreview, null, 2)}
                </pre>
              </div>

              <button
                type="button"
                onClick={fixMyDevops}
                disabled={fixingSetup || !selectedRepoUrl}
                className="w-full h-11 rounded-xl bg-emerald-500/90 text-white text-[13px] font-semibold hover:bg-emerald-500 disabled:opacity-60 transition flex items-center justify-center gap-2"
              >
                {fixingSetup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                {fixingSetup ? 'Fixing DevOps setup...' : 'Fix My DevOps Setup'}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={saveHistory}
                  disabled={fixingSetup || debugging || (!generatedFiles.length && !debugResult)}
                  className="h-9 rounded-xl text-[12px] font-semibold border border-brand-500/30 text-brand-400 hover:bg-brand-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> Save History
                </button>
                <button
                  type="button"
                  onClick={clearCurrent}
                  disabled={fixingSetup || debugging}
                  className="h-9 rounded-xl text-[12px] font-semibold border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear
                </button>
              </div>

              {historyNotice && <p className="text-[12px] text-brand-400">{historyNotice}</p>}

              {!!error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 px-3.5 py-3 text-[12px] text-rose-700 dark:text-rose-300">
                  {error}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card/70 p-4 space-y-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                    <ShieldCheck className="w-4 h-4 text-brand" />
                    Rule-based Detection (Step 1)
                  </div>
                  {repoResult?.repoInsights && (
                    <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand">
                      Health Score {repoResult.repoInsights.healthScore}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {RULE_PACK_ISSUES.map((issue) => {
                    const active = detectedIssues.includes(issue);
                    return (
                      <div
                        key={issue}
                        className={cn(
                          'rounded-xl border px-3 py-2 text-[12px] font-medium',
                          active
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                            : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                        )}
                      >
                        {active ? 'Issue: ' : 'OK: '}
                        {issue}
                      </div>
                    );
                  })}
                </div>

                <AnimatePresence>
                  {repoResult?.repoInsights?.checks?.length ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                    >
                      {repoResult.repoInsights.checks.map((check) => (
                        <HealthBadge key={check.id} check={check} />
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="rounded-2xl border border-border bg-card/70 p-4 space-y-3.5">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                  <FileCode2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Step 3: Generated Output
                </div>

                {!generatedFiles.length ? (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                    <Bot className="w-8 h-8 mx-auto text-muted-foreground/55 mb-2" />
                    <p className="text-[13px] text-muted-foreground">
                      Run Fix My DevOps Setup to generate Dockerfile, CI/CD workflow, .env.example, and setup docs.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredOutput.map((file) => (
                      <FileOutputCard key={file.id} file={file} />
                    ))}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3.5">
                        <p className="text-[11px] uppercase tracking-[0.1em] text-sky-600 dark:text-cyan-400 font-semibold mb-1.5">Cost Estimate</p>
                        <p className="text-[12.5px] text-foreground/90 leading-relaxed">{costEstimate || 'No estimate available.'}</p>
                      </div>
                      <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5">
                        <p className="text-[11px] uppercase tracking-[0.1em] text-amber-600 dark:text-amber-400 font-semibold mb-1.5">Security Notes</p>
                        <p className="text-[12.5px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
                          {securityFindings || 'No findings available.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="rounded-3xl border border-border bg-card overflow-hidden"
        >
          <div className="px-4 sm:px-5 py-3.5 border-b border-border bg-secondary/20 flex items-center gap-2">
            <TerminalSquare className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <h2 className="text-[14px] font-semibold text-foreground">Real-Time CI/CD Debugger</h2>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[440px_1fr] gap-4 p-4 sm:p-5">
            <div className="space-y-3.5">
              <div>
                <label className={labelClass}>Execution Context</label>
                <input
                  value={debugContext}
                  onChange={(e) => setDebugContext(e.target.value)}
                  className={inputClass}
                  placeholder="Failure context"
                />
              </div>

              <div>
                <label className={labelClass}>CI/CD Logs</label>
                <textarea
                  value={logInput}
                  onChange={(e) => setLogInput(e.target.value)}
                  className={cn(inputClass, 'h-44 py-2.5 resize-y')}
                  placeholder="Paste workflow run logs here"
                />
              </div>

              <button
                type="button"
                onClick={runRealtimeDebugger}
                disabled={debugging}
                className="w-full h-10 rounded-xl border border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-300 text-[13px] font-semibold hover:bg-rose-500/18 disabled:opacity-60 transition flex items-center justify-center gap-2"
              >
                {debugging ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
                {debugging ? 'Analyzing in real time...' : 'Run CI/CD Debugger'}
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="rounded-2xl border border-border bg-secondary/20 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-semibold text-foreground">Live Timeline</p>
                  {debugging && <Loader2 className="w-3.5 h-3.5 text-brand animate-spin" />}
                </div>
                <div className="rounded-xl border border-border bg-card p-3 max-h-[190px] overflow-auto space-y-1.5">
                  {debugTimeline.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground">Run debugger to stream execution updates.</p>
                  ) : (
                    debugTimeline.map((entry, idx) => (
                      <p key={`${entry}-${idx}`} className="text-[12px] font-mono text-foreground/85">
                        {entry}
                      </p>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card/80 p-4 min-h-[280px]">
                {!debugResult ? (
                  <div className="h-full min-h-[250px] grid place-items-center text-center">
                    <div>
                      <TerminalSquare className="w-8 h-8 mx-auto text-muted-foreground/55 mb-2" />
                      <p className="text-[13px] text-muted-foreground">
                        Debug output will appear here with root cause and actionable fix steps.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.1em] text-brand font-semibold mb-1.5">Explanation</p>
                      <p className="text-[13px] text-foreground/90 leading-relaxed">{debugResult.explanation}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.1em] text-rose-600 dark:text-rose-400 font-semibold mb-1.5">Root Cause</p>
                      <p className="text-[13px] text-foreground/90 leading-relaxed">{debugResult.rootCause}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.1em] text-emerald-600 dark:text-emerald-400 font-semibold mb-1.5">Fix Steps</p>
                      <ol className="space-y-1.5 list-decimal list-inside">
                        {debugResult.fixSteps.map((step, index) => (
                          <li key={`${step}-${index}`} className="text-[13px] text-foreground/90 leading-relaxed">
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </AppShell>
  );
}