"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyTheme, getStoredTheme, type ThemeMode } from "@/lib/theme";

const THEME_EVENT = "devmat-theme-change";

function readTheme(): ThemeMode {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("light")) {
    return "light";
  }
  if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
    return "dark";
  }
  return getStoredTheme();
}

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => {
      const theme = readTheme();
      setDark(theme === "dark");
      setReady(true);
    };

    sync();

    const onStorage = (event: StorageEvent) => {
      if (event.key !== "theme") return;
      sync();
    };

    const onThemeChange = () => sync();

    window.addEventListener("storage", onStorage);
    window.addEventListener(THEME_EVENT, onThemeChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(THEME_EVENT, onThemeChange);
    };
  }, []);

  const toggle = () => {
    const nextTheme: ThemeMode = dark ? "light" : "dark";
    setDark(nextTheme === "dark");
    applyTheme(nextTheme);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "relative h-9 w-9 rounded-xl border border-border bg-card",
        "flex items-center justify-center",
        "text-muted-foreground hover:text-foreground hover:bg-secondary",
        "shadow-sm transition-all duration-200",
        !ready && "opacity-0",
        className,
      )}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
