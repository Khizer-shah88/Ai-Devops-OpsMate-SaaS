"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyTheme, getStoredTheme } from "@/lib/theme";

export function ThemeToggle({ className }: { className?: string }) {
 const [dark, setDark] = useState(true);

 useEffect(() => {
 const theme = getStoredTheme();
 setDark(theme === "dark");
 applyTheme(theme);
 }, []);

 const toggle = () => {
 const nextTheme = dark ? "light" : "dark";
 setDark(nextTheme === "dark");
 applyTheme(nextTheme);
 };

 return (
 <button
 onClick={toggle}
 className={cn(
 "relative h-8 w-8 rounded-lg border border-border flex items-center justify-center",
 "text-muted-foreground hover:text-foreground",
 "hover:bg-surface-alt transition-all duration-200",
 className,
 )}
 title={dark ? "Switch to light mode" : "Switch to dark mode"}
 aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
 >
 {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
 </button>
 );
}
