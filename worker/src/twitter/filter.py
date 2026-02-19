"""Tweet relevance filter — two-tier keyword + LLM filtering at ingestion time.

Tier 1: Free keyword/regex heuristics (tickers, trading terms, crypto terms).
Tier 2: Cheap Claude Haiku yes/no call for ambiguous tweets (~$0.0001/tweet).

Irrelevant tweets are discarded entirely — no soft-delete.
"""

import logging
import re
from dataclasses import dataclass, field

import anthropic

from src.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Term sets (~120 terms across three categories)
# ---------------------------------------------------------------------------

TRADING_TERMS = frozenset({
    "long", "short", "bullish", "bearish", "pump", "dump", "breakout",
    "support", "resistance", "liquidation", "liquidated", "leverage",
    "margin", "futures", "perp", "perps", "perpetual", "scalp", "swing",
    "overbought", "oversold", "entry", "exit", "sl", "tp", "stoploss",
    "takeprofit", "position", "hedge", "hedging", "longs", "shorts",
    "squeeze", "wick", "dip", "buy", "sell", "bid", "ask", "order",
    "limit", "market", "fill", "filled",
})

MARKET_TERMS = frozenset({
    "price", "volume", "chart", "candle", "candles", "dip", "rally",
    "ath", "atl", "correction", "crash", "trend", "momentum", "rsi",
    "macd", "ema", "sma", "vwap", "fib", "fibonacci", "ta",
    "technical", "analysis", "indicator", "divergence", "convergence",
    "pattern", "triangle", "wedge", "flag", "pennant", "channel",
    "trendline", "level", "zone", "range", "consolidation",
    "reversal", "retest", "pullback", "bounce",
})

CRYPTO_TERMS = frozenset({
    "bitcoin", "btc", "ethereum", "eth", "crypto", "defi", "nft",
    "airdrop", "staking", "tvl", "blockchain", "onchain", "token",
    "altcoin", "altcoins", "memecoin", "memecoins", "whale", "whales",
    "halving", "etf", "binance", "coinbase", "bybit", "okx", "dex",
    "cex", "swap", "yield", "farming", "liquidity", "pool", "mint",
    "minting", "gas", "gwei", "sol", "solana", "avax", "bnb", "xrp",
    "doge", "ada", "dot", "matic", "polygon", "layer2", "l2", "l1",
    "rollup", "bridge", "protocol", "dao", "governance", "web3",
    "hodl", "hodling", "sats", "satoshi",
})

ALL_POSITIVE_TERMS = TRADING_TERMS | MARKET_TERMS | CRYPTO_TERMS

# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

# Ticker patterns: $BTC, BTCUSDT, ETH/USDT, $ETH
TICKER_RE = re.compile(
    r"\$[A-Z]{2,10}"           # $BTC, $ETH, $SOL
    r"|[A-Z]{2,10}USDT"        # BTCUSDT, ETHUSDT
    r"|[A-Z]{2,10}/USDT"       # BTC/USDT, ETH/USDT
    r"|[A-Z]{2,10}/USD",       # BTC/USD
    re.IGNORECASE,
)

# Price/percentage patterns: $42,000  15%  10x  2.5x
PRICE_PCT_RE = re.compile(
    r"\$[\d,]+\.?\d*"          # $42,000 or $1.23
    r"|\d+\.?\d*%"             # 15% or 2.5%
    r"|\d+\.?\d*x\b",         # 10x or 2.5x
)

