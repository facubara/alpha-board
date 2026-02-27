import { NextRequest, NextResponse } from "next/server";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

/**
 * DELETE /api/memecoins/tracker/[mint] — Deactivate a manual token (proxy to worker)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;

  const res = await fetch(
    `${WORKER_URL}/memecoins/tracker/${encodeURIComponent(mint)}`,
    { method: "DELETE" }
  );

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}

/**
 * PATCH /api/memecoins/tracker/[mint] — Update refresh interval (proxy to worker)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;
  const body = await request.json();

  const res = await fetch(
    `${WORKER_URL}/memecoins/tracker/${encodeURIComponent(mint)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}
