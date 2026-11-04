'use client';

import { FormEvent, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
 Mail,
 Lock,
 User,
 ArrowRight,
 Eye,
 EyeOff,
 Sparkles,
 Code2,
 Bug,
 GitBranch,
 CheckCircle2,
 AlertCircle,
} from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import Aurora from '@/components/ui/Aurora';
import TextType from '@/components/ui/TextType';
import Antigravity from '@/components/Antigravity';

// ─── Animated background feature pills ───────────────────────────────────────

const FEATURES = [
 { icon: Code2, label: 'AI Code Review', color: 'from-violet-500/20 to-purple-500/10', border: 'border-violet-500/20', text: 'text-violet-600 dark:text-violet-400 ', delay: 0 },
 { icon: Bug, label: 'Error Debugger', color: 'from-rose-500/20 to-pink-500/10', border: 'border-rose-500/20', text: 'text-rose-600 dark:text-rose-400 ', delay: 0.15 },
 { icon: GitBranch, label: 'CI/CD Generator', color: 'from-cyan-500/20 to-sky-500/10', border: 'border-cyan-500/20', text: 'text-cyan-600 dark:text-cyan-400 ', delay: 0.3 },
];

// ─── Floating orb decoration ─────────────────────────────────────────────────

function FloatingOrbs() {
 const [isDark, setIsDark] = useState(true);
 useEffect(() => {
 setIsDark(document.documentElement.classList.contains('dark'));
 const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
 observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
 return () => observer.disconnect();
 }, []);
 return (
 <>
 <div className="fixed inset-0 min-h-screen z-0">
 <Aurora
 colorStops={isDark ? ["#010102","#1d2fb7","#6fcfc6"] : ["#cbd5e1","#e2e8f0","#6fcfc6"]}
 blend={0.6}
 amplitude={1.0}
 speed={1.0}
 />
 </div>
 <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
 {/* Top-left orb */}
 <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-brand/20 blur-[120px] animate-pulse" />
 {/* Bottom-right orb */}
 <div className="absolute -bottom-40 -right-20 w-96 h-96 rounded-full bg-purple-600/15 blur-[120px] animate-pulse" style={{ animationDelay: '1.5s' }} />
 {/* Center accent */}
 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-brand/5 blur-[80px]" />
 </div>

 {/* Grid overlay */}
 <div className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-30 z-0" />
 </>
 );
}

// ─── Input field with icon ────────────────────────────────────────────────────

interface InputFieldProps {
 id: string;
 label: string;
 type: string;
 placeholder: string;
 value: string;
 onChange: (v: string) => void;
 icon: any;
 required?: boolean;
 minLength?: number;
 rightSlot?: React.ReactNode;
 autoComplete?: string;
}

function InputField({
 id, label, type, placeholder, value, onChange,
 icon: Icon, required, minLength, rightSlot, autoComplete,
}: InputFieldProps) {
 return (
 <div className="space-y-2">
 <label htmlFor={id} className="block text-[13px] font-bold text-muted-foreground uppercase tracking-wider">
 {label}
 </label>
 <div className="relative group">
 {/* Left icon */}
 <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
 <Icon className="w-5 h-5 text-muted-foreground group-focus-within:text-brand transition-colors duration-200" />
 </div>

 <input
 id={id}
 type={type}
 value={value}
 onChange={(e) => onChange(e.target.value)}
 placeholder={placeholder}
 required={required}
 minLength={minLength}
 autoComplete={autoComplete}
 className={cn(
 'w-full h-14 pl-12 pr-4 rounded-2xl text-[16px]',
 'bg-secondary/60 border border-border',
 'text-foreground placeholder:text-muted-foreground/50',
 'outline-none ring-0',
 'transition-all duration-200',
 'focus:bg-secondary focus:border-brand/50 focus:ring-2 focus:ring-brand/15',
 'hover:border-border/80 hover:bg-secondary/80',
 rightSlot && 'pr-14',
 )}
 />

 {/* Right slot (e.g. show/hide password) */}
 {rightSlot && (
 <div className="absolute inset-y-0 right-4 flex items-center">
 {rightSlot}
 </div>
 )}
 </div>
 </div>
 );
}

// ─── Auth Page ────────────────────────────────────────────────────────────────

