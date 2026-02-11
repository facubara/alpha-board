"""FastAPI endpoints for notification preferences, webhook, and testing."""

import logging
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.db import async_session, get_session
from src.models.db import Agent, AgentPortfolio, AgentPosition, AgentTrade, NotificationPreference
from src.notifications.client import TelegramClient
from src.notifications.digest import compute_daily_digest
from src.notifications.service import NotificationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["notifications"])


class PreferencesResponse(BaseModel):
    enabled: bool
    engine_filter: str
    notify_trade_opened: bool
    notify_trade_closed: bool
    notify_sl_tp: bool
    notify_daily_digest: bool
    notify_equity_alerts: bool
    notify_evolution: bool
    drawdown_alert_threshold: float
    muted_agent_ids: list[int]
    quiet_hours_start: int | None
    quiet_hours_end: int | None


class PreferencesUpdate(BaseModel):
    enabled: bool | None = None
    engine_filter: str | None = Field(default=None, pattern="^(all|llm|rule)$")
    notify_trade_opened: bool | None = None
    notify_trade_closed: bool | None = None
    notify_sl_tp: bool | None = None
    notify_daily_digest: bool | None = None
    notify_equity_alerts: bool | None = None
    notify_evolution: bool | None = None
    drawdown_alert_threshold: float | None = Field(default=None, ge=1.0, le=50.0)
    muted_agent_ids: list[int] | None = None
    quiet_hours_start: int | None = Field(default=None, ge=0, le=23)
    quiet_hours_end: int | None = Field(default=None, ge=0, le=23)


