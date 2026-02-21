import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

/**
 * GET /api/memecoins/wallets — List watch wallets
 */
export async function GET() {
  const rows = await sql`
    SELECT *
    FROM watch_wallets
    WHERE is_active = true
    ORDER BY score DESC
    LIMIT 100
  `;

  const wallets = rows.map((row) => ({
    id: Number(row.id),
    address: row.address,
    label: row.label,
    source: row.source,
    score: Number(row.score),
    hitCount: Number(row.hit_count),
    winRate: row.win_rate != null ? Number(row.win_rate) : null,
    avgEntryRank: row.avg_entry_rank != null ? Number(row.avg_entry_rank) : null,
    totalTokensTraded: Number(row.total_tokens_traded),
    tokensSummary: row.tokens_summary || [],
    isActive: row.is_active,
    stats: row.stats || {},
    addedAt: (row.added_at as Date).toISOString(),
    lastRefreshedAt: row.last_refreshed_at
      ? (row.last_refreshed_at as Date).toISOString()
      : null,
  }));

  return NextResponse.json(wallets);
}

/**
 * POST /api/memecoins/wallets — Add a manual wallet
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { address, label } = body as { address?: string; label?: string };

  if (!address || address.length > 64) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  // Check duplicate
  const existing = await sql`
    SELECT id FROM watch_wallets WHERE address = ${address}
  `;
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "Wallet already tracked" },
      { status: 409 }
    );
  }

  const rows = await sql`
    INSERT INTO watch_wallets (address, label, source)
    VALUES (${address}, ${label || null}, 'manual')
    RETURNING id, address, label, source, score, hit_count, added_at
  `;

  const row = rows[0];
  return NextResponse.json({
    id: Number(row.id),
    address: row.address,
    label: row.label,
    source: row.source,
    score: Number(row.score),
    hitCount: Number(row.hit_count),
    addedAt: (row.added_at as Date).toISOString(),
  });
}

/**
 * DELETE /api/memecoins/wallets — Deactivate a wallet (pass address as query param)
 */
export async function DELETE(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "Address required" }, { status: 400 });
  }

  const result = await sql`
    UPDATE watch_wallets SET is_active = false WHERE address = ${address} RETURNING id
  `;

  if (result.length === 0) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  return NextResponse.json({ status: "deactivated", address });
}
