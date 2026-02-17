import { NextRequest, NextResponse } from "next/server";
import { deleteAgent } from "@/lib/queries/agents";

/**
 * DELETE /api/agents/[agentId]/delete
 *
 * Permanently delete an agent and all associated data.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const id = Number(agentId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid agent ID" }, { status: 400 });
  }

  try {
    await deleteAgent(id);
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