async def _get_prefs(session: AsyncSession) -> NotificationPreference:
    result = await session.execute(
        select(NotificationPreference).where(NotificationPreference.id == 1)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        # Create default row if missing
        prefs = NotificationPreference(id=1)
        session.add(prefs)
        await session.flush()
    return prefs


@router.get("/preferences", response_model=PreferencesResponse)
async def get_preferences(session: AsyncSession = Depends(get_session)):
    """Get current notification preferences."""
    prefs = await _get_prefs(session)
    return PreferencesResponse(
        enabled=prefs.enabled,
        engine_filter=prefs.engine_filter,
        notify_trade_opened=prefs.notify_trade_opened,
        notify_trade_closed=prefs.notify_trade_closed,
        notify_sl_tp=prefs.notify_sl_tp,
        notify_daily_digest=prefs.notify_daily_digest,
        notify_equity_alerts=prefs.notify_equity_alerts,
        notify_evolution=prefs.notify_evolution,
        drawdown_alert_threshold=float(prefs.drawdown_alert_threshold),
        muted_agent_ids=prefs.muted_agent_ids or [],
        quiet_hours_start=prefs.quiet_hours_start,
        quiet_hours_end=prefs.quiet_hours_end,
    )


@router.put("/preferences", response_model=PreferencesResponse)
async def update_preferences(
    body: PreferencesUpdate,
    session: AsyncSession = Depends(get_session),
):
    """Update notification preferences (partial update)."""
    prefs = await _get_prefs(session)

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "drawdown_alert_threshold" and value is not None:
            value = Decimal(str(value))
        setattr(prefs, field, value)

    await session.commit()
    await session.refresh(prefs)

    return PreferencesResponse(
        enabled=prefs.enabled,
        engine_filter=prefs.engine_filter,
        notify_trade_opened=prefs.notify_trade_opened,
        notify_trade_closed=prefs.notify_trade_closed,
        notify_sl_tp=prefs.notify_sl_tp,
        notify_daily_digest=prefs.notify_daily_digest,
        notify_equity_alerts=prefs.notify_equity_alerts,
        notify_evolution=prefs.notify_evolution,
        drawdown_alert_threshold=float(prefs.drawdown_alert_threshold),
        muted_agent_ids=prefs.muted_agent_ids or [],
        quiet_hours_start=prefs.quiet_hours_start,
        quiet_hours_end=prefs.quiet_hours_end,
    )


@router.post("/test")
async def send_test_message(session: AsyncSession = Depends(get_session)):
    """Send a test message to verify Telegram configuration."""
    client = TelegramClient()
    if not client.is_configured:
        return {
            "success": False,
            "error": "Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.",
        }

    text = (
        "\u2705 <b>Alpha Board — Test Notification</b>\n\n"
        "Telegram notifications are working correctly!"
    )
    success = await client.send_message(text)
    return {"success": success}


@router.post("/digest/trigger")
async def trigger_digest(session: AsyncSession = Depends(get_session)):
    """Manually trigger the daily digest."""
    data = await compute_daily_digest(session)
    service = NotificationService(session)
    await service.send_daily_digest(data)
    return {"success": True, "data": data.model_dump()}


# =========================================================================
# Telegram Webhook & Bot Commands
# =========================================================================

HELP_TEXT = """\
\U0001f916 <b>Alpha Board Bot</b>

I send real-time notifications for your 56 trading agents.

<b>Commands:</b>
/help — Show this message
/status — Active agents, open positions, today's trades
/digest — Trigger daily PnL digest now
/settings — Show current notification preferences

<b>Notifications I send:</b>
\U0001f4c8 Trade opened (with entry, size, SL/TP)
\U0001f7e2\U0001f534 Trade closed (with PnL, duration, reason)
\U0001f3c6 New equity highs
\U0001f6a8 Drawdown alerts
\U0001f9ec Prompt evolutions & reverts
\U0001f4ca Daily digest at 00:00 UTC

<b>Configure via API:</b>
GET/PUT /notifications/preferences
Filter by engine (LLM/Rule), mute agents, set quiet hours.\
"""


async def _handle_command(command: str, chat_id: str, client: TelegramClient) -> None:
    """Process a bot command and send a reply."""
    cmd = command.split("@")[0].strip().lower()  # strip @botname suffix

    if cmd == "/help" or cmd == "/start":
        await client.send_message_to(chat_id, HELP_TEXT)

    elif cmd == "/status":
        try:
            async with async_session() as session:
                active_result = await session.execute(
                    select(func.count(Agent.id)).where(Agent.status == "active")
                )
                active = active_result.scalar() or 0

                total_result = await session.execute(select(func.count(Agent.id)))
                total = total_result.scalar() or 0

                pos_result = await session.execute(select(func.count(AgentPosition.id)))
                positions = pos_result.scalar() or 0

                equity_result = await session.execute(
                    select(func.sum(AgentPortfolio.total_equity))
                )
                equity = equity_result.scalar() or 0

                from datetime import date, datetime, timezone
                today_start = datetime(
                    date.today().year, date.today().month, date.today().day,
                    tzinfo=timezone.utc,
                )
                trades_result = await session.execute(
                    select(func.count(AgentTrade.id)).where(
                        AgentTrade.closed_at >= today_start
                    )
                )
                trades_today = trades_result.scalar() or 0

            text = (
                f"\U0001f4ca <b>Status</b>\n\n"
                f"Agents: {active}/{total} active\n"
                f"Open Positions: {positions}\n"
                f"Trades Today: {trades_today}\n"
                f"Total Equity: <b>${float(equity):,.2f}</b>"
            )
            await client.send_message_to(chat_id, text)
        except Exception:
            logger.exception("Error handling /status command")
            await client.send_message_to(chat_id, "\u274c Error fetching status.")

    elif cmd == "/digest":
        try:
            async with async_session() as session:
                data = await compute_daily_digest(session)
                service = NotificationService(session)
                await service.send_daily_digest(data)
        except Exception:
            logger.exception("Error handling /digest command")
            await client.send_message_to(chat_id, "\u274c Error generating digest.")

    elif cmd == "/settings":
        try:
            async with async_session() as session:
                prefs = await _get_prefs(session)
                muted = prefs.muted_agent_ids or []
                quiet = "Off"
                if prefs.quiet_hours_start is not None and prefs.quiet_hours_end is not None:
                    quiet = f"{prefs.quiet_hours_start:02d}:00 - {prefs.quiet_hours_end:02d}:00 UTC"

                text = (
                    f"\u2699\ufe0f <b>Notification Settings</b>\n\n"
                    f"Enabled: {'Yes' if prefs.enabled else 'No'}\n"
                    f"Engine Filter: {prefs.engine_filter}\n"
                    f"Trade Opened: {'On' if prefs.notify_trade_opened else 'Off'}\n"
                    f"Trade Closed: {'On' if prefs.notify_trade_closed else 'Off'}\n"
                    f"SL/TP: {'On' if prefs.notify_sl_tp else 'Off'}\n"
                    f"Equity Alerts: {'On' if prefs.notify_equity_alerts else 'Off'}\n"
                    f"Evolution: {'On' if prefs.notify_evolution else 'Off'}\n"
                    f"Daily Digest: {'On' if prefs.notify_daily_digest else 'Off'}\n"
                    f"Drawdown Threshold: {prefs.drawdown_alert_threshold}%\n"
                    f"Muted Agents: {len(muted)} agent(s)\n"
                    f"Quiet Hours: {quiet}"
                )
                await client.send_message_to(chat_id, text)
        except Exception:
            logger.exception("Error handling /settings command")
            await client.send_message_to(chat_id, "\u274c Error fetching settings.")


@router.post("/webhook")
async def telegram_webhook(request: Request):
    """Receive Telegram updates (bot commands)."""
    try:
        body = await request.json()
        message = body.get("message", {})
        text = message.get("text", "")
        chat_id = str(message.get("chat", {}).get("id", ""))

        if text.startswith("/") and chat_id:
            client = TelegramClient()
            await _handle_command(text, chat_id, client)
    except Exception:
        logger.exception("Error processing Telegram webhook")

    # Always return 200 so Telegram doesn't retry
    return {"ok": True}


@router.post("/webhook/register")
async def register_webhook():
    """Register the Telegram webhook URL."""
    client = TelegramClient()
    if not client.is_configured:
        return {
            "success": False,
            "error": "Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.",
        }

    # Build webhook URL from the app's public domain
    webhook_url = f"https://alpha-worker.fly.dev/notifications/webhook"
    success = await client.set_webhook(webhook_url)
    return {"success": success, "webhook_url": webhook_url}
