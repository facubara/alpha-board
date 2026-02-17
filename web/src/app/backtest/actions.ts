"use server";

import { revalidatePath } from "next/cache";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

export async function launchBacktest(formData: FormData) {
  const strategy = formData.get("strategy") as string;
  const timeframe = formData.get("timeframe") as string;
  const symbol = formData.get("symbol") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;

  if (!strategy || !timeframe || !symbol || !startDate || !endDate) {
    return { error: "All fields are required" };
  }

  if (!WORKER_URL) {
    return { error: "Worker URL not configured" };
  }

  try {
    const response = await fetch(`${WORKER_URL}/backtest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strategy,
        timeframe,
        symbol: symbol.toUpperCase(),
        start_date: startDate,
        end_date: endDate,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return { error: data?.detail || `Worker returned ${response.status}` };
    }

    const data = await response.json();
    revalidatePath("/backtest");
    return { runId: data.run_id, status: data.status };
  } catch (e) {
    return { error: `Failed to reach worker: ${(e as Error).message}` };
  }
}

export async function cancelBacktest(runId: number) {
  if (!WORKER_URL) {
    return { error: "Worker URL not configured" };
  }

  try {
    const response = await fetch(`${WORKER_URL}/backtest/${runId}/cancel`, {
      method: "POST",
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return { error: data?.detail || `Worker returned ${response.status}` };
    }

    const data = await response.json();
    revalidatePath("/backtest");
    return { status: data.status };
  } catch (e) {
    return { error: `Failed to cancel backtest: ${(e as Error).message}` };
  }
}
