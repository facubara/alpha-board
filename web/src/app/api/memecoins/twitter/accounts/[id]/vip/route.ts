import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

/**
 * PATCH /api/memecoins/twitter/accounts/[id]/vip — Toggle VIP status
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = Number(idStr);

  if (!id || isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const rows = await sql`
    UPDATE memecoin_twitter_accounts
    SET is_vip = NOT is_vip
    WHERE id = ${id}
    RETURNING id, handle, is_vip
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const row = rows[0];
  return NextResponse.json({
    id: Number(row.id),
    handle: row.handle,
    isVip: row.is_vip,
  });
}
