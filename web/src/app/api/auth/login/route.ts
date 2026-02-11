import { NextRequest, NextResponse } from "next/server";
import {
  computeAuthToken,
  AUTH_COOKIE_NAME,
  AUTH_STATUS_COOKIE,
  AUTH_MAX_AGE,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { password } = body;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await computeAuthToken(password);

  const response = NextResponse.json({ ok: true });

  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: AUTH_MAX_AGE,
    path: "/",
  });

  response.cookies.set(AUTH_STATUS_COOKIE, "1", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: AUTH_MAX_AGE,
    path: "/",
  });

  return response;
}
