"""Token extractor — find memecoin tickers in tweet text and search DexScreener.

Extracts $TICKER patterns, contract addresses, and DexScreener/Birdeye/Pump.fun URLs,
then searches DexScreener for matches on Solana and stores results in memecoin_tweet_tokens.
"""

import logging
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from src.memecoins.dexscreener_client import DexScreenerClient
from src.models.db import MemecoinTweetToken

logger = logging.getLogger(__name__)

# Regex for $TICKER patterns
TICKER_REGEX = re.compile(r"\$([A-Z]{2,10})\b")
# Regex for TICKER/SOL patterns
PAIR_REGEX = re.compile(r"\b([A-Z]{2,10})/SOL\b")
# Standalone all-caps words that look like tickers (3-6 chars, not common words)
STANDALONE_REGEX = re.compile(r"\b([A-Z]{3,6})\b")

# Contract address patterns (Solana base58: 32-44 chars, no 0/O/I/l)
CA_REGEX = re.compile(r"\b([1-9A-HJ-NP-Za-km-z]{32,44})\b")

# URL patterns that embed contract addresses
DEXSCREENER_URL_REGEX = re.compile(
    r"https?://(?:www\.)?dexscreener\.com/solana/([1-9A-HJ-NP-Za-km-z]{32,44})"
)
BIRDEYE_URL_REGEX = re.compile(
    r"https?://(?:www\.)?birdeye\.so/token/([1-9A-HJ-NP-Za-km-z]{32,44})"
)
PUMP_FUN_URL_REGEX = re.compile(
    r"https?://(?:www\.)?pump\.fun/(?:coin/)?([1-9A-HJ-NP-Za-km-z]{32,44})"
)

# Common false positives to exclude
FALSE_POSITIVES = {
    "USD", "BTC", "ETH", "SOL", "USDT", "USDC", "BNB", "XRP", "ADA",
    "DOGE", "DOT", "LINK", "UNI", "AVAX", "MATIC", "ATOM", "APT", "SUI",
    "THE", "FOR", "AND", "BUT", "NOT", "YOU", "ALL", "CAN", "HER", "WAS",
    "ONE", "OUR", "OUT", "ARE", "HAS", "HIS", "HOW", "ITS", "LET", "MAY",
    "NEW", "NOW", "OLD", "SEE", "WAY", "WHO", "BOY", "DID", "GET", "HIM",
    "SAY", "SHE", "TOO", "USE", "DAD", "MOM", "TOP", "BIG", "END", "FAR",
    "RUN", "TRY", "ASK", "MEN", "OWN", "PUT", "SET", "FEW", "WHY",
    "NFT", "DAO", "DCA", "ATH", "ATL", "APR", "APY", "TVL", "DEX", "CEX",
    "IMO", "TBH", "LOL", "WTF", "LFG", "NFA", "DYOR", "HODL", "FOMO",
    "PUMP", "DUMP", "LONG", "SHORT", "BULL", "BEAR", "SEND", "MOON",
    "JUST", "THIS", "THAT", "WITH", "FROM", "THEY", "BEEN", "HAVE",
    "WILL", "MORE", "WHEN", "WHAT", "SOME", "THAN", "THEM", "INTO",
    "LIKE", "ONLY", "OVER", "SUCH", "TAKE", "MAKE", "VERY", "EACH",
    "MUCH", "ALSO", "BACK", "GOOD", "GIVE", "MOST", "FIND", "HERE",
    "KNOW", "LAST", "LONG", "NEED", "NEXT", "COME", "LOOK", "KEEP",
}

MIN_LIQUIDITY = 1_000  # $1K minimum liquidity
MAX_TOKEN_AGE_DAYS = 30  # only match tokens created within 30 days


