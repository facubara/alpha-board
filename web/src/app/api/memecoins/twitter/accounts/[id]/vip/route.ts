import { NextRequest, NextResponse } from "next/server";
import { workerPatch } from "@/lib/worker-client";

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

  const result = await workerPatch(`/memecoins/twitter/accounts/${id}`);
  return NextResponse.json(result);
}
