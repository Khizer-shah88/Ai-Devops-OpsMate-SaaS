import os

content = """'use client';

import { FormEvent, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch, Play, XCircle, Copy,
  CheckCheck, FileCode, FileText,
  Info, Box, Server, Settings, TerminalSquare, ServerCog
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { AiLoader } from '@/components/shared/AiLoader';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { cicdApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { cn } from '@/lib/utils';
import type { CicdResult } from '@/types';

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
        copied
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
          : 'bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground border border-border',
      )}
    >
      {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

// ─── Code Output Block ────────────────────────────────────────────────────────

function CodeBlock({
  title, icon: Icon, content, iconColor, borderColor, bgColor,
}: {
  title: string;
  icon: React.ElementType;
  content: string;
  iconColor: string;
  borderColor: string;
  bgColor: string;
}) {
  if (!content || content.trim() === '') return null;
  const displayed = content.replace(/\\\\n/g, '\\n');

  return (
    <div className={cn('rounded-3xl border bg-card overflow-hidden', borderColor)}>
      <div className={cn('flex items-center justify-between px-6 py-4 border-b', bgColor, borderColor)}>
        <div className="flex items-center gap-3">
          <Icon className={cn('w-5 h-5', iconColor)} />
          <h3 className={cn('text-[16px] font-semibold', iconColor)}>{title}</h3>
          <span className="text-[13px] text-muted-foreground font-mono">{displayed.split('\\n').length} lines</span>
        </div>
        <CopyButton text={displayed} />
      </div>
      <div className="relative">
        <pre className="overflow-x-auto p-6 text-[14px] font-mono text-foreground/85 leading-relaxed max-h-[460px] overflow-y-auto">
          {displayed}
        </pre>
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-card to-transparent pointer-events-none" />
      </div>
    </div>
  );
}

// ─── Result Panel ─────────────────────────────────────────────────────────────

function CicdResultPanel({ result }: { result: CicdResult }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* Dockerfile */}
      <CodeBlock
        title="Dockerfile"
        icon={Box}
        content={result.dockerfile}
        iconColor="text-blue-500"
        borderColor="border-blue-500/20"
        bgColor="bg-blue-500/5"
      />

      {/* Docker Compose */}
      <CodeBlock
        title="docker-compose.yml"
        icon={Server}
        content={result.dockerCompose}
        iconColor="text-indigo-500"
        borderColor="border-indigo-500/20"
        bgColor="bg-indigo-500/5"
      />

      {/* GitHub Actions YAML */}
      <CodeBlock
        title="GitHub Actions Workflow"
        icon={GitBranch}
        content={result.githubActions}
        iconColor="text-violet-500"
        borderColor="border-violet-500/20"
        bgColor="bg-violet-500/5"
      />

      {/* Kubernetes */}
      <CodeBlock
        title="Kubernetes Manifests"
        icon={ServerCog}
        content={result.kubernetes}
        iconColor="text-cyan-500"
        borderColor="border-cyan-500/20"
        bgColor="bg-cyan-500/5"
      />

      {/* Environment Variables */}
      <CodeBlock
        title=".env (Example)"
        icon={Settings}
        content={result.env}
        iconColor="text-emerald-500"
        borderColor="border-emerald-500/20"
        bgColor="bg-emerald-500/5"
      />

      {/* Setup Instructions */}
      {result.setupInstructions && (
        <div className="rounded-3xl border border-amber-500/20 bg-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-amber-500/15 bg-amber-500/5">
            <div className="flex items-center gap-3">
              <TerminalSquare className="w-5 h-5 text-amber-500" />
              <h3 className="text-[16px] font-semibold text-amber-500">Setup Instructions</h3>
            </div>
            <CopyButton text={result.setupInstructions} />
          </div>
          <div className="relative">
            <pre className="overflow-x-auto p-6 text-[14px] font-mono text-foreground/85 leading-relaxed max-h-[460px] overflow-y-auto whitespace-pre-wrap">
              {result.setupInstructions}
            </pre>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CicdPage() {
  useRequireAuth();

  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<CicdResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await cicdApi.submit({ description });
      setResult(res.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="px-6 py-8 max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <PageHeader
            icon={GitBranch}
            title="DevOps Setup Generator"
            description="Generate a complete, production-ready DevOps setup by describing your project architecture."
            badge="AI Architect"
          />
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[450px_1fr] gap-8">
          {/* LEFT — Input Form */}
          <div className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="rounded-3xl border border-border bg-card overflow-hidden flex flex-col">
                <div className="p-6 pb-4 bg-muted/30 border-b border-border">
                  <label htmlFor="project-desc" className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                    <TerminalSquare className="w-5 h-5 text-brand-500" />
                    Describe your architecture
                  </label>
                  <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed">
                    Mention your framework, database, queue, caching, or specific build steps (e.g., "Next.js app with Prisma, Postgres, and Redis").
                  </p>
                </div>
                <div className="p-2">
                  <textarea
                    id="project-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. A monolithic NestJS API connected to a PostgreSQL database and a separate Next.js web frontend. Needs to run on port 3000..."
                    className="w-full min-h-[220px] p-4 bg-transparent resize-none outline-none text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:ring-0"
                    spellCheck="false"
                  />
                </div>
              </div>

              {/* Generate button */}
              <button
                type="submit"
                disabled={loading || description.trim().length === 0}
                className={cn(
                  'w-full h-14 rounded-3xl font-bold text-[16px]',
                  'bg-brand-500 hover:bg-brand-600 active:scale-[0.99]',
                  'text-white transition-all duration-200 flex items-center justify-center gap-3',
                  'shadow-lg shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2',
                )}
              >
                {loading ? (
                  <>
                    <motion.span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                    Architecting Infrastructure…
                  </>
                ) : (
                  <><Play className="w-5 h-5" /> Generate Setup</>
                )}
              </button>

              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 px-5 py-4 rounded-3xl bg-red-500/10 border border-red-500/20">
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-[14px] text-red-500">{error}</p>
                </motion.div>
              )}
            </form>

            <div className="rounded-3xl border border-border bg-card p-6">
              <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider mb-4">What you'll get</p>
              <div className="space-y-3">
                {[
                  { icon: Box, label: 'Multi-stage Dockerfile', color: 'text-blue-400' },
                  { icon: Server, label: 'docker-compose.yaml', color: 'text-indigo-400' },
                  { icon: GitBranch, label: 'GitHub Actions workflow', color: 'text-violet-400' },
                  { icon: ServerCog, label: 'Kubernetes manifests', color: 'text-cyan-400' },
                  { icon: Settings, label: '.env template', color: 'text-emerald-400' },
                  { icon: FileText, label: 'Setup instructions', color: 'text-amber-400' },
                ].map((f) => (
                  <div key={f.label} className="flex items-center gap-3">
                    <f.icon className={cn('w-4 h-4 flex-shrink-0', f.color)} />
                    <p className="text-[14px] text-muted-foreground">{f.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — Output */}
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="rounded-3xl border border-border bg-card p-12 min-h-[500px] flex items-center justify-center"
                >
                  <AiLoader message="Applying DevOps best practices…" />
                </motion.div>
              ) : result ? (
                <CicdResultPanel key="result" result={result} />
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="rounded-3xl border border-border border-dashed bg-card/30 flex flex-col items-center justify-center min-h-[500px] text-center p-8"
                >
                  <div className="w-16 h-16 rounded-full bg-secondary/80 flex items-center justify-center mb-4">
                    <ServerCog className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-[18px] font-semibold text-foreground mb-2">DevOps AI Architect</h3>
                  <p className="text-[15px] text-muted-foreground max-w-sm">
                    Enter your project details on the left, and our AI will generate a complete Docker, Kubernetes, and CI/CD setup tailored to your stack.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
"""

with open("frontend/app/cicd/page.tsx", "w") as f:
    f.write(content)
