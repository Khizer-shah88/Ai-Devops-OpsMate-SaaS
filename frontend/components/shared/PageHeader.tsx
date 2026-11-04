"use client";

import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface PageHeaderProps {
 icon: LucideIcon;
 title: string;
 description: string;
 badge?: string;
}

export function PageHeader({ icon: Icon, title, description, badge }: PageHeaderProps) {
 return (
 <motion.section
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 className="rounded-2xl sm:rounded-3xl border border-border bg-card relative overflow-hidden p-5 sm:p-7 flex-1 shadow-sm"
 >
 <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-brand/12 blur-2xl" />
 <div className="relative flex items-start gap-4 sm:gap-5">
 <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-brand/10 border border-brand/20">
 <Icon className="h-5 w-5 text-brand" />
 </div>
 <div className="min-w-0">
 {badge && (
 <p className="mb-2 inline-flex rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
 {badge}
 </p>
 )}
 <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight text-foreground leading-tight">{title}</h1>
 <p className="mt-1.5 text-[13px] sm:text-[15px] text-muted-foreground leading-relaxed max-w-2xl">{description}</p>
 </div>
 </div>
 </motion.section>
 );
}
