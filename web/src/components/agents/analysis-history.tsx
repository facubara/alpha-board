"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentAnalysis } from "@/lib/types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-[var(--bearish-subtle)] text-bearish",
  medium: "bg-[var(--warning)]/10 text-[var(--warning)]",
  low: "bg-[var(--bg-muted)] text-muted",
};

export function AnalysisHistory({ analyses }: { analyses: AgentAnalysis[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {analyses.map((analysis) => {
        const expanded = expandedId === analysis.id;
        return (
          <div
            key={analysis.id}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]"
          >
            {/* Header — clickable */}
            <button
              onClick={() => setExpandedId(expanded ? null : analysis.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <ChevronRight
                className={cn(
                  "h-4 w-4 shrink-0 text-muted transition-transform",
                  expanded && "rotate-90"
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-primary">{analysis.summary}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {analysis.analysisType.replace(/_/g, " ")} &middot; {timeAgo(analysis.createdAt)}
                </p>
              </div>
              {analysis.recommendations.length > 0 && (
                <span className="shrink-0 rounded bg-[var(--bg-muted)] px-1.5 py-0.5 text-xs text-muted">
                  {analysis.recommendations.length} rec
                </span>
              )}
            </button>

            {/* Expanded content */}
            {expanded && (
              <div className="border-t border-[var(--border-default)] px-4 py-3 space-y-4">
                {/* Full analysis */}
                <div>
                  <h4 className="text-xs font-medium text-muted uppercase mb-1">Full Analysis</h4>
                  <p className="text-sm text-secondary whitespace-pre-wrap">
                    {analysis.fullAnalysis}
                  </p>
                </div>

                {/* Recommendations */}
                {analysis.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted uppercase mb-2">Recommendations</h4>
                    <div className="space-y-2">
                      {analysis.recommendations.map((rec, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2"
                        >
                          <span
                            className={cn(
                              "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                              PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.low
                            )}
                          >
                            {rec.priority}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-primary">{rec.action}</p>
                            {rec.details && (
                              <p className="mt-0.5 text-xs text-muted">{rec.details}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metrics snapshot */}
                {Object.keys(analysis.metricsSnapshot).length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted uppercase mb-1">Metrics at Review</h4>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(analysis.metricsSnapshot).map(([key, value]) => (
                        <div key={key} className="text-xs">
                          <span className="text-muted">{key.replace(/_/g, " ")}:</span>{" "}
                          <span className="font-mono text-secondary">
                            {typeof value === "number" ? value.toFixed(2) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
