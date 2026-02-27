"""Cross-reference checker — check new token buyers against analyzed wallet DB.

Input a new token CA → fetch early buyers → check if any are in our
analyzed_wallets database → score matches by historical performance.
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.memecoins.dexscreener_client import DexScreenerClient
from src.memecoins.helius_client import HeliusClient
from src.models.db import (
    AnalyzedWallet,
    CrossReferenceCheck,
    WalletTokenEntry,
)

logger = logging.getLogger(__name__)

# How many buyers to scan from the new token
SCAN_BUYERS = 200
PAGE_SIZE = 100

# Excluded system addresses
EXCLUDED_ADDRESSES = {
    "11111111111111111111111111111111",
    "So11111111111111111111111111111111111111112",
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
}


class CrossReferenceChecker:
    """Check a token's buyers against the analyzed_wallets database."""

    def __init__(
        self,
        session: AsyncSession,
        helius: HeliusClient | None = None,
        dex: DexScreenerClient | None = None,
    ):
        self.session = session
        self.helius = helius or HeliusClient()
        self.dex = dex or DexScreenerClient()

    async def check_token(self, mint: str) -> dict:
        """Check a new token's buyers against our wallet database.

        Returns dict with token info, matches, and scoring.
        """
        # Get token metadata
        token_symbol = None
        token_name = None
        market_cap = None
        try:
            pairs = await self.dex.get_token_pairs(mint)
            if pairs:
                best = pairs[0]
                token_symbol = best.get("baseToken", {}).get("symbol")
                token_name = best.get("baseToken", {}).get("name")
                market_cap = best.get("marketCap") or best.get("fdv")
        except Exception as e:
            logger.warning(f"DexScreener fetch failed for {mint}: {e}")

        # Fetch first ~200 buyers of the new token
        buyer_addresses = await self._fetch_buyers(mint)

        if not buyer_addresses:
            # Save check even with no results
            check = CrossReferenceCheck(
                mint_address=mint,
                token_symbol=token_symbol,
                token_name=token_name,
                buyers_scanned=0,
                matches_found=0,
            )
            self.session.add(check)
            await self.session.commit()

            return {
                "mintAddress": mint,
                "tokenSymbol": token_symbol,
                "tokenName": token_name,
                "marketCapUsd": float(market_cap) if market_cap else None,
                "buyersScanned": 0,
                "matches": [],
            }

        # Query analyzed_wallets for matches
        result = await self.session.execute(
            select(AnalyzedWallet).where(
                AnalyzedWallet.address.in_(list(buyer_addresses.keys()))
            )
        )
        matched_wallets = result.scalars().all()

        # Build match data with scoring
        matches = []
        for wallet in matched_wallets:
            # Get all their past token entries
            entries_result = await self.session.execute(
                select(WalletTokenEntry)
                .where(WalletTokenEntry.wallet_id == wallet.id)
                .order_by(WalletTokenEntry.entry_rank)
            )
            entries = entries_result.scalars().all()

            # Score: more early entries on successful tokens = higher signal
            score = self._compute_match_score(wallet, entries)

            past_tokens = [
                {
                    "mintAddress": e.mint_address,
                    "tokenSymbol": e.token_symbol,
                    "entryRank": e.entry_rank,
                    "tokenPeakMcap": float(e.token_peak_mcap) if e.token_peak_mcap else None,
                    "amountSol": float(e.amount_sol) if e.amount_sol else None,
                }
                for e in entries
            ]

            buyer_info = buyer_addresses.get(wallet.address, {})

            matches.append({
                "address": wallet.address,
                "score": round(score, 2),
                "entryRank": buyer_info.get("entry_rank"),
                "solBalance": float(wallet.sol_balance) if wallet.sol_balance else None,
                "totalTxCount": wallet.total_tx_count,
                "tags": wallet.tags or [],
                "pastTokens": past_tokens,
                "pastTokenCount": len(entries),
            })

        # Sort by score descending
        matches.sort(key=lambda m: m["score"], reverse=True)

        top_score = matches[0]["score"] if matches else None

        # Log the check
        check = CrossReferenceCheck(
            mint_address=mint,
            token_symbol=token_symbol,
            token_name=token_name,
            buyers_scanned=len(buyer_addresses),
            matches_found=len(matches),
            top_match_score=Decimal(str(top_score)) if top_score is not None else None,
            results=[
                {"address": m["address"], "score": m["score"], "past_tokens": m["pastTokenCount"]}
                for m in matches
            ],
        )
        self.session.add(check)
        await self.session.commit()

        return {
            "mintAddress": mint,
            "tokenSymbol": token_symbol,
            "tokenName": token_name,
            "marketCapUsd": float(market_cap) if market_cap else None,
            "buyersScanned": len(buyer_addresses),
            "matches": matches,
        }

    async def _fetch_buyers(self, mint: str) -> dict[str, dict]:
        """Fetch first N buyer wallets of a token. Returns {address: info}."""
        buyers: dict[str, dict] = {}
        last_sig = None
        rank = 0

        for page in range(SCAN_BUYERS // PAGE_SIZE + 1):
            if len(buyers) >= SCAN_BUYERS:
                break

            try:
                txs = await self.helius.get_wallet_transactions(
                    mint, limit=PAGE_SIZE, before=last_sig
                )
            except Exception as e:
                logger.warning(f"Failed to fetch buyers page {page} for {mint}: {e}")
                break

            if not txs:
                break

            for tx in txs:
                if len(buyers) >= SCAN_BUYERS:
                    break

                fee_payer = tx.get("feePayer", "")
                if (
                    not fee_payer
                    or fee_payer in buyers
                    or fee_payer in EXCLUDED_ADDRESSES
                ):
                    continue

                tx_type = tx.get("type", "")
                if tx_type not in ("SWAP", "TRANSFER"):
                    continue

                rank += 1
                buyers[fee_payer] = {
                    "entry_rank": rank,
                    "tx_signature": tx.get("signature", ""),
                }

            if txs:
                last_sig = txs[-1].get("signature")

        return buyers

    @staticmethod
    def _compute_match_score(wallet: AnalyzedWallet, entries: list[WalletTokenEntry]) -> float:
        """Score a matched wallet (0-100).

        Factors:
        - Number of past early entries (40%): more = better
        - Average entry rank (30%): lower rank = better
        - Wallet balance (15%): higher = more serious trader
        - Activity level (15%): more txs = more experienced
        """
        if not entries:
            return 0.0

        # Entry count score (40 pts max)
        entry_count = len(entries)
        entry_score = min(entry_count * 10, 40.0)

        # Avg rank score (30 pts max)
        avg_rank = sum(e.entry_rank for e in entries) / entry_count
        rank_score = max(0, 30.0 - (avg_rank - 1) * 0.6)

        # Balance score (15 pts max)
        sol = float(wallet.sol_balance) if wallet.sol_balance else 0
        if sol >= 100:
            bal_score = 15.0
        elif sol >= 10:
            bal_score = 10.0
        elif sol >= 1:
            bal_score = 5.0
        else:
            bal_score = 0.0

        # Activity score (15 pts max)
        tx_count = wallet.total_tx_count or 0
        if tx_count >= 1000:
            act_score = 15.0
        elif tx_count >= 100:
            act_score = 10.0
        elif tx_count >= 10:
            act_score = 5.0
        else:
            act_score = 0.0

        return min(entry_score + rank_score + bal_score + act_score, 100.0)

    async def list_checks(self, limit: int = 50) -> list[dict]:
        """List past cross-reference checks."""
        result = await self.session.execute(
            select(CrossReferenceCheck)
            .order_by(CrossReferenceCheck.checked_at.desc())
            .limit(min(limit, 200))
        )
        checks = result.scalars().all()

        return [
            {
                "id": c.id,
                "mintAddress": c.mint_address,
                "tokenSymbol": c.token_symbol,
                "tokenName": c.token_name,
                "buyersScanned": c.buyers_scanned,
                "matchesFound": c.matches_found,
                "topMatchScore": float(c.top_match_score) if c.top_match_score else None,
                "checkedAt": c.checked_at.isoformat(),
            }
            for c in checks
        ]
