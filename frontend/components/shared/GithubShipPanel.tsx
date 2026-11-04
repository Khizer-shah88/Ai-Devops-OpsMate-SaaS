"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bug,
  CheckCircle2,
  Diff,
  ExternalLink,
  GitPullRequest,
  History,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { devopsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  ActionsDebugResult,
  ActionsRun,
  ApplyPrResult,
  GeneratedFile,
  RepoDiffResult,
  RepoMemory,
} from "@/lib/types";

interface GithubShipPanelProps {
  repoUrl: string;
  branch: string;
  versionId?: string | null;
  files: GeneratedFile[];
  enabled: boolean;
}

export function GithubShipPanel({
  repoUrl,
  branch,
  versionId,
  files,
  enabled,
}: GithubShipPanelProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [diff, setDiff] = useState<RepoDiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyPrResult | null>(null);
  const [runs, setRuns] = useState<ActionsRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugResult, setDebugResult] = useState<ActionsDebugResult | null>(null);
  const [memory, setMemory] = useState<RepoMemory | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);

  const selectableFiles = useMemo(
    () => files.filter((f) => f.path && f.content != null),
    [files],
  );

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const file of selectableFiles) {
      next[file.path] = selected[file.path] ?? true;
    }
    setSelected(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectableFiles.map((f) => f.path).join("|")]);

  useEffect(() => {
    if (!enabled || !repoUrl) return;
    void loadMemory();
    void loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, repoUrl, branch]);

  const selectedFiles = selectableFiles.filter((f) => selected[f.path]);

  const loadMemory = async () => {
    setMemoryLoading(true);
    try {
      const data = await devopsApi.getRepoMemory(repoUrl);
      setMemory(data);
    } catch {
      setMemory(null);
    } finally {
      setMemoryLoading(false);
    }
  };

  const loadRuns = async () => {
    setRunsLoading(true);
    try {
      const data = await devopsApi.listActionRuns(repoUrl, branch, 8);
      setRuns(data.runs);
    } catch {
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  };

  const runDiff = async () => {
    if (!selectedFiles.length) {
      setError("Select at least one file to compare.");
      return;
    }
    setError(null);
    setDiffLoading(true);
    try {
      const result = await devopsApi.diffGithub({
        repoUrl,
        branch,
        files: selectedFiles.map((f) => ({ path: f.path, content: f.content })),
      });
      setDiff(result);
      setActivePath(result.files.find((f) => f.status !== "unchanged")?.path || result.files[0]?.path || null);
      await loadMemory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Diff failed");
    } finally {
      setDiffLoading(false);
    }
  };

  const applyPr = async () => {
    if (!selectedFiles.length) {
      setError("Select at least one file to include in the PR.");
      return;
    }
    setError(null);
    setApplyLoading(true);
    try {
      // Always refresh diff before apply so users see latest remote state.
      const latestDiff = await devopsApi.diffGithub({
        repoUrl,
        branch,
        files: selectedFiles.map((f) => ({ path: f.path, content: f.content })),
      });
      setDiff(latestDiff);

      const result = await devopsApi.applyPullRequest({
        repoUrl,
        baseBranch: branch,
        versionId: versionId || undefined,
        title: `DevMat AI: update CI/CD & infra (${selectedFiles.length} files)`,
        body: [
          "## DevMat AI apply",
          "",
          "### Diff summary",
          `- Added: ${latestDiff.summary.added}`,
          `- Modified: ${latestDiff.summary.modified}`,
          `- Unchanged: ${latestDiff.summary.unchanged}`,
          "",
          "### Files",
          ...selectedFiles.map((f) => `- \`${f.path}\``),
        ].join("\n"),
        files: selectedFiles.map((f) => ({ path: f.path, content: f.content })),
      });
      setApplyResult(result);
      await loadMemory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create pull request");
    } finally {
      setApplyLoading(false);
    }
  };

  const runActionsDebug = async (runId?: string) => {
    setError(null);
    setDebugLoading(true);
    try {
      const result = await devopsApi.debugActions({
        repoUrl,
        branch,
        runId,
      });
      setDebugResult(result);
      await loadMemory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Actions debug failed");
    } finally {
      setDebugLoading(false);
    }
  };

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-5 text-[13px] text-muted-foreground">
        Connect GitHub and generate pipeline files to unlock Diff, Apply PR, Actions debug, and per-repo memory.
      </div>
    );
  }

  const activeDiff = diff?.files.find((f) => f.path === activePath) || diff?.files[0];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border/80 bg-card/90 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Ship to GitHub</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Diff against remote → select files → open PR
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runDiff}
              disabled={diffLoading || selectedFiles.length === 0}
              className={cn(
                "h-9 px-3 rounded-xl text-[12px] font-semibold border inline-flex items-center gap-1.5",
                "border-sky-500/30 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 disabled:opacity-50",
              )}
            >
              {diffLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Diff className="w-3.5 h-3.5" />}
              Diff
            </button>
            <button
              type="button"
              onClick={applyPr}
              disabled={applyLoading || selectedFiles.length === 0}
              className={cn(
                "h-9 px-3 rounded-xl text-[12px] font-semibold text-white inline-flex items-center gap-1.5",
                "bg-sky-600 hover:bg-sky-500 disabled:opacity-50",
              )}
            >
              {applyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitPullRequest className="w-3.5 h-3.5" />}
              Apply PR
            </button>
          </div>
        </div>

        <div className="space-y-1.5 max-h-44 overflow-y-auto scrollbar-hide">
          {selectableFiles.map((file) => (
            <label
              key={file.path}
              className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-secondary/20 px-3 py-2 cursor-pointer hover:bg-secondary/35"
            >
              <input
                type="checkbox"
                checked={Boolean(selected[file.path])}
                onChange={(e) => setSelected((prev) => ({ ...prev, [file.path]: e.target.checked }))}
                className="accent-sky-500"
              />
              <span className="text-[12px] font-medium text-foreground truncate">{file.path}</span>
              {diff?.files.find((f) => f.path === file.path) && (
                <span className={cn(
                  "ml-auto text-[10px] font-semibold uppercase tracking-wide",
                  diff.files.find((f) => f.path === file.path)?.status === "added" && "text-emerald-600 dark:text-emerald-400",
                  diff.files.find((f) => f.path === file.path)?.status === "modified" && "text-amber-700 dark:text-amber-300",
                  diff.files.find((f) => f.path === file.path)?.status === "unchanged" && "text-muted-foreground",
                )}>
                  {diff.files.find((f) => f.path === file.path)?.status}
                </span>
              )}
            </label>
          ))}
        </div>

        {diff && (
          <div className="rounded-xl border border-border/70 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-secondary/20">
              <p className="text-[11px] text-muted-foreground">
                +{diff.summary.added} / ~{diff.summary.modified} / ={diff.summary.unchanged}
              </p>
              <div className="flex gap-1 overflow-x-auto scrollbar-hide max-w-[70%]">
                {diff.files.map((file) => (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => setActivePath(file.path)}
                    className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap",
                      activePath === file.path ? "bg-sky-500/20 text-sky-700 dark:text-sky-300" : "text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {file.path.split("/").pop()}
                  </button>
                ))}
              </div>
            </div>
            <pre className="max-h-64 overflow-auto scrollbar-hide p-3 text-[11px] font-mono leading-relaxed text-foreground/85 whitespace-pre">
              {(activeDiff?.hunks || []).join("\n")}
            </pre>
          </div>
        )}

        {applyResult && (
          <a
            href={applyResult.prUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            PR #{applyResult.prNumber} opened
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </section>

      <section className="rounded-2xl border border-border/80 bg-card/90 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Actions auto-debug</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Pull latest workflow failure and diagnose with AI
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadRuns}
              disabled={runsLoading}
              className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", runsLoading && "animate-spin")} />
            </button>
            <button
              type="button"
              onClick={() => runActionsDebug()}
              disabled={debugLoading}
              className={cn(
                "h-9 px-3 rounded-xl text-[12px] font-semibold border inline-flex items-center gap-1.5",
                "border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 disabled:opacity-50",
              )}
            >
              {debugLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bug className="w-3.5 h-3.5" />}
              Debug latest
            </button>
          </div>
        </div>

        <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-hide">
          {runs.length === 0 ? (
            <p className="text-[12px] text-muted-foreground px-1 py-2">No recent Actions runs found.</p>
          ) : (
            runs.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => runActionsDebug(run.id)}
                className="w-full text-left rounded-xl border border-border/60 bg-secondary/15 px-3 py-2 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-medium text-foreground truncate">{run.title || run.name}</p>
                  <span className={cn(
                    "text-[10px] font-semibold uppercase",
                    run.conclusion === "success" && "text-emerald-600 dark:text-emerald-400",
                    run.conclusion === "failure" && "text-rose-600 dark:text-rose-400",
                    !run.conclusion && "text-muted-foreground",
                  )}>
                    {run.conclusion || run.status}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {run.headBranch} · {new Date(run.updatedAt).toLocaleString()}
                </p>
              </button>
            ))
          )}
        </div>

        {debugResult && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5 space-y-2"
          >
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <ShieldAlert className="w-4 h-4" />
              <p className="text-[12px] font-semibold">
                {debugResult.job.name} · {debugResult.run.conclusion || debugResult.run.status}
              </p>
            </div>
            <p className="text-[12px] text-foreground/90 leading-relaxed">{debugResult.diagnosis.explanation}</p>
            <p className="text-[12px] text-muted-foreground">
              <span className="text-foreground font-medium">Root cause:</span> {debugResult.diagnosis.rootCause}
            </p>
            <ol className="list-decimal pl-4 space-y-1">
              {debugResult.diagnosis.fixSteps.map((step) => (
                <li key={step} className="text-[12px] text-muted-foreground">{step}</li>
              ))}
            </ol>
            {debugResult.run.htmlUrl && (
              <a
                href={debugResult.run.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline"
              >
                Open run on GitHub <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </motion.div>
        )}
      </section>

      <section className="rounded-2xl border border-border/80 bg-card/90 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <p className="text-[13px] font-semibold text-foreground">Per-repo memory</p>
          </div>
          <button
            type="button"
            onClick={loadMemory}
            disabled={memoryLoading}
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", memoryLoading && "animate-spin")} />
          </button>
        </div>

        {!memory ? (
          <p className="text-[12px] text-muted-foreground">
            No memory yet for this repository. Analyze, generate, diff, or debug to start building history.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-border/60 bg-secondary/20 px-2.5 py-2">
                <p className="text-muted-foreground">Last branch</p>
                <p className="font-semibold text-foreground mt-0.5">{memory.lastBranch || "—"}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-secondary/20 px-2.5 py-2">
                <p className="text-muted-foreground">Last Actions</p>
                <p className="font-semibold text-foreground mt-0.5">{memory.lastActionsStatus || "—"}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-secondary/20 px-2.5 py-2 col-span-2">
                <p className="text-muted-foreground">Last PR</p>
                {memory.lastPrUrl ? (
                  <a href={memory.lastPrUrl} target="_blank" rel="noreferrer" className="font-semibold text-sky-600 dark:text-sky-400 hover:underline mt-0.5 inline-flex items-center gap-1">
                    #{memory.lastPrNumber} <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="font-semibold text-foreground mt-0.5">—</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-hide">
              {(memory.events || []).map((event) => (
                <div key={event.id} className="rounded-lg border border-border/50 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">{event.type}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p>
                  </div>
                  <p className="text-[12px] text-foreground/90 mt-0.5">{event.summary}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {error && (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-3 text-[12px] text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}
    </div>
  );
}
