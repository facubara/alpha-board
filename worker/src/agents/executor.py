"""Agent executor for Claude API calls.

Handles:
- Building prompts from agent context
- Calling Claude API with tool_use
- Parsing structured responses
- Token usage tracking
- Retry logic
"""

import json
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import anthropic
from anthropic import APITimeoutError, APIConnectionError

from src.config import settings
from src.agents.schemas import (
    ActionType,
    AgentContext,
    AgentDecisionResult,
    TradeAction,
)

logger = logging.getLogger(__name__)

# Model pricing (per 1M tokens) as of 2025
MODEL_PRICING = {
    "claude-haiku-3-5-20241022": {"input": 1.00, "output": 5.00},
    "claude-sonnet-4-20250514": {"input": 3.00, "output": 15.00},
    "claude-opus-4-5-20251101": {"input": 15.00, "output": 75.00},
}

# Trade action tool definition
TRADE_ACTION_TOOL = {
    "name": "trade_action",
    "description": "Execute a trading action. Use this tool to open positions, close positions, or hold.",
    "input_schema": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["open_long", "open_short", "close", "hold"],
                "description": "The action to take",
            },
            "symbol": {
                "type": "string",
                "description": "Trading pair symbol (e.g., BTCUSDT). Required for open_long, open_short, close.",
            },
            "position_size_pct": {
                "type": "number",
                "minimum": 0.01,
                "maximum": 0.25,
                "description": "Position size as percentage of portfolio (0.01-0.25). Required for open_long, open_short.",
            },
            "stop_loss_pct": {
                "type": "number",
                "minimum": 0.01,
                "maximum": 0.20,
                "description": "Stop loss percentage from entry (0.01-0.20). Optional.",
            },
            "take_profit_pct": {
                "type": "number",
                "minimum": 0.01,
                "maximum": 0.50,
                "description": "Take profit percentage from entry (0.01-0.50). Optional.",
            },
            "confidence": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "description": "Your confidence in this action (0-1)",
            },
        },
        "required": ["action", "confidence"],
    },
}


