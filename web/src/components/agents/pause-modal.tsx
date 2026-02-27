"use client";

import { useReducer, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadProgress,
  saveProgress,
  clearProgress,
  arraysMatch,
  type PauseProgress,
} from "@/lib/pause-progress";

interface PauseAgent {
  id: number;
  name: string;
}

type ModalStatus = "loading" | "resume_prompt" | "pausing" | "done" | "error" | "empty";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// ─── Reducer ───
interface PauseState {
  agents: PauseAgent[];
  currentIndex: number;
  status: ModalStatus;
  failedAgent: PauseAgent | null;
  pausedCount: number;
  spinnerFrame: number;
  savedProgress: PauseProgress | null;
}

type PauseAction =
  | { type: "RESET" }
  | { type: "SET_AGENTS_EMPTY" }
  | { type: "SET_AGENTS"; agents: PauseAgent[]; saved: PauseProgress | null }
  | { type: "START_PAUSING"; startFrom: number }
  | { type: "SET_INDEX"; index: number }
  | { type: "AGENT_PAUSED"; index: number }
  | { type: "PAUSE_FAILED"; agent: PauseAgent; count: number }
  | { type: "PAUSE_DONE"; count: number }
  | { type: "LOAD_ERROR" }
  | { type: "TICK_SPINNER" };

function pauseReducer(state: PauseState, action: PauseAction): PauseState {
  switch (action.type) {
    case "RESET":
      return { ...state, status: "loading", failedAgent: null, pausedCount: 0, currentIndex: 0 };
    case "SET_AGENTS_EMPTY":
      return { ...state, agents: [], status: "empty" };
    case "SET_AGENTS":
      return {
        ...state,
        agents: action.agents,
        savedProgress: action.saved,
        status: action.saved ? "resume_prompt" : "pausing",
      };
    case "START_PAUSING":
      return { ...state, status: "pausing", pausedCount: action.startFrom, currentIndex: action.startFrom };
    case "SET_INDEX":
      return { ...state, currentIndex: action.index };
    case "AGENT_PAUSED":
      return { ...state, pausedCount: action.index + 1 };
    case "PAUSE_FAILED":
      return { ...state, failedAgent: action.agent, status: "error", pausedCount: action.count };
    case "PAUSE_DONE":
      return { ...state, status: "done", pausedCount: action.count };
    case "LOAD_ERROR":
      return { ...state, status: "error", failedAgent: null };
    case "TICK_SPINNER":
      return { ...state, spinnerFrame: (state.spinnerFrame + 1) % SPINNER_FRAMES.length };
  }
}

interface PauseModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function PauseModal({ open, onClose, onComplete }: PauseModalProps) {
  const [state, dispatch] = useReducer(pauseReducer, {
    agents: [],
    currentIndex: 0,
    status: "loading",
    failedAgent: null,
    pausedCount: 0,
    spinnerFrame: 0,
    savedProgress: null,
  });

  const cancelRef = useRef(false);
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Spinner animation
  useEffect(() => {
    if (state.status === "pausing") {
      spinnerRef.current = setInterval(() => {
        dispatch({ type: "TICK_SPINNER" });
      }, 80);
    } else {
      if (spinnerRef.current) clearInterval(spinnerRef.current);
    }
    return () => {
      if (spinnerRef.current) clearInterval(spinnerRef.current);
    };
  }, [state.status]);

  const startPausing = useCallback(async (agentList: PauseAgent[], startFrom: number) => {
    dispatch({ type: "START_PAUSING", startFrom });
    cancelRef.current = false;

    saveProgress(agentList.map((a) => a.id), startFrom);

    for (let i = startFrom; i < agentList.length; i++) {
      if (cancelRef.current) return;

      dispatch({ type: "SET_INDEX", index: i });
      const agent = agentList[i];

      let res: Response | null = null;
      try {
        res = await fetch(`/api/agents/${agent.id}/pause`, { method: "POST" });
      } catch {
        dispatch({ type: "PAUSE_FAILED", agent, count: i });
        return;
      }

      if (!res.ok && res.status !== 404) {
        dispatch({ type: "PAUSE_FAILED", agent, count: i });
        return;
      }

      dispatch({ type: "AGENT_PAUSED", index: i });
      saveProgress(agentList.map((a) => a.id), i);
    }

    // All done
    clearProgress();
    dispatch({ type: "PAUSE_DONE", count: agentList.length });
  }, []);

  // Load agents on open
  useEffect(() => {
    if (!open) return;
    cancelRef.current = false;
    dispatch({ type: "RESET" });

    let cancelled = false;

    (async () => {
      let data: { agents: PauseAgent[] } | null = null;
      try {
        const res = await fetch("/api/agents/active-llm");
        if (!res.ok) throw new Error("fetch failed");
        data = await res.json();
      } catch {
        if (!cancelled) dispatch({ type: "LOAD_ERROR" });
        return;
      }

      if (cancelled || !data) return;

      if (data.agents.length === 0) {
        dispatch({ type: "SET_AGENTS_EMPTY" });
        return;
      }

      const saved = loadProgress();
      if (saved && arraysMatch(saved.agentIds, data.agents.map((a) => a.id))) {
        dispatch({ type: "SET_AGENTS", agents: data.agents, saved });
      } else {
        clearProgress();
        dispatch({ type: "SET_AGENTS", agents: data.agents, saved: null });
        startPausing(data.agents, 0);
      }
    })();

    return () => { cancelled = true; };
  }, [open, startPausing]);

