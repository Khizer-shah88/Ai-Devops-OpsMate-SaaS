'use client';

import { FormEvent, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
 Bug, Play, XCircle, AlertTriangle,
 Lightbulb, Wrench, BookOpen, ClipboardPaste,
 ChevronRight,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { AiLoader } from '@/components/shared/AiLoader';
import { debugApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { cn } from '@/lib/utils';
import type { DebugResult } from '@/types';

// ─── Sample errors ────────────────────────────────────────────────────────────

const SAMPLES = [
 {
 label: 'TypeError',
 log: `TypeError: Cannot read properties of undefined (reading 'map')
 at UserList (/app/components/UserList.tsx:12:24)
 at renderWithHooks (react-dom.development.js:14985:18)
 at mountIndeterminateComponent (react-dom.development.js:17811:13)`,
 },
 {
 label: 'DB Connect',
 log: `Error: connect ECONNREFUSED 127.0.0.1:5432
 at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1300:16) {
 errno: -111,
 code: 'ECONNREFUSED',
 syscall: 'connect',
 address: '127.0.0.1',
 port: 5432
 }`,
 },
 {
 label: 'JWT Error',
 log: `JsonWebTokenError: invalid signature
 at /app/node_modules/jsonwebtoken/verify.js:63:21
 at /app/node_modules/jsonwebtoken/verify.js:211:14
 at getCallback (/app/node_modules/jsonwebtoken/verify.js:196:14)`,
 },
];

// ─── Fix Step Item ────────────────────────────────────────────────────────────

function FixStep({ step, index }: { step: string; index: number }) {
 return (
 <motion.div
 initial={{ opacity: 0, x: -10 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: index * 0.07 }}
 className="flex items-start gap-4 group"
 >
 <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand/15 border border-brand/25 text-[13px] font-bold text-brand flex items-center justify-center mt-0.5 shadow-sm">
 {index + 1}
 </span>
 <p className="text-[15px] font-medium text-foreground leading-relaxed pt-1">{step}</p>
 </motion.div>
 );
}

// ─── Debug Result Panel ───────────────────────────────────────────────────────

function DebugResultPanel({ result }: { result: DebugResult }) {
 return (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.45, ease: 'easeOut' }}
 className="space-y-6"
 >
 {/* Explanation */}
 <div className="rounded-3xl border border-amber-500/20 bg-card overflow-hidden shadow-sm">
 <div className="flex items-center gap-3.5 px-6 py-4 border-b border-amber-500/15 bg-amber-500/auto">
 <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 " />
 <h3 className="text-[15px] font-bold text-amber-600 dark:text-amber-400 ">What Happened</h3>
 </div>
 <p className="px-6 py-5 text-[15px] font-medium text-foreground leading-relaxed">{result.explanation}</p>
 </div>

 {/* Root Cause */}
 <div className="rounded-3xl border border-rose-500/20 bg-card overflow-hidden shadow-sm">
 <div className="flex items-center gap-3.5 px-6 py-4 border-b border-rose-500/15 bg-rose-500/auto">
 <Bug className="w-5 h-5 text-rose-600 dark:text-rose-400 " />
 <h3 className="text-[15px] font-bold text-rose-600 dark:text-rose-400 ">Root Cause</h3>
 </div>
 <div className="px-4 sm:px-6 py-5 flex items-start gap-3.5">
 <ChevronRight className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
 <p className="text-[15px] font-medium text-foreground leading-relaxed">{result.rootCause}</p>
 </div>
 </div>

 {/* Fix Steps */}
 {result.fixSteps.length > 0 && (
 <div className="rounded-3xl border border-emerald-500/20 bg-card overflow-hidden shadow-sm">
 <div className="flex items-center gap-3.5 px-6 py-4 border-b border-emerald-500/15 bg-emerald-500/auto">
 <Wrench className="w-5 h-5 text-emerald-600 dark:text-emerald-400 " />
 <h3 className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400 ">How to Fix ({result.fixSteps.length} steps)</h3>
 </div>
 <div className="px-4 sm:px-6 py-5 space-y-4">
 {result.fixSteps.map((step, i) => (
 <FixStep key={i} step={step} index={i} />
 ))}
 </div>
 </div>
 )}

 {/* Related Concepts */}
 {result.relatedConcepts.length > 0 && (
 <div className="rounded-3xl border border-brand/20 bg-card overflow-hidden shadow-sm">
 <div className="flex items-center gap-3.5 px-6 py-4 border-b border-brand/15 bg-brand/auto">
 <BookOpen className="w-5 h-5 text-brand" />
 <h3 className="text-[15px] font-bold text-brand">Related Concepts</h3>
 </div>
 <div className="px-4 sm:px-6 py-5 flex flex-wrap gap-2.5">
 {result.relatedConcepts.map((concept, i) => (
 <motion.span
 key={i}
 initial={{ opacity: 0, scale: 0.9 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ delay: i * 0.05 }}
 className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-bold bg-brand/10 text-brand border border-brand/20"
 >
 <Lightbulb className="w-4 h-4" /> {concept}
 </motion.span>
 ))}
 </div>
 </div>
 )}
 </motion.div>
 );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DebugPage() {
 useRequireAuth();

 const [errorLog, setErrorLog] = useState('');
 const [loading, setLoading] = useState(false);
 const [result, setResult] = useState<DebugResult | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [charCount, setCharCount] = useState(0);

 const handleChange = (val: string) => {
 setErrorLog(val);
 setCharCount(val.length);
 };

 const handleSample = (sample: typeof SAMPLES[0]) => {
 handleChange(sample.log);
 setResult(null);
 setError(null);
 };

   useEffect(() => {
    const saved = localStorage.getItem('devmate_state_DEBUG');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.errorLog) { setErrorLog(parsed.errorLog); setCharCount(parsed.errorLog.length); }
        if (parsed.result) setResult(parsed.result);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (errorLog || result) {
      localStorage.setItem('devmate_state_DEBUG', JSON.stringify({ errorLog, result }));
    }
  }, [errorLog, result]);

  const handleSubmit = async (e: FormEvent) => {
 e.preventDefault();
 if (!errorLog.trim()) return;
 setLoading(true);
 setError(null);
 setResult(null);
 try {
 const res = await debugApi.submit({ errorLog });
 setResult(res.result);
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Debug failed. Please try again.');
 } finally {
 setLoading(false);
 }
 };

 return (
 <AppShell>
 <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-10 max-w-[1400px] mx-auto">
 {/* Header */}
 <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 md:gap-0 mb-8 md:mb-10">
 <PageHeader
 icon={Bug}
 title="Error Debugger"
 description="Paste error logs or stack traces for instant AI-powered diagnosis and fix steps."
 badge="AI"
 />
 </div>

 <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
 {/* LEFT — Input */}
 <div className="space-y-6">
 {/* Sample errors */}
 <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
 <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider mb-4">Quick samples</p>
 <div className="flex flex-wrap gap-3">
 {SAMPLES.map((s) => (
 <button
 key={s.label}
 type="button"
 onClick={() => handleSample(s)}
 className="flex items-center gap-2 px-4 py-2 rounded-xl text-[14px] font-bold bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground border border-border transition-all duration-200"
 >
 <ClipboardPaste className="w-4 h-4" /> {s.label}
 </button>
 ))}
 </div>
 </div>

 {/* Textarea */}
 <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
 <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
 <div className="flex items-center gap-2.5">
 <Bug className="w-4 h-4 text-muted-foreground" />
 <span className="text-[14px] font-bold text-muted-foreground">Error Log / Stack Trace</span>
 </div>
 <span className="text-[12px] text-muted-foreground font-mono">{charCount} / 8000</span>
 </div>
 <textarea
 value={errorLog}
 onChange={(e) => handleChange(e.target.value)}
 placeholder={`Paste your error log or stack trace here...

Example:
TypeError: Cannot read properties of undefined (reading 'map')
 at Component (/app/src/Component.tsx:24:12)
 at renderWithHooks (react-dom.js:14985:18)`}
 maxLength={8000}
 rows={14}
 className={cn(
 'w-full px-6 py-6 bg-transparent resize-none',
 'text-[15px] font-mono text-foreground placeholder:text-muted-foreground/40',
 'outline-none focus:outline-none',
 'leading-relaxed',
 )}
 />
 </div>

 {/* Submit */}
 <form onSubmit={handleSubmit}>
 <button
 type="submit"
 disabled={loading || !errorLog.trim()}
 className={cn(
 'w-full h-14 rounded-2xl font-bold text-[16px]',
 'bg-rose-500 hover:bg-rose-600 active:scale-[0.99]',
 'text-white transition-all duration-200 flex items-center justify-center gap-3',
 'shadow-lg shadow-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed',
 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2',
 )}
 >
 {loading ? (
 <>
 <motion.span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
 Diagnosing…
 </>
 ) : (
 <><Play className="w-5 h-5" /> Debug This Error</>
 )}
 </button>
 </form>

 {error && (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 shadow-sm">
 <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
 <p className="text-[15px] font-bold text-red-600 dark:text-red-400 ">{error}</p>
 </motion.div>
 )}
 </div>

 {/* RIGHT — Result */}
 <div>
 <AnimatePresence mode="wait">
 {loading ? (
 <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
 className="rounded-3xl border border-border bg-card p-10 shadow-sm"
 >
 <AiLoader message="Diagnosing your error…" />
 </motion.div>
 ) : result ? (
 <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
 <DebugResultPanel result={result} />
 </motion.div>
 ) : (
 <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
 className="rounded-3xl border border-dashed border-border bg-card/50 p-16 flex flex-col items-center justify-center text-center min-h-[440px]"
 >
 <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-5 shadow-sm">
 <Bug className="w-8 h-8 text-rose-600 dark:text-rose-400 " />
 </div>
 <p className="text-[18px] font-bold text-foreground mb-2">No diagnosis yet</p>
 <p className="text-[15px] font-medium text-muted-foreground max-w-[280px]">Paste an error log and click &quot;Debug This Error&quot; for a detailed breakdown.</p>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </div>
 </div>
 </AppShell>
 );
}