'use client';

import { FormEvent, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
 GitBranch, Copy, CheckCheck, Info,
 Box, Settings, TerminalSquare, ServerCog,
 Activity, ChevronDown, Sparkles, Cloud, Zap,
 FileCode2, Container, Workflow, AlertTriangle,
 BookOpen, XCircle, Play,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { AiLoader } from '@/components/shared/AiLoader';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { cicdApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { cn } from '@/lib/utils';
import type { CicdResult } from '@/types';

// ─── Config ───────────────────────────────────────────────────────────────────

const ACTION_TYPES = [
 { value: 'generate', label: 'Generate', desc: 'Clean setup', icon: Zap, color: 'text-brand-600 dark:text-brand-400 ', bg: 'bg-brand-500/8', border: 'border-brand-500/20' },
 { value: 'modify', label: 'Modify', desc: 'Update existing', icon: Settings, color: 'text-amber-600 dark:text-amber-400 ', bg: 'bg-amber-500/8', border: 'border-amber-500/20' },
 { value: 'validate', label: 'Validate', desc: 'Check for issues', icon: Activity, color: 'text-rose-600 dark:text-rose-400 ', bg: 'bg-rose-500/8', border: 'border-rose-500/20' },
 { value: 'explain', label: 'Explain', desc: 'Understand config', icon: BookOpen, color: 'text-cyan-600 dark:text-cyan-400 ', bg: 'bg-cyan-500/8', border: 'border-cyan-500/20' },
];

const CLOUD_OPTIONS = ['AWS', 'GCP', 'Azure', 'DigitalOcean', 'Agnostic'];
const MODE_OPTIONS = ['quick', 'production', 'cloud-optimized'];

const OUTPUT_BLOCKS: {
 key: string;
 title: string;
 icon: any;
 iconColor: string;
 border: string;
 bg: string;
}[] = [
 { key: 'dockerfile', title: 'Dockerfile', icon: FileCode2, iconColor: 'text-blue-600 dark:text-blue-400 ', border: 'border-blue-500/20', bg: 'bg-blue-500/5' },
 { key: 'dockerCompose', title: 'docker-compose.yml', icon: Container, iconColor: 'text-indigo-600 dark:text-indigo-400 ', border: 'border-indigo-500/20', bg: 'bg-indigo-500/5' },
 { key: 'githubActions', title: 'GitHub Actions', icon: Workflow, iconColor: 'text-violet-600 dark:text-violet-400 ', border: 'border-violet-500/20', bg: 'bg-violet-500/5' },
 { key: 'kubernetes', title: 'Kubernetes', icon: ServerCog, iconColor: 'text-cyan-600 dark:text-cyan-400 ', border: 'border-cyan-500/20', bg: 'bg-cyan-500/5' },
 { key: 'env', title: '.env Template', icon: Settings, iconColor: 'text-emerald-600 dark:text-emerald-400 ', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
 { key: 'validation', title: 'Validation Issues', icon: AlertTriangle, iconColor: 'text-rose-600 dark:text-rose-400 ', border: 'border-rose-500/20', bg: 'bg-rose-500/5' },
 { key: 'explanation', title: 'Explanation', icon: Info, iconColor: 'text-brand-600 dark:text-brand-400 ', border: 'border-brand-500/20', bg: 'bg-brand-500/5' },
 { key: 'setupInstructions', title: 'Setup Instructions', icon: TerminalSquare,iconColor: 'text-amber-600 dark:text-amber-400 ', border: 'border-amber-500/20', bg: 'bg-amber-500/5' },
 // fallback for the existing API shape
 { key: 'githubActionsYaml', title: 'GitHub Actions', icon: Workflow, iconColor: 'text-violet-600 dark:text-violet-400 ', border: 'border-violet-500/20', bg: 'bg-violet-500/5' },
 { key: 'dockerfileContent', title: 'Dockerfile', icon: FileCode2, iconColor: 'text-blue-600 dark:text-blue-400 ', border: 'border-blue-500/20', bg: 'bg-blue-500/5' },
];

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
 const [ok, setOk] = useState(false);
 return (
 <button
 type="button"
 onClick={async () => { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }}
 className={cn(
 'flex items-center gap-4.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
 ok ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
 : 'bg-secondary/70 text-muted-foreground hover:text-foreground border border-border hover:bg-secondary',
 )}
 >
 {ok ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
 {ok ? 'Copied!' : 'Copy'}
 </button>
 );
}

// ─── Collapsible code block ───────────────────────────────────────────────────

function CodeBlock({ title, icon: Icon, content, iconColor, border, bg }: {
 title: string; icon: any; content: string;
 iconColor: string; border: string; bg: string;
}) {
 const [open, setOpen] = useState(true);
 const text = content.replace(/\\n/g, '\n').trim();
 const lines = text.split('\n').length;

 return (
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.3 }}
 className={cn('rounded-2xl border bg-card overflow-hidden', border)}
 >
 {/* ── Header ──────────────────────────────────────────────────── */}
 <div className={cn('flex items-center justify-between px-6 py-4 border-b', bg, border)}>
 <div className="flex items-center gap-4.5 min-w-0">
 <div className={cn('w-10 h-12 rounded-lg flex items-center justify-center flex-shrink-0 border', bg, border)}>
 <Icon className={cn('w-5 h-5', iconColor)} />
 </div>
 <span className={cn('text-base font-semibold truncate', iconColor)}>{title}</span>
 <span className="text-sm text-muted-foreground font-mono hidden sm:block">{lines} lines</span>
 </div>
 <div className="flex items-center gap-4 flex-shrink-0 ml-2">
 <CopyBtn text={text} />
 <button
 type="button"
 onClick={() => setOpen(o => !o)}
 className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
 >
 <ChevronDown className={cn('w-5 h-5 transition-transform duration-200', !open && '-rotate-180')} />
 </button>
 </div>
 </div>

 {/* ── Body ────────────────────────────────────────────────────── */}
 <AnimatePresence initial={false}>
 {open && (
 <motion.div
 initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
 transition={{ duration: 0.2, ease: 'easeInOut' }}
 className="overflow-hidden"
 >
 <div className="relative">
 <pre className={cn(
 'px-4 py-4 text-[15px] font-mono leading-[1.7] overflow-x-auto overflow-y-auto max-h-[500px]',
 'text-foreground/80 whitespace-pre',
 )}>
 {text}
 </pre>
 <div className="absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-card to-transparent pointer-events-none" />
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </motion.div>
 );
}

// ─── Result panel ─────────────────────────────────────────────────────────────

function ResultPanel({ result }: { result: CicdResult }) {
 const resultRecord = result as unknown as Record<string, unknown>;
 const rendered = OUTPUT_BLOCKS.filter((b, i, arr) => {
 const val = resultRecord[b.key];
 if (!val || typeof val !== 'string') return false;
 const t = val.trim();
 if (!t || ['Not required','Not applicable','Not requested'].includes(t)) return false;
 // Deduplicate: prefer the first occurrence of a title
 return arr.findIndex(x => x.title === b.title) === i;
 });

 return (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
 {/* Summary */}
 <div className="flex items-center gap-4 px-5 py-4 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
 <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
 <p className="text-[15px] text-emerald-600 dark:text-emerald-400 font-medium">
 {rendered.length} configuration {rendered.length === 1 ? 'file' : 'files'} generated — collapse any block to save space.
 </p>
 </div>

 {rendered.map(b => (
 <CodeBlock
 key={b.key}
 title={b.title}
 icon={b.icon}
 content={resultRecord[b.key] as string}
 iconColor={b.iconColor}
 border={b.border}
 bg={b.bg}
 />
 ))}
 </motion.div>
 );
}

// ─── Reusable field helpers ───────────────────────────────────────────────────

const labelCls = 'block text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground/65 mb-1.5';

const inputCls = cn(
 'w-full h-12 px-3.5 rounded-xl border border-border bg-secondary/30 text-base text-foreground',
 'placeholder:text-muted-foreground/40 outline-none transition-all duration-200',
 'focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/45 hover:border-border/80',
);

const textareaCls = cn(
 'w-full px-5 py-4 rounded-xl border border-border bg-secondary/30 text-base text-foreground resize-none',
 'placeholder:text-muted-foreground/40 outline-none transition-all duration-200',
 'focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/45 hover:border-border/80',
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CicdPage() {
 useRequireAuth();

 const [actionType, setActionType] = useState('generate');
 const [projectDescription, setProjectDescription] = useState('');
 const [stackInfo, setStackInfo] = useState('');
 const [cloudProvider, setCloudProvider] = useState('AWS');
 const [mode, setMode] = useState('production');
 const [existingConfig, setExistingConfig] = useState('');
 const [userRequest, setUserRequest] = useState('');
 const [loading, setLoading] = useState(false);
 const [result, setResult] = useState<CicdResult | null>(null);
 const [error, setError] = useState<string | null>(null);

 const action = ACTION_TYPES.find(a => a.value === actionType)!;

   useEffect(() => {
    const saved = localStorage.getItem('devmate_state_CICD');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.actionType) setActionType(parsed.actionType);
        if (parsed.projectDescription) setProjectDescription(parsed.projectDescription);
        if (parsed.cloudProvider) setCloudProvider(parsed.cloudProvider);
        if (parsed.mode) setMode(parsed.mode);
        if (parsed.existingConfig) setExistingConfig(parsed.existingConfig);
        if (parsed.userRequest) setUserRequest(parsed.userRequest);
        if (parsed.result) setResult(parsed.result);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (projectDescription || existingConfig || result) {
      localStorage.setItem('devmate_state_CICD', JSON.stringify({
        actionType, projectDescription, cloudProvider, mode,
        existingConfig, userRequest, result
      }));
    }
  }, [actionType, projectDescription, cloudProvider, mode, existingConfig, userRequest, result]);

  const handleSubmit = async (e: FormEvent) => {
 e.preventDefault();
 if (!projectDescription.trim() && actionType === 'generate') return;
 setLoading(true); setError(null); setResult(null);
 try {
    const res = await cicdApi.submit({
      actionType,
      projectDescription,
      stackInfo,
      cloudProvider,
      mode,
      existingConfig,
      userRequest,
    });
 setResult(res.result);
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Generation failed. Please try again.');
 } finally {
 setLoading(false);
 }
 };

 return (
 <AppShell>
 <div className="px-4 sm:px-6 py-7 max-w-7xl mx-auto">

 {/* ── Header ─────────────────────────────────────────────────── */}
 <div className="flex items-start justify-between mb-7">
 <PageHeader
 icon={GitBranch}
 title="DevOps Architect"
 description="Generate production-ready CI/CD pipelines, Dockerfiles, and infrastructure configs."
 badge="AI"
 />
 <ThemeToggle />
 </div>

 <div className="grid grid-cols-1 xl:grid-cols-[390px_1fr] gap-5">

 {/* ══════════════════════════════════════
 LEFT — Controls
 ══════════════════════════════════════ */}
 <div className="space-y-4">

 {/* Action type grid */}
 <div className="rounded-2xl border border-border bg-card p-6">
 <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground/55 mb-3">
 Action
 </p>
 <div className="grid grid-cols-2 gap-4">
 {ACTION_TYPES.map(a => (
 <button
 key={a.value}
 type="button"
 onClick={() => { setActionType(a.value); setResult(null); setError(null); }}
 className={cn(
 'relative flex flex-col items-start gap-4.5 p-4 rounded-xl border transition-all duration-200 text-left',
 'hover:-translate-y-0.5 active:translate-y-0',
 actionType === a.value
 ? cn(a.bg, a.border)
 : 'border-border/60 bg-secondary/15 hover:bg-secondary/35 hover:border-border',
 )}
 >
 {actionType === a.value && (
 <span className={cn('absolute top-3 right-3 w-2.5 h-2.5 rounded-full', a.color.replace(/text-/g,'bg-'))} />
 )}
 <div className={cn('w-10 h-12 rounded-lg flex items-center justify-center border', a.bg, a.border)}>
 <a.icon className={cn('w-5 h-5', a.color)} />
 </div>
 <div>
 <p className={cn('text-[15px] font-semibold leading-none', actionType === a.value ? a.color : 'text-foreground')}>
 {a.label}
 </p>
 <p className="text-xs text-muted-foreground/60 mt-0.5">{a.desc}</p>
 </div>
 </button>
 ))}
 </div>
 </div>

 {/* Form card */}
 <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 space-y-4">

 {/* Project description */}
 <div>
 <label className={labelCls}>Project description</label>
 <textarea
 rows={3}
 value={projectDescription}
 onChange={e => setProjectDescription(e.target.value)}
 placeholder="e.g. NestJS backend + Next.js frontend, JWT auth, PostgreSQL database"
 className={textareaCls}
 />
 </div>

 {/* Mode + Cloud */}
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className={labelCls}>Mode</label>
 <div className="relative">
 <Zap className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/45 pointer-events-none" />
 <select value={mode} onChange={e => setMode(e.target.value)}
 className={cn(inputCls, 'pl-12 pr-8 appearance-none cursor-pointer')}>
 {MODE_OPTIONS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase()+o.slice(1)}</option>)}
 </select>
 <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/45 pointer-events-none" />
 </div>
 </div>
 <div>
 <label className={labelCls}>Cloud</label>
 <div className="relative">
 <Cloud className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/45 pointer-events-none" />
 <select value={cloudProvider} onChange={e => setCloudProvider(e.target.value)}
 className={cn(inputCls, 'pl-12 pr-8 appearance-none cursor-pointer')}>
 {CLOUD_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
 </select>
 <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/45 pointer-events-none" />
 </div>
 </div>
 </div>

 {/* Tech stack */}
 <div>
 <label className={labelCls}>Tech stack</label>
 <div className="relative">
 <Box className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/45 pointer-events-none" />
 <input
 value={stackInfo}
 onChange={e => setStackInfo(e.target.value)}
 placeholder="Node 20, PostgreSQL 15, Redis 7"
 className={cn(inputCls, 'pl-12')}
 />
 </div>
 </div>

 {/* Existing config — modify / validate only */}
 <AnimatePresence>
 {(actionType === 'modify' || actionType === 'validate') && (
 <motion.div
 initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
 exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
 className="overflow-hidden"
 >
 <label className={labelCls}>Existing configuration</label>
 <textarea
 rows={5}
 value={existingConfig}
 onChange={e => setExistingConfig(e.target.value)}
 placeholder="Paste your Dockerfile, docker-compose.yml or GitHub Actions YAML…"
 className={cn(textareaCls, 'font-mono text-[15px] leading-relaxed')}
 />
 </motion.div>
 )}
 </AnimatePresence>

 {/* Specific request */}
 <div>
 <label className={labelCls}>Specific request <span className="normal-case font-normal text-muted-foreground/45">(optional)</span></label>
 <textarea
 rows={2}
 value={userRequest}
 onChange={e => setUserRequest(e.target.value)}
 placeholder="e.g. Add Redis container, use multi-stage builds, add health checks…"
 className={textareaCls}
 />
 </div>

 {/* Error */}
 <AnimatePresence>
 {error && (
 <motion.div
 initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
 className="flex items-start gap-4.5 px-5 py-4 rounded-xl bg-red-500/8 border border-red-500/15"
 >
 <XCircle className="w-8 h-8 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
 <p className="text-base text-red-600 dark:text-red-400 ">{error}</p>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Submit */}
 <button
 type="submit"
 disabled={loading || (!projectDescription.trim() && actionType === 'generate')}
 className={cn(
 'w-full h-14 rounded-xl font-bold text-lg text-white',
 'flex items-center justify-center gap-4',
 'bg-brand-500 hover:bg-brand-600 active:scale-[0.99]',
 'transition-all duration-200 shadow-lg shadow-brand-500/20',
 'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2',
 )}
 >
 {loading ? (
 <>
 <motion.span className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white"
 animate={{ rotate: 360 }} transition={{ duration: 0.75, repeat: Infinity, ease: 'linear' }} />
 Processing…
 </>
 ) : (
 <>
 <Play className="w-8 h-8" />
 Run {action.label} Task
 </>
 )}
 </button>
 </form>

 {/* What you get */}
 <div className="rounded-2xl border border-border bg-card p-6">
 <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground/55 mb-3">
 What's included
 </p>
 <div className="space-y-2">
 {[
 { icon: FileCode2, label: 'Dockerfile (multi-stage)', color: 'text-blue-600 dark:text-blue-400 ' },
 { icon: Container, label: 'docker-compose.yml', color: 'text-indigo-600 dark:text-indigo-400 ' },
 { icon: GitBranch, label: 'GitHub Actions workflow', color: 'text-violet-600 dark:text-violet-400 ' },
 { icon: Settings, label: '.env template', color: 'text-emerald-600 dark:text-emerald-400 ' },
 { icon: TerminalSquare, label: 'Setup instructions', color: 'text-amber-600 dark:text-amber-400 ' },
 ].map(item => (
 <div key={item.label} className="flex items-center gap-4.5">
 <item.icon className={cn('w-5 h-5 flex-shrink-0', item.color)} />
 <p className="text-[15px] text-muted-foreground">{item.label}</p>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* ══════════════════════════════════════
 RIGHT — Output
 ══════════════════════════════════════ */}
 <div className="min-w-0">
 <AnimatePresence mode="wait">
 {loading ? (
 <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
 className="rounded-2xl border border-border bg-card p-10 min-h-[420px] flex items-center justify-center"
 >
 <AiLoader message="Building your infrastructure configs…" />
 </motion.div>

 ) : result ? (
 <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
 <ResultPanel result={result} />
 </motion.div>

 ) : (
 <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
 className="rounded-2xl border border-dashed border-border bg-card/30 flex flex-col items-center justify-center min-h-[420px] p-10 text-center"
 >
 <div className="w-20 h-20 rounded-2xl bg-brand-500/8 border border-brand-500/20 flex items-center justify-center mb-4">
 <ServerCog className="w-8 h-8 text-brand-600 dark:text-brand-400 " />
 </div>
 <p className="text-lg font-semibold text-foreground mb-1.5">No pipeline yet</p>
 <p className="text-base text-muted-foreground max-w-[260px] leading-relaxed">
 Select an action, describe your project and click Run.
 </p>

 {/* Quick examples */}
 <div className="mt-6 flex flex-wrap justify-center gap-4">
 {['NestJS + PostgreSQL', 'Next.js on AWS', 'MERN stack'].map(ex => (
 <button
 key={ex}
 type="button"
 onClick={() => setProjectDescription(ex)}
 className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground bg-secondary/50 border border-border hover:bg-secondary hover:text-foreground transition-all duration-200"
 >
 {ex}
 </button>
 ))}
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </div>
 </div>
 </AppShell>
 );
}