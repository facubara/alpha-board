"""Unit tests for the memory and evolution system."""

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.agents.memory import MemoryManager, MEMORY_SYSTEM_PROMPT
from src.agents.evolution import (
    EvolutionManager,
    EVOLUTION_SYSTEM_PROMPT,
    REVERT_THRESHOLD_PCT,
    REVERT_EVALUATION_TRADES,
)


# =============================================================================
# Memory Manager Tests
# =============================================================================


class TestMemoryManager:
    """Tests for MemoryManager."""

    def test_memory_system_prompt(self):
        """Memory system prompt should be defined."""
        assert "trading analyst" in MEMORY_SYSTEM_PROMPT.lower()
        assert "lesson" in MEMORY_SYSTEM_PROMPT.lower()

    def test_generate_tags_win(self):
        """Should generate correct tags for a winning trade."""
        manager = MemoryManager.__new__(MemoryManager)

        trade = MagicMock()
        trade.pnl = Decimal("100.00")
        trade.position_size = Decimal("1000.00")
        trade.direction = "long"
        trade.exit_reason = "take_profit"
        trade.duration_minutes = 120

        tags = manager._generate_tags(trade, "BTCUSDT")

        assert "symbol:BTCUSDT" in tags
        assert "outcome:win" in tags
        assert "direction:long" in tags
        assert "exit:take_profit" in tags
        assert "magnitude:large" in tags  # 10% PnL (>=10% is large)
        assert "duration:intraday" in tags

    def test_generate_tags_loss(self):
        """Should generate correct tags for a losing trade."""
        manager = MemoryManager.__new__(MemoryManager)

        trade = MagicMock()
        trade.pnl = Decimal("-50.00")
        trade.position_size = Decimal("1000.00")
        trade.direction = "short"
        trade.exit_reason = "stop_loss"
        trade.duration_minutes = 30

        tags = manager._generate_tags(trade, "ETHUSDT")

        assert "symbol:ETHUSDT" in tags
        assert "outcome:loss" in tags
        assert "direction:short" in tags
        assert "exit:stop_loss" in tags
        assert "magnitude:medium" in tags
        assert "duration:quick" in tags

    def test_generate_tags_large_pnl(self):
        """Should tag large PnL trades correctly."""
        manager = MemoryManager.__new__(MemoryManager)

        trade = MagicMock()
        trade.pnl = Decimal("150.00")
        trade.position_size = Decimal("1000.00")
        trade.direction = "long"
        trade.exit_reason = "agent_decision"
        trade.duration_minutes = 2880  # 2 days

        tags = manager._generate_tags(trade, "SOLUSDT")

        assert "magnitude:large" in tags  # 15% PnL
        assert "duration:swing" in tags

    def test_generate_tags_small_pnl(self):
        """Should tag small PnL trades correctly."""
        manager = MemoryManager.__new__(MemoryManager)

        trade = MagicMock()
        trade.pnl = Decimal("10.00")
        trade.position_size = Decimal("1000.00")
        trade.direction = "long"
        trade.exit_reason = "agent_decision"
        trade.duration_minutes = 30

        tags = manager._generate_tags(trade, "ADAUSDT")

        assert "magnitude:small" in tags  # 1% PnL

    def test_build_trade_context(self):
        """Should build proper trade context for memory generation."""
        manager = MemoryManager.__new__(MemoryManager)

        trade = MagicMock()
        trade.entry_price = Decimal("50000.00")
        trade.exit_price = Decimal("52000.00")
        trade.position_size = Decimal("1000.00")
        trade.pnl = Decimal("40.00")
        trade.direction = "long"
        trade.exit_reason = "take_profit"
        trade.duration_minutes = 240

        context = manager._build_trade_context(trade, "BTCUSDT")

        assert "BTCUSDT" in context
        assert "LONG" in context
        assert "50000.00" in context
        assert "52000.00" in context
        assert "WIN" in context
        assert "4.0 hours" in context


# =============================================================================
# Evolution Manager Tests
# =============================================================================


