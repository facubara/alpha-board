"""Unit tests for the agent system."""

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.agents import (
    ActionType,
    AgentContext,
    AgentDecisionResult,
    Direction,
    ExecutionResult,
    PerformanceStats,
    PortfolioSummary,
    PositionInfo,
    TradeAction,
    ValidationResult,
    estimate_cost,
)
from src.agents.executor import AgentExecutor, TRADE_ACTION_TOOL


# =============================================================================
# Schema Tests
# =============================================================================


class TestTradeAction:
    """Tests for TradeAction schema."""

    def test_hold_action(self):
        """Hold action should only require action and confidence."""
        action = TradeAction(action=ActionType.HOLD, confidence=0.5)
        assert action.action == ActionType.HOLD
        assert action.confidence == 0.5
        assert action.symbol is None

    def test_open_long_action(self):
        """Open long should include all position details."""
        action = TradeAction(
            action=ActionType.OPEN_LONG,
            symbol="BTCUSDT",
            position_size_pct=0.10,
            stop_loss_pct=0.05,
            take_profit_pct=0.15,
            confidence=0.8,
        )
        assert action.action == ActionType.OPEN_LONG
        assert action.symbol == "BTCUSDT"
        assert action.position_size_pct == 0.10
        assert action.stop_loss_pct == 0.05
        assert action.take_profit_pct == 0.15

    def test_position_size_validation(self):
        """Position size should be between 1% and 25%."""
        # Valid
        action = TradeAction(
            action=ActionType.OPEN_LONG,
            symbol="BTCUSDT",
            position_size_pct=0.25,
            confidence=0.5,
        )
        assert action.position_size_pct == 0.25

        # Invalid - too high
        with pytest.raises(ValueError):
            TradeAction(
                action=ActionType.OPEN_LONG,
                symbol="BTCUSDT",
                position_size_pct=0.30,  # > 25%
                confidence=0.5,
            )

    def test_confidence_validation(self):
        """Confidence should be between 0 and 1."""
        action = TradeAction(action=ActionType.HOLD, confidence=1.0)
        assert action.confidence == 1.0

        with pytest.raises(ValueError):
            TradeAction(action=ActionType.HOLD, confidence=1.5)


class TestPortfolioSummary:
    """Tests for PortfolioSummary schema."""

    def test_empty_portfolio(self):
        """Empty portfolio should have no positions."""
        portfolio = PortfolioSummary(
            agent_id=1,
            cash_balance=Decimal("10000.00"),
            total_equity=Decimal("10000.00"),
            total_realized_pnl=Decimal("0.00"),
            total_fees_paid=Decimal("0.00"),
            open_positions=[],
            position_count=0,
            available_for_new_position=Decimal("2500.00"),
        )
        assert portfolio.position_count == 0
        assert len(portfolio.open_positions) == 0

    def test_portfolio_with_positions(self):
        """Portfolio with positions should calculate correctly."""
        position = PositionInfo(
            id=1,
            symbol="BTCUSDT",
            symbol_id=1,
            direction=Direction.LONG,
            entry_price=Decimal("50000.00"),
            position_size=Decimal("1000.00"),
            stop_loss=Decimal("47500.00"),
            take_profit=Decimal("55000.00"),
            opened_at=datetime.now(timezone.utc),
            unrealized_pnl=Decimal("50.00"),
        )
        portfolio = PortfolioSummary(
            agent_id=1,
            cash_balance=Decimal("9000.00"),
            total_equity=Decimal("10050.00"),
            total_realized_pnl=Decimal("0.00"),
            total_fees_paid=Decimal("1.00"),
            open_positions=[position],
            position_count=1,
            available_for_new_position=Decimal("2512.50"),
        )
        assert portfolio.position_count == 1
        assert portfolio.open_positions[0].direction == Direction.LONG


class TestPerformanceStats:
    """Tests for PerformanceStats schema."""

    def test_zero_trades(self):
        """Zero trades should have zero win rate."""
        stats = PerformanceStats(
            total_trades=0,
            winning_trades=0,
            losing_trades=0,
            win_rate=0.0,
            total_pnl=Decimal("0.00"),
            avg_pnl_per_trade=Decimal("0.00"),
            max_drawdown=0.0,
        )
        assert stats.win_rate == 0.0

    def test_with_trades(self):
        """Stats with trades should calculate correctly."""
        stats = PerformanceStats(
            total_trades=10,
            winning_trades=6,
            losing_trades=4,
            win_rate=0.6,
            total_pnl=Decimal("500.00"),
            avg_pnl_per_trade=Decimal("50.00"),
            max_drawdown=0.15,
            sharpe_ratio=1.5,
        )
        assert stats.win_rate == 0.6
        assert stats.sharpe_ratio == 1.5


# =============================================================================
# Executor Tests
# =============================================================================


class TestAgentExecutor:
    """Tests for AgentExecutor."""

    def test_tool_schema(self):
        """Trade action tool should have correct schema."""
        assert TRADE_ACTION_TOOL["name"] == "trade_action"
        assert "input_schema" in TRADE_ACTION_TOOL

        schema = TRADE_ACTION_TOOL["input_schema"]
        assert "action" in schema["properties"]
        assert "confidence" in schema["properties"]
        assert "action" in schema["required"]
        assert "confidence" in schema["required"]

    def test_estimate_cost(self):
        """Cost estimation should work correctly."""
        # Haiku pricing: $1/M input, $5/M output
        cost = estimate_cost(
            "claude-haiku-3-5-20241022",
            input_tokens=1000,
            output_tokens=500,
        )
        expected = Decimal(str((1000 * 1.00 + 500 * 5.00) / 1_000_000))
        assert cost == expected

    def test_estimate_cost_sonnet(self):
        """Cost estimation for Sonnet."""
        cost = estimate_cost(
            "claude-sonnet-4-20250514",
            input_tokens=1000,
            output_tokens=500,
        )
        expected = Decimal(str((1000 * 3.00 + 500 * 15.00) / 1_000_000))
        assert cost == expected


