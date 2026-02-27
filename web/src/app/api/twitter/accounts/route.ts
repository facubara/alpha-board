import { NextRequest, NextResponse } from "next/server";
import { workerGet, workerPost, workerDelete } from "@/lib/worker-client";

/**
 * GET /api/twitter/accounts — List all tracked accounts
 */
export async function GET() {
  const accounts = await workerGet("/twitter/accounts");
  return NextResponse.json(accounts);
}

/**
 * POST /api/twitter/accounts — Add a new account to track
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await workerPost("/twitter/accounts", body);
  return NextResponse.json(result);
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

  const result = await workerDelete(`/twitter/accounts/${id}`);
  return NextResponse.json(result);
}
