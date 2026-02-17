"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, X, Zap, AlertTriangle, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import type { FleetLesson, FleetLessonCategory } from "@/lib/types";

const CATEGORY_CONFIG: Record<
  FleetLessonCategory,
  { label: string; icon: typeof Zap; colorClass: string }
> = {
  strength: {
    label: "Strength",
    icon: Zap,
    colorClass: "bg-emerald-500/10 text-emerald-400",
  },
  mistake: {
    label: "Mistake",
    icon: AlertTriangle,
    colorClass: "bg-red-500/10 text-red-400",
  },
  pattern: {
    label: "Pattern",
    icon: Eye,
    colorClass: "bg-blue-500/10 text-blue-400",
  },
};

interface FleetLessonsProps {
  lessons: FleetLesson[];
}

export function FleetLessons({ lessons: initialLessons }: FleetLessonsProps) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState(initialLessons);
  const [removing, setRemoving] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<FleetLessonCategory | "all">("all");
  const { requireAuth } = useAuth();

  const handleRemove = useCallback(
    (id: number) => {
      requireAuth(async () => {
        setRemoving((prev) => new Set(prev).add(id));
        try {
          const res = await fetch(`/api/lessons/${id}`, { method: "DELETE" });
          if (res.ok) {
            setItems((prev) => prev.filter((l) => l.id !== id));
          }
        } finally {
          setRemoving((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      });
    },
    [requireAuth]
  );

  if (items.length === 0) return null;

  const filtered = filter === "all" ? items : items.filter((l) => l.category === filter);

  const counts = {
    all: items.length,
    strength: items.filter((l) => l.category === "strength").length,
    mistake: items.filter((l) => l.category === "mistake").length,
    pattern: items.filter((l) => l.category === "pattern").length,
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium text-secondary transition-colors-fast hover:text-primary"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        Fleet Lessons ({items.length})
      </button>

      {expanded && (
        <div className="space-y-3">
          {/* Category filters */}
          <div className="flex gap-1.5">
            {(["all", "strength", "mistake", "pattern"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium transition-colors-fast",
                  filter === cat
                    ? "bg-[var(--bg-elevated)] text-primary"
                    : "text-muted hover:text-secondary"
                )}
              >
                {cat === "all" ? "All" : CATEGORY_CONFIG[cat].label} ({counts[cat]})
              </button>
            ))}
          </div>

          {/* Lessons list */}
          <div className="divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-default)]">
            {filtered.map((lesson) => {
              const config = CATEGORY_CONFIG[lesson.category];
              const Icon = config.icon;
              return (
                <div
                  key={lesson.id}
                  className="flex items-start gap-3 px-3 py-2.5 hover:bg-[var(--bg-elevated)]"
                >
                  {/* Category badge */}
                  <span
                    className={cn(
                      "mt-0.5 flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                      config.colorClass
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {config.label.toUpperCase()}
                  </span>

                  {/* Lesson content */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-primary">{lesson.lesson}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      from{" "}
                      <span className="font-medium text-secondary">
                        {lesson.agentName}
                      </span>
                      <span className="mx-1">·</span>
                      <span className="font-mono">{lesson.archetype}</span>
                      <span className="mx-1">·</span>
                      {new Date(lesson.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => handleRemove(lesson.id)}
                    disabled={removing.has(lesson.id)}
                    className="mt-0.5 shrink-0 rounded p-1 text-muted transition-colors-fast hover:bg-[var(--bg-muted)] hover:text-bearish disabled:opacity-50"
                    title="Remove lesson"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-muted">
                No {filter} lessons yet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
