'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu, Bug, Code2, LayoutDashboard, GitBranch,
  LogOut, X, Sparkles, ChevronRight,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import { useRequireAuth } from '@/hooks/useRequireAuth';

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV = [
  {
    href:  '/dashboard',
    label: 'Dashboard',
    icon:  LayoutDashboard,
    hint:  'Overview & activity',
    accent: {
      color:  'text-brand-400',
      bg:     'bg-brand-500/10',
      border: 'border-brand-500/25',
      bar:    'bg-brand-400',
      glow:   'shadow-brand-500/20',
    },
  },
  {
    href:  '/code-review',
    label: 'Code Review',
    icon:  Code2,
    hint:  'AI static analysis',
    accent: {
      color:  'text-violet-400',
      bg:     'bg-violet-500/10',
      border: 'border-violet-500/25',
      bar:    'bg-violet-400',
      glow:   'shadow-violet-500/20',
    },
  },
  {
    href:  '/debug',
    label: 'Debug Assistant',
    icon:  Bug,
    hint:  'Error diagnosis',
    accent: {
      color:  'text-rose-400',
      bg:     'bg-rose-500/10',
      border: 'border-rose-500/25',
      bar:    'bg-rose-400',
      glow:   'shadow-rose-500/20',
    },
  },
  {
    href:  '/cicd',
    label: 'CI/CD Generator',
    icon:  GitBranch,
    hint:  'Pipelines & Docker',
    accent: {
      color:  'text-cyan-400',
      bg:     'bg-cyan-500/10',
      border: 'border-cyan-500/25',
      bar:    'bg-cyan-400',
      glow:   'shadow-cyan-500/20',
    },
  },
  {
    href: '/devops',
    label: 'DevOps Copilot',
    icon: Sparkles,
    hint: 'Infra, cost, logs',
    accent: {
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/25',
      bar: 'bg-amber-400',
      glow: 'shadow-amber-500/20',
    },
  },
  {
    href: '/devops-autofix',
    label: 'Auto Fix + Debug',
    icon: Zap,
    hint: 'One-click fixes, live logs',
    accent: {
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/25',
      bar: 'bg-emerald-400',
      glow: 'shadow-emerald-500/20',
    },
  },
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  mobileOpen?:    boolean;
  onCloseMobile?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Sidebar({ mobileOpen = false, onCloseMobile = () => {} }: SidebarProps) {
  const pathname            = usePathname();
  const router              = useRouter();
  const { clearAuth } = useAuthStore();
  const { user } = useRequireAuth();

  const handleLogout = () => { clearAuth(); router.push('/auth'); };

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? 'DM';

  return (
    <>
      {/* ── Mobile backdrop ──────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.button
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onCloseMobile}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            aria-label="Close navigation"
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col',
        'w-[290px]',                          // ← wider
        'bg-card border-r border-border/70',
        'transition-transform duration-400 ease-[0.22,1,0.36,1]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>

        {/* Top rainbow accent */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-brand-500/60 to-transparent pointer-events-none rounded-t" />

        {/* ════════════════════════════════
            LOGO
        ════════════════════════════════ */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-border/60 flex-shrink-0">
          <div className="flex items-center gap-3.5">
            {/* Badge */}
            <div className="relative w-11 h-11 flex-shrink-0">
              <div className="absolute inset-0 rounded-[13px] bg-gradient-to-br from-brand-400 to-brand-700 shadow-lg shadow-brand-500/35" />
              <div className="absolute inset-0 rounded-[13px] ring-1 ring-black/10 dark:ring-white/10" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Cpu className="w-5.5 h-5.5 text-white" style={{ width: 22, height: 22 }} />
              </div>
              {/* Online dot */}
              <span className="absolute -top-[3px] -right-[3px] w-3 h-3 rounded-full bg-emerald-400 border-[2.5px] border-card shadow-sm shadow-emerald-400/50" />
            </div>

            <div>
              <p className="text-[15px] font-extrabold text-foreground leading-none tracking-tight">
                OpsMate AI
              </p>
              <p className="text-[11px] text-muted-foreground/60 mt-1 leading-none">
                Developer Assistant
              </p>
            </div>
          </div>

          {/* Mobile close */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ════════════════════════════════
            SECTION LABEL
        ════════════════════════════════ */}
        <p className="px-6 pt-6 pb-3 text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground/40">
          Workspace
        </p>

        {/* ════════════════════════════════
            NAV ITEMS
        ════════════════════════════════ */}
        <nav className="flex-1 px-3.5 space-y-1 overflow-y-auto pb-2">
          {NAV.map((item, i) => {
            const active = pathname === item.href;
            const Icon   = item.icon;
            const a      = item.accent;

            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.28, ease: 'easeOut' }}
              >
                <Link
                  href={item.href}
                  onClick={onCloseMobile}
                  className={cn(
                    'group relative flex items-center gap-3.5 px-3.5 py-3 rounded-2xl border',
                    'transition-all duration-200 select-none',
                    active
                      ? cn(a.bg, a.border, 'shadow-md', a.glow)
                      : 'border-transparent hover:bg-secondary/50 hover:border-border/50',
                  )}
                >
                  {/* Active bar */}
                  {active && (
                    <motion.span
                      layoutId="sidebarBar"
                      className={cn(
                        'absolute left-0 top-1/2 -translate-y-1/2',
                        'w-[3.5px] h-[22px] rounded-r-full',
                        a.bar,
                      )}
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}

                  {/* Icon box — bigger */}
                  <div className={cn(
                    'w-10 h-10 rounded-[11px] flex items-center justify-center flex-shrink-0 border',
                    'transition-all duration-200',
                    active
                      ? cn(a.bg, a.border)
                      : 'bg-secondary/60 border-transparent group-hover:border-border/40',
                  )}>
                    <Icon
                      className={cn(
                        'transition-colors duration-200',
                        active ? a.color : 'text-muted-foreground group-hover:text-foreground',
                      )}
                      style={{ width: 18, height: 18 }}
                    />
                  </div>

                  {/* Label + hint */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-[13.5px] font-semibold leading-none transition-colors duration-200',
                      active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground',
                    )}>
                      {item.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground/55 mt-1.5 leading-none">
                      {item.hint}
                    </p>
                  </div>

                  {/* Chevron */}
                  <ChevronRight
                    className={cn(
                      'flex-shrink-0 transition-all duration-200',
                      active
                        ? cn('opacity-100', a.color)
                        : 'text-muted-foreground/25 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0',
                    )}
                    style={{ width: 15, height: 15 }}
                  />
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* ════════════════════════════════
            AI STATUS BADGE
        ════════════════════════════════ */}
        <div className="mx-3.5 mb-3 px-4 py-3.5 rounded-2xl border border-brand-500/18 bg-gradient-to-br from-brand-500/8 to-purple-600/5">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-lg bg-brand-500/15 border border-brand-500/20 flex items-center justify-center">
              <Sparkles className="text-brand-400" style={{ width: 12, height: 12 }} />
            </div>
            <span className="text-[11px] font-extrabold text-brand-400 uppercase tracking-[0.1em]">
              GPT-4 Turbo
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-semibold text-emerald-400">Active</span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground/60 leading-[1.55]">
            All AI tools powered by OpenAI's latest model.
          </p>
        </div>

        {/* ════════════════════════════════
            FOOTER
        ════════════════════════════════ */}
        <div className="flex-shrink-0 px-3.5 pt-3.5 pb-5 border-t border-border/60 space-y-2.5">

          {/* User card */}
          <div className="group flex items-center gap-3 px-3.5 py-3 rounded-2xl border border-border/40 bg-secondary/20 hover:bg-secondary/50 hover:border-border/70 transition-all duration-200 cursor-default">
            {/* Avatar */}
            <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-brand-500/25">
              <span className="text-[12px] font-bold text-white select-none">{initials}</span>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-[2px] border-card" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground truncate leading-none">
                {user?.name ?? 'Developer'}
              </p>
              <p className="text-[11px] text-muted-foreground/70 truncate mt-1 leading-none">
                {user?.email ?? ''}
              </p>
            </div>

            {/* Hover logout */}
            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/12 transition-all duration-200 flex-shrink-0"
            >
              <LogOut style={{ width: 15, height: 15 }} />
            </button>
          </div>

          {/* Sign out row */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              className={cn(
                'w-full h-9 rounded-xl flex items-center justify-center gap-2',
                'border border-border/60 bg-secondary/30 text-muted-foreground',
                'hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/22',
                'transition-all duration-200',
              )}
            >
              <LogOut style={{ width: 15, height: 15 }} />
              <span className="text-[12px] font-semibold">Sign out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}