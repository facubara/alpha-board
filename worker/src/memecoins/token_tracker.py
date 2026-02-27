"""Token Tracker Service — manages real-time market data for tracked tokens.

Combines Helius (holder counts) + DexScreener (price/volume) data,
maintains a watchlist with per-token refresh intervals, and stores
time-series snapshots for sparkline charting.
"""

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.memecoins.dexscreener_client import DexScreenerClient
from src.memecoins.helius_client import HeliusClient
from src.models.db import TokenTracker, TokenTrackerSnapshot

logger = logging.getLogger(__name__)


class TokenTrackerService:
    """Manages token tracking lifecycle: add, refresh, cleanup."""

    def __init__(
        self,
        session: AsyncSession,
        helius: HeliusClient | None = None,
        dexscreener: DexScreenerClient | None = None,
    ):
        self.session = session
        self.helius = helius or HeliusClient()
        self.dex = dexscreener or DexScreenerClient()

    async def add_token(
        self,
        mint: str,
        source: str = "manual",
        interval: int = 15,
        symbol: str | None = None,
        name: str | None = None,
    ) -> TokenTracker | None:
        """Validate via DexScreener and upsert into token_tracker.

        Returns the TokenTracker row, or None if DexScreener can't find it.
        """
        # Resolve symbol/name from DexScreener if not provided
        resolved_symbol = symbol
        resolved_name = name
        mcap = None
        price = None
        liquidity = None
        volume = None

        try:
            pairs = await self.dex.get_token_pairs(mint)
            if pairs:
                best = pairs[0]
                base = best.get("baseToken", {})
                if not resolved_symbol:
                    resolved_symbol = base.get("symbol")
                if not resolved_name:
                    resolved_name = base.get("name")
                mcap = best.get("marketCap") or best.get("fdv")
                price = best.get("priceUsd")
                liquidity = (best.get("liquidity") or {}).get("usd")
                vol = best.get("volume") or {}
                volume = vol.get("h24")
        except Exception as e:
            logger.warning(f"DexScreener lookup failed for {mint}: {e}")
            if source == "manual" and not symbol:
                return None

        stmt = pg_insert(TokenTracker).values(
            mint_address=mint,
            symbol=resolved_symbol,
            name=resolved_name,
            source=source,
            refresh_interval_minutes=interval,
            is_active=True,
            latest_price_usd=Decimal(str(price)) if price else None,
            latest_mcap_usd=Decimal(str(mcap)) if mcap else None,
            latest_liquidity_usd=Decimal(str(liquidity)) if liquidity else None,
            latest_volume_24h_usd=Decimal(str(volume)) if volume else None,
        ).on_conflict_do_update(
            index_elements=["mint_address"],
            set_={
                "is_active": True,
                "symbol": resolved_symbol or TokenTracker.symbol,
                "name": resolved_name or TokenTracker.name,
                "latest_price_usd": Decimal(str(price)) if price else TokenTracker.latest_price_usd,
                "latest_mcap_usd": Decimal(str(mcap)) if mcap else TokenTracker.latest_mcap_usd,
                "latest_liquidity_usd": Decimal(str(liquidity)) if liquidity else TokenTracker.latest_liquidity_usd,
                "latest_volume_24h_usd": Decimal(str(volume)) if volume else TokenTracker.latest_volume_24h_usd,
            },
        )
        await self.session.execute(stmt)
        await self.session.commit()

        result = await self.session.execute(
            select(TokenTracker).where(TokenTracker.mint_address == mint)
        )
        return result.scalar_one_or_none()

    async def refresh_token(self, token: TokenTracker) -> None:
        """Fetch latest holders + market data and update the token row + snapshot."""
        holders = None
        price = None
        volume = None
        mcap = None
        liquidity = None

        # Fetch holder count from Helius
        try:
            holders = await self.helius.count_token_holders(token.mint_address)
        except Exception as e:
            logger.warning(f"Holder count failed for {token.mint_address}: {e}")

        # Fetch market data from DexScreener
        try:
            pairs = await self.dex.get_token_pairs(token.mint_address)
            if pairs:
                best = pairs[0]
                price = best.get("priceUsd")
                mcap = best.get("marketCap") or best.get("fdv")
                liquidity = (best.get("liquidity") or {}).get("usd")
                vol = best.get("volume") or {}
                volume = vol.get("h24")
        except Exception as e:
            logger.warning(f"DexScreener fetch failed for {token.mint_address}: {e}")

        now = datetime.now(timezone.utc)

        # Update latest values on the token row
        if holders is not None:
            token.latest_holders = holders
        if price is not None:
            token.latest_price_usd = Decimal(str(price))
        if volume is not None:
            token.latest_volume_24h_usd = Decimal(str(volume))
        if mcap is not None:
            token.latest_mcap_usd = Decimal(str(mcap))
        if liquidity is not None:
            token.latest_liquidity_usd = Decimal(str(liquidity))
        token.last_refreshed_at = now

        # Insert snapshot
        snapshot = TokenTrackerSnapshot(
            token_id=token.id,
            holders=holders,
            price_usd=Decimal(str(price)) if price else None,
            volume_24h_usd=Decimal(str(volume)) if volume else None,
            mcap_usd=Decimal(str(mcap)) if mcap else None,
        )
        self.session.add(snapshot)

    async def refresh_all_due(self) -> int:
        """Find active tokens past their interval and refresh each.

        Returns the number of tokens refreshed.
        """
        now = datetime.now(timezone.utc)
        result = await self.session.execute(
            select(TokenTracker).where(
                TokenTracker.is_active == True,  # noqa: E712
            )
        )
        tokens = list(result.scalars().all())

        refreshed = 0
        for token in tokens:
            # Check if token is due for refresh
            if token.last_refreshed_at:
                next_refresh = token.last_refreshed_at + timedelta(
                    minutes=token.refresh_interval_minutes
                )
                if now < next_refresh:
                    continue

            try:
                await self.refresh_token(token)
                refreshed += 1
            except Exception as e:
                logger.warning(
                    f"Failed to refresh token {token.mint_address}: {e}"
                )

        if refreshed > 0:
            await self.session.commit()
            logger.info(f"Token tracker: refreshed {refreshed}/{len(tokens)} tokens")

        return refreshed

    async def cleanup_old_snapshots(self) -> int:
        """Delete snapshots older than 7 days. Returns count deleted."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        result = await self.session.execute(
            delete(TokenTrackerSnapshot).where(
                TokenTrackerSnapshot.snapshot_at < cutoff
            )
        )
        await self.session.commit()
        deleted = result.rowcount
        if deleted:
            logger.info(f"Token tracker: cleaned up {deleted} old snapshots")
        return deleted


async def run_token_tracker_refresh() -> None:
    """Entry point for scheduler job."""
    from src.db import async_session

    async with async_session() as session:
        service = TokenTrackerService(session)
        await service.refresh_all_due()


async def run_token_tracker_cleanup() -> None:
    """Entry point for scheduler cleanup job."""
    from src.db import async_session

    async with async_session() as session:
        service = TokenTrackerService(session)
        await service.cleanup_old_snapshots()