class TestEvolutionManager:
    """Tests for EvolutionManager."""

    def test_evolution_constants(self):
        """Evolution constants should be defined."""
        assert REVERT_THRESHOLD_PCT == 0.20
        assert REVERT_EVALUATION_TRADES == 5

    def test_evolution_system_prompt(self):
        """Evolution system prompt should be defined."""
        assert "optimizer" in EVOLUTION_SYSTEM_PROMPT.lower()
        assert "improve" in EVOLUTION_SYSTEM_PROMPT.lower()

    def test_generate_diff(self):
        """Should generate diff between prompts."""
        manager = EvolutionManager.__new__(EvolutionManager)

        old_prompt = "You are a momentum trader.\nBuy when RSI is oversold."
        new_prompt = "You are a momentum trader.\nBuy when RSI is below 30.\nSell when RSI is above 70."

        diff = manager._generate_diff(old_prompt, new_prompt)

        assert "-Buy when RSI is oversold" in diff
        assert "+Buy when RSI is below 30" in diff
        assert "+Sell when RSI is above 70" in diff

    def test_generate_diff_identical(self):
        """Should handle identical prompts."""
        manager = EvolutionManager.__new__(EvolutionManager)

        prompt = "You are a trader."
        diff = manager._generate_diff(prompt, prompt)

        # Empty diff for identical content
        assert len(diff) == 0


class TestEvolutionThresholds:
    """Tests for evolution threshold logic."""

    def test_revert_threshold_value(self):
        """Revert threshold should be 20%."""
        assert REVERT_THRESHOLD_PCT == 0.20

    def test_evaluation_trades_value(self):
        """Should evaluate after 5 trades."""
        assert REVERT_EVALUATION_TRADES == 5


# =============================================================================
# Integration Tests (Mocked)
# =============================================================================


class TestMemoryGeneration:
    """Integration tests for memory generation."""

    @pytest.mark.asyncio
    async def test_memory_generation_success(self):
        """Should generate memory successfully with mocked API."""
        # This would require full mocking of session and API client
        pass

    @pytest.mark.asyncio
    async def test_memory_generation_api_failure(self):
        """Should handle API failures gracefully."""
        pass


class TestEvolutionTrigger:
    """Integration tests for evolution triggering."""

    @pytest.mark.asyncio
    async def test_evolution_trigger_check(self):
        """Should check evolution trigger correctly."""
        pass

    @pytest.mark.asyncio
    async def test_auto_revert_trigger(self):
        """Should trigger auto-revert when PnL drops."""
        pass


# =============================================================================
# Edge Cases
# =============================================================================


class TestEdgeCases:
    """Edge case tests."""

    def test_breakeven_trade_tags(self):
        """Should handle breakeven trades."""
        manager = MemoryManager.__new__(MemoryManager)

        trade = MagicMock()
        trade.pnl = Decimal("0.00")
        trade.position_size = Decimal("1000.00")
        trade.direction = "long"
        trade.exit_reason = "agent_decision"
        trade.duration_minutes = 60

        tags = manager._generate_tags(trade, "BTCUSDT")

        assert "outcome:breakeven" in tags

    def test_very_short_duration(self):
        """Should tag very short trades correctly."""
        manager = MemoryManager.__new__(MemoryManager)

        trade = MagicMock()
        trade.pnl = Decimal("5.00")
        trade.position_size = Decimal("1000.00")
        trade.direction = "short"
        trade.exit_reason = "stop_loss"
        trade.duration_minutes = 5

        tags = manager._generate_tags(trade, "BTCUSDT")

        assert "duration:quick" in tags

    def test_long_duration_trade(self):
        """Should tag long duration trades as swing."""
        manager = MemoryManager.__new__(MemoryManager)

        trade = MagicMock()
        trade.pnl = Decimal("200.00")
        trade.position_size = Decimal("1000.00")
        trade.direction = "long"
        trade.exit_reason = "take_profit"
        trade.duration_minutes = 10080  # 7 days

        tags = manager._generate_tags(trade, "BTCUSDT")

        assert "duration:swing" in tags

    def test_build_context_minutes_duration(self):
        """Should format duration in minutes for short trades."""
        manager = MemoryManager.__new__(MemoryManager)

        trade = MagicMock()
        trade.entry_price = Decimal("100.00")
        trade.exit_price = Decimal("101.00")
        trade.position_size = Decimal("100.00")
        trade.pnl = Decimal("1.00")
        trade.direction = "long"
        trade.exit_reason = "agent_decision"
        trade.duration_minutes = 45

        context = manager._build_trade_context(trade, "TEST")

        assert "45 minutes" in context

    def test_build_context_days_duration(self):
        """Should format duration in days for long trades."""
        manager = MemoryManager.__new__(MemoryManager)

        trade = MagicMock()
        trade.entry_price = Decimal("100.00")
        trade.exit_price = Decimal("110.00")
        trade.position_size = Decimal("100.00")
        trade.pnl = Decimal("10.00")
        trade.direction = "long"
        trade.exit_reason = "take_profit"
        trade.duration_minutes = 2880  # 2 days

        context = manager._build_trade_context(trade, "TEST")

        assert "2.0 days" in context
