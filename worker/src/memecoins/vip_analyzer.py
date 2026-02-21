"""VIP token analyzer — LLM-powered theme extraction for VIP accounts.

For accounts with is_vip=True (e.g., Elon, Trump), uses Claude Haiku
to extract token themes from tweets and search DexScreener for matches.
"""

import logging
from decimal import Decimal

import anthropic
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.llm_settings import is_enabled
from src.memecoins.dexscreener_client import DexScreenerClient
from src.models.db import MemecoinTweetToken

logger = logging.getLogger(__name__)

MODEL = "claude-haiku-4-5-20251001"
MODEL_PRICING = {"input": 0.80, "output": 4.00}  # per 1M tokens

EXTRACT_THEMES_TOOL = {
    "name": "extract_token_themes",
    "description": "Extract memecoin-related themes and keywords from a tweet that could trigger new token creation or pumps",
    "input_schema": {
        "type": "object",
        "properties": {
            "themes": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Keywords or themes that could become memecoin names/tickers (e.g. 'mars', 'rocket', 'spacex', 'doge')",
            },
            "reasoning": {
                "type": "string",
                "description": "Brief explanation of why these themes could trigger memecoin activity",
            },
            "urgency": {
                "type": "string",
                "enum": ["high", "medium", "low"],
                "description": "How likely this tweet is to immediately move memecoin markets",
            },
        },
        "required": ["themes", "reasoning", "urgency"],
    },
}

SYSTEM_PROMPT = """You are a memecoin market analyst. You analyze tweets from high-profile VIP accounts (influencers, public figures) to identify themes that historically trigger new memecoin creation or price pumps on Solana.

When a public figure tweets about a topic, memecoin traders often create or pump tokens related to that topic within minutes. Your job is to extract the most likely trigger themes.

Examples:
- Elon tweets about Mars → tokens like $MARS, $ROCKET, $SPACEX pump
- Trump tweets about victory → tokens like $MAGA, $VICTORY pump
- A celebrity mentions a pet → pet-themed tokens pump

Extract the most specific and actionable themes. Ignore generic/common topics that wouldn't trigger memecoin activity."""


class VipTokenAnalyzer:
    """Analyze VIP account tweets for memecoin-triggering themes."""

    def __init__(self, dex: DexScreenerClient | None = None):
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self.dex = dex or DexScreenerClient()

    async def analyze_tweet(
        self,
        session: AsyncSession,
        tweet_db_id: int,
        text: str,
        author_handle: str,
    ) -> list[dict]:
        """Analyze a VIP tweet for token themes and search DexScreener.

        Returns:
            List of matched token dicts.
        """
        if not is_enabled("memecoin_vip_token_search"):
            return []

        if not settings.anthropic_api_key:
            return []

        # Extract themes via LLM
        try:
            themes = await self._extract_themes(text, author_handle)
        except Exception as e:
            logger.warning(f"VIP theme extraction failed for @{author_handle}: {e}")
            return []

        if not themes:
            return []

        # Search DexScreener for each theme
        matches: list[dict] = []
        seen_mints: set[str] = set()

        for theme in themes:
            try:
                pairs = await self.dex.search_tokens(theme)
                for pair in pairs[:3]:  # Top 3 per theme
                    if pair.get("chainId") != "solana":
                        continue

                    base = pair.get("baseToken", {})
                    mint = base.get("address", "")
                    if not mint or mint in seen_mints:
                        continue
                    seen_mints.add(mint)

                    liquidity = pair.get("liquidity", {})
                    liq_usd = liquidity.get("usd", 0) if isinstance(liquidity, dict) else 0
                    if liq_usd < 1000:
                        continue

                    mcap = pair.get("marketCap")
                    price = pair.get("priceUsd")

                    token_match = MemecoinTweetToken(
                        tweet_id=tweet_db_id,
                        token_mint=mint,
                        token_symbol=base.get("symbol", ""),
                        token_name=base.get("name", ""),
                        source="llm",
                        dexscreener_url=pair.get("url"),
                        market_cap_usd=Decimal(str(mcap)) if mcap else None,
                        price_usd=Decimal(str(price)) if price else None,
                        liquidity_usd=Decimal(str(liq_usd)) if liq_usd else None,
                        metadata_={
                            "theme": theme,
                            "author": author_handle,
                        },
                    )
                    session.add(token_match)
                    matches.append({
                        "theme": theme,
                        "token_symbol": base.get("symbol", ""),
                        "token_mint": mint,
                        "source": "llm",
                    })

            except Exception as e:
                logger.debug(f"DexScreener search failed for theme '{theme}': {e}")

        return matches

    async def _extract_themes(self, text: str, author_handle: str) -> list[str]:
        """Use Claude Haiku to extract token themes from tweet text."""
        user_message = f"Tweet from @{author_handle}:\n\n{text}"

        response = self.client.messages.create(
            model=MODEL,
            max_tokens=512,
            system=SYSTEM_PROMPT,
            tools=[EXTRACT_THEMES_TOOL],
            tool_choice={"type": "tool", "name": "extract_token_themes"},
            messages=[{"role": "user", "content": user_message}],
        )

        # Parse tool_use response
        for block in response.content:
            if block.type == "tool_use" and block.name == "extract_token_themes":
                themes = block.input.get("themes", [])
                urgency = block.input.get("urgency", "low")
                logger.info(
                    f"VIP @{author_handle}: themes={themes}, urgency={urgency}"
                )
                return themes

        return []
