"""Equity high/low and drawdown alert detection.

Compares current equity against tracked peak/trough values and returns
alert events when milestones are reached.
"""

from decimal import Decimal

from src.models.db import Agent, AgentPortfolio
from src.notifications.models import EquityAlertEvent


def check_equity_alerts(
    agent: Agent,
    portfolio: AgentPortfolio,
    threshold: Decimal,
) -> list[EquityAlertEvent]:
    """Check for equity milestones and drawdown alerts.

    Updates peak_equity and trough_equity on the portfolio in-place.

    Args:
        agent: The agent to check.
        portfolio: The agent's portfolio (will be mutated).
        threshold: Drawdown percentage threshold to trigger alert.

    Returns:
        List of equity alert events (may be empty).
    """
    alerts: list[EquityAlertEvent] = []
    equity = portfolio.total_equity
    initial = agent.initial_balance
    return_pct = float((equity - initial) / initial * 100) if initial else 0.0

    # New equity high
    if equity > portfolio.peak_equity:
        portfolio.peak_equity = equity
        alerts.append(
            EquityAlertEvent(
                alert_type="high",
                agent_name=agent.name,
                engine=agent.engine,
                agent_id=agent.id,
                equity=equity,
                return_pct=return_pct,
            )
        )

    # New equity low
    if equity < portfolio.trough_equity:
        portfolio.trough_equity = equity
        alerts.append(
            EquityAlertEvent(
                alert_type="low",
                agent_name=agent.name,
                engine=agent.engine,
                agent_id=agent.id,
                equity=equity,
                return_pct=return_pct,
            )
        )

    # Drawdown from peak
    if portfolio.peak_equity > 0:
        drawdown_pct = float(
            (portfolio.peak_equity - equity) / portfolio.peak_equity * 100
        )
        if drawdown_pct >= float(threshold):
            alerts.append(
                EquityAlertEvent(
                    alert_type="drawdown",
                    agent_name=agent.name,
                    engine=agent.engine,
                    agent_id=agent.id,
                    equity=equity,
                    return_pct=return_pct,
                    drawdown_pct=drawdown_pct,
                    peak_equity=portfolio.peak_equity,
                )
            )

    return alerts