export default function AuthPage() {
 const router = useRouter();
 const { setAuth } = useAuthStore();

 const [mode, setMode] = useState<'login' | 'register'>('login');
 const [name, setName] = useState('');
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [showPw, setShowPw] = useState(false);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState<string | null>(null);

 // Switch tabs — reset form state
 const switchMode = (next: 'login' | 'register') => {
 if (next === mode) return;
 setMode(next);
 setError(null);
 setSuccess(null);
 setName('');
 setEmail('');
 setPassword('');
 };

 const handleSubmit = async (e: FormEvent) => {
 e.preventDefault();
 setLoading(true);
 setError(null);
 setSuccess(null);

 try {
 if (mode === 'register') {
 const res = await authApi.register({ name: name.trim() || undefined, email, password });
 setAuth(res.user, res.accessToken);
 setSuccess('Account created! Redirecting…');
 setTimeout(() => router.push('/dashboard'), 800);
 } else {
 const res = await authApi.login({ email, password });
 setAuth(res.user, res.accessToken);
 setSuccess('Welcome back! Redirecting…');
 setTimeout(() => router.push('/dashboard'), 800);
 }
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="relative min-h-screen flex bg-background text-foreground overflow-hidden">
 <FloatingOrbs />

 <div className="absolute top-4 right-4 z-30">
 <ThemeToggle />
 </div>

 {/* ── LEFT PANEL — branding ─────────────────────────────────────── */}
 <motion.div
 initial={{ opacity: 0, x: -30 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ duration: 0.6, ease: 'easeOut' }}
 className="hidden lg:flex flex-col justify-between w-[45%] px-16 py-14 relative z-10"
 >
 {/* Logo */}
 <BrandLogo size={40} textClassName="text-base font-bold" />

 {/* Headline */}
 <div className="space-y-8">
 <div>
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.2, duration: 0.5 }}
 >
 <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand uppercase tracking-widest mb-4 px-3 py-1.5 rounded-full bg-brand/10 border border-brand/20">
 <Sparkles className="w-3 h-3" /> Powered by GPT-4 Turbo
 </span>
 </motion.div>

 <motion.h2
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.3, duration: 0.5 }}
 className="text-6xl font-bold text-foreground leading-tight"
 >
 Your AI-powered
 <br />
 <span className="gradient-text">
 <TextType 
 texts={["dev companion.", "code reviewer.", "error debugger.", "CI/CD generator."]}
 typingSpeed={75}
 pauseDuration={1500}
 showCursor
 cursorCharacter="_"
 deletingSpeed={50}
 variableSpeedEnabled={false}
 variableSpeedMin={60}
 variableSpeedMax={120}
 cursorBlinkDuration={0.5}
 />
 </span>
 </motion.h2>

 <motion.p
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.4, duration: 0.5 }}
 className="mt-4 text-base text-muted-foreground leading-relaxed max-w-sm"
 >
 Code reviews, error diagnosis, and CI/CD generation — all in one
 intelligent platform built for modern developers.
 </motion.p>
 </div>

 {/* Feature pills */}
 <div className="space-y-3 relative z-20">
 {FEATURES.map((f, i) => (
 <motion.div
 key={f.label}
 initial={{ opacity: 0, x: -20 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: 0.5 + f.delay, duration: 0.4 }}
 className={cn(
 'flex items-center gap-3 px-4 py-3 rounded-xl border bg-gradient-to-r backdrop-blur-sm',
 f.color, f.border,
 )}
 >
 <div className={cn('w-7 h-7 rounded-lg bg-black/5 dark:bg-black/40 flex items-center justify-center')}>
 <f.icon className={cn('w-3.5 h-3.5', f.text)} />
 </div>
 <span className={cn('text-sm font-medium', f.text)}>{f.label}</span>
 <CheckCircle2 className={cn('w-3.5 h-3.5 ml-auto', f.text)} />
 </motion.div>
 ))}
 </div>

 {/* Antigravity component */}
 <div className="absolute top-1/3 left-0 w-[120%] h-[600px] pointer-events-none opacity-60 z-10 hidden lg:block" style={{ transform: 'translateY(-10%)' }}>
 <Antigravity
 count={300}
 magnetRadius={6}
 ringRadius={7}
 waveSpeed={0.4}
 waveAmplitude={1}
 particleSize={1.5}
 lerpSpeed={0.05}
 color="#c2b9e4"
 autoAnimate
 particleVariance={1}
 rotationSpeed={0}
 depthFactor={1}
 pulseSpeed={3}
 particleShape="capsule"
 fieldStrength={10}
 />
 </div>
 </div>

 {/* Footer */}
 <p className="text-xs text-muted-foreground">
 © {new Date().getFullYear()} DevMat AI — All rights reserved
 </p>
 </motion.div>

 {/* ── RIGHT PANEL — form ───────────────────────────────────────── */}
 <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
 <motion.div
 initial={{ opacity: 0, y: 24 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
 className="w-full max-w-[420px]"
 >
 {/* Mobile logo */}
 <div className="flex justify-center mb-8 lg:hidden">
 <BrandLogo size={40} subtitle="" textClassName="text-xl font-bold" />
 </div>

 {/* Card */}
 <div className="bg-card/90 backdrop-blur-2xl border border-border/60 rounded-2xl p-8 shadow-xl shadow-black/5 dark:shadow-black/30">

 {/* Header */}
 <div className="mb-7">
 <h1 className="text-2xl font-bold text-foreground">
 {mode === 'login' ? 'Welcome back' : 'Create account'}
 </h1>
 <p className="text-sm text-muted-foreground mt-1">
 {mode === 'login'
 ? 'Sign in to your DevMat AI workspace'
 : 'Start building smarter with AI assistance'}
 </p>
 </div>

 {/* Tab switcher */}
 <div className="relative flex gap-1 p-1 rounded-xl bg-secondary/80 border border-border/60 mb-7">
 {/* Sliding indicator */}
 <motion.div
 className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-card rounded-lg border border-border/60 shadow-sm"
 animate={{ left: mode === 'login' ? '4px' : 'calc(50%)' }}
 transition={{ type: 'spring', stiffness: 300, damping: 30 }}
 />
 {(['login', 'register'] as const).map((m) => (
 <button
 key={m}
 type="button"
 onClick={() => switchMode(m)}
 className={cn(
 'relative z-10 flex-1 py-2 text-sm font-medium rounded-lg transition-colors duration-200',
 mode === m ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80',
 )}
 >
 {m === 'login' ? 'Sign In' : 'Register'}
 </button>
 ))}
 </div>

 {/* Form */}
 <AnimatePresence mode="wait">
 <motion.form
 key={mode}
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -8 }}
 transition={{ duration: 0.2 }}
 onSubmit={handleSubmit}
 className="space-y-4"
 >
 {/* Name field — register only */}
 {mode === 'register' && (
 <motion.div
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: 'auto' }}
 exit={{ opacity: 0, height: 0 }}
 transition={{ duration: 0.25 }}
 >
 <InputField
 id="name"
 label="Full name"
 type="text"
 placeholder="John Doe"
 value={name}
 onChange={setName}
 icon={User}
 autoComplete="name"
 />
 </motion.div>
 )}

 <InputField
 id="email"
 label="Email address"
 type="email"
 placeholder="you@company.com"
 value={email}
 onChange={setEmail}
 icon={Mail}
 required
 autoComplete="email"
 />

 <InputField
 id="password"
 label="Password"
 type={showPw ? 'text' : 'password'}
 placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
 value={password}
 onChange={setPassword}
 icon={Lock}
 required
 minLength={8}
 autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
 rightSlot={
 <button
 type="button"
 onClick={() => setShowPw(!showPw)}
 className="text-muted-foreground hover:text-foreground transition-colors"
 tabIndex={-1}
 >
 {showPw
 ? <EyeOff className="w-4 h-4" />
 : <Eye className="w-4 h-4" />}
 </button>
 }
 />

 {/* Error banner */}
 <AnimatePresence>
 {error && (
 <motion.div
 initial={{ opacity: 0, scale: 0.97 }}
 animate={{ opacity: 1, scale: 1 }}
 exit={{ opacity: 0, scale: 0.97 }}
 className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-red-500/10 border border-red-500/20"
 >
 <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
 <p className="text-sm text-red-600 dark:text-red-400 ">{error}</p>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Success banner */}
 <AnimatePresence>
 {success && (
 <motion.div
 initial={{ opacity: 0, scale: 0.97 }}
 animate={{ opacity: 1, scale: 1 }}
 exit={{ opacity: 0, scale: 0.97 }}
 className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
 >
 <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
 <p className="text-sm text-emerald-600 dark:text-emerald-400 ">{success}</p>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Submit button */}
 <button
 type="submit"
 disabled={loading || !!success}
 className={cn(
 'relative w-full h-11 rounded-xl font-semibold text-sm',
 'bg-brand hover:bg-brand active:scale-[0.98]',
 'text-white transition-all duration-200',
 'shadow-lg shadow-brand/25',
 'flex items-center justify-center gap-2',
 'disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100',
 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-card',
 )}
 >
 {loading ? (
 <>
 <motion.span
 className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white"
 animate={{ rotate: 360 }}
 transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
 />
 <span>Please wait…</span>
 </>
 ) : (
 <>
 <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
 <ArrowRight className="w-4 h-4" />
 </>
 )}
 </button>
 </motion.form>
 </AnimatePresence>

 {/* Divider */}
 <div className="flex items-center gap-3 my-6">
 <div className="flex-1 h-px bg-border/60" />
 <span className="text-xs text-muted-foreground">or continue with</span>
 <div className="flex-1 h-px bg-border/60" />
 </div>

 {/* Demo credentials hint */}
 <button
 type="button"
 onClick={() => {
 setMode('login');
 setEmail('demo@devmate.ai');
 setPassword('demo1234');
 }}
 className={cn(
 'w-full flex items-center justify-center gap-2.5 h-11 rounded-xl',
 'border border-border/70 bg-secondary/40 hover:bg-secondary/80',
 'text-sm text-muted-foreground hover:text-foreground',
 'transition-all duration-200 active:scale-[0.98]',
 )}
 >
 <Sparkles className="w-4 h-4 text-brand" />
 Use demo account
 </button>

 {/* Switch mode link */}
 <p className="mt-5 text-center text-xs text-muted-foreground">
 {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
 <button
 type="button"
 onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
 className="text-brand hover:text-brand font-medium transition-colors"
 >
 {mode === 'login' ? 'Create one' : 'Sign in'}
 </button>
 </p>
 </div>

 {/* Trust badge */}
 <div className="mt-5 flex items-center justify-center gap-4">
 {['Secure JWT auth', 'No credit card', 'Free to start'].map((item) => (
 <div key={item} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
 <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 " />
 {item}
 </div>
 ))}
 </div>
 </motion.div>
 </div>
 </div>
 );
}