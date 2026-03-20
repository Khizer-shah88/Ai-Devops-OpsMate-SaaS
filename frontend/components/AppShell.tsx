"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { isAuthenticated } from "@/lib/auth";
import { Menu } from "lucide-react";

export function AppShell({ children }: { children: ReactNode }) {
 const router = useRouter();
 const [mobileOpen, setMobileOpen] = useState(false);

 useEffect(() => {
 if (!isAuthenticated()) {
 router.replace("/auth");
 }
 }, [router]);

 return (
 <div className="flex min-h-[100dvh] w-full bg-background">
 <div className="flex items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-md px-5 py-3.5 lg:hidden w-full fixed top-0 left-0 z-40 shadow-sm">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-brand-400 to-brand-700 shadow flex items-center justify-center mr-2"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><rect width="16" height="16" x="4" y="4" rx="2" ry="2"/><rect width="6" height="6" x="9" y="9" rx="1" ry="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg></div><p className="text-[16px] font-extrabold text-foreground tracking-tight">DevMate AI</p>
 </div>
 <button
 type="button"
 className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors border border-border/50 bg-secondary/30"
 onClick={() => setMobileOpen(true)}
 aria-label="Open sidebar"
 >
 <Menu size={18} />
 </button>
 </div>

 <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
 
 <main className="flex-1 min-w-0 w-full lg:pt-0 pt-[68px] lg:pl-[290px] h-[100dvh] overflow-y-auto scroll-smooth">
 <div className="mx-auto w-full max-w-[1400px] p-5 lg:p-8">
 {children}
 </div>
 </main>
 </div>
 );
}