class TokenExtractor:
    """Extract token tickers from tweets and match against DexScreener."""

    def __init__(self, dex: DexScreenerClient | None = None):
        self.dex = dex or DexScreenerClient()

    async def extract_and_match(
        self, session: AsyncSession, tweet_db_id: int, text: str
    ) -> list[dict]:
        """Extract tickers from tweet text and search DexScreener.

        Two-phase approach:
        1. CA/URL lookups — highest confidence, exact token resolution
        2. Symbol search — only for tickers NOT already resolved via Phase 1

        Args:
            session: DB session for persisting matches.
            tweet_db_id: The memecoin_tweets.id for FK reference.
            text: The tweet text to parse.

        Returns:
            List of matched token dicts.
        """
        matches: list[dict] = []
        seen_mints: set[str] = set()
        seen_symbols: set[str] = set()

        # Phase 1: Contract address / URL lookups
        contract_addresses = self._extract_contract_addresses(text)
        for mint in contract_addresses:
            if mint in seen_mints:
                continue

            try:
                pairs = await self.dex.get_token_pairs(mint)
                for pair in self._filter_pairs(pairs):
                    token_data = self._pair_to_match(pair)
                    token_mint = token_data.get("token_mint")
                    token_symbol = token_data.get("token_symbol", "").upper()

                    if token_mint and token_mint in seen_mints:
                        continue

                    match = MemecoinTweetToken(
                        tweet_id=tweet_db_id,
                        token_mint=token_data.get("token_mint"),
                        token_symbol=token_data["token_symbol"],
                        token_name=token_data.get("token_name"),
                        source="keyword",
                        dexscreener_url=token_data.get("dexscreener_url"),
                        market_cap_usd=token_data.get("market_cap_usd"),
                        price_usd=token_data.get("price_usd"),
                        liquidity_usd=token_data.get("liquidity_usd"),
                    )
                    session.add(match)
                    matches.append(token_data)

                    if token_mint:
                        seen_mints.add(token_mint)
                    if token_symbol:
                        seen_symbols.add(token_symbol)
                    break  # Take first valid match per mint

            except Exception as e:
                logger.debug(f"DexScreener lookup failed for mint {mint}: {e}")

        # Phase 2: Symbol search (existing ticker extraction)
        tickers = self._extract_tickers(text)

        for ticker in tickers:
            if ticker in seen_symbols:
                continue
            seen_symbols.add(ticker)

            try:
                pairs = await self.dex.search_tokens(ticker)
                for pair in self._filter_pairs(pairs):
                    token_data = self._pair_to_match(pair)
                    token_mint = token_data.get("token_mint")

                    if token_mint and token_mint in seen_mints:
                        continue
                    if token_data["token_symbol"].upper() in seen_symbols and token_data["token_symbol"].upper() != ticker:
                        continue

                    match = MemecoinTweetToken(
                        tweet_id=tweet_db_id,
                        token_mint=token_data.get("token_mint"),
                        token_symbol=token_data["token_symbol"],
                        token_name=token_data.get("token_name"),
                        source="keyword",
                        dexscreener_url=token_data.get("dexscreener_url"),
                        market_cap_usd=token_data.get("market_cap_usd"),
                        price_usd=token_data.get("price_usd"),
                        liquidity_usd=token_data.get("liquidity_usd"),
                    )
                    session.add(match)
                    matches.append(token_data)

                    if token_mint:
                        seen_mints.add(token_mint)
                    break  # Take first valid match per ticker

            except Exception as e:
                logger.debug(f"DexScreener search failed for {ticker}: {e}")

        return matches

    def _extract_contract_addresses(self, text: str) -> list[str]:
        """Extract contract addresses from URLs first, then raw CAs.

        Priority: URLs (highest confidence) → raw CAs.
        """
        addresses: list[str] = []
        seen: set[str] = set()

        # URL patterns first (highest confidence)
        for regex in [DEXSCREENER_URL_REGEX, BIRDEYE_URL_REGEX, PUMP_FUN_URL_REGEX]:
            for match in regex.finditer(text):
                addr = match.group(1)
                if addr not in seen:
                    addresses.append(addr)
                    seen.add(addr)

        # Raw contract addresses
        for match in CA_REGEX.finditer(text):
            addr = match.group(1)
            if addr not in seen:
                addresses.append(addr)
                seen.add(addr)

        return addresses

    def _extract_tickers(self, text: str) -> list[str]:
        """Extract potential token tickers from text."""
        tickers: list[str] = []

        # $TICKER patterns (highest confidence)
        for match in TICKER_REGEX.finditer(text):
            ticker = match.group(1)
            if ticker not in FALSE_POSITIVES:
                tickers.append(ticker)

        # TICKER/SOL patterns
        for match in PAIR_REGEX.finditer(text):
            ticker = match.group(1)
            if ticker not in FALSE_POSITIVES and ticker not in tickers:
                tickers.append(ticker)

        return tickers

    def _filter_pairs(self, pairs: list[dict]) -> list[dict]:
        """Filter DexScreener pairs to only valid Solana memecoin matches."""
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=MAX_TOKEN_AGE_DAYS)

        filtered = []
        for pair in pairs:
            if pair.get("chainId") != "solana":
                continue

            liquidity = pair.get("liquidity", {})
            liq_usd = liquidity.get("usd", 0) if isinstance(liquidity, dict) else 0
            if liq_usd < MIN_LIQUIDITY:
                continue

            # Check creation time if available
            created = pair.get("pairCreatedAt")
            if created:
                try:
                    created_dt = datetime.fromtimestamp(created / 1000, tz=timezone.utc)
                    if created_dt < cutoff:
                        continue
                except (ValueError, TypeError):
                    pass

            filtered.append(pair)

        return filtered

    @staticmethod
    def _pair_to_match(pair: dict) -> dict:
        """Convert DexScreener pair to match dict."""
        base = pair.get("baseToken", {})
        liquidity = pair.get("liquidity", {})
        liq_usd = liquidity.get("usd") if isinstance(liquidity, dict) else None

        return {
            "token_mint": base.get("address"),
            "token_symbol": base.get("symbol", ""),
            "token_name": base.get("name", ""),
            "dexscreener_url": pair.get("url"),
            "market_cap_usd": Decimal(str(pair["marketCap"])) if pair.get("marketCap") else None,
            "price_usd": Decimal(str(pair["priceUsd"])) if pair.get("priceUsd") else None,
            "liquidity_usd": Decimal(str(liq_usd)) if liq_usd else None,
        }
