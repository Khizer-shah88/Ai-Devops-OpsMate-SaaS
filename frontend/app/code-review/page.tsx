'use client';

import { FormEvent, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code2, Play, ChevronDown, AlertTriangle,
  Lightbulb, Zap, CheckCircle2, XCircle,
  AlertCircle, TrendingUp, RotateCcw,
  Sparkles,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { AiLoader } from '@/components/shared/AiLoader';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { reviewApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { cn } from '@/lib/utils';
import type { CodeReviewResult, Bug } from '@/types';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

// ─── Language config ──────────────────────────────────────────────────────────

const LANGUAGES = [
  { value: 'typescript',  label: 'TypeScript'  },
  { value: 'javascript',  label: 'JavaScript'  },
  { value: 'python',      label: 'Python'      },
  { value: 'java',        label: 'Java'        },
  { value: 'go',          label: 'Go'          },
  { value: 'rust',        label: 'Rust'        },
  { value: 'cpp',         label: 'C++'         },
  { value: 'php',         label: 'PHP'         },
  { value: 'ruby',        label: 'Ruby'        },
  { value: 'sql',         label: 'SQL'         },
];

const DEFAULT_CODE: Record<string, string> = {
  typescript: `// Paste your code here — AI will review it instantly
function fetchUserData(userId: string) {
  const user = db.users.find(userId);
  const orders = db.orders.filter(o => o.userId == userId);

  let total = 0;
  for (var i = 0; i < orders.length; i++) {
    total += orders[i].amount;
  }

  return { user, orders, total };
}`,
  python: `# Paste your code here
def fetch_user_data(user_id):
    user = db.users.find(user_id)
    orders = [o for o in db.orders if o.user_id == user_id]
    total = 0
    for order in orders:
        total = total + order.amount
    return {"user": user, "orders": orders, "total": total}`,
};

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r    = 26;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const col  = score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : '#f87171';

  return (
    <div className="relative w-[72px] h-[72px] flex-shrink-0 flex items-center justify-center">
      <svg className="-rotate-90" width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" strokeWidth="5" className="stroke-border" />
        <motion.circle
          cx="36" cy="36" r={r} fill="none" strokeWidth="5"
          strokeLinecap="round" stroke={col}
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - fill }}
          transition={{ duration: 1.1, ease: 'easeOut', delay: 0.25 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[18px] font-extrabold leading-none tabular-nums" style={{ color: col }}>{score}</span>
        <span className="text-[9px] text-muted-foreground font-semibold mt-0.5">/100</span>
      </div>
    </div>
  );
}

// ─── Severity badge ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const MAP = {
    high:   { label: 'High',   cls: 'bg-red-500/10    text-red-500    border-red-500/20',    icon: XCircle       },
    medium: { label: 'Medium', cls: 'bg-amber-500/10  text-amber-500  border-amber-500/20',  icon: AlertCircle   },
    low:    { label: 'Low',    cls: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: AlertTriangle },
  } as const;
  const { label, cls, icon: Icon } = MAP[severity as keyof typeof MAP] ?? MAP.low;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap', cls)}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

// ─── Result section wrapper ───────────────────────────────────────────────────

