"use client";

/**
 * StatusPageClient — Client-side wrapper that fetches status data
 * and caches it in memory so tab switches don't re-fetch.
 */

import { useEffect, useRef, useState } from "react";
import type { LlmSection, StatusData } from "@/lib/types";
import { StatusPage } from "./status-page";

const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL || "https://alpha-worker.fly.dev";

const STALE_MS = 60_000; // refresh if older than 60s

interface CachedData {
  status: StatusData;
  llm: LlmSection[];
  fetchedAt: number;
}

// Module-level cache — survives across navigations
let cache: CachedData | null = null;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function loadStatusData(): Promise<CachedData> {
  const [currentData, historyData, incidentsData, llmData] = await Promise.all([
    fetchJson<{
      overall: StatusData["overall"];
      services: StatusData["services"];
      active_incidents: StatusData["activeIncidents"];
    }>("/status/services"),
    fetchJson<{ services: StatusData["history"] }>("/status/history?days=90"),
    fetchJson<StatusData["recentIncidents"]>("/status/incidents?days=3"),
    fetchJson<LlmSection[]>("/settings/llm"),
  ]);

  return {
    status: {
      overall: currentData.overall,
      services: currentData.services,
      activeIncidents: currentData.active_incidents,
      history: historyData.services,
      recentIncidents: incidentsData,
    },
    llm: llmData,
    fetchedAt: Date.now(),
  };
}

export function StatusPageClient() {
  const [data, setData] = useState<CachedData | null>(cache);
  const [error, setError] = useState(false);
  const fetching = useRef(false);

  useEffect(() => {
    // If cache is fresh, skip fetch
    if (data && Date.now() - data.fetchedAt < STALE_MS) return;

    if (fetching.current) return;
    fetching.current = true;

    loadStatusData()
      .then((result) => {
        cache = result;
        setData(result);
        setError(false);
      })
      .catch(() => {
        if (!data) setError(true);
      })
      .finally(() => {
        fetching.current = false;
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <h1 className="font-mono text-xl text-text-primary uppercase tracking-widest border-b border-void-border pb-2">
        {">"}_ SYSTEM STATUS
        <span className="inline-block animate-pulse text-terminal-amber leading-none translate-y-[2px] ml-2 text-lg">
          █
        </span>
      </h1>

      {data ? (
        <StatusPage data={data.status} llmSections={data.llm} />
      ) : error ? (
        <div className="border border-void-border bg-void-surface px-4 py-8 text-center text-sm font-mono text-text-tertiary">
          Unable to fetch status data. The worker API may be unavailable.
        </div>
      ) : (
        <StatusSkeleton />
      )}
    </div>
  );
}

function StatusSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-14 border border-void-border bg-void-surface skeleton" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
        <div className="lg:col-span-8 flex flex-col gap-8">
          <div>
            <div className="mb-3 h-4 w-24 bg-void-muted skeleton" />
            <div className="grid grid-cols-2 gap-px border border-void-border bg-void-border sm:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 bg-void-surface px-3 py-2.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-void-muted skeleton" />
                  <div className="h-3 w-28 bg-void-muted skeleton" />
                </div>
              ))}
            </div>
          </div>
          <div className="border border-void-border">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between border-b border-void-border bg-void-surface px-4 py-3 last:border-b-0">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-void-muted skeleton" />
                  <div className="h-4 w-32 bg-void-muted skeleton" />
                </div>
                <div className="h-3 w-16 bg-void-muted skeleton" />
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="h-4 w-32 bg-void-muted skeleton" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-void-border bg-void-surface p-3 flex flex-col gap-2">
              <div className="h-4 w-20 bg-void-muted skeleton" />
              <div className="h-3 w-full bg-void-muted skeleton" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
