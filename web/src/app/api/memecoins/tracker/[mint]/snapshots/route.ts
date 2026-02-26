import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

/**
 * GET /api/memecoins/tracker/[mint]/snapshots — Get historical snapshots for a token
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;

  // Resolve token_id from mint_address
  const tokenRows = await sql`
    SELECT id FROM token_tracker WHERE mint_address = ${mint}
  `;
  if (tokenRows.length === 0) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }
  const tokenId = Number(tokenRows[0].id);

  const rows = await sql`
    SELECT id, holders, price_usd, volume_24h_usd, mcap_usd, snapshot_at
    FROM token_tracker_snapshots
    WHERE token_id = ${tokenId}
      AND snapshot_at > NOW() - INTERVAL '7 days'
    ORDER BY snapshot_at ASC
    LIMIT 500
  `;

  const snapshots = rows.map((row) => ({
    id: Number(row.id),
    holders: row.holders != null ? Number(row.holders) : null,
    priceUsd: row.price_usd != null ? Number(row.price_usd) : null,
    volume24hUsd:
      row.volume_24h_usd != null ? Number(row.volume_24h_usd) : null,
    mcapUsd: row.mcap_usd != null ? Number(row.mcap_usd) : null,
    snapshotAt: (row.snapshot_at as Date).toISOString(),
  }));

  return NextResponse.json(snapshots);
}
