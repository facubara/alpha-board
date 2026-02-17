"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PauseAgent {
  id: number;
  name: string;
}

interface PauseProgress {
  agentIds: number[];
  lastPausedIndex: number;
  timestamp: number;
}

type ModalStatus = "loading" | "resume_prompt" | "pausing" | "done" | "error" | "empty";

const STORAGE_KEY = "alpha-board:pause-progress";
const EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

interface PauseModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function PauseModal({ open, onClose, onComplete }: PauseModalProps) {
  const [agents, setAgents] = useState<PauseAgent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<ModalStatus>("loading");
  const [failedAgent, setFailedAgent] = useState<PauseAgent | null>(null);
  const [pausedCount, setPausedCount] = useState(0);
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [savedProgress, setSavedProgress] = useState<PauseProgress | null>(null);
  const cancelRef = useRef(false);
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Spinner animation
  useEffect(() => {
    if (status === "pausing") {
      spinnerRef.current = setInterval(() => {
        setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length);
      }, 80);
    } else {
      if (spinnerRef.current) clearInterval(spinnerRef.current);
    }
    return () => {
      if (spinnerRef.current) clearInterval(spinnerRef.current);
    };
  }, [status]);

  // Load agents on open
  useEffect(() => {
    if (!open) return;
    cancelRef.current = false;
    setStatus("loading");
    setFailedAgent(null);
    setPausedCount(0);
    setCurrentIndex(0);

    fetch("/api/agents/active-llm")
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((data: { agents: PauseAgent[] }) => {
        if (data.agents.length === 0) {
          setAgents([]);
          setStatus("empty");
          return;
        }

        setAgents(data.agents);

        // Check localStorage for saved progress
        const saved = loadProgress();
        if (saved && arraysMatch(saved.agentIds, data.agents.map((a) => a.id))) {
          setSavedProgress(saved);
          setStatus("resume_prompt");
        } else {
          clearProgress();
          setSavedProgress(null);
          startPausing(data.agents, 0);
        }
      })
      .catch(() => {
        setStatus("error");
        setFailedAgent(null);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startPausing = useCallback(async (agentList: PauseAgent[], startFrom: number) => {
    setStatus("pausing");
    cancelRef.current = false;
    setPausedCount(startFrom);
    setCurrentIndex(startFrom);

    // Save initial progress
    saveProgress(agentList.map((a) => a.id), startFrom);

    for (let i = startFrom; i < agentList.length; i++) {
      if (cancelRef.current) return;

      setCurrentIndex(i);
      const agent = agentList[i];

      try {
        const res = await fetch(`/api/agents/${agent.id}/pause`, { method: "POST" });
        if (!res.ok && res.status !== 404) {
          // 404 means already paused — that's fine, continue
          throw new Error(`HTTP ${res.status}`);
        }

        setPausedCount(i + 1);
        saveProgress(agentList.map((a) => a.id), i);
      } catch {
        setFailedAgent(agent);
        setStatus("error");
        setPausedCount(i);
        return;
      }
    }

    // All done
    clearProgress();
    setStatus("done");
    setPausedCount(agentList.length);
  }, []);

  const handleResume = useCallback(() => {
    if (savedProgress) {
      startPausing(agents, savedProgress.lastPausedIndex + 1);
    }
  }, [savedProgress, agents, startPausing]);

  const handleStartFresh = useCallback(() => {
    clearProgress();
    setSavedProgress(null);
    startPausing(agents, 0);
  }, [agents, startPausing]);

  const handleResumeFromError = useCallback(() => {
    if (failedAgent) {
      const idx = agents.findIndex((a) => a.id === failedAgent.id);
      if (idx >= 0) {
        setFailedAgent(null);
        startPausing(agents, idx);
      }
    }
  }, [failedAgent, agents, startPausing]);

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
    onClose();
  }, [onClose]);

  const handleDone = useCallback(() => {
    onComplete();
    onClose();
  }, [onComplete, onClose]);

  if (!open) return null;

  const progress = agents.length > 0 ? (pausedCount / agents.length) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleCancel}
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
        {status === "loading" && (
          <div className="flex items-center gap-2 py-8">
            <span className="font-mono text-sm text-secondary animate-pulse">
              Loading agents...
            </span>
          </div>
        )}

        {/* Empty state */}
        {status === "empty" && (
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
        {status === "resume_prompt" && savedProgress && (
          <div className="space-y-4 py-4">
            <p className="font-mono text-sm text-secondary">
              Previous pause stopped at{" "}
              <span className="text-primary">
                {savedProgress.lastPausedIndex + 1}/{agents.length}
              </span>
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleResume}
                className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 py-1.5 font-mono text-xs font-medium text-primary transition-colors hover:bg-[var(--bg-surface)]"
              >
                Resume from {savedProgress.lastPausedIndex + 2}
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
        {status === "pausing" && (
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <p className="font-mono text-sm text-secondary">
                <span className="text-primary">
                  {SPINNER_FRAMES[spinnerFrame]}
                </span>{" "}
                stopping{" "}
                <span className="text-primary">
                  {currentIndex + 1}
                </span>{" "}
                of{" "}
                <span className="text-primary">{agents.length}</span>
              </p>
              {agents[currentIndex] && (
                <p className="font-mono text-xs text-muted">
                  current: {agents[currentIndex].name}
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
        {status === "done" && (
          <div className="space-y-4 py-4">
            <p className="font-mono text-sm text-primary">
              All {pausedCount} agents paused
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
        {status === "error" && (
          <div className="space-y-4 py-4">
            {failedAgent ? (
              <>
                <p className="font-mono text-sm text-bearish">
                  Failed at agent {currentIndex + 1} of {agents.length}
                </p>
                <p className="font-mono text-xs text-muted">
                  {failedAgent.name}
                </p>
                <p className="font-mono text-xs text-secondary">
                  {pausedCount} agent{pausedCount !== 1 ? "s" : ""} paused
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

function loadProgress(): PauseProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PauseProgress;
    if (Date.now() - data.timestamp > EXPIRY_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveProgress(agentIds: number[], lastPausedIndex: number) {
  try {
    const data: PauseProgress = { agentIds, lastPausedIndex, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable
  }
}

function clearProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}

function arraysMatch(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
