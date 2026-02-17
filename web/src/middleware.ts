import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

export const config = {
  matcher: ["/api/agents/:path*", "/api/twitter/:path*", "/api/backtest/:path*"],
};

export async function middleware(request: NextRequest) {
  if (request.method !== "POST" && request.method !== "DELETE") {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!password || !secret) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(password)
  );
  const expectedToken = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}
