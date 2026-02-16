import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import type { TwitterAccountCategory } from "@/lib/types";

const VALID_CATEGORIES: TwitterAccountCategory[] = [
  "analyst",
  "founder",
  "news",
  "degen",
  "insider",
  "protocol",
];

/**
 * GET /api/twitter/accounts — List all tracked accounts
 */
export async function GET() {
  const rows = await sql`
    SELECT
      ta.id,
      ta.handle,
      ta.display_name,
      ta.category,
      ta.is_active,
      ta.added_at,
      COUNT(t.id) AS tweet_count
    FROM twitter_accounts ta
    LEFT JOIN tweets t ON t.twitter_account_id = ta.id
    GROUP BY ta.id
    ORDER BY ta.added_at DESC
  `;

  const accounts = rows.map((row) => ({
    id: Number(row.id),
    handle: row.handle,
    displayName: row.display_name,
    category: row.category,
    isActive: row.is_active,
    addedAt: (row.added_at as Date).toISOString(),
    tweetCount: Number(row.tweet_count),
  }));

  return NextResponse.json(accounts);
}

/**
 * POST /api/twitter/accounts — Add a new account to track
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { handle, displayName, category } = body as {
    handle?: string;
    displayName?: string;
    category?: string;
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

  if (!VALID_CATEGORIES.includes(category as TwitterAccountCategory)) {
    return NextResponse.json(
      { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  // Check for duplicate
  const existing = await sql`
    SELECT id FROM twitter_accounts WHERE handle = ${cleanHandle}
  `;
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "Account already tracked" },
      { status: 409 }
    );
  }

  const rows = await sql`
    INSERT INTO twitter_accounts (handle, display_name, category)
    VALUES (${cleanHandle}, ${displayName}, ${category})
    RETURNING id, handle, display_name, category, is_active, added_at
  `;

  const row = rows[0];
  return NextResponse.json({
    id: Number(row.id),
    handle: row.handle,
    displayName: row.display_name,
    category: row.category,
    isActive: row.is_active,
    addedAt: (row.added_at as Date).toISOString(),
  });
}

/**
 * DELETE /api/twitter/accounts — Remove an account (pass id in body)
 */
export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { id } = body as { id?: number };

  if (!id || !Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid account ID" }, { status: 400 });
  }

  const result = await sql`
    DELETE FROM twitter_accounts WHERE id = ${id} RETURNING id
  `;

  if (result.length === 0) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({ status: "deleted", id });
}
