"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { isAuthenticated } from "@/lib/auth";

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/auth");
    }
  }, [router]);

  return (
    <div className="flex min-h-[100dvh] w-full bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border bg-card/95 backdrop-blur-md px-4 py-3 lg:hidden w-full fixed top-0 left-0 z-40 shadow-sm">
        <BrandLogo size={32} subtitle="" textClassName="text-[15px]" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors border border-border bg-secondary/40"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      <main className="flex-1 min-w-0 w-full lg:pt-0 pt-[68px] lg:pl-[290px] h-[100dvh] overflow-y-auto scroll-smooth scrollbar-hide bg-background">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-5 sm:py-6 lg:px-8 lg:py-7 overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