class AgentExecutor:
    """Executes agent decisions via Claude API."""

    def __init__(self, api_key: str | None = None):
        self.client = anthropic.Anthropic(api_key=api_key or settings.anthropic_api_key)

    async def decide(
        self,
        context: AgentContext,
        system_prompt: str,
        model: str,
        prompt_version: int,
        max_retries: int = 1,
    ) -> AgentDecisionResult:
        """Call Claude API to get a trading decision.

        Args:
            context: Full agent context.
            system_prompt: The agent's strategy prompt.
            model: Model ID to use.
            prompt_version: Version of the prompt being used.
            max_retries: Number of retries on timeout.

        Returns:
            AgentDecisionResult with action and reasoning.
        """
        # Build user message with context
        user_message = self._build_user_message(context)

        # Call Claude API with retry
        response = None
        last_error = None

        for attempt in range(max_retries + 1):
            try:
                response = self.client.messages.create(
                    model=model,
                    max_tokens=1024,
                    system=system_prompt,
                    tools=[TRADE_ACTION_TOOL],
                    tool_choice={"type": "tool", "name": "trade_action"},
                    messages=[{"role": "user", "content": user_message}],
                )
                break
            except (APITimeoutError, APIConnectionError) as e:
                last_error = e
                logger.warning(
                    f"Claude API attempt {attempt + 1} failed: {e}"
                )
                if attempt == max_retries:
                    # Return hold action on persistent failure
                    return self._create_hold_decision(
                        f"API error after {max_retries + 1} attempts: {e}",
                        model,
                        prompt_version,
                    )

        if not response:
            return self._create_hold_decision(
                f"No response from API: {last_error}",
                model,
                prompt_version,
            )

        # Parse response
        return self._parse_response(response, model, prompt_version)

    def _build_user_message(self, context: AgentContext) -> str:
        """Build the user message with context data."""
        # Format portfolio
        portfolio = context.portfolio
        positions_str = "None"
        if portfolio.open_positions:
            positions_str = "\n".join(
                f"  - {p.symbol}: {p.direction.value} @ {p.entry_price}, "
                f"size=${p.position_size}, unrealized PnL=${p.unrealized_pnl}"
                for p in portfolio.open_positions
            )

        # Format top rankings
        rankings_str = "\n".join(
            f"  #{r.rank} {r.symbol}: score={r.bullish_score:.3f}, conf={r.confidence}%"
            for r in context.primary_timeframe_rankings[:15]
        )

        # Format memory
        memory_str = "None"
        if context.recent_memory:
            memory_str = "\n".join(f"  - {m}" for m in context.recent_memory[:5])

        # Format confluence
        confluence_str = "No cross-timeframe data"
        if context.cross_timeframe_confluence:
            cf = context.cross_timeframe_confluence
            bullish = ", ".join(cf.get("bullish_confluence", [])[:3]) or "None"
            bearish = ", ".join(cf.get("bearish_confluence", [])[:3]) or "None"
            confluence_str = f"Bullish confluence: {bullish}\nBearish confluence: {bearish}"

        # Format regime context
        regime_str = "No regime data available"
        if context.cross_timeframe_regime:
            regime = context.cross_timeframe_regime
            regime_lines = []
            for tf in ["15m", "30m", "1h", "4h", "1d", "1w"]:
                label = regime.regimes.get(tf)
                if label:
                    regime_lines.append(
                        f"  {tf}: {label.regime} (confidence={label.confidence:.0f}%, "
                        f"avg_score={label.avg_bullish_score:.3f})"
                    )
            if regime_lines:
                regime_str = "\n".join(regime_lines)
            regime_str += f"\nHigher-TF trend: {regime.higher_tf_trend} (confidence={regime.higher_tf_confidence:.0f}%)"

        return f"""Current time: {context.context_built_at.isoformat()}
Timeframe: {context.primary_timeframe}

=== PORTFOLIO ===
Cash: ${portfolio.cash_balance}
Total equity: ${portfolio.total_equity}
Realized PnL: ${portfolio.total_realized_pnl}
Available for new position: ${portfolio.available_for_new_position}
Open positions ({portfolio.position_count}/5):
{positions_str}

=== PERFORMANCE ===
Total trades: {context.performance.total_trades}
Win rate: {context.performance.win_rate:.1%}
Total PnL: ${context.performance.total_pnl}
Max drawdown: {context.performance.max_drawdown:.1%}

=== TOP RANKINGS ({context.primary_timeframe}) ===
{rankings_str}

=== CROSS-TIMEFRAME CONFLUENCE ===
{confluence_str}

=== MARKET REGIME ===
{regime_str}

=== RECENT LESSONS ===
{memory_str}

Based on the above data and your strategy, decide what action to take. Use the trade_action tool to submit your decision."""

    def _parse_response(
        self,
        response: anthropic.types.Message,
        model: str,
        prompt_version: int,
    ) -> AgentDecisionResult:
        """Parse Claude's response into a decision result."""
        # Extract token usage
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens

        # Calculate cost
        pricing = MODEL_PRICING.get(model, {"input": 3.00, "output": 15.00})
        cost = Decimal(str(
            (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000
        ))

        # Find tool use block
        tool_use_block = None
        text_blocks: list[str] = []

        for block in response.content:
            if block.type == "tool_use" and block.name == "trade_action":
                tool_use_block = block
            elif block.type == "text":
                text_blocks.append(block.text)

        if not tool_use_block:
            # No tool use, return hold
            return self._create_hold_decision(
                "No trade_action tool use in response",
                model,
                prompt_version,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost=cost,
            )

        # Parse tool input
        try:
            tool_input = tool_use_block.input
            action = TradeAction(
                action=ActionType(tool_input["action"]),
                symbol=tool_input.get("symbol"),
                position_size_pct=tool_input.get("position_size_pct"),
                stop_loss_pct=tool_input.get("stop_loss_pct"),
                take_profit_pct=tool_input.get("take_profit_pct"),
                confidence=tool_input.get("confidence", 0.5),
            )
        except Exception as e:
            logger.error(f"Failed to parse tool input: {e}")
            return self._create_hold_decision(
                f"Failed to parse tool input: {e}",
                model,
                prompt_version,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost=cost,
            )

        # Extract reasoning
        reasoning_full = "\n".join(text_blocks) if text_blocks else "No reasoning provided"
        reasoning_summary = self._summarize_reasoning(reasoning_full)

        return AgentDecisionResult(
            action=action,
            reasoning_full=reasoning_full,
            reasoning_summary=reasoning_summary,
            model_used=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost_usd=cost,
            prompt_version=prompt_version,
            decided_at=datetime.now(timezone.utc),
        )

    def _create_hold_decision(
        self,
        reason: str,
        model: str,
        prompt_version: int,
        input_tokens: int = 0,
        output_tokens: int = 0,
        cost: Decimal = Decimal("0.00"),
    ) -> AgentDecisionResult:
        """Create a hold decision (used for errors or no action)."""
        return AgentDecisionResult(
            action=TradeAction(action=ActionType.HOLD, confidence=0.0),
            reasoning_full=reason,
            reasoning_summary=reason[:500],
            model_used=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost_usd=cost,
            prompt_version=prompt_version,
            decided_at=datetime.now(timezone.utc),
        )

    def _summarize_reasoning(self, full_reasoning: str, max_length: int = 500) -> str:
        """Create a summary of the reasoning."""
        if len(full_reasoning) <= max_length:
            return full_reasoning

        # Take first paragraph or first max_length chars
        paragraphs = full_reasoning.split("\n\n")
        if paragraphs and len(paragraphs[0]) <= max_length:
            return paragraphs[0]

        return full_reasoning[:max_length - 3] + "..."


def estimate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> Decimal:
    """Estimate cost for a given model and token counts."""
    pricing = MODEL_PRICING.get(model, {"input": 3.00, "output": 15.00})
    return Decimal(str(
        (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000
    ))
