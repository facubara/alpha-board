"""Portfolio manager for agent trading.

Handles:
- Position validation and constraints
- Opening/closing positions
- PnL calculations
- Stop-loss and take-profit checks
- Fee calculations
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.db import (
    Agent,
    AgentPortfolio,
    AgentPosition,
    AgentTrade,
    Symbol,
)
from src.agents.schemas import (
    ActionType,
    Direction,
    ExecutionResult,
    TradeAction,
    ValidationResult,
)

logger = logging.getLogger(__name__)

# Trading constraints
MAX_POSITION_SIZE_PCT = Decimal("0.25")  # 25% of equity
MAX_CONCURRENT_POSITIONS = 5
TRADING_FEE_PCT = Decimal("0.001")  # 0.1% per trade (entry + exit)


class PortfolioManager:
    """Manages agent portfolios and positions."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def validate_action(
        self,
        agent_id: int,
        action: TradeAction,
        current_prices: dict[str, Decimal],
    ) -> ValidationResult:
        """Validate if an action can be executed.

        Checks:
        - Position size limits
        - Concurrent position limits
        - Sufficient cash
        - Symbol exists and has price
        - Close action has matching position
        """
        warnings: list[str] = []

        if action.action == ActionType.HOLD:
            return ValidationResult(is_valid=True, warnings=warnings)

        # Fetch portfolio
        portfolio = await self._get_portfolio(agent_id)
        if not portfolio:
            return ValidationResult(
                is_valid=False,
                error_message="No portfolio found for agent",
            )

        # Fetch open positions
        positions = await self._get_open_positions(agent_id)

        if action.action in (ActionType.OPEN_LONG, ActionType.OPEN_SHORT):
            return await self._validate_open(
                action, portfolio, positions, current_prices, warnings
            )
        elif action.action == ActionType.CLOSE:
            return await self._validate_close(action, positions, warnings)

        return ValidationResult(is_valid=False, error_message="Unknown action type")

    async def _validate_open(
        self,
        action: TradeAction,
        portfolio: AgentPortfolio,
        positions: list[AgentPosition],
        current_prices: dict[str, Decimal],
        warnings: list[str],
    ) -> ValidationResult:
        """Validate open position action."""
        # Check symbol
        if not action.symbol:
            return ValidationResult(
                is_valid=False,
                error_message="Symbol required for open action",
            )

        # Check price available
        if action.symbol not in current_prices:
            return ValidationResult(
                is_valid=False,
                error_message=f"No current price available for {action.symbol}",
            )

        # Check concurrent positions limit
        if len(positions) >= MAX_CONCURRENT_POSITIONS:
            return ValidationResult(
                is_valid=False,
                error_message=f"Maximum {MAX_CONCURRENT_POSITIONS} concurrent positions reached",
            )

        # Check not already in position for this symbol
        existing = [p for p in positions if p.symbol_id == await self._get_symbol_id(action.symbol)]
        if existing:
            return ValidationResult(
                is_valid=False,
                error_message=f"Already have an open position in {action.symbol}",
            )

        # Check position size
        if not action.position_size_pct:
            return ValidationResult(
                is_valid=False,
                error_message="Position size percentage required for open action",
            )

        position_size_pct = Decimal(str(action.position_size_pct))
        if position_size_pct > MAX_POSITION_SIZE_PCT:
            return ValidationResult(
                is_valid=False,
                error_message=f"Position size {position_size_pct:.1%} exceeds max {MAX_POSITION_SIZE_PCT:.1%}",
            )

        # Calculate position size in USD
        position_size = portfolio.total_equity * position_size_pct
        fees = position_size * TRADING_FEE_PCT * 2  # Entry + exit fees

        # Check sufficient cash
        required_cash = position_size + fees
        if portfolio.cash_balance < required_cash:
            return ValidationResult(
                is_valid=False,
                error_message=f"Insufficient cash. Need ${required_cash:.2f}, have ${portfolio.cash_balance:.2f}",
            )

        # Warnings for low confidence
        if action.confidence < 0.5:
            warnings.append(f"Low confidence ({action.confidence:.1%})")

        return ValidationResult(is_valid=True, warnings=warnings)

    async def _validate_close(
        self,
        action: TradeAction,
        positions: list[AgentPosition],
        warnings: list[str],
    ) -> ValidationResult:
        """Validate close position action."""
        if not action.symbol:
            return ValidationResult(
                is_valid=False,
                error_message="Symbol required for close action",
            )

        # Find position to close
        symbol_id = await self._get_symbol_id(action.symbol)
        position = next((p for p in positions if p.symbol_id == symbol_id), None)

        if not position:
            return ValidationResult(
                is_valid=False,
                error_message=f"No open position found for {action.symbol}",
            )

        return ValidationResult(is_valid=True, warnings=warnings)

    async def open_position(
        self,
        agent_id: int,
        action: TradeAction,
        current_price: Decimal,
        decision_id: int | None = None,
    ) -> ExecutionResult:
        """Open a new position.

        Args:
            agent_id: The agent opening the position.
            action: The trade action with position details.
            current_price: Current market price.
            decision_id: Optional ID of the decision that triggered this.

        Returns:
            ExecutionResult with position ID if successful.
        """
        if action.action not in (ActionType.OPEN_LONG, ActionType.OPEN_SHORT):
            return ExecutionResult(
                success=False,
                action=action.action,
                error_message="Invalid action for open_position",
            )

        # Get portfolio
        portfolio = await self._get_portfolio(agent_id)
        if not portfolio:
            return ExecutionResult(
                success=False,
                action=action.action,
                error_message="No portfolio found",
            )

        # Get symbol ID
        symbol_id = await self._get_symbol_id(action.symbol)
        if not symbol_id:
            return ExecutionResult(
                success=False,
                action=action.action,
                symbol=action.symbol,
                error_message=f"Symbol {action.symbol} not found",
            )

        # Calculate position size
        position_size_pct = Decimal(str(action.position_size_pct))
        position_size = portfolio.total_equity * position_size_pct

        # Calculate fees (entry fee)
        entry_fee = position_size * TRADING_FEE_PCT

        # Calculate stop loss and take profit prices
        stop_loss = None
        take_profit = None

        if action.stop_loss_pct:
            sl_pct = Decimal(str(action.stop_loss_pct))
            if action.action == ActionType.OPEN_LONG:
                stop_loss = current_price * (1 - sl_pct)
            else:
                stop_loss = current_price * (1 + sl_pct)

        if action.take_profit_pct:
            tp_pct = Decimal(str(action.take_profit_pct))
            if action.action == ActionType.OPEN_LONG:
                take_profit = current_price * (1 + tp_pct)
            else:
                take_profit = current_price * (1 - tp_pct)

        # Create position
        direction = Direction.LONG if action.action == ActionType.OPEN_LONG else Direction.SHORT
        position = AgentPosition(
            agent_id=agent_id,
            symbol_id=symbol_id,
            direction=direction.value,
            entry_price=current_price,
            position_size=position_size,
            stop_loss=stop_loss,
            take_profit=take_profit,
            opened_at=datetime.now(timezone.utc),
            unrealized_pnl=Decimal("0.00"),
        )
        self.session.add(position)

        # Update portfolio
        portfolio.cash_balance -= (position_size + entry_fee)
        portfolio.total_fees_paid += entry_fee
        portfolio.updated_at = datetime.now(timezone.utc)

        await self.session.flush()

        logger.info(
            f"Opened {direction.value} position for agent {agent_id}: "
            f"{action.symbol} @ {current_price}, size=${position_size}"
        )

        return ExecutionResult(
            success=True,
            action=action.action,
            symbol=action.symbol,
            position_id=position.id,
            details={
                "entry_price": str(current_price),
                "position_size": str(position_size),
                "direction": direction.value,
                "stop_loss": str(stop_loss) if stop_loss else None,
                "take_profit": str(take_profit) if take_profit else None,
                "entry_fee": str(entry_fee),
            },
        )

    async def close_position(
        self,
        agent_id: int,
        symbol: str,
        exit_price: Decimal,
        exit_reason: str = "agent_decision",
        decision_id: int | None = None,
    ) -> ExecutionResult:
        """Close an existing position.

        Args:
            agent_id: The agent closing the position.
            symbol: Symbol of position to close.
            exit_price: Current market price.
            exit_reason: Reason for closing (agent_decision, stop_loss, take_profit).
            decision_id: Optional ID of the decision that triggered this.

        Returns:
            ExecutionResult with trade ID if successful.
        """
        # Get symbol ID
        symbol_id = await self._get_symbol_id(symbol)
        if not symbol_id:
            return ExecutionResult(
                success=False,
                action=ActionType.CLOSE,
                symbol=symbol,
                error_message=f"Symbol {symbol} not found",
            )

        # Find position
        result = await self.session.execute(
            select(AgentPosition).where(
                AgentPosition.agent_id == agent_id,
                AgentPosition.symbol_id == symbol_id,
            )
        )
        position = result.scalar_one_or_none()

        if not position:
            return ExecutionResult(
                success=False,
                action=ActionType.CLOSE,
                symbol=symbol,
                error_message=f"No open position found for {symbol}",
            )

        # Get portfolio
        portfolio = await self._get_portfolio(agent_id)

        # Calculate PnL
        if position.direction == "long":
            pnl = (exit_price - position.entry_price) * (
                position.position_size / position.entry_price
            )
        else:
            pnl = (position.entry_price - exit_price) * (
                position.position_size / position.entry_price
            )

        # Calculate exit fee
        exit_fee = position.position_size * TRADING_FEE_PCT

        # Net PnL after fees
        net_pnl = pnl - exit_fee

        # Calculate duration
        duration_minutes = int(
            (datetime.now(timezone.utc) - position.opened_at).total_seconds() / 60
        )

        # Create trade record
        trade = AgentTrade(
            agent_id=agent_id,
            symbol_id=symbol_id,
            direction=position.direction,
            entry_price=position.entry_price,
            exit_price=exit_price,
            position_size=position.position_size,
            pnl=net_pnl,
            fees=exit_fee,
            exit_reason=exit_reason,
            opened_at=position.opened_at,
            closed_at=datetime.now(timezone.utc),
            duration_minutes=duration_minutes,
            decision_id=decision_id,
        )
        self.session.add(trade)

        # Update portfolio
        portfolio.cash_balance += position.position_size + net_pnl
        portfolio.total_realized_pnl += net_pnl
        portfolio.total_fees_paid += exit_fee
        portfolio.total_equity = portfolio.cash_balance  # Will be updated with unrealized
        portfolio.updated_at = datetime.now(timezone.utc)

        # Delete position
        await self.session.delete(position)
        await self.session.flush()

        logger.info(
            f"Closed {position.direction} position for agent {agent_id}: "
            f"{symbol} @ {exit_price}, PnL=${net_pnl:.2f} ({exit_reason})"
        )

        return ExecutionResult(
            success=True,
            action=ActionType.CLOSE,
            symbol=symbol,
            trade_id=trade.id,
            details={
                "entry_price": str(position.entry_price),
                "exit_price": str(exit_price),
                "position_size": str(position.position_size),
                "pnl": str(net_pnl),
                "exit_fee": str(exit_fee),
                "duration_minutes": duration_minutes,
                "exit_reason": exit_reason,
            },
        )

    async def update_unrealized_pnl(
        self,
        agent_id: int,
        current_prices: dict[str, Decimal],
    ) -> None:
        """Update unrealized PnL for all open positions.

        Args:
            agent_id: The agent to update.
            current_prices: Dict of symbol -> current price.
        """
        positions = await self._get_open_positions(agent_id)
        portfolio = await self._get_portfolio(agent_id)

        total_unrealized = Decimal("0.00")
        positions_value = Decimal("0.00")

        for position in positions:
            # Get symbol name
            result = await self.session.execute(
                select(Symbol).where(Symbol.id == position.symbol_id)
            )
            symbol = result.scalar_one()

            current_price = current_prices.get(symbol.symbol)
            if not current_price:
                continue

            # Calculate unrealized PnL
            if position.direction == "long":
                unrealized = (current_price - position.entry_price) * (
                    position.position_size / position.entry_price
                )
            else:
                unrealized = (position.entry_price - current_price) * (
                    position.position_size / position.entry_price
                )

            position.unrealized_pnl = unrealized
            total_unrealized += unrealized
            positions_value += position.position_size

        # Update portfolio equity
        if portfolio:
            portfolio.total_equity = portfolio.cash_balance + positions_value + total_unrealized
            portfolio.updated_at = datetime.now(timezone.utc)

    async def check_stop_loss_take_profit(
        self,
        agent_id: int,
        candle_data: dict[str, dict[str, Decimal]],
    ) -> list[ExecutionResult]:
        """Check if any positions hit stop loss or take profit.

        Args:
            agent_id: The agent to check.
            candle_data: Dict of symbol -> {high, low, close}.

        Returns:
            List of execution results for closed positions.
        """
        results: list[ExecutionResult] = []
        positions = await self._get_open_positions(agent_id)

        for position in positions:
            # Get symbol
            result = await self.session.execute(
                select(Symbol).where(Symbol.id == position.symbol_id)
            )
            symbol = result.scalar_one()

            candle = candle_data.get(symbol.symbol)
            if not candle:
                continue

            high = candle.get("high")
            low = candle.get("low")
            close = candle.get("close")

            if not all([high, low, close]):
                continue

            # Check stop loss
            if position.stop_loss:
                if position.direction == "long" and low <= position.stop_loss:
                    result = await self.close_position(
                        agent_id, symbol.symbol, position.stop_loss, "stop_loss"
                    )
                    results.append(result)
                    continue
                elif position.direction == "short" and high >= position.stop_loss:
                    result = await self.close_position(
                        agent_id, symbol.symbol, position.stop_loss, "stop_loss"
                    )
                    results.append(result)
                    continue

            # Check take profit
            if position.take_profit:
                if position.direction == "long" and high >= position.take_profit:
                    result = await self.close_position(
                        agent_id, symbol.symbol, position.take_profit, "take_profit"
                    )
                    results.append(result)
                    continue
                elif position.direction == "short" and low <= position.take_profit:
                    result = await self.close_position(
                        agent_id, symbol.symbol, position.take_profit, "take_profit"
                    )
                    results.append(result)
                    continue

        return results

    async def _get_portfolio(self, agent_id: int) -> AgentPortfolio | None:
        """Get portfolio for an agent."""
        result = await self.session.execute(
            select(AgentPortfolio).where(AgentPortfolio.agent_id == agent_id)
        )
        return result.scalar_one_or_none()

    async def _get_open_positions(self, agent_id: int) -> list[AgentPosition]:
        """Get all open positions for an agent."""
        result = await self.session.execute(
            select(AgentPosition).where(AgentPosition.agent_id == agent_id)
        )
        return list(result.scalars().all())

    async def close_all_positions(
        self,
        agent_id: int,
        current_prices: dict[str, Decimal],
        exit_reason: str = "agent_paused",
    ) -> list[ExecutionResult]:
        """Close all open positions for an agent (used on pause).

        Returns list of execution results for each closed position.
        """
        results: list[ExecutionResult] = []
        positions = await self._get_open_positions(agent_id)

        for position in positions:
            symbol_result = await self.session.execute(
                select(Symbol).where(Symbol.id == position.symbol_id)
            )
            symbol = symbol_result.scalar_one()
            current_price = current_prices.get(symbol.symbol)
            if not current_price:
                continue

            result = await self.close_position(
                agent_id, symbol.symbol, current_price, exit_reason
            )
            results.append(result)

        return results

    async def reconcile_pnl(self, agent_id: int) -> dict:
        """Verify PnL integrity for an agent.

        Checks that:
        - portfolio.total_realized_pnl == sum(agent_trades.pnl)
        - portfolio.total_equity == cash + positions_value + unrealized

        Returns dict with is_consistent, discrepancy, and details.
        """
        from sqlalchemy import func as sqlfunc

        portfolio = await self._get_portfolio(agent_id)
        if not portfolio:
            return {"is_consistent": False, "error": "No portfolio found"}

        # Sum all trade PnLs
        trade_sum_result = await self.session.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(AgentTrade.pnl), Decimal("0.00"))).where(
                AgentTrade.agent_id == agent_id
            )
        )
        sum_realized = trade_sum_result.scalar() or Decimal("0.00")

        # Sum unrealized PnL from open positions
        positions = await self._get_open_positions(agent_id)
        sum_unrealized = sum(p.unrealized_pnl or Decimal("0.00") for p in positions)
        positions_value = sum(p.position_size for p in positions)

        # Check realized PnL matches
        realized_discrepancy = float(abs(sum_realized - portfolio.total_realized_pnl))

        # Check equity matches
        expected_equity = portfolio.cash_balance + positions_value + sum_unrealized
        equity_discrepancy = float(abs(expected_equity - portfolio.total_equity))

        is_consistent = realized_discrepancy < 0.01 and equity_discrepancy < 0.01

        details = {
            "is_consistent": is_consistent,
            "realized": {
                "sum_trades": float(sum_realized),
                "portfolio_value": float(portfolio.total_realized_pnl),
                "discrepancy": realized_discrepancy,
            },
            "equity": {
                "cash_balance": float(portfolio.cash_balance),
                "positions_value": float(positions_value),
                "sum_unrealized": float(sum_unrealized),
                "expected_equity": float(expected_equity),
                "portfolio_equity": float(portfolio.total_equity),
                "discrepancy": equity_discrepancy,
            },
            "open_positions": len(positions),
        }

        if not is_consistent:
            logger.warning(
                f"PnL discrepancy for agent {agent_id}: "
                f"realized_diff=${realized_discrepancy:.4f}, "
                f"equity_diff=${equity_discrepancy:.4f}"
            )

        return details

    async def _get_symbol_id(self, symbol: str) -> int | None:
        """Get symbol ID by name."""
        result = await self.session.execute(
            select(Symbol.id).where(Symbol.symbol == symbol)
        )
        return result.scalar_one_or_none()
