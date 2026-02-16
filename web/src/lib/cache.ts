/**
 * Redis Caching Layer (Upstash)
 *
 * Fail-open: if Redis is unconfigured or down, queries run directly.
 */

import { Redis } from "@upstash/redis";

// Derive REST credentials from whichever env var is available:
// 1. Explicit REST vars (UPSTASH_REDIS_REST_* or KV_REST_API_*)
// 2. Fall back to parsing REDIS_URL (rediss://default:<token>@<host>:6379)
function getRedisCredentials(): { url: string; token: string } | null {
  const restUrl =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const restToken =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (restUrl && restToken) return { url: restUrl, token: restToken };

  // Parse REDIS_URL: rediss://default:<token>@<host>:6379
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      if (parsed.hostname.includes("upstash.io")) {
        return {
          url: `https://${parsed.hostname}`,
          token: decodeURIComponent(parsed.password),
        };
      }
    } catch {
      // Invalid URL — skip
    }
  }

  return null;
}

const creds = getRedisCredentials();
const redis = creds ? new Redis({ url: creds.url, token: creds.token }) : null;

/**
 * Cache-through wrapper. Returns cached value if available,
 * otherwise calls fn() and stores the result.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  if (!redis) return fn();

  try {
    const hit = await redis.get<T>(key);
    if (hit !== null && hit !== undefined) return hit;
  } catch {
    // Cache read failed — fall through to fn()
  }

  const result = await fn();

  try {
    await redis.setex(key, ttlSeconds, result);
  } catch {
    // Cache write failed — non-critical
  }

  return result;
}
