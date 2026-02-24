"use client";

/**
 * FollowingImport — Upload following.js from Twitter data export,
 * parse account IDs client-side, and bulk-import via worker API.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import type { TwitterImportProgress } from "@/lib/types";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

export function FollowingImport() {
  const router = useRouter();
  const { requireAuth } = useAuth();
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importId, setImportId] = useState<number | null>(null);
  const [progress, setProgress] = useState<TwitterImportProgress | null>(null);
  const [starting, setStarting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const pollProgress = useCallback(
    (id: number) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${WORKER_URL}/twitter/import/${id}`);
          if (!res.ok) return;
          const data = await res.json();
          const mapped: TwitterImportProgress = {
            importId: data.import_id,
            status: data.status,
            totalAccounts: data.total_accounts,
            processed: data.processed,
            inserted: data.inserted,
            skippedExisting: data.skipped_existing,
            skippedDiscard: data.skipped_discard,
            errors: data.errors,
            currentBatch: data.current_batch,
            totalBatches: data.total_batches,
            rateLimitWait: data.rate_limit_wait,
            errorMessage: data.error_message,
          };
          setProgress(mapped);
          if (mapped.status === "completed" || mapped.status === "failed") {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (mapped.status === "completed") router.refresh();
          }
        } catch {
          // Ignore polling errors
        }
      }, 2000);
    },
    [router],
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setAccountIds([]);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = reader.result as string;
        const jsonStr = raw.replace("window.YTD.following.part0 = ", "");
        const data = JSON.parse(jsonStr);
        const ids: string[] = data.map(
          (entry: { following: { accountId: string } }) =>
            entry.following.accountId,
        );
        if (ids.length === 0) {
          setParseError("No account IDs found in file");
          return;
        }
        setAccountIds(ids);
      } catch {
        setParseError(
          "Failed to parse file. Make sure this is a following.js from your Twitter data export.",
        );
      }
    };
    reader.readAsText(file);
  }

  async function doStart() {
    setStarting(true);
    try {
      const res = await fetch(`${WORKER_URL}/twitter/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_ids: accountIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        setParseError(data.detail || "Failed to start import");
        setStarting(false);
        return;
      }
      const data = await res.json();
      setImportId(data.import_id);
      setProgress({
        importId: data.import_id,
        status: "pending",
        totalAccounts: accountIds.length,
        processed: 0,
        inserted: 0,
        skippedExisting: 0,
        skippedDiscard: 0,
        errors: 0,
        currentBatch: 0,
        totalBatches: 0,
        rateLimitWait: null,
        errorMessage: null,
      });
      pollProgress(data.import_id);
    } catch {
      setParseError("Failed to connect to worker");
    }
    setStarting(false);
  }

  function handleStart() {
    requireAuth(() => doStart());
  }

  const pct =
    progress && progress.totalAccounts > 0
      ? Math.round((progress.processed / progress.totalAccounts) * 100)
      : 0;

  const isFinished =
    progress?.status === "completed" || progress?.status === "failed";

  return (
    <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3">
      <h3 className="text-sm font-medium text-primary">
        Import from following.js
      </h3>

      {/* File picker (only show if not started) */}
      {!importId && (
        <div className="space-y-2">
          <p className="text-xs text-muted">
            Upload your <code>following.js</code> from a Twitter data export.
            Accounts will be looked up via the X API and auto-classified.
          </p>
          <input
            type="file"
            accept=".js"
            onChange={handleFileChange}
            className="block w-full text-sm text-muted file:mr-3 file:rounded file:border-0 file:bg-[var(--bg-elevated)] file:px-3 file:py-1.5 file:text-sm file:text-primary file:cursor-pointer hover:file:bg-[var(--bg-base)]"
          />
          {parseError && <p className="text-xs text-red-400">{parseError}</p>}
          {accountIds.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-green-400">
                {accountIds.length} accounts found in file
              </p>
              <button
                onClick={handleStart}
                disabled={starting}
                className="flex items-center gap-1.5 rounded bg-[var(--primary)] px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
              >
                {starting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                Start Import
              </button>
            </div>
          )}
        </div>
      )}

      {/* Progress */}
      {progress && (
        <div className="space-y-2">
          {/* Progress bar */}
          <div className="h-2 w-full rounded-full bg-[var(--bg-base)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                progress.status === "failed"
                  ? "bg-red-500"
                  : progress.status === "completed"
                    ? "bg-green-500"
                    : "bg-[var(--primary)]"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Status line */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">
              {progress.status === "running" && (
                <>
                  Batch {progress.currentBatch}/{progress.totalBatches}
                  {" — "}
                  {pct}% processed
                </>
              )}
              {progress.status === "pending" && "Starting..."}
              {progress.status === "completed" && (
                <span className="flex items-center gap-1 text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Import complete
                </span>
              )}
              {progress.status === "failed" && (
                <span className="flex items-center gap-1 text-red-400">
                  <XCircle className="h-3 w-3" />
                  Import failed
                  {progress.errorMessage && `: ${progress.errorMessage}`}
                </span>
              )}
            </span>
            {progress.rateLimitWait && (
              <span className="text-yellow-400">
                Rate limit — waiting {progress.rateLimitWait}s...
              </span>
            )}
          </div>

          {/* Stats */}
          {(progress.status === "running" || isFinished) && (
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="rounded bg-[var(--bg-base)] p-2 text-center">
                <div className="text-green-400 font-medium">
                  {progress.inserted}
                </div>
                <div className="text-muted">Inserted</div>
              </div>
              <div className="rounded bg-[var(--bg-base)] p-2 text-center">
                <div className="text-blue-400 font-medium">
                  {progress.skippedExisting}
                </div>
                <div className="text-muted">Already exist</div>
              </div>
              <div className="rounded bg-[var(--bg-base)] p-2 text-center">
                <div className="text-yellow-400 font-medium">
                  {progress.skippedDiscard}
                </div>
                <div className="text-muted">Discarded</div>
              </div>
              <div className="rounded bg-[var(--bg-base)] p-2 text-center">
                <div className="text-red-400 font-medium">
                  {progress.errors}
                </div>
                <div className="text-muted">Errors</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
