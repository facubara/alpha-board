/**
 * Worker API Client
 *
 * Shared fetch utility for calling the worker API from Next.js server components.
 * All web query files should use this instead of direct DB access.
 */

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "https://alpha-worker.fly.dev";

export class WorkerError extends Error {
  constructor(
    public status: number,
    public detail: string
  ) {
    super(`Worker API error ${status}: ${detail}`);
    this.name = "WorkerError";
  }
}

async function workerFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...options,
    next: { revalidate: 0 },
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || body.message || JSON.stringify(body);
    } catch {
      // keep statusText
    }
    throw new WorkerError(res.status, detail);
  }

  return res.json() as Promise<T>;
}

export function workerGet<T>(path: string): Promise<T> {
  return workerFetch<T>(path, { method: "GET" });
}

export function workerPost<T>(path: string, body?: unknown): Promise<T> {
  return workerFetch<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function workerDelete<T>(path: string): Promise<T> {
  return workerFetch<T>(path, { method: "DELETE" });
}

export function workerPatch<T>(path: string, body?: unknown): Promise<T> {
  return workerFetch<T>(path, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