function Section({
  title, icon: Icon, count, color, border, bg, children, delay = 0,
}: {
  title: string; icon: any; count: number;
  color: string; border: string; bg: string;
  children: React.ReactNode; delay?: number;
}) {
  const [open, setOpen] = useState(true);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className={cn('rounded-2xl border bg-card overflow-hidden', border)}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center justify-between px-5 py-3.5 border-b transition-colors hover:opacity-90', bg, border)}
      >
        <div className="flex items-center gap-2.5">
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center border', bg, border)}>
            <Icon className={cn('w-3.5 h-3.5', color)} />
          </div>
          <h3 className={cn('text-[13px] font-semibold', color)}>{title}</h3>
          <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full border', bg, border, color)}>
            {count}
          </span>
        </div>
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200 text-muted-foreground', !open && '-rotate-180')} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="divide-y divide-border/40">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Review result panel ──────────────────────────────────────────────────────

function ReviewResultPanel({ result }: { result: CodeReviewResult }) {
  const scoreCol = result.score >= 80 ? 'text-emerald-500' : result.score >= 60 ? 'text-amber-500' : 'text-red-500';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-3"
    >
      {/* ── Score card ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-5">
          <ScoreRing score={result.score} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-brand-400" />
              <p className="text-[13px] font-semibold text-foreground">Code Quality Score</p>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-3">{result.summary}</p>

            {/* Mini counters */}
            <div className="flex gap-5 mt-3.5 pt-3.5 border-t border-border/60">
              {[
                { val: result.bugs.length,          label: 'Bugs',          col: 'text-red-500'     },
                { val: result.improvements.length,  label: 'Improvements',  col: 'text-amber-500'   },
                { val: result.optimizations.length, label: 'Optimizations', col: 'text-brand-400'   },
              ].map(({ val, label, col }) => (
                <div key={label}>
                  <p className={cn('text-[20px] font-extrabold leading-none tabular-nums', col)}>{val}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Large score badge */}
          <div className="hidden sm:flex flex-col items-end flex-shrink-0">
            <div className={cn('text-[11px] font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full border',
              result.score >= 80 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              : result.score >= 60 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
              : 'bg-red-500/10 text-red-500 border-red-500/20'
            )}>
              {result.score >= 80 ? 'Good' : result.score >= 60 ? 'Fair' : 'Needs work'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bugs ───────────────────────────────────────────────────── */}
      {result.bugs.length > 0 && (
        <Section title="Bugs Found" icon={XCircle} count={result.bugs.length}
          color="text-red-500" border="border-red-500/20" bg="bg-red-500/5" delay={0.05}
        >
          {result.bugs.map((bug, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="px-5 py-3.5 flex items-start gap-3"
            >
              {bug.line && (
                <span className="text-[11px] font-mono bg-secondary/70 px-2 py-0.5 rounded text-muted-foreground flex-shrink-0 mt-0.5 border border-border">
                  L{bug.line}
                </span>
              )}
              <p className="text-[13px] text-foreground flex-1 leading-relaxed">{bug.description}</p>
              <SeverityBadge severity={bug.severity} />
            </motion.div>
          ))}
        </Section>
      )}

      {/* ── Improvements ───────────────────────────────────────────── */}
      {result.improvements.length > 0 && (
        <Section title="Improvements" icon={Lightbulb} count={result.improvements.length}
          color="text-amber-500" border="border-amber-500/20" bg="bg-amber-500/5" delay={0.1}
        >
          {result.improvements.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="px-5 py-3.5 flex items-start gap-3"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-500/60 flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-foreground leading-relaxed">{item}</p>
            </motion.div>
          ))}
        </Section>
      )}

      {/* ── Optimizations ──────────────────────────────────────────── */}
      {result.optimizations.length > 0 && (
        <Section title="Optimizations" icon={Zap} count={result.optimizations.length}
          color="text-brand-400" border="border-brand-500/20" bg="bg-brand-500/5" delay={0.15}
        >
          {result.optimizations.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="px-5 py-3.5 flex items-start gap-3"
            >
              <Zap className="w-4 h-4 text-brand-400/60 flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-foreground leading-relaxed">{item}</p>
            </motion.div>
          ))}
        </Section>
      )}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CodeReviewPage() {
  useRequireAuth();

  const [language, setLanguage] = useState('typescript');
  const [code,     setCode]     = useState(DEFAULT_CODE['typescript']);
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<CodeReviewResult | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const changeLanguage = (lang: string) => {
    setLanguage(lang);
    setCode(DEFAULT_CODE[lang] ?? '// Paste your code here\n');
    setResult(null);
    setError(null);
  };

    useEffect(() => {
    const saved = localStorage.getItem('devmate_state_REVIEW');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.code) setCode(parsed.code);
        if (parsed.language) setLanguage(parsed.language);
        if (parsed.result) setResult(parsed.result);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (code !== DEFAULT_CODE['typescript'] || result) {
      localStorage.setItem('devmate_state_REVIEW', JSON.stringify({ code, language, result }));
    }
  }, [code, language, result]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await reviewApi.submit({ code, language });
      setResult(res.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="px-4 sm:px-6 py-7 max-w-7xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 md:gap-0 mb-6 md:mb-7">
          <PageHeader
            icon={Code2}
            title="AI Code Review"
            description="Submit your code for instant bug detection, improvement suggestions, and optimizations."
            badge="GPT-4"
          />
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

          {/* ══════════════════════════════════════
              LEFT — Editor Panel
          ══════════════════════════════════════ */}
          <div className="flex flex-col gap-4">

            {/* Editor card */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col">

              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/20">
                <div className="flex items-center gap-3">
                  {/* Traffic lights (decorative) */}
                  <div className="hidden sm:flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
                  </div>

                  {/* Language selector */}
                  <div className="relative">
                    <select
                      value={language}
                      onChange={e => changeLanguage(e.target.value)}
                      className={cn(
                        'appearance-none pl-3 pr-7 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer',
                        'bg-secondary border border-border text-foreground',
                        'outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500/40',
                        'transition-all duration-200 hover:bg-secondary/80',
                      )}
                    >
                      {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                  </div>

                  <span className="text-[11px] text-muted-foreground font-mono">
                    {code.split('\n').length} lines
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => { setCode(DEFAULT_CODE[language] ?? ''); setResult(null); }}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </div>

              {/* Monaco editor */}
              <div className="h-[360px] sm:h-[400px]">
                <MonacoEditor
                  height="100%"
                  language={language}
                  value={code}
                  onChange={v => setCode(v ?? '')}
                  theme="vs-dark"
                  options={{
                    minimap:              { enabled: false },
                    fontSize:             13,
                    lineHeight:           21,
                    padding:              { top: 14, bottom: 14 },
                    scrollBeyondLastLine: false,
                    renderLineHighlight:  'line',
                    fontFamily:           'var(--font-geist-mono, monospace)',
                    fontLigatures:        true,
                    smoothScrolling:      true,
                    cursorBlinking:       'smooth',
                    tabSize:              2,
                    wordWrap:             'on',
                    lineNumbers:          'on',
                  }}
                />
              </div>
            </div>

            {/* Submit button */}
            <form onSubmit={handleSubmit}>
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className={cn(
                  'w-full h-11 rounded-xl font-bold text-[13.5px] text-white',
                  'bg-brand-500 hover:bg-brand-600 active:scale-[0.99]',
                  'flex items-center justify-center gap-2',
                  'transition-all duration-200 shadow-lg shadow-brand-500/20',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2',
                )}
              >
                {loading ? (
                  <>
                    <motion.span
                      className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.75, repeat: Infinity, ease: 'linear' }}
                    />
                    Analyzing code…
                  </>
                ) : (
                  <><Play className="w-4 h-4" /> Run AI Code Review</>
                )}
              </button>
            </form>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/15"
                >
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[13px] text-red-400">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tip card — only shown when no result yet */}
            {!result && !loading && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                className="rounded-2xl border border-brand-500/15 bg-brand-500/5 p-4"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                  <p className="text-[11px] font-bold text-brand-400 uppercase tracking-[0.08em]">How it works</p>
                </div>
                <p className="text-[12px] text-muted-foreground leading-[1.6]">
                  GPT-4 Turbo reads your code, detects bugs by severity, suggests improvements, and recommends performance optimizations — all in one pass.
                </p>
              </motion.div>
            )}
          </div>

          {/* ══════════════════════════════════════
              RIGHT — Result Panel
          ══════════════════════════════════════ */}
          <div>
            <AnimatePresence mode="wait">

              {/* Loading */}
              {loading && (
                <motion.div
                  key="loader"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="rounded-2xl border border-border bg-card p-8 min-h-[360px] flex items-center justify-center"
                >
                  <AiLoader message="Reviewing your code…" />
                </motion.div>
              )}

              {/* Result */}
              {!loading && result && (
                <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <ReviewResultPanel result={result} />
                </motion.div>
              )}

              {/* Empty state */}
              {!loading && !result && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className={cn(
                    'rounded-2xl border border-dashed border-border bg-card/30',
                    'flex flex-col items-center justify-center text-center',
                    'min-h-[360px] sm:min-h-[440px] p-10',
                  )}
                >
                  <div className="w-14 h-14 rounded-2xl bg-brand-500/8 border border-brand-500/20 flex items-center justify-center mb-4">
                    <Code2 className="w-6 h-6 text-brand-400" />
                  </div>
                  <p className="text-[15px] font-semibold text-foreground mb-1.5">No review yet</p>
                  <p className="text-[13px] text-muted-foreground max-w-[240px] leading-relaxed">
                    Paste or write code in the editor, then click <strong className="text-foreground font-semibold">Run AI Code Review</strong>.
                  </p>

                  {/* Sample language chips */}
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {['TypeScript', 'Python', 'Go', 'Java'].map(lang => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => changeLanguage(lang.toLowerCase())}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground bg-secondary/50 border border-border hover:bg-secondary hover:text-foreground transition-all duration-200"
                      >
                        {lang}
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