import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import type { MemecoinCategory } from "@/lib/types";

const VALID_CATEGORIES: MemecoinCategory[] = [
  "caller",
  "influencer",
  "degen",
  "news",
];

/**
 * GET /api/memecoins/twitter/accounts — List memecoin Twitter accounts
 */
export async function GET() {
  const rows = await sql`
    SELECT
      mta.id,
      mta.handle,
      mta.display_name,
      mta.category,
      mta.is_vip,
      mta.is_active,
      mta.added_at,
      COUNT(mt.id) AS tweet_count
    FROM memecoin_twitter_accounts mta
    LEFT JOIN memecoin_tweets mt ON mt.account_id = mta.id
    GROUP BY mta.id
    ORDER BY mta.added_at DESC
  `;

  const accounts = rows.map((row) => ({
    id: Number(row.id),
    handle: row.handle,
    displayName: row.display_name,
    category: row.category,
    isVip: row.is_vip,
    isActive: row.is_active,
    addedAt: (row.added_at as Date).toISOString(),
    tweetCount: Number(row.tweet_count),
  }));

  return NextResponse.json(accounts);
}

/**
 * POST /api/memecoins/twitter/accounts — Add a memecoin Twitter account
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { handle, displayName, category, isVip } = body as {
    handle?: string;
    displayName?: string;
    category?: string;
    isVip?: boolean;
  };

  if (!handle || !displayName || !category) {
    return NextResponse.json(
      { error: "handle, displayName, and category are required" },
      { status: 400 }
    );
  }

  const cleanHandle = handle.replace(/^@/, "").toLowerCase();
  if (!cleanHandle || cleanHandle.length > 30) {
    return NextResponse.json({ error: "Invalid handle" }, { status: 400 });
  }

  if (!VALID_CATEGORIES.includes(category as MemecoinCategory)) {
    return NextResponse.json(
      { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  // Check duplicate
  const existing = await sql`
    SELECT id FROM memecoin_twitter_accounts WHERE handle = ${cleanHandle}
  `;
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "Account already tracked" },
      { status: 409 }
    );
  }

  const rows = await sql`
    INSERT INTO memecoin_twitter_accounts (handle, display_name, category, is_vip)
    VALUES (${cleanHandle}, ${displayName}, ${category}, ${isVip || false})
    RETURNING id, handle, display_name, category, is_vip, is_active, added_at
  `;

  const row = rows[0];
  return NextResponse.json({
    id: Number(row.id),
    handle: row.handle,
    displayName: row.display_name,
    category: row.category,
    isVip: row.is_vip,
    isActive: row.is_active,
    addedAt: (row.added_at as Date).toISOString(),
  });
}

/**
 * DELETE /api/memecoins/twitter/accounts — Remove an account (pass id in body)
 */
export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { id } = body as { id?: number };

  if (!id || !Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid account ID" }, { status: 400 });
  }

  // Delete tweets first (FK constraint), then signals and token matches
  const tweetIds = await sql`
    SELECT id FROM memecoin_tweets WHERE account_id = ${id}
  `;
  const ids = tweetIds.map((r) => Number(r.id));

  if (ids.length > 0) {
    await sql`DELETE FROM memecoin_tweet_signals WHERE tweet_id = ANY(${ids})`;
    await sql`DELETE FROM memecoin_tweet_tokens WHERE tweet_id = ANY(${ids})`;
    await sql`DELETE FROM memecoin_tweets WHERE account_id = ${id}`;
  }

  const result = await sql`
    DELETE FROM memecoin_twitter_accounts WHERE id = ${id} RETURNING id
  `;

  if (result.length === 0) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({ status: "deleted", id });
}
