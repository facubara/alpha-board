import { NextResponse } from "next/server";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

/**
 * POST /api/memecoins/wallets/refresh — Trigger wallet discovery refresh via worker
 */
export async function POST() {
  if (!WORKER_URL) {
    return NextResponse.json(
      { error: "Worker URL not configured" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${WORKER_URL}/memecoins/wallets/refresh`, {
      method: "POST",
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to reach worker" },
      { status: 502 }
    );
  }
}
