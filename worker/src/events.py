"""In-memory asyncio pub/sub event bus for SSE broadcasting.

Simple fan-out to all subscribers per topic. No Redis needed — single
worker instance on Fly.io.
"""

import asyncio
import itertools
import logging

logger = logging.getLogger(__name__)


class EventBus:
    """Asyncio pub/sub with per-subscriber queues."""

    def __init__(self) -> None:
        self._subscribers: dict[str, dict[int, asyncio.Queue]] = {}
        self._id_counter = itertools.count()

    def subscribe(self, topic: str) -> tuple[int, asyncio.Queue]:
        """Subscribe to a topic. Returns (subscriber_id, queue)."""
        if topic not in self._subscribers:
            self._subscribers[topic] = {}

        sub_id = next(self._id_counter)
        queue: asyncio.Queue = asyncio.Queue(maxsize=10)
        self._subscribers[topic][sub_id] = queue
        logger.debug(f"SSE subscriber {sub_id} joined topic '{topic}'")
        return sub_id, queue

    def unsubscribe(self, topic: str, sub_id: int) -> None:
        """Remove a subscriber from a topic."""
        subs = self._subscribers.get(topic)
        if subs and sub_id in subs:
            del subs[sub_id]
            logger.debug(f"SSE subscriber {sub_id} left topic '{topic}'")

    async def publish(self, topic: str, data: dict) -> None:
        """Fan out data to all subscribers on a topic.

        Uses put_nowait with backpressure — slow clients drop events
        rather than blocking the publisher.
        """
        subs = self._subscribers.get(topic, {})
        if not subs:
            return

        dropped = 0
        for queue in subs.values():
            try:
                queue.put_nowait(data)
            except asyncio.QueueFull:
                dropped += 1

        if dropped:
            logger.warning(
                f"SSE topic '{topic}': dropped event for {dropped}/{len(subs)} slow subscribers"
            )


# Module-level singleton
event_bus = EventBus()
