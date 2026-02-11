"""Notification service — filters by preferences and routes to Telegram.

All public methods are fire-and-forget: they catch all exceptions and
log errors instead of propagating them to the caller.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.db import NotificationPreference
from src.notifications.client import TelegramClient
from src.notifications.models import (
    DailyDigestData,
    EquityAlertEvent,
    EvolutionEvent,
    TradeClosedEvent,
    TradeOpenedEvent,
)
from src.notifications import templates

logger = logging.getLogger(__name__)


class NotificationService:
    """Routes notification events through preferences filter to Telegram."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.client = TelegramClient()

    async def _get_preferences(self) -> NotificationPreference | None:
        result = await self.session.execute(
            select(NotificationPreference).where(NotificationPreference.id == 1)
        )
        return result.scalar_one_or_none()

    def _should_notify(
        self,
        prefs: NotificationPreference,
        event_type: str,
        engine: str,
        agent_id: int,
    ) -> bool:
        """Check if a notification should be sent based on preferences."""
        if not prefs.enabled:
            return False

        # Engine filter
        if prefs.engine_filter != "all" and prefs.engine_filter != engine:
            return False

        # Muted agents
        if agent_id in (prefs.muted_agent_ids or []):
            return False

        # Event type toggles
        toggle_map = {
            "trade_opened": prefs.notify_trade_opened,
            "trade_closed": prefs.notify_trade_closed,
            "sl_tp": prefs.notify_sl_tp,
            "equity_alert": prefs.notify_equity_alerts,
            "evolution": prefs.notify_evolution,
            "daily_digest": prefs.notify_daily_digest,
        }
        if not toggle_map.get(event_type, True):
            return False

        # Quiet hours
        if prefs.quiet_hours_start is not None and prefs.quiet_hours_end is not None:
            current_hour = datetime.now(timezone.utc).hour
            start = prefs.quiet_hours_start
            end = prefs.quiet_hours_end
            if start <= end:
                if start <= current_hour < end:
                    return False
            else:  # Wraps midnight (e.g., 22-06)
                if current_hour >= start or current_hour < end:
                    return False

        return True

    async def notify_trade_opened(self, event: TradeOpenedEvent) -> None:
        try:
            if not self.client.is_configured:
                return
            prefs = await self._get_preferences()
            if not prefs or not self._should_notify(prefs, "trade_opened", event.engine, event.agent_id):
                return
            text = templates.trade_opened_message(event)
            await self.client.send_message(text)
        except Exception:
            logger.exception("Error sending trade opened notification")

    async def notify_trade_closed(self, event: TradeClosedEvent) -> None:
        try:
            if not self.client.is_configured:
                return
            prefs = await self._get_preferences()
            if not prefs:
                return
            event_type = "sl_tp" if event.exit_reason in ("stop_loss", "take_profit") else "trade_closed"
            if not self._should_notify(prefs, event_type, event.engine, event.agent_id):
                return
            text = templates.trade_closed_message(event)
            await self.client.send_message(text)
        except Exception:
            logger.exception("Error sending trade closed notification")

    async def notify_equity_alert(self, event: EquityAlertEvent) -> None:
        try:
            if not self.client.is_configured:
                return
            prefs = await self._get_preferences()
            if not prefs or not self._should_notify(prefs, "equity_alert", event.engine, event.agent_id):
                return
            text = templates.equity_alert_message(event)
            await self.client.send_message(text)
        except Exception:
            logger.exception("Error sending equity alert notification")

    async def notify_evolution(self, event: EvolutionEvent) -> None:
        try:
            if not self.client.is_configured:
                return
            prefs = await self._get_preferences()
            if not prefs or not self._should_notify(prefs, "evolution", event.engine, event.agent_id):
                return
            text = templates.evolution_message(event)
            await self.client.send_message(text)
        except Exception:
            logger.exception("Error sending evolution notification")

    async def send_daily_digest(self, data: DailyDigestData) -> None:
        try:
            if not self.client.is_configured:
                return
            prefs = await self._get_preferences()
            if not prefs or not prefs.enabled or not prefs.notify_daily_digest:
                return
            text = templates.daily_digest_message(data)
            await self.client.send_message(text)
        except Exception:
            logger.exception("Error sending daily digest notification")
