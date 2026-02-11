export const AUTH_COOKIE_NAME = "auth_token";
export const AUTH_STATUS_COOKIE = "auth_status";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function computeAuthToken(password: string): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET not configured");

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
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
