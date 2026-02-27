interface PauseProgress {
  agentIds: number[];
  lastPausedIndex: number;
  timestamp: number;
}

const STORAGE_KEY = "alpha-board:pause-progress";
const EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export type { PauseProgress };

export function loadProgress(): PauseProgress | null {
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

export function saveProgress(agentIds: number[], lastPausedIndex: number) {
  try {
    const data: PauseProgress = { agentIds, lastPausedIndex, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable
  }
}

export function clearProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}

export function arraysMatch(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