# Negative patterns — only checked when no positive matches found
NEGATIVE_PATTERNS = re.compile(
    r"good\s+morning"
    r"|having\s+lunch"
    r"|family\s+dinner"
    r"|workout|gym\s+day|at\s+the\s+gym"
    r"|vacation|holiday\s+mode"
    r"|check\s+out\s+my\s+podcast"
    r"|new\s+episode"
    r"|subscribe\s+to"
    r"|happy\s+birthday"
    r"|merry\s+christmas"
    r"|happy\s+new\s+year"
    r"|just\s+woke\s+up"
    r"|movie\s+night"
    r"|date\s+night"
    r"|cooking\s+dinner"
    r"|road\s+trip",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# FilterStats
# ---------------------------------------------------------------------------

@dataclass
class FilterStats:
    """Tracks filter statistics for a batch of tweets."""

    total: int = 0
    passed: int = 0
    dropped_keyword: int = 0
    dropped_llm: int = 0
    ambiguous_kept: int = 0
    llm_cost: float = 0.0


# ---------------------------------------------------------------------------
# TweetRelevanceFilter
# ---------------------------------------------------------------------------

class TweetRelevanceFilter:
    """Two-tier relevance filter for crypto tweets."""

    def __init__(self, api_key: str | None = None):
        self._anthropic: anthropic.Anthropic | None = None
        self._api_key = api_key or settings.anthropic_api_key

    @property
    def anthropic_client(self) -> anthropic.Anthropic:
        if self._anthropic is None:
            self._anthropic = anthropic.Anthropic(api_key=self._api_key)
        return self._anthropic

    # -- Tier 1: Keyword / heuristic filter ---------------------------------

    @staticmethod
    def is_relevant(text: str) -> bool | None:
        """Keyword-based relevance check.

        Returns:
            True  — definitely relevant (positive match found)
            False — definitely irrelevant (negative match, no positive)
            None  — ambiguous (no strong signal either way)
        """
        # Check ticker patterns ($BTC, BTCUSDT, etc.)
        if TICKER_RE.search(text):
            return True

        # Check price/percentage patterns ($42,000, 15%, 10x)
        if PRICE_PCT_RE.search(text):
            return True

        # Tokenize and check against term sets
        tokens = set(re.findall(r"[a-zA-Z0-9]+", text.lower()))
        if tokens & ALL_POSITIVE_TERMS:
            return True

        # No positive match — check negative patterns
        if NEGATIVE_PATTERNS.search(text):
            return False

        # Ambiguous
        return None

    # -- Tier 2: LLM fallback -----------------------------------------------

    def check_relevance_llm(self, text: str) -> tuple[bool, float]:
        """LLM-based relevance check using Claude Haiku.

        Returns:
            (is_relevant, cost_usd)
        """
        try:
            response = self.anthropic_client.messages.create(
                model=settings.tweet_analysis_model,
                max_tokens=3,
                system="Is this tweet relevant to crypto markets, trading, or digital assets? Reply only yes or no.",
                messages=[{"role": "user", "content": text}],
            )

            # Calculate cost
            input_tokens = response.usage.input_tokens
            output_tokens = response.usage.output_tokens
            # Haiku 4.5 pricing: $0.80/1M input, $4.00/1M output
            cost = (input_tokens * 0.80 + output_tokens * 4.00) / 1_000_000

            answer = response.content[0].text.strip().lower()
            is_relevant = not answer.startswith("no")

            return is_relevant, cost

        except Exception as e:
            logger.warning(f"LLM relevance check failed (fail-open): {e}")
            return True, 0.0  # Fail-open: keep the tweet

    # -- Main entry point ----------------------------------------------------

    def filter_tweets(
        self,
        tweets: list[dict],
        llm_enabled: bool = False,
    ) -> tuple[list[dict], FilterStats]:
        """Filter a list of tweet dicts for relevance.

        Args:
            tweets: List of raw tweet dicts (must have "text" key).
            llm_enabled: Whether to use LLM fallback for ambiguous tweets.

        Returns:
            (kept_tweets, stats)
        """
        stats = FilterStats(total=len(tweets))
        kept: list[dict] = []

        for tweet in tweets:
            text = tweet.get("text", "")
            result = self.is_relevant(text)

            if result is True:
                kept.append(tweet)
                stats.passed += 1
            elif result is False:
                stats.dropped_keyword += 1
                logger.debug(f"Dropped (keyword): {text[:80]}...")
            else:
                # Ambiguous — check LLM if enabled
                if llm_enabled:
                    is_rel, cost = self.check_relevance_llm(text)
                    stats.llm_cost += cost
                    if is_rel:
                        kept.append(tweet)
                        stats.passed += 1
                    else:
                        stats.dropped_llm += 1
                        logger.debug(f"Dropped (LLM): {text[:80]}...")
                else:
                    # Fail-open: keep ambiguous tweets
                    kept.append(tweet)
                    stats.passed += 1
                    stats.ambiguous_kept += 1

        return kept, stats
