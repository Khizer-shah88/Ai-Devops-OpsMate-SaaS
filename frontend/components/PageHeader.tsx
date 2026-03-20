"use client";

import { motion } from "framer-motion";

interface PageHeaderProps {
 eyebrow: string;
 title: string;
 description: string;
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
 return (
 <motion.section
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 className="card relative overflow-hidden p-5 sm:p-6"
 >
 <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-brand/15 blur-2xl" />
 <div className="relative">
 <p className="mb-2 inline-flex rounded-full border border-border bg-surface-alt px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground">
 {eyebrow}
 </p>
 <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
 <p className="mt-1 text-sm text-muted-foreground sm:text-base">{description}</p>
 </div>
 </motion.section>
 );
}