class TestValidationResult:
    """Tests for ValidationResult schema."""

    def test_valid_result(self):
        """Valid result should have is_valid=True."""
        result = ValidationResult(is_valid=True)
        assert result.is_valid
        assert result.error_message is None

    def test_invalid_result(self):
        """Invalid result should have error message."""
        result = ValidationResult(
            is_valid=False,
            error_message="Insufficient funds",
        )
        assert not result.is_valid
        assert result.error_message == "Insufficient funds"

    def test_warnings(self):
        """Result can have warnings even if valid."""
        result = ValidationResult(
            is_valid=True,
            warnings=["Low confidence", "Near resistance"],
        )
        assert result.is_valid
        assert len(result.warnings) == 2


class TestExecutionResult:
    """Tests for ExecutionResult schema."""

    def test_successful_open(self):
        """Successful open should have position ID."""
        result = ExecutionResult(
            success=True,
            action=ActionType.OPEN_LONG,
            symbol="BTCUSDT",
            position_id=123,
            details={
                "entry_price": "50000.00",
                "position_size": "1000.00",
            },
        )
        assert result.success
        assert result.position_id == 123
        assert result.trade_id is None

    def test_successful_close(self):
        """Successful close should have trade ID."""
        result = ExecutionResult(
            success=True,
            action=ActionType.CLOSE,
            symbol="BTCUSDT",
            trade_id=456,
            details={
                "pnl": "150.00",
                "exit_reason": "agent_decision",
            },
        )
        assert result.success
        assert result.trade_id == 456
        assert result.position_id is None

    def test_failed_execution(self):
        """Failed execution should have error message."""
        result = ExecutionResult(
            success=False,
            action=ActionType.OPEN_LONG,
            symbol="BTCUSDT",
            error_message="Insufficient funds",
        )
        assert not result.success
        assert result.error_message == "Insufficient funds"


# =============================================================================
# Action Type Tests
# =============================================================================


class TestActionType:
    """Tests for ActionType enum."""

    def test_all_actions_defined(self):
        """All expected actions should be defined."""
        assert ActionType.OPEN_LONG.value == "open_long"
        assert ActionType.OPEN_SHORT.value == "open_short"
        assert ActionType.CLOSE.value == "close"
        assert ActionType.HOLD.value == "hold"

    def test_action_from_string(self):
        """Actions should be creatable from strings."""
        assert ActionType("open_long") == ActionType.OPEN_LONG
        assert ActionType("hold") == ActionType.HOLD


class TestDirection:
    """Tests for Direction enum."""

    def test_directions(self):
        """Both directions should be defined."""
        assert Direction.LONG.value == "long"
        assert Direction.SHORT.value == "short"


# =============================================================================
# Decision Result Tests
# =============================================================================


class TestAgentDecisionResult:
    """Tests for AgentDecisionResult schema."""

    def test_hold_decision(self):
        """Hold decision should be valid."""
        action = TradeAction(action=ActionType.HOLD, confidence=0.3)
        decision = AgentDecisionResult(
            action=action,
            reasoning_full="Market is uncertain, holding position.",
            reasoning_summary="Holding due to uncertainty.",
            model_used="claude-sonnet-4-20250514",
            input_tokens=500,
            output_tokens=100,
            estimated_cost_usd=Decimal("0.003"),
            prompt_version=1,
        )
        assert decision.action.action == ActionType.HOLD
        assert decision.prompt_version == 1

    def test_trade_decision(self):
        """Trade decision should include all details."""
        action = TradeAction(
            action=ActionType.OPEN_LONG,
            symbol="BTCUSDT",
            position_size_pct=0.10,
            stop_loss_pct=0.05,
            take_profit_pct=0.15,
            confidence=0.85,
        )
        decision = AgentDecisionResult(
            action=action,
            reasoning_full="Strong bullish signals across multiple indicators...",
            reasoning_summary="Opening long on BTCUSDT due to bullish confluence.",
            model_used="claude-sonnet-4-20250514",
            input_tokens=800,
            output_tokens=150,
            estimated_cost_usd=Decimal("0.0048"),
            prompt_version=2,
        )
        assert decision.action.symbol == "BTCUSDT"
        assert decision.action.confidence == 0.85


# =============================================================================
# Integration-style Tests (Mocked)
# =============================================================================


class TestPortfolioManagerValidation:
    """Tests for portfolio validation logic."""

    def test_safety_ceiling_positions_limit(self):
        """Should reject when safety ceiling (20) positions reached."""
        # This would need mocked session - placeholder
        pass

    def test_position_size_limit(self):
        """Should reject position size over 25%."""
        # This would need mocked session - placeholder
        pass

    def test_sufficient_cash_check(self):
        """Should reject when insufficient cash."""
        # This would need mocked session - placeholder
        pass


class TestContextBuilder:
    """Tests for context building."""

    def test_empty_portfolio_context(self):
        """Should handle agents with no portfolio."""
        # This would need mocked session - placeholder
        pass

    def test_rankings_context(self):
        """Should include rankings in context."""
        # This would need mocked session - placeholder
        pass
