"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, GitBranch, Lock, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GithubRepo } from "@/lib/types";

interface RepoSelectProps {
  repos: GithubRepo[];
  value: string;
  onChange: (repoUrl: string, repo?: GithubRepo) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function RepoSelect({
  repos,
  value,
  onChange,
  disabled = false,
  placeholder = "Select repository…",
  className,
}: RepoSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => repos.find((repo) => repo.htmlUrl === value) ?? null,
    [repos, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter((repo) =>
      `${repo.fullName} ${repo.language ?? ""}`.toLowerCase().includes(q),
    );
  }, [repos, query]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => searchRef.current?.focus(), 20);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative w-full min-w-0", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          "w-full h-11 px-3 rounded-xl border border-border/80 bg-background/80",
          "flex items-center gap-2.5 text-left transition-all duration-200",
          "hover:border-sky-500/35 hover:bg-secondary/40",
          "focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500/45",
          open && "border-sky-500/45 ring-2 ring-sky-500/20 bg-secondary/40",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex-shrink-0">
          <GitBranch className="w-3.5 h-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          {selected ? (
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="truncate text-[13px] font-semibold text-foreground tracking-tight">
                {selected.fullName}
              </span>
              {selected.private && (
                <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              )}
            </span>
          ) : (
            <span className="truncate text-[13px] text-muted-foreground/70">
              {placeholder}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground/80 transition-transform duration-200 flex-shrink-0",
            open && "rotate-180 text-sky-600 dark:text-sky-400",
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 right-0 z-[80] mt-2 overflow-hidden",
            "rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl",
            "shadow-xl shadow-black/10 dark:shadow-black/40 ring-1 ring-border/60",
          )}
        >
          <div className="border-b border-border/60 p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search repositories…"
                className={cn(
                  "w-full h-10 rounded-xl border border-border/70 bg-secondary/50 pl-9 pr-3",
                  "text-[12.5px] text-foreground placeholder:text-muted-foreground/50",
                  "outline-none focus:border-sky-500/40 focus:ring-2 focus:ring-sky-500/15",
                )}
              />
            </div>
          </div>

          <ul
            role="listbox"
            className="max-h-[280px] overflow-y-auto scrollbar-hide py-1.5"
          >
            {filtered.length === 0 ? (
              <li className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">
                No repositories found
              </li>
            ) : (
              filtered.map((repo) => {
                const active = repo.htmlUrl === value;
                return (
                  <li key={repo.id} className="px-1.5">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(repo.htmlUrl, repo);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "w-full px-3 py-2.5 rounded-xl flex items-center gap-3 text-left transition-colors",
                        active
                          ? "bg-sky-500/15 text-foreground ring-1 ring-sky-500/25"
                          : "hover:bg-secondary/70 text-foreground/90",
                      )}
                    >
                      <span className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg border flex-shrink-0",
                        active
                          ? "bg-sky-500/20 border-sky-500/30 text-sky-700 dark:text-sky-300"
                          : "bg-secondary border-border text-muted-foreground",
                      )}>
                        <GitBranch className="w-3.5 h-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate text-[13px] font-semibold tracking-tight">
                            {repo.fullName}
                          </span>
                          {repo.private && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 flex-shrink-0">
                              <Lock className="w-2.5 h-2.5" />
                              private
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {repo.language || "Unknown"} · {repo.defaultBranch || "main"}
                        </span>
                      </span>
                      {active && <Check className="w-4 h-4 text-sky-600 dark:text-sky-400 flex-shrink-0" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
