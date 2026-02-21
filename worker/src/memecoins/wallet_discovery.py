"""Wallet cross-reference pipeline — discover smart wallets.

Finds wallets that were provably early on multiple successful memecoins,
scores them, and builds a leaderboard.
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.memecoins.dexscreener_client import DexScreenerClient
from src.memecoins.helius_client import HeliusClient
from src.models.db import MemecoinToken, WatchWallet

logger = logging.getLogger(__name__)

# Known Solana DEX program IDs
SWAP_PROGRAM_IDS = {
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",  # Jupiter v6
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",  # Raydium AMM
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",  # PumpSwap
}

# Minimum number of early token hits to qualify as a smart wallet
MIN_HITS = 2
EARLY_BUYERS_PER_TOKEN = 50


class WalletDiscoveryPipeline:
    """Cross-reference pipeline for discovering smart wallets."""

    def __init__(
        self,
        session: AsyncSession,
        helius: HeliusClient | None = None,
        dex: DexScreenerClient | None = None,
    ):
        self.session = session
        self.helius = helius or HeliusClient()
        self.dex = dex or DexScreenerClient()

    async def run(self) -> dict:
        """Run full cross-reference pipeline.

        Returns:
            Summary dict with tokens_found, wallets_discovered, etc.
        """
        logger.info("Starting wallet discovery pipeline")

        # Step 1: Get successful tokens
        tokens = await self._fetch_successful_tokens()
        logger.info(f"Step 1: {len(tokens)} successful tokens")

        if not tokens:
            return {"tokens_found": 0, "wallets_discovered": 0, "status": "no_tokens"}

        # Step 2: Get early buyers per token
        early_buyers: dict[str, list[dict]] = {}  # wallet -> [{mint, entry_rank}]
        for token in tokens:
            try:
                buyers = await self._get_early_buyers(token["mint_address"])
                for buyer in buyers:
                    addr = buyer["wallet"]
                    early_buyers.setdefault(addr, []).append({
                        "mint": token["mint_address"],
                        "symbol": token.get("symbol", "???"),
                        "entry_rank": buyer["entry_rank"],
                        "peak_mcap": token.get("peak_mcap_usd"),
                    })
            except Exception as e:
                logger.warning(f"Failed to get early buyers for {token.get('symbol')}: {e}")

        logger.info(f"Step 2: {len(early_buyers)} unique wallets found across all tokens")

        # Step 3: Cross-reference — wallets appearing in 2+ tokens
        smart_wallets = {
            addr: entries
            for addr, entries in early_buyers.items()
            if len(entries) >= MIN_HITS
        }
        logger.info(f"Step 3: {len(smart_wallets)} wallets with {MIN_HITS}+ hits")

        # Step 4: Score and persist
        upserted = 0
        for address, entries in smart_wallets.items():
            score = self._compute_score(entries)
            hit_count = len(entries)
            avg_rank = (
                sum(e["entry_rank"] for e in entries) // hit_count if hit_count else 0
            )

            tokens_summary = [
                {
                    "symbol": e["symbol"],
                    "mint": e["mint"],
                    "entry_rank": e["entry_rank"],
                    "peak_mcap": float(e["peak_mcap"]) if e["peak_mcap"] else None,
                }
                for e in entries
            ]

            stmt = pg_insert(WatchWallet).values(
                address=address,
                source="on_chain",
                score=Decimal(str(round(score, 2))),
                hit_count=hit_count,
                total_tokens_traded=hit_count,
                avg_entry_rank=avg_rank,
                tokens_summary=tokens_summary,
                is_active=True,
                last_refreshed_at=datetime.now(timezone.utc),
            ).on_conflict_do_update(
                index_elements=["address"],
                set_={
                    "score": Decimal(str(round(score, 2))),
                    "hit_count": hit_count,
                    "total_tokens_traded": hit_count,
                    "avg_entry_rank": avg_rank,
                    "tokens_summary": tokens_summary,
                    "last_refreshed_at": datetime.now(timezone.utc),
                },
            )
            await self.session.execute(stmt)
            upserted += 1

        await self.session.commit()
        logger.info(f"Step 4: Upserted {upserted} smart wallets")

        return {
            "tokens_found": len(tokens),
            "wallets_scanned": len(early_buyers),
            "wallets_discovered": upserted,
            "status": "completed",
        }

    async def _fetch_successful_tokens(self) -> list[dict]:
        """Get top Solana memecoins from DexScreener + DB."""
        tokens: list[dict] = []

        # From DexScreener: search for top Solana tokens
        try:
            pairs = await self.dex.search_tokens("solana meme")
            for pair in pairs[:30]:
                if pair.get("chainId") != "solana":
                    continue
                mcap = pair.get("marketCap") or pair.get("fdv") or 0
                if mcap < 500_000:
                    continue

                mint = pair.get("baseToken", {}).get("address", "")
                if not mint:
                    continue

                token_data = {
                    "mint_address": mint,
                    "symbol": pair.get("baseToken", {}).get("symbol", ""),
                    "name": pair.get("baseToken", {}).get("name", ""),
                    "peak_mcap_usd": mcap,
                    "launchpad": "unknown",
                }
                tokens.append(token_data)

                # Upsert into DB
                stmt = pg_insert(MemecoinToken).values(
                    mint_address=mint,
                    symbol=token_data["symbol"],
                    name=token_data["name"],
                    peak_mcap_usd=Decimal(str(mcap)),
                    current_mcap_usd=Decimal(str(mcap)),
                    status="active",
                ).on_conflict_do_update(
                    index_elements=["mint_address"],
                    set_={
                        "current_mcap_usd": Decimal(str(mcap)),
                        "peak_mcap_usd": func.greatest(
                            MemecoinToken.peak_mcap_usd, Decimal(str(mcap))
                        ),
                        "updated_at": func.now(),
                    },
                )
                await self.session.execute(stmt)

        except Exception as e:
            logger.warning(f"DexScreener token fetch failed: {e}")

        # Also include manually added tokens from DB
        db_result = await self.session.execute(
            select(MemecoinToken).where(
                MemecoinToken.status == "active",
                MemecoinToken.peak_mcap_usd >= 500_000,
            )
        )
        for token in db_result.scalars().all():
            existing = {t["mint_address"] for t in tokens}
            if token.mint_address not in existing:
                tokens.append({
                    "mint_address": token.mint_address,
                    "symbol": token.symbol or "",
                    "name": token.name or "",
                    "peak_mcap_usd": float(token.peak_mcap_usd) if token.peak_mcap_usd else 0,
                    "launchpad": token.launchpad or "unknown",
                })

        await self.session.commit()
        return tokens

    async def _get_early_buyers(self, mint: str) -> list[dict]:
        """Get first N buyers of a token via Helius transaction history."""
        try:
            txs = await self.helius.get_wallet_transactions(mint, limit=100)
        except Exception as e:
            logger.warning(f"Failed to get transactions for {mint}: {e}")
            return []

        # Extract unique buyer wallets from swap transactions
        buyers: list[dict] = []
        seen_wallets: set[str] = set()

        for tx in txs:
            if len(buyers) >= EARLY_BUYERS_PER_TOKEN:
                break

            # Look for swap instructions
            fee_payer = tx.get("feePayer", "")
            if not fee_payer or fee_payer in seen_wallets:
                continue

            # Check if this is a swap/buy transaction
            tx_type = tx.get("type", "")
            if tx_type in ("SWAP", "TRANSFER"):
                seen_wallets.add(fee_payer)
                buyers.append({
                    "wallet": fee_payer,
                    "entry_rank": len(buyers) + 1,
                })

        return buyers

    @staticmethod
    def _compute_score(entries: list[dict]) -> float:
        """Compute wallet score (0-100) from cross-reference data.

        Score formula:
        - hit_count (25%): more successful tokens = higher score
        - avg_entry_rank_inverted (25%): earlier entries = higher score
        - diversity_bonus (25%): variety of tokens
        - recency_bonus (25%): flat 25 for now (no timestamp in entries)
        """
        hit_count = len(entries)
        hit_score = min(hit_count * 12.5, 25.0)  # cap at 25

        ranks = [e["entry_rank"] for e in entries]
        avg_rank = sum(ranks) / len(ranks) if ranks else 50
        rank_score = max(0, 25.0 - (avg_rank - 1) * 0.5)  # rank 1 = 25, rank 51 = 0

        symbols = {e.get("symbol", "") for e in entries}
        diversity_score = min(len(symbols) * 6.25, 25.0)  # cap at 25

        recency_score = 25.0  # flat for now

        return min(hit_score + rank_score + diversity_score + recency_score, 100.0)


async def run_wallet_discovery() -> dict:
    """Entry point for scheduler job."""
    from src.db import async_session

    async with async_session() as session:
        pipeline = WalletDiscoveryPipeline(session)
        return await pipeline.run()
