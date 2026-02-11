"""HTML message templates for Telegram notifications.

HTML parse mode is used instead of MarkdownV2 because financial data
contains too many special characters (., -, %, $) that would need escaping.
"""

from src.notifications.models import (
    DailyDigestData,
    EquityAlertEvent,
    EvolutionEvent,
    TradeClosedEvent,
    TradeOpenedEvent,
)


def _engine_tag(engine: str) -> str:
    return f"[{engine.upper()}]"


def _format_price(price) -> str:
    """Format price, dropping trailing zeros."""
    p = float(price)
    if p >= 1:
        return f"{p:,.2f}"
    return f"{p:.6g}"


def _format_pnl(pnl) -> str:
    p = float(pnl)
    sign = "+" if p >= 0 else ""
    return f"{sign}{p:,.2f}"


def _format_duration(minutes: int) -> str:
    if minutes < 60:
        return f"{minutes}m"
    hours = minutes // 60
    mins = minutes % 60
    if hours < 24:
        return f"{hours}h {mins}m" if mins else f"{hours}h"
    days = hours // 24
    remaining_hours = hours % 24
    return f"{days}d {remaining_hours}h" if remaining_hours else f"{days}d"


def trade_opened_message(event: TradeOpenedEvent) -> str:
    direction_emoji = "\U0001f4c8" if event.direction == "long" else "\U0001f4c9"
    lines = [
        f"{direction_emoji} <b>Trade Opened</b> {_engine_tag(event.engine)}",
        f"Agent: <b>{event.agent_name}</b>",
        f"Symbol: <b>{event.symbol}</b> ({event.direction.upper()})",
        f"Entry: {_format_price(event.entry_price)}",
        f"Size: ${float(event.position_size):,.2f}",
    ]
    if event.stop_loss:
        lines.append(f"SL: {_format_price(event.stop_loss)}")
    if event.take_profit:
        lines.append(f"TP: {_format_price(event.take_profit)}")
    if event.confidence is not None:
        lines.append(f"Confidence: {event.confidence:.0%}")
    return "\n".join(lines)


def trade_closed_message(event: TradeClosedEvent) -> str:
    pnl_float = float(event.pnl)
    emoji = "\U0001f7e2" if pnl_float >= 0 else "\U0001f534"
    lines = [
        f"{emoji} <b>Trade Closed</b> {_engine_tag(event.engine)}",
        f"Agent: <b>{event.agent_name}</b>",
        f"Symbol: <b>{event.symbol}</b> ({event.direction.upper()})",
        f"Entry: {_format_price(event.entry_price)} \u2192 Exit: {_format_price(event.exit_price)}",
        f"PnL: <b>${_format_pnl(event.pnl)}</b> ({_format_pnl(event.pnl_pct)}%)",
        f"Duration: {_format_duration(event.duration_minutes)}",
        f"Reason: {event.exit_reason.replace('_', ' ').title()}",
    ]
    return "\n".join(lines)


def equity_alert_message(event: EquityAlertEvent) -> str:
    if event.alert_type == "high":
        emoji = "\U0001f3c6"
        title = "New Equity High"
    elif event.alert_type == "low":
        emoji = "\U0001f4c9"
        title = "New Equity Low"
    else:
        emoji = "\U0001f6a8"
        title = f"Drawdown Alert ({event.drawdown_pct:.1f}%)" if event.drawdown_pct else "Drawdown Alert"

    lines = [
        f"{emoji} <b>{title}</b>",
        f"Agent: <b>{event.agent_name}</b> {_engine_tag(event.engine)}",
        f"Equity: <b>${float(event.equity):,.2f}</b>",
        f"Return: {_format_pnl(event.return_pct)}%",
    ]
    if event.peak_equity and event.alert_type == "drawdown":
        lines.append(f"Peak: ${float(event.peak_equity):,.2f}")
    return "\n".join(lines)


def evolution_message(event: EvolutionEvent) -> str:
    if event.event_type == "evolved":
        emoji = "\U0001f9ec"
        title = "Prompt Evolved"
        version_text = f"v{event.old_version} \u2192 v{event.new_version}"
    else:
        emoji = "\u23ea"
        title = "Prompt Reverted"
        version_text = f"v{event.old_version} \u2192 v{event.new_version}"

    lines = [
        f"{emoji} <b>{title}</b>",
        f"Agent: <b>{event.agent_name}</b> {_engine_tag(event.engine)}",
        f"Version: {version_text}",
    ]
    return "\n".join(lines)


def daily_digest_message(data: DailyDigestData) -> str:
    win_rate = (
        f"{data.winning_trades / data.total_trades_today * 100:.0f}%"
        if data.total_trades_today > 0
        else "N/A"
    )
    pnl_emoji = "\U0001f7e2" if float(data.total_pnl) >= 0 else "\U0001f534"

    lines = [
        f"\U0001f4ca <b>Daily Digest</b> \u2014 {data.date}",
        "",
        f"Agents: {data.active_agents}/{data.total_agents} active",
        f"Open Positions: {data.open_positions}",
        "",
        f"<b>Trades Today:</b> {data.total_trades_today}",
        f"W/L: {data.winning_trades}/{data.losing_trades} ({win_rate})",
        f"PnL: {pnl_emoji} <b>${_format_pnl(data.total_pnl)}</b>",
    ]

    if data.best_agent_name:
        lines.append(
            f"\U0001f947 Best: {data.best_agent_name} (${_format_pnl(data.best_agent_pnl)})"
        )
    if data.worst_agent_name:
        lines.append(
            f"\U0001f614 Worst: {data.worst_agent_name} (${_format_pnl(data.worst_agent_pnl)})"
        )

    lines.append(f"\nTotal Equity: <b>${float(data.total_equity):,.2f}</b>")

    if data.evolutions_today > 0:
        lines.append(f"\U0001f9ec Evolutions: {data.evolutions_today}")

    return "\n".join(lines)
