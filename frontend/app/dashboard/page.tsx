'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code2, Bug, GitBranch, Clock, Zap, Activity,
  ArrowRight, RefreshCw, Circle, LogOut, ChevronDown,
  LayoutDashboard, Sparkles, TrendingUp, Trash2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { AiLoader } from '@/components/shared/AiLoader';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { historyApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { cn, formatDate } from '@/lib/utils';
import type { HistoryItem, UsageStats } from '@/types';
import { useAuthStore } from '@/store/auth.store';

// ─── Animated counter ─────────────────────────────────────────────────────────

function useCounter(target: number, delay = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      let n = 0;
      const steps = 28;
      const step  = Math.max(1, Math.ceil(target / steps));
      const id    = setInterval(() => {
        n = Math.min(n + step, target);
        setVal(n);
        if (n >= target) clearInterval(id);
      }, 28);
      return () => clearInterval(id);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, delay]);
  return val;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label:       string;
  value:       number;
  icon:        any;
  color:       string;
  bg:          string;
  border:      string;
  glow:        string;
  delay?:      number;
}

function StatCard({ label, value, icon: Icon, color, bg, border, glow, delay = 0 }: StatCardProps) {
  const displayed = useCounter(value, delay * 1000 + 200);
  const pct = Math.min((value / Math.max(value, 20)) * 100, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.38, ease: [0.22,1,0.36,1] }}
      className={cn(
        'relative overflow-hidden rounded-2xl border p-5 bg-card',
        'hover:shadow-lg transition-all duration-300 group cursor-default',
        border,
      )}
    >
      {/* Hover glow layer */}
      <div className={cn('absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none', glow)} />

      <div className="relative flex items-start justify-between mb-4">
        <div>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em] mb-2.5">{label}</p>
          <p className={cn('text-[32px] font-extrabold leading-none tabular-nums tracking-tight', color)}>
            {displayed}
          </p>
        </div>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', bg, 'border', border)}>
          <Icon className={cn('w-4.5 h-4.5', color)} />
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-border/60 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color.replace('text-','bg-'))}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: delay + 0.4, duration: 0.9, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  );
}

// ─── Type badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const MAP: Record<string, { label: string; cls: string; icon: any }> = {
    REVIEW: { label: 'Code Review', cls: 'bg-violet-500/10 text-violet-500 border-violet-500/20', icon: Code2    },
    DEBUG:  { label: 'Debug',       cls: 'bg-rose-500/10  text-rose-500  border-rose-500/20',    icon: Bug      },
    CICD:   { label: 'CI/CD',       cls: 'bg-cyan-500/10  text-cyan-500  border-cyan-500/20',    icon: GitBranch},
  };
  const { label, cls, icon: Icon } = MAP[type] ?? { label: type, cls: 'bg-secondary text-muted-foreground border-border', icon: Circle };
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap', cls)}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

// ─── Input snippet ────────────────────────────────────────────────────────────

function Snippet({ type, input }: { type: string; input: Record<string, unknown> }) {
  let text = '—';
  if (type === 'REVIEW') text = `${String(input.language ?? '').toUpperCase()} · ${String(input.code ?? '').slice(0, 55)}…`;
  if (type === 'DEBUG')  text = String(input.errorLog ?? '').slice(0, 75) + '…';
  if (type === 'CICD')   text = `Stack: ${String(input.stack ?? '').toUpperCase()}`;
  return <span className="text-[12px] text-muted-foreground font-mono truncate max-w-xs">{text}</span>;
}

// ─── Profile dropdown ─────────────────────────────────────────────────────────

const AVAILABILITY = {
  available: { label: 'Available', dot: 'bg-emerald-400' },
  away:      { label: 'Away',      dot: 'bg-amber-400'   },
  focus:     { label: 'Focus',     dot: 'bg-sky-400'     },
} as const;

type AvailKey = keyof typeof AVAILABILITY;

