/**
 * Redis Caching Layer (Upstash)
 *
 * Fail-open: if Redis is unconfigured or down, queries run directly.
 */

import { Redis } from "@upstash/redis";

// Support both Upstash and Vercel KV env var naming conventions
const restUrl =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const restToken =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const redis =
  restUrl && restToken
    ? new Redis({ url: restUrl, token: restToken })
    : null;

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
