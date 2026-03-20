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
 className="rounded-3xl border border-border bg-card relative overflow-hidden p-8 sm:p-10 flex-1 shadow-sm"
 >
 <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/15 blur-2xl" />
 <div className="relative flex items-start gap-5">
 <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 border border-brand/20 shadow-inner">
 <Icon className="h-6 w-6 text-brand" />
 </div>
 <div>
 {badge && (
 <p className="mb-2.5 inline-flex rounded-full border border-border bg-secondary px-3 py-1 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
 {badge}
 </p>
 )}
 <h1 className="text-[28px] font-bold sm:text-[34px] tracking-tight">{title}</h1>
 <p className="mt-2 text-[16px] text-muted-foreground sm:text-[17px] leading-relaxed max-w-2xl">{description}</p>
 </div>
 </div>
 </motion.section>
 );
}