  const handleResume = useCallback(() => {
    if (state.savedProgress) {
      startPausing(state.agents, state.savedProgress.lastPausedIndex + 1);
    }
  }, [state.savedProgress, state.agents, startPausing]);

  const handleStartFresh = useCallback(() => {
    clearProgress();
    startPausing(state.agents, 0);
  }, [state.agents, startPausing]);

  const handleResumeFromError = useCallback(() => {
    if (state.failedAgent) {
      const idx = state.agents.findIndex((a) => a.id === state.failedAgent!.id);
      if (idx >= 0) {
        startPausing(state.agents, idx);
      }
    }
  }, [state.failedAgent, state.agents, startPausing]);

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
    onClose();
  }, [onClose]);

  const handleDone = useCallback(() => {
    onComplete();
    onClose();
  }, [onComplete, onClose]);

  if (!open) return null;

  const progress = state.agents.length > 0 ? (state.pausedCount / state.agents.length) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        role="button"
        tabIndex={-1}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleCancel}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleCancel(); }}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-mono text-sm font-semibold text-primary">
            Pause All LLM Agents
          </h2>
          <button
            onClick={handleCancel}
            className="text-muted transition-colors hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Loading state */}
        {state.status === "loading" && (
          <div className="flex items-center gap-2 py-8">
            <span className="font-mono text-sm text-secondary animate-pulse">
              Loading agents...
            </span>
          </div>
        )}

        {/* Empty state */}
        {state.status === "empty" && (
          <div className="py-8 text-center">
            <p className="font-mono text-sm text-secondary">
              No active LLM agents to pause
            </p>
            <button
              onClick={onClose}
              className="mt-4 rounded-md border border-[var(--border-default)] px-4 py-1.5 font-mono text-xs font-medium text-secondary transition-colors hover:bg-[var(--bg-elevated)] hover:text-primary"
            >
              Close
            </button>
          </div>
        )}

        {/* Resume prompt */}
        {state.status === "resume_prompt" && state.savedProgress && (
          <div className="space-y-4 py-4">
            <p className="font-mono text-sm text-secondary">
              Previous pause stopped at{" "}
              <span className="text-primary">
                {state.savedProgress.lastPausedIndex + 1}/{state.agents.length}
              </span>
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleResume}
                className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 py-1.5 font-mono text-xs font-medium text-primary transition-colors hover:bg-[var(--bg-surface)]"
              >
                Resume from {state.savedProgress.lastPausedIndex + 2}
              </button>
              <button
                onClick={handleStartFresh}
                className="rounded-md border border-[var(--border-default)] px-4 py-1.5 font-mono text-xs font-medium text-secondary transition-colors hover:bg-[var(--bg-elevated)] hover:text-primary"
              >
                Start fresh
              </button>
            </div>
          </div>
        )}

        {/* Pausing state */}
        {state.status === "pausing" && (
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <p className="font-mono text-sm text-secondary">
                <span className="text-primary">
                  {SPINNER_FRAMES[state.spinnerFrame]}
                </span>{" "}
                stopping{" "}
                <span className="text-primary">
                  {state.currentIndex + 1}
                </span>{" "}
                of{" "}
                <span className="text-primary">{state.agents.length}</span>
              </p>
              {state.agents[state.currentIndex] && (
                <p className="font-mono text-xs text-muted">
                  current: {state.agents[state.currentIndex].name}
                </p>
              )}
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
              <div
                className="h-full rounded-full bg-[var(--bearish-strong)] transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="font-mono text-xs text-muted text-right">
              {Math.round(progress)}%
            </p>

            <button
              onClick={handleCancel}
              className="rounded-md border border-[var(--border-default)] px-4 py-1.5 font-mono text-xs font-medium text-secondary transition-colors hover:bg-[var(--bg-elevated)] hover:text-primary"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Done state */}
        {state.status === "done" && (
          <div className="space-y-4 py-4">
            <p className="font-mono text-sm text-primary">
              All {state.pausedCount} agents paused
            </p>
            <button
              onClick={handleDone}
              className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 py-1.5 font-mono text-xs font-medium text-primary transition-colors hover:bg-[var(--bg-surface)]"
            >
              Done
            </button>
          </div>
        )}

        {/* Error state */}
        {state.status === "error" && (
          <div className="space-y-4 py-4">
            {state.failedAgent ? (
              <>
                <p className="font-mono text-sm text-bearish">
                  Failed at agent {state.currentIndex + 1} of {state.agents.length}
                </p>
                <p className="font-mono text-xs text-muted">
                  {state.failedAgent.name}
                </p>
                <p className="font-mono text-xs text-secondary">
                  {state.pausedCount} agent{state.pausedCount !== 1 ? "s" : ""} paused
                  successfully
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleResumeFromError}
                    className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 py-1.5 font-mono text-xs font-medium text-primary transition-colors hover:bg-[var(--bg-surface)]"
                  >
                    Resume
                  </button>
                  <button
                    onClick={onClose}
                    className={cn(
                      "rounded-md border border-[var(--border-default)] px-4 py-1.5 font-mono text-xs font-medium text-secondary transition-colors",
                      "hover:bg-[var(--bg-elevated)] hover:text-primary"
                    )}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="font-mono text-sm text-bearish">
                  Failed to load agents
                </p>
                <button
                  onClick={onClose}
                  className="rounded-md border border-[var(--border-default)] px-4 py-1.5 font-mono text-xs font-medium text-secondary transition-colors hover:bg-[var(--bg-elevated)] hover:text-primary"
                >
                  Close
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