function ProfileMenu({ user, onLogout }: { user: { name?: string | null; email?: string } | null; onLogout: () => void }) {
  const [open,  setOpen]  = useState(false);
  const [avail, setAvail] = useState<AvailKey>('available');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('devmate_avail') as AvailKey | null;
    if (stored && AVAILABILITY[stored]) setAvail(stored);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const choose = (k: AvailKey) => { setAvail(k); localStorage.setItem('devmate_avail', k); setOpen(false); };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
    : user?.email?.slice(0,2).toUpperCase() ?? 'DM';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 pl-2.5 pr-3 py-2 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-all duration-200"
      >
        {/* Avatar */}
        <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-[11px] font-bold text-white select-none">{initials}</span>
          <span className={cn('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card', AVAILABILITY[avail].dot)} />
        </div>
        <div className="hidden sm:block text-left min-w-0">
          <p className="text-[13px] font-semibold text-foreground leading-none truncate max-w-[120px]">{user?.name ?? 'Developer'}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">{AVAILABILITY[avail].label}</p>
        </div>
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1,    y: 0   }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-[220px] rounded-2xl border border-border bg-card shadow-xl shadow-black/10 overflow-hidden"
          >
            {/* User info */}
            <div className="px-4 py-3.5 border-b border-border">
              <p className="text-[13px] font-semibold text-foreground truncate">{user?.name ?? 'Developer'}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{user?.email ?? ''}</p>
            </div>

            {/* Availability */}
            <div className="p-2">
              <p className="px-2 pt-1 pb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">
                Availability
              </p>
              {(Object.keys(AVAILABILITY) as AvailKey[]).map(k => (
                <button key={k} type="button" onClick={() => choose(k)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 text-left',
                    avail === k ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full flex-shrink-0', AVAILABILITY[k].dot)} />
                  {AVAILABILITY[k].label}
                  {avail === k && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400" />}
                </button>
              ))}
            </div>

            {/* Logout */}
            <div className="p-2 border-t border-border">
              <button type="button" onClick={onLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-rose-500 hover:bg-rose-500/8 transition-colors duration-150 text-left"
              >
                <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Stat config ──────────────────────────────────────────────────────────────

const STATS = [
  { key: 'total',  label: 'Total Requests',  icon: Activity,  color: 'text-brand-400',  bg: 'bg-brand-500/8',  border: 'border-brand-500/18',  glow: 'bg-brand-500/5'  },
  { key: 'review', label: 'Code Reviews',    icon: Code2,     color: 'text-violet-500', bg: 'bg-violet-500/8', border: 'border-violet-500/18', glow: 'bg-violet-500/5' },
  { key: 'debug',  label: 'Debug Sessions',  icon: Bug,       color: 'text-rose-500',   bg: 'bg-rose-500/8',   border: 'border-rose-500/18',   glow: 'bg-rose-500/5'   },
  { key: 'cicd',   label: 'CI/CD Pipelines', icon: GitBranch, color: 'text-cyan-500',   bg: 'bg-cyan-500/8',   border: 'border-cyan-500/18',   glow: 'bg-cyan-500/5'   },
] as const;

const ACTIONS = [
  { href: '/code-review', icon: Code2,     label: 'Code Review',  desc: 'Analyze code with AI',         color: 'text-violet-500', bg: 'bg-violet-500/8', border: 'border-violet-500/20 hover:border-violet-500/40' },
  { href: '/debug',       icon: Bug,       label: 'Debug Error',  desc: 'Diagnose any error log',        color: 'text-rose-500',   bg: 'bg-rose-500/8',   border: 'border-rose-500/20 hover:border-rose-500/40'     },
  { href: '/cicd',        icon: GitBranch, label: 'CI/CD',        desc: 'Generate pipelines & Docker',   color: 'text-cyan-500',   bg: 'bg-cyan-500/8',   border: 'border-cyan-500/20 hover:border-cyan-500/40'     },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { clearAuth } = useAuthStore();
  const { user } = useRequireAuth();

  const router = (typeof window !== 'undefined' ? require('next/navigation') : { useRouter: () => ({ push: () => {} }) }).useRouter?.() ?? { push: () => {} };

  const [stats,      setStats]      = useState<UsageStats>({ total: 0, review: 0, debug: 0, cicd: 0 });
  const [history,    setHistory]    = useState<HistoryItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);

  const load = async (showSpin = false) => {
    if (showSpin) setRefreshing(true);
    try {
      const res = await historyApi.get({ limit: 8 });
      setStats(res.stats);
      setHistory(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  };

  const handleLogout = () => { clearAuth(); router.push('/auth'); };

  const handleHistoryClick = (item: HistoryItem) => {
    const routeMap: Record<string, string> = { 'REVIEW': '/code-review', 'DEBUG': '/debug', 'CICD': '/cicd' };
    const route = routeMap[item.type];
    if (route) {
        if (item.type === 'REVIEW') {
           localStorage.setItem('devmate_state_REVIEW', JSON.stringify({
             code: (item.input as any).code || '',
             language: (item.input as any).language || 'typescript',
             result: item.output
           }));
        } else if (item.type === 'DEBUG') {
           localStorage.setItem('devmate_state_DEBUG', JSON.stringify({
             errorLog: (item.input as any).errorLog || '',
             result: item.output
           }));
        } else if (item.type === 'CICD') {
           const cicdInput = (item.input as any) || {};
           const cicdOutput = (item.output as any) || {};
           const files = Array.isArray(cicdOutput.files)
             ? cicdOutput.files.filter((f: any) => f?.kind === 'githubActions' || String(f?.path || '').includes('.github/workflows/'))
             : [];

           localStorage.setItem('devmate_state_CICD', JSON.stringify({
             versionId: cicdOutput.versionId || null,
             repoUrl: cicdInput.repoUrl || '',
             branch: cicdInput.branch || 'main',
             cloudTarget: cicdInput.cloudTarget || 'local',
             pipelineFiles: files,
             result: cicdOutput,
           }));
        }
        router.push(route);
    }
  };

  const handleDeleteOne = async (itemId: string) => {
    if (deletingId || clearingAll) return;
    setDeletingId(itemId);
    try {
      await historyApi.deleteOne(itemId);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!history.length || clearingAll || deletingId) return;
    const ok = window.confirm('Clear all recent activity? This cannot be undone.');
    if (!ok) return;

    setClearingAll(true);
    try {
      await historyApi.clearAll();
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setClearingAll(false);
    }
  };

  return (
    <AppShell>
      <div className="px-4 sm:px-6 py-7 max-w-7xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 md:gap-6 mb-8 mt-2 md:mt-0">
          <div>
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 mb-1"
            >
              <div className="w-6 h-6 rounded-md bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                <LayoutDashboard className="w-3.5 h-3.5 text-brand-400" />
              </div>
              <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.1em]">Dashboard</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 }}
              className="text-[22px] font-bold text-foreground tracking-tight leading-none"
            >
              {greeting()}, {user?.name?.split(' ')[0] ?? 'Developer'} 👋
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.09 }}
              className="text-[13px] text-muted-foreground mt-1.5"
            >
              Here's what's happening with your AI workspace today.
            </motion.p>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-2.5 flex-shrink-0 w-full md:w-auto justify-end md:justify-start">
            <ThemeToggle />
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary border border-border transition-all duration-200 disabled:opacity-40"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <ProfileMenu user={user} onLogout={handleLogout} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <AiLoader message="Loading your workspace…" />
          </div>
        ) : (
          <div className="space-y-6">

            {/* ── Stat cards ───────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {STATS.map((s, i) => (
                <StatCard
                  key={s.key}
                  label={s.label}
                  value={stats[s.key]}
                  icon={s.icon}
                  color={s.color}
                  bg={s.bg}
                  border={s.border}
                  glow={s.glow}
                  delay={i * 0.07}
                />
              ))}
            </div>

            {/* ── Activity table + quick actions ───────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5 md:gap-6">

              {/* History table */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32, duration: 0.4 }}
                className="rounded-2xl border border-border bg-card overflow-hidden"
              >
                {/* Table top bar */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/70">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-brand-500/8 border border-brand-500/20 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-brand-400" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-foreground leading-none">Recent Activity</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Last {history.length} requests</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {history.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAll}
                        disabled={clearingAll || !!deletingId}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" />
                        {clearingAll ? 'Clearing...' : 'Clear All'}
                      </button>
                    )}
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </div>
                  </div>
                </div>

                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center mb-3">
                      <Zap className="w-5 h-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-[14px] font-semibold text-foreground mb-1">No activity yet</p>
                    <p className="text-[12px] text-muted-foreground">Make your first AI request to see it here.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left px-5 py-4 text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.1em]">Type</th>
                          <th className="text-left px-5 py-4 text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.1em] hidden md:table-cell">Snapshot</th>
                          <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.1em] hidden lg:table-cell">Date</th>
                          <th className="w-8 px-5 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {history.map((item, i) => (
                          <motion.tr
                            key={item.id}
                            onClick={() => handleHistoryClick(item)}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.38 + i * 0.035 }}
                            className="group hover:bg-secondary/25 transition-colors duration-150 cursor-pointer"
                          >
                            <td className="px-5 py-3.5"><TypeBadge type={item.type} /></td>
                            <td className="px-4 py-3.5 hidden md:table-cell max-w-[220px] truncate">
                              <Snippet type={item.type} input={item.input} />
                            </td>
                            <td className="px-5 py-4 hidden lg:table-cell whitespace-nowrap">
                              <span className="text-[12px] text-muted-foreground">{formatDate(item.createdAt)}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteOne(item.id); }}
                                  disabled={clearingAll || deletingId === item.id}
                                  title="Remove from history"
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>

              {/* Quick actions sidebar */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38, duration: 0.4 }}
                className="space-y-3"
              >
                {/* Title */}
                <div className="flex items-center gap-2 px-1">
                  <TrendingUp className="w-3.5 h-3.5 text-muted-foreground/60" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">Quick actions</p>
                </div>

                {ACTIONS.map((a, i) => (
                  <motion.div
                    key={a.href}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.42 + i * 0.07 }}
                  >
                    <Link
                      href={a.href}
                      className={cn(
                        'group flex items-center gap-3.5 p-4 rounded-2xl border bg-card',
                        'hover:bg-secondary/30 hover:-translate-y-0.5',
                        'transition-all duration-200',
                        a.border,
                      )}
                    >
                      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', a.bg, 'border', a.border.split(' ')[0])}>
                        <a.icon className={cn('w-4 h-4', a.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground leading-none">{a.label}</p>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-none truncate">{a.desc}</p>
                      </div>
                      <ArrowRight className={cn(
                        'w-3.5 h-3.5 flex-shrink-0 transition-all duration-200',
                        'opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0',
                        a.color,
                      )} />
                    </Link>
                  </motion.div>
                ))}

                {/* AI status card */}
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.62 }}
                  className="mt-1 p-4 rounded-2xl border border-brand-500/15 bg-brand-500/5"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                    <p className="text-[11px] font-bold text-brand-400 uppercase tracking-[0.08em]">AI Status</p>
                    <span className="ml-auto flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Online
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-[1.55]">
                    GPT-4 Turbo is active and ready. All three AI tools are operational.
                  </p>
                </motion.div>
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}