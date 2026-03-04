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
  high: "bg-terminal-amber-muted text-data-loss",
  medium: "bg-terminal-amber-muted text-terminal-amber",
  low: "bg-void-muted text-text-tertiary",
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
            className="rounded-none border border-void-border bg-void-surface"
          >
            {/* Header — clickable */}
            <button
              onClick={() => setExpandedId(expanded ? null : analysis.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <ChevronRight
                className={cn(
                  "h-4 w-4 shrink-0 text-text-tertiary transition-transform",
                  expanded && "rotate-90"
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary">{analysis.summary}</p>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  {analysis.analysisType.replace(/_/g, " ")} &middot; {timeAgo(analysis.createdAt)}
                </p>
              </div>
              {analysis.recommendations.length > 0 && (
                <span className="shrink-0 rounded-none bg-void-muted px-1.5 py-0.5 text-xs text-text-tertiary">
                  {analysis.recommendations.length} rec
                </span>
              )}
            </button>

            {/* Expanded content */}
            {expanded && (
              <div className="border-t border-void-border px-4 py-3 space-y-4">
                {/* Full analysis */}
                <div>
                  <h4 className="text-xs font-medium text-text-tertiary uppercase mb-1">Full Analysis</h4>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">
                    {analysis.fullAnalysis}
                  </p>
                </div>

                {/* Recommendations */}
                {analysis.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-text-tertiary uppercase mb-2">Recommendations</h4>
                    <div className="space-y-2">
                      {analysis.recommendations.map((rec, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 rounded-none border border-void-border bg-void px-3 py-2"
                        >
                          <span
                            className={cn(
                              "mt-0.5 shrink-0 rounded-none px-1.5 py-0.5 text-xs font-medium",
                              PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.low
                            )}
                          >
                            {rec.priority}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text-primary">{rec.action}</p>
                            {rec.details && (
                              <p className="mt-0.5 text-xs text-text-tertiary">{rec.details}</p>
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
                    <h4 className="text-xs font-medium text-text-tertiary uppercase mb-1">Metrics at Review</h4>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(analysis.metricsSnapshot).map(([key, value]) => (
                        <div key={key} className="text-xs">
                          <span className="text-text-tertiary">{key.replace(/_/g, " ")}:</span>{" "}
                          <span className="font-mono text-text-secondary">
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
