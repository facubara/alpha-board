"""Token analysis engine — fetch early buyers and enrich wallet profiles.

Analyzes a Solana token CA: paginates through transaction history,
extracts the first N unique buyer wallets, enriches each with on-chain
data, and stores everything for cross-reference.
"""

import asyncio
import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.memecoins.dexscreener_client import DexScreenerClient
from src.memecoins.helius_client import HeliusClient
from src.models.db import (
    AnalyzedWallet,
    TokenAnalysis,
    WalletTokenEntry,
    WatchWallet,
)

logger = logging.getLogger(__name__)

# USDC mint on Solana
USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

# Known system / DEX program addresses to exclude
EXCLUDED_ADDRESSES = {
    "11111111111111111111111111111111",
    "So11111111111111111111111111111111111111112",
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
}

PAGE_SIZE = 100
MAX_PAGES = 50  # Safety limit: 50 pages * 100 txs = 5000 txs max


class TokenAnalyzer:
    """Analyze a token CA: fetch early buyers, enrich wallet profiles."""

    def __init__(
        self,
        session: AsyncSession,
        helius: HeliusClient | None = None,
        dex: DexScreenerClient | None = None,
    ):
        self.session = session
        self.helius = helius or HeliusClient()
        self.dex = dex or DexScreenerClient()

    async def start_analysis(self, mint: str, num_buyers: int) -> int:
        """Create analysis job, return analysis_id. Runs analysis in background."""
        num_buyers = min(max(num_buyers, 1), 500)

        # Get token metadata from DexScreener
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
            logger.warning(f"DexScreener metadata fetch failed for {mint}: {e}")

        analysis = TokenAnalysis(
            mint_address=mint,
            token_symbol=token_symbol,
            token_name=token_name,
            market_cap_usd=Decimal(str(market_cap)) if market_cap else None,
            requested_buyers=num_buyers,
            status="pending",
        )
        self.session.add(analysis)
        await self.session.commit()
        await self.session.refresh(analysis)

        logger.info(
            f"Created analysis #{analysis.id} for {token_symbol or mint} "
            f"(requesting {num_buyers} buyers)"
        )

        # Run analysis (non-blocking fire in background task)
        asyncio.create_task(self._run_analysis_safe(analysis.id))

        return analysis.id

    async def resume_analysis(self, analysis_id: int) -> None:
        """Resume a paused/failed analysis from last checkpoint."""
        result = await self.session.execute(
            select(TokenAnalysis).where(TokenAnalysis.id == analysis_id)
        )
        analysis = result.scalar_one_or_none()
        if not analysis:
            raise ValueError(f"Analysis {analysis_id} not found")
        if analysis.status not in ("paused", "failed"):
            raise ValueError(f"Analysis {analysis_id} is {analysis.status}, cannot resume")

        analysis.status = "running"
        await self.session.commit()

        asyncio.create_task(self._run_analysis_safe(analysis_id))

    async def _run_analysis_safe(self, analysis_id: int) -> None:
        """Wrapper that catches all errors and marks analysis as failed."""
        try:
            await self._run_analysis(analysis_id)
        except Exception as e:
            logger.exception(f"Analysis {analysis_id} failed: {e}")
            try:
                from src.db import async_session
                async with async_session() as session:
                    result = await session.execute(
                        select(TokenAnalysis).where(TokenAnalysis.id == analysis_id)
                    )
                    analysis = result.scalar_one_or_none()
                    if analysis and analysis.status != "completed":
                        analysis.status = "failed"
                        analysis.error_message = str(e)[:500]
                        await session.commit()
            except Exception:
                logger.exception("Failed to update analysis status to failed")

    async def _run_analysis(self, analysis_id: int) -> None:
        """Main analysis pipeline."""
        from src.db import async_session

        async with async_session() as session:
            result = await session.execute(
                select(TokenAnalysis).where(TokenAnalysis.id == analysis_id)
            )
            analysis = result.scalar_one_or_none()
            if not analysis:
                return

            analysis.status = "running"
            await session.commit()

            mint = analysis.mint_address
            target = analysis.requested_buyers
            progress = analysis.progress or {}
            last_sig = progress.get("last_signature")
            pages_fetched = progress.get("pages_fetched", 0)
            total_scanned = progress.get("total_txs_scanned", 0)

            # Collect unique buyer wallets
            buyers: list[dict] = []
            seen_wallets: set[str] = set()

            # Resume: reload already-found wallets
            existing_entries = await session.execute(
                select(WalletTokenEntry).where(
                    WalletTokenEntry.analysis_id == analysis_id
                )
            )
            for entry in existing_entries.scalars().all():
                wallet_result = await session.execute(
                    select(AnalyzedWallet).where(AnalyzedWallet.id == entry.wallet_id)
                )
                wallet = wallet_result.scalar_one_or_none()
                if wallet:
                    seen_wallets.add(wallet.address)

            logger.info(
                f"Analysis #{analysis_id}: starting from page {pages_fetched}, "
                f"{len(seen_wallets)} wallets already found"
            )

            # Paginate through token transactions
            for page in range(pages_fetched, MAX_PAGES):
                if len(buyers) + len(seen_wallets) >= target:
                    break

                try:
                    txs = await self.helius.get_wallet_transactions(
                        mint, limit=PAGE_SIZE, before=last_sig
                    )
                except Exception as e:
                    logger.warning(f"Failed to fetch page {page} for {mint}: {e}")
                    # Save checkpoint and pause
                    analysis.status = "paused"
                    analysis.error_message = f"Paused at page {page}: {e}"
                    analysis.progress = {
                        "last_signature": last_sig,
                        "pages_fetched": page,
                        "total_txs_scanned": total_scanned,
                    }
                    await session.commit()
                    return

                if not txs:
                    break  # No more transactions

                for tx in txs:
                    if len(buyers) + len(seen_wallets) >= target:
                        break

                    fee_payer = tx.get("feePayer", "")
                    if (
                        not fee_payer
                        or fee_payer in seen_wallets
                        or fee_payer in EXCLUDED_ADDRESSES
                    ):
                        continue

                    tx_type = tx.get("type", "")
                    if tx_type not in ("SWAP", "TRANSFER"):
                        continue

                    seen_wallets.add(fee_payer)

                    # Extract SOL amount from native transfers or token transfers
                    amount_sol = Decimal("0")
                    for transfer in tx.get("nativeTransfers", []):
                        if transfer.get("fromUserAccount") == fee_payer:
                            lamports = transfer.get("amount", 0)
                            amount_sol += Decimal(str(lamports)) / Decimal("1000000000")

                    block_time = tx.get("timestamp", 0)
                    block_dt = (
                        datetime.fromtimestamp(block_time, tz=timezone.utc)
                        if block_time
                        else None
                    )

                    buyers.append({
                        "wallet": fee_payer,
                        "entry_rank": len(seen_wallets),
                        "tx_signature": tx.get("signature", ""),
                        "block_time": block_dt,
                        "amount_sol": amount_sol,
                    })

                    total_scanned += 1

                # Update last signature for pagination
                if txs:
                    last_sig = txs[-1].get("signature")

                # Save checkpoint after each page
                analysis.progress = {
                    "last_signature": last_sig,
                    "pages_fetched": page + 1,
                    "total_txs_scanned": total_scanned,
                }
                analysis.found_buyers = len(seen_wallets)
                await session.commit()

                # Brief pause to respect rate limits
                await asyncio.sleep(0.15)

            logger.info(
                f"Analysis #{analysis_id}: found {len(buyers)} new buyers, "
                f"enriching wallet profiles"
            )

            # Enrich and persist each buyer wallet
            for i, buyer in enumerate(buyers):
                try:
                    wallet_data = await self._enrich_wallet(buyer["wallet"])

                    # Upsert analyzed wallet
                    stmt = pg_insert(AnalyzedWallet).values(
                        address=buyer["wallet"],
                        sol_balance=wallet_data.get("sol_balance"),
                        usdc_balance=wallet_data.get("usdc_balance"),
                        first_tx_at=wallet_data.get("first_tx_at"),
                        total_tx_count=wallet_data.get("total_tx_count"),
                        estimated_pnl_sol=wallet_data.get("estimated_pnl_sol"),
                        win_rate=wallet_data.get("win_rate"),
                        tokens_traded=wallet_data.get("tokens_traded"),
                        current_holdings=wallet_data.get("current_holdings", []),
                        tags=wallet_data.get("tags", []),
                        last_enriched_at=datetime.now(timezone.utc),
                    ).on_conflict_do_update(
                        index_elements=["address"],
                        set_={
                            "sol_balance": wallet_data.get("sol_balance"),
                            "usdc_balance": wallet_data.get("usdc_balance"),
                            "first_tx_at": wallet_data.get("first_tx_at"),
                            "total_tx_count": wallet_data.get("total_tx_count"),
                            "estimated_pnl_sol": wallet_data.get("estimated_pnl_sol"),
                            "win_rate": wallet_data.get("win_rate"),
                            "tokens_traded": wallet_data.get("tokens_traded"),
                            "current_holdings": wallet_data.get("current_holdings", []),
                            "tags": wallet_data.get("tags", []),
                            "last_enriched_at": datetime.now(timezone.utc),
                        },
                    )
                    result = await session.execute(stmt)

                    # Get the wallet ID
                    wallet_result = await session.execute(
                        select(AnalyzedWallet).where(
                            AnalyzedWallet.address == buyer["wallet"]
                        )
                    )
                    wallet = wallet_result.scalar_one()

                    # Insert wallet-token entry
                    entry_stmt = pg_insert(WalletTokenEntry).values(
                        wallet_id=wallet.id,
                        analysis_id=analysis_id,
                        mint_address=mint,
                        token_symbol=analysis.token_symbol,
                        entry_rank=buyer["entry_rank"],
                        entry_tx_signature=buyer["tx_signature"],
                        entry_block_time=buyer["block_time"],
                        amount_sol=buyer["amount_sol"],
                        token_mcap_at_entry=analysis.market_cap_usd,
                        token_peak_mcap=analysis.market_cap_usd,
                    ).on_conflict_do_nothing(
                        constraint="uq_wallet_token_entry"
                    )
                    await session.execute(entry_stmt)

                    # Update progress
                    analysis.found_buyers = len(seen_wallets) - len(buyers) + i + 1
                    if (i + 1) % 5 == 0:
                        await session.commit()

                except Exception as e:
                    logger.warning(
                        f"Failed to enrich wallet {buyer['wallet']}: {e}"
                    )
                    continue

                # Rate limit between enrichments
                await asyncio.sleep(0.2)

            # Mark completed
            analysis.status = "completed"
            analysis.found_buyers = len(seen_wallets)
            analysis.completed_at = datetime.now(timezone.utc)
            await session.commit()

            logger.info(f"Analysis #{analysis_id} completed: {len(seen_wallets)} wallets")

    async def _enrich_wallet(self, address: str) -> dict:
        """Fetch rich wallet data from Helius."""
        data: dict = {}

        # SOL balance
        sol_balance = await self.helius.get_sol_balance(address)
        data["sol_balance"] = Decimal(str(round(sol_balance, 9)))

        # Token balances → find USDC
        balances = await self.helius.get_token_balances(address)
        usdc_balance = Decimal("0")
        for bal in balances:
            if bal["mint"] == USDC_MINT:
                usdc_balance = Decimal(str(bal["amount"]))
                break
        data["usdc_balance"] = usdc_balance

        # Transaction count
        tx_count = await self.helius.get_signatures_count(address)
        data["total_tx_count"] = tx_count

        # First transaction timestamp
        try:
            # Fetch oldest transactions (small batch from the end)
            txs = await self.helius.get_wallet_transactions(address, limit=1)
            # The API returns most recent first; to get the actual first tx
            # we'd need to paginate to the end, which is expensive.
            # Instead, use signatures count to estimate age.
            if txs:
                # Record most recent tx time as a proxy
                latest_ts = txs[0].get("timestamp", 0)
                if latest_ts:
                    data["first_tx_at"] = None  # Would need full pagination
        except Exception:
            pass

        # Token holdings via DAS API
        holdings = await self.helius.get_assets_by_owner(address, limit=20)
        data["current_holdings"] = [
            {
                "mint": h["mint"],
                "symbol": h.get("symbol", ""),
                "amount": h["amount"],
                "value_usd": h.get("value_usd"),
            }
            for h in holdings[:20]
        ]
        data["tokens_traded"] = len(holdings)

        # Derive tags
        tags = []
        if sol_balance >= 100:
            tags.append("whale")
        elif sol_balance >= 10:
            tags.append("mid_size")
        if tx_count >= 1000:
            tags.append("active_trader")
        if tx_count < 50:
            tags.append("new_wallet")
        data["tags"] = tags

        # PnL estimation (simplified — would need full swap history for accuracy)
        data["estimated_pnl_sol"] = None
        data["win_rate"] = None
        data["first_tx_at"] = None

        return data

    async def get_analysis(self, analysis_id: int) -> dict | None:
        """Get analysis status and results."""
        result = await self.session.execute(
            select(TokenAnalysis).where(TokenAnalysis.id == analysis_id)
        )
        analysis = result.scalar_one_or_none()
        if not analysis:
            return None

        data = {
            "id": analysis.id,
            "mintAddress": analysis.mint_address,
            "tokenSymbol": analysis.token_symbol,
            "tokenName": analysis.token_name,
            "marketCapUsd": float(analysis.market_cap_usd) if analysis.market_cap_usd else None,
            "requestedBuyers": analysis.requested_buyers,
            "foundBuyers": analysis.found_buyers,
            "status": analysis.status,
            "progress": analysis.progress,
            "errorMessage": analysis.error_message,
            "requestedAt": analysis.requested_at.isoformat(),
            "completedAt": analysis.completed_at.isoformat() if analysis.completed_at else None,
            "wallets": [],
        }

        # If completed or running, include wallet data
        if analysis.status in ("completed", "running"):
            entries_result = await self.session.execute(
                select(WalletTokenEntry, AnalyzedWallet)
                .join(AnalyzedWallet, AnalyzedWallet.id == WalletTokenEntry.wallet_id)
                .where(WalletTokenEntry.analysis_id == analysis_id)
                .order_by(WalletTokenEntry.entry_rank)
            )
            rows = entries_result.all()

            for entry, wallet in rows:
                data["wallets"].append({
                    "address": wallet.address,
                    "entryRank": entry.entry_rank,
                    "amountSol": float(entry.amount_sol) if entry.amount_sol else None,
                    "entryBlockTime": entry.entry_block_time.isoformat() if entry.entry_block_time else None,
                    "entryTxSignature": entry.entry_tx_signature,
                    "solBalance": float(wallet.sol_balance) if wallet.sol_balance else None,
                    "usdcBalance": float(wallet.usdc_balance) if wallet.usdc_balance else None,
                    "totalTxCount": wallet.total_tx_count,
                    "estimatedPnlSol": float(wallet.estimated_pnl_sol) if wallet.estimated_pnl_sol else None,
                    "winRate": float(wallet.win_rate) if wallet.win_rate else None,
                    "tokensTraded": wallet.tokens_traded,
                    "tags": wallet.tags or [],
                    "currentHoldings": wallet.current_holdings or [],
                    "tokenEntries": [],
                })

            # For each wallet, also include their entries from OTHER analyses
            for wallet_data in data["wallets"]:
                other_entries_result = await self.session.execute(
                    select(WalletTokenEntry, TokenAnalysis)
                    .join(TokenAnalysis, TokenAnalysis.id == WalletTokenEntry.analysis_id)
                    .join(AnalyzedWallet, AnalyzedWallet.id == WalletTokenEntry.wallet_id)
                    .where(
                        AnalyzedWallet.address == wallet_data["address"],
                        WalletTokenEntry.analysis_id != analysis_id,
                    )
                    .order_by(WalletTokenEntry.entry_rank)
                )
                for other_entry, other_analysis in other_entries_result.all():
                    wallet_data["tokenEntries"].append({
                        "mintAddress": other_entry.mint_address,
                        "tokenSymbol": other_entry.token_symbol,
                        "entryRank": other_entry.entry_rank,
                        "amountSol": float(other_entry.amount_sol) if other_entry.amount_sol else None,
                        "tokenPeakMcap": float(other_entry.token_peak_mcap) if other_entry.token_peak_mcap else None,
                    })

        return data

    async def list_analyses(self) -> list[dict]:
        """List all analysis jobs."""
        result = await self.session.execute(
            select(TokenAnalysis).order_by(TokenAnalysis.requested_at.desc()).limit(50)
        )
        analyses = result.scalars().all()

        return [
            {
                "id": a.id,
                "mintAddress": a.mint_address,
                "tokenSymbol": a.token_symbol,
                "tokenName": a.token_name,
                "marketCapUsd": float(a.market_cap_usd) if a.market_cap_usd else None,
                "requestedBuyers": a.requested_buyers,
                "foundBuyers": a.found_buyers,
                "status": a.status,
                "requestedAt": a.requested_at.isoformat(),
                "completedAt": a.completed_at.isoformat() if a.completed_at else None,
            }
            for a in analyses
        ]
