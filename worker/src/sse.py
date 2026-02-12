"""Server-Sent Events endpoints for real-time dashboard updates.

Streams ranking and agent leaderboard updates to connected browsers.
Uses the in-memory EventBus — no external dependencies.
"""

import asyncio
import json
import logging
from collections.abc import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from src.events import event_bus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sse", tags=["sse"])

KEEPALIVE_SECONDS = 15


async def _event_stream(topic: str) -> AsyncGenerator[str, None]:
    """Async generator that yields SSE-formatted events from the event bus."""
    sub_id, queue = event_bus.subscribe(topic)

    try:
        # Initial connected event
        yield f"data: {json.dumps({'type': 'connected', 'topic': topic})}\n\n"

        while True:
            try:
                data = await asyncio.wait_for(queue.get(), timeout=KEEPALIVE_SECONDS)
                yield f"data: {json.dumps(data)}\n\n"
            except asyncio.TimeoutError:
                # Send keepalive comment to prevent proxy/browser timeout
                yield ": keepalive\n\n"

    except asyncio.CancelledError:
        logger.debug(f"SSE stream cancelled for topic '{topic}', subscriber {sub_id}")
    finally:
        event_bus.unsubscribe(topic, sub_id)


@router.get("/rankings")
async def sse_rankings() -> StreamingResponse:
    """Stream ranking updates for all timeframes."""
    return StreamingResponse(
        _event_stream("rankings"),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/agents")
async def sse_agents() -> StreamingResponse:
    """Stream agent leaderboard updates."""
    return StreamingResponse(
        _event_stream("agents"),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
