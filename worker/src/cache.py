"""Redis caching layer (Upstash).

All operations are fail-open: if Redis is down or unconfigured,
the system works exactly as before.
"""

import logging

from redis.asyncio import Redis

from src.config import settings

logger = logging.getLogger(__name__)
_redis: Redis | None = None


async def get_redis() -> Redis | None:
    """Get async Redis client. Returns None if redis_url not configured."""
    global _redis
    if not settings.redis_url:
        return None
    if _redis is None:
        _redis = Redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def cache_get(key: str) -> str | None:
    r = await get_redis()
    if not r:
        return None
    try:
        return await r.get(key)
    except Exception as e:
        logger.warning(f"Cache GET failed for {key}: {e}")
        return None


async def cache_set(key: str, value: str, ttl: int) -> None:
    r = await get_redis()
    if not r:
        return
    try:
        await r.setex(key, ttl, value)
    except Exception as e:
        logger.warning(f"Cache SET failed for {key}: {e}")


async def cache_delete(pattern: str) -> None:
    r = await get_redis()
    if not r:
        return
    try:
        keys = []
        async for key in r.scan_iter(match=pattern):
            keys.append(key)
        if keys:
            await r.delete(*keys)
    except Exception as e:
        logger.warning(f"Cache DELETE failed for {pattern}: {e}")
