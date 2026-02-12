"""In-memory portfolio manager for backtesting.

Mirrors PortfolioManager logic from worker/src/agents/portfolio.py
without any DB writes.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal


TRADING_FEE_PCT = 0.001  # 0.1% per trade (same as live)
MAX_POSITION_SIZE_PCT = 0.25
MAX_CONCURRENT = 5


@dataclass
class SimPosition:
    """An open position in the simulated portfolio."""

    symbol: str
    direction: str  # "long" or "short"
    entry_price: float
    position_size: float  # USD notional
    stop_loss: float | None
    take_profit: float | None
    opened_at: datetime


@dataclass
class SimTrade:
    """A completed trade record."""

    symbol: str
    direction: str
    entry_price: float
    exit_price: float
    position_size: float
    pnl: float
    fees: float
    exit_reason: str
    entry_at: datetime
    exit_at: datetime
    duration_minutes: int


@dataclass
class PortfolioSnapshot:
    """A snapshot of portfolio equity at a point in time."""

    timestamp: str  # ISO format
    equity: float


class SimPortfolio:
    """In-memory portfolio for backtesting. No DB writes."""

    def __init__(self, initial_balance: float = 10000.0):
        self.cash: float = initial_balance
        self.initial_balance: float = initial_balance
        self.positions: dict[str, SimPosition] = {}
        self.trades: list[SimTrade] = []
        self.equity_curve: list[PortfolioSnapshot] = []
        self.peak_equity: float = initial_balance

    @property
    def position_count(self) -> int:
        return len(self.positions)

    def _calc_equity(self, prices: dict[str, float]) -> float:
        """Calculate total equity given current prices."""
        equity = self.cash
        for symbol, pos in self.positions.items():
            price = prices.get(symbol, pos.entry_price)
            if pos.direction == "long":
                unrealized = (price - pos.entry_price) / pos.entry_price * pos.position_size
            else:
                unrealized = (pos.entry_price - price) / pos.entry_price * pos.position_size
            equity += pos.position_size + unrealized
        return equity

    def available_for_new_position(self, prices: dict[str, float]) -> float:
        """Cash available for a new position, respecting constraints."""
        if self.position_count >= MAX_CONCURRENT:
            return 0.0
        equity = self._calc_equity(prices)
        max_size = equity * MAX_POSITION_SIZE_PCT
        return min(self.cash, max_size)

    def open_position(
        self,
        symbol: str,
        direction: str,
        price: float,
        size_pct: float,
        sl_pct: float | None,
        tp_pct: float | None,
        timestamp: datetime,
        prices: dict[str, float],
    ) -> bool:
        """Open a new position. Returns True if successful."""
        if symbol in self.positions:
            return False
        if self.position_count >= MAX_CONCURRENT:
            return False

        equity = self._calc_equity(prices)
        position_size = equity * min(size_pct, MAX_POSITION_SIZE_PCT)
        entry_fee = position_size * TRADING_FEE_PCT

        if self.cash < position_size + entry_fee:
            return False

        # Calculate SL/TP prices
        stop_loss = None
        take_profit = None
        if sl_pct:
            if direction == "long":
                stop_loss = price * (1 - sl_pct)
            else:
                stop_loss = price * (1 + sl_pct)
        if tp_pct:
            if direction == "long":
                take_profit = price * (1 + tp_pct)
            else:
                take_profit = price * (1 - tp_pct)

        self.positions[symbol] = SimPosition(
            symbol=symbol,
            direction=direction,
            entry_price=price,
            position_size=position_size,
            stop_loss=stop_loss,
            take_profit=take_profit,
            opened_at=timestamp,
        )
        self.cash -= position_size + entry_fee
        return True

    def close_position(
        self,
        symbol: str,
        price: float,
        reason: str,
        timestamp: datetime,
    ) -> SimTrade | None:
        """Close a position and record the trade. Returns SimTrade or None."""
        pos = self.positions.pop(symbol, None)
        if not pos:
            return None

        # PnL calculation (same as live PortfolioManager)
        if pos.direction == "long":
            pnl = (price - pos.entry_price) / pos.entry_price * pos.position_size
        else:
            pnl = (pos.entry_price - price) / pos.entry_price * pos.position_size

        exit_fee = pos.position_size * TRADING_FEE_PCT
        net_pnl = pnl - exit_fee

        duration = int((timestamp - pos.opened_at).total_seconds() / 60)

        trade = SimTrade(
            symbol=pos.symbol,
            direction=pos.direction,
            entry_price=pos.entry_price,
            exit_price=price,
            position_size=pos.position_size,
            pnl=net_pnl,
            fees=exit_fee,
            exit_reason=reason,
            entry_at=pos.opened_at,
            exit_at=timestamp,
            duration_minutes=max(duration, 1),
        )
        self.trades.append(trade)
        self.cash += pos.position_size + net_pnl
        return trade

    def check_sl_tp(
        self,
        candle_data: dict[str, dict[str, float]],
        timestamp: datetime,
    ) -> list[SimTrade]:
        """Check stop-loss and take-profit against candle high/low."""
        closed: list[SimTrade] = []
        symbols_to_check = list(self.positions.keys())

        for symbol in symbols_to_check:
            pos = self.positions.get(symbol)
            if not pos:
                continue

            candle = candle_data.get(symbol)
            if not candle:
                continue

            high = candle.get("high", 0)
            low = candle.get("low", 0)

            # Check stop loss
            if pos.stop_loss:
                if pos.direction == "long" and low <= pos.stop_loss:
                    trade = self.close_position(symbol, pos.stop_loss, "stop_loss", timestamp)
                    if trade:
                        closed.append(trade)
                    continue
                elif pos.direction == "short" and high >= pos.stop_loss:
                    trade = self.close_position(symbol, pos.stop_loss, "stop_loss", timestamp)
                    if trade:
                        closed.append(trade)
                    continue

            # Check take profit
            if pos.take_profit:
                if pos.direction == "long" and high >= pos.take_profit:
                    trade = self.close_position(symbol, pos.take_profit, "take_profit", timestamp)
                    if trade:
                        closed.append(trade)
                    continue
                elif pos.direction == "short" and low <= pos.take_profit:
                    trade = self.close_position(symbol, pos.take_profit, "take_profit", timestamp)
                    if trade:
                        closed.append(trade)
                    continue

        return closed

    def update_equity(self, prices: dict[str, float], timestamp: datetime) -> None:
        """Snapshot the equity curve."""
        equity = self._calc_equity(prices)
        self.peak_equity = max(self.peak_equity, equity)
        self.equity_curve.append(
            PortfolioSnapshot(
                timestamp=timestamp.isoformat(),
                equity=round(equity, 2),
            )
        )

    def get_portfolio_summary(self, prices: dict[str, float]) -> dict:
        """Return an AgentContext-compatible portfolio summary dict."""
        equity = self._calc_equity(prices)
        return {
            "cash_balance": self.cash,
            "total_equity": equity,
            "position_count": self.position_count,
            "available_for_new_position": self.available_for_new_position(prices),
            "open_positions": [
                {
                    "symbol": pos.symbol,
                    "direction": pos.direction,
                    "entry_price": pos.entry_price,
                    "position_size": pos.position_size,
                    "stop_loss": pos.stop_loss,
                    "take_profit": pos.take_profit,
                }
                for pos in self.positions.values()
            ],
        }

    def get_stats(self) -> dict:
        """Compute final backtest statistics."""
        total_trades = len(self.trades)
        winning = sum(1 for t in self.trades if t.pnl > 0)

        if not self.equity_curve:
            final_equity = self.initial_balance
        else:
            final_equity = self.equity_curve[-1].equity

        total_pnl = final_equity - self.initial_balance

        # Max drawdown
        peak = self.initial_balance
        max_dd = 0.0
        for snap in self.equity_curve:
            peak = max(peak, snap.equity)
            if peak > 0:
                dd = (peak - snap.equity) / peak
                max_dd = max(max_dd, dd)

        # Sharpe ratio (annualized, from equity curve returns)
        sharpe = None
        if len(self.equity_curve) > 1:
            equities = [s.equity for s in self.equity_curve]
            returns = [
                (equities[i] - equities[i - 1]) / equities[i - 1]
                for i in range(1, len(equities))
                if equities[i - 1] > 0
            ]
            if returns:
                mean_r = sum(returns) / len(returns)
                var_r = sum((r - mean_r) ** 2 for r in returns) / len(returns)
                std_r = math.sqrt(var_r) if var_r > 0 else 0
                if std_r > 0:
                    # Annualize assuming ~365 bars for daily, adjust per use
                    sharpe = round((mean_r / std_r) * math.sqrt(len(returns)), 4)

        return {
            "final_equity": round(final_equity, 2),
            "total_pnl": round(total_pnl, 2),
            "total_trades": total_trades,
            "winning_trades": winning,
            "max_drawdown_pct": round(max_dd * 100, 4),
            "sharpe_ratio": sharpe,
            "equity_curve": [
                {"timestamp": s.timestamp, "equity": s.equity}
                for s in self.equity_curve
            ],
        }
