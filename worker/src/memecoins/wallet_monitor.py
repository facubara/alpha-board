"""Wallet activity monitor via Helius webhooks.

Handles incoming webhook events for watched wallet swap activity,
enriches with DexScreener data, and broadcasts via SSE.
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.events import event_bus
from src.memecoins.dexscreener_client import DexScreenerClient
from src.memecoins.helius_client import HeliusClient
from src.models.db import AnalyzedWallet, WalletTokenEntry, WatchWallet, WatchWalletActivity

logger = logging.getLogger(__name__)

# Known DEX program IDs for swap detection
SWAP_PROGRAMS = {
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",  # Jupiter v6
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",  # Raydium AMM
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",  # PumpSwap
}

SOL_MINT = "So11111111111111111111111111111111111111112"


class WalletMonitor:
    """Handles Helius webhook events and manages wallet monitoring."""

    def __init__(
        self,
        session: AsyncSession,
        helius: HeliusClient | None = None,
        dex: DexScreenerClient | None = None,
    ):
        self.session = session
        self.helius = helius or HeliusClient()
        self.dex = dex or DexScreenerClient()

    async def handle_webhook(self, events: list[dict]) -> dict:
        """Process a batch of Helius webhook events.

        Always returns quickly — errors logged, never raised.
        Returns summary of processed events.
        """
        processed = 0
        errors = 0

        for event in events:
            try:
                result = await self._process_event(event)
                if result:
                    processed += 1
            except Exception as e:
                logger.warning(f"Failed to process webhook event: {e}")
                errors += 1

        await self.session.commit()

        return {"processed": processed, "errors": errors, "total": len(events)}

    async def _process_event(self, event: dict) -> bool:
        """Process a single enhanced transaction event.

        Returns True if activity was recorded.
        """
        fee_payer = event.get("feePayer", "")
        if not fee_payer:
            return False

        # Check if this wallet is one we're watching
        result = await self.session.execute(
            select(WatchWallet).where(
                WatchWallet.address == fee_payer,
                WatchWallet.is_active == True,  # noqa: E712
            )
        )
        wallet = result.scalar_one_or_none()
        if not wallet:
            return False

        # Parse swap details from token transfers
        tx_type = event.get("type", "")
        if tx_type != "SWAP":
            return False

        signature = event.get("signature", "")
        if not signature:
            return False

        # Extract token transfers
        token_transfers = event.get("tokenTransfers", [])
        if not token_transfers:
            return False

        # Determine direction and token
        token_mint = ""
        direction = "buy"
        amount_sol = Decimal("0")

        for transfer in token_transfers:
            mint = transfer.get("mint", "")
            if mint == SOL_MINT:
                raw = transfer.get("tokenAmount", 0)
                amount_sol = Decimal(str(raw))
            elif mint:
                token_mint = mint
                # If wallet is sending the token, it's a sell
                if transfer.get("fromUserAccount") == fee_payer:
                    direction = "sell"
                else:
                    direction = "buy"

        if not token_mint:
            return False

        # Enrich with DexScreener data
        token_symbol = ""
        token_name = ""
        price_usd = None
        try:
            pairs = await self.dex.get_token_pairs(token_mint)
            if pairs:
                best = pairs[0]
                token_symbol = best.get("baseToken", {}).get("symbol", "")
                token_name = best.get("baseToken", {}).get("name", "")
                price_str = best.get("priceUsd")
                if price_str:
                    price_usd = Decimal(str(price_str))
        except Exception as e:
            logger.debug(f"DexScreener enrichment failed for {token_mint}: {e}")

        # Parse block time
        block_time_unix = event.get("timestamp", 0)
        block_time = datetime.fromtimestamp(block_time_unix, tz=timezone.utc) if block_time_unix else datetime.now(timezone.utc)

        # Insert activity (ON CONFLICT DO NOTHING for idempotency)
        stmt = pg_insert(WatchWalletActivity).values(
            wallet_id=wallet.id,
            token_mint=token_mint,
            token_symbol=token_symbol,
            token_name=token_name,
            direction=direction,
            amount_sol=amount_sol,
            price_usd=price_usd,
            tx_signature=signature,
            block_time=block_time,
        ).on_conflict_do_nothing(index_elements=["tx_signature"])

        result = await self.session.execute(stmt)
        if not result.rowcount:
            return False  # Duplicate

        # Broadcast via SSE
        await event_bus.publish("memecoins", {
            "type": "wallet_activity",
            "wallet": {
                "address": wallet.address,
                "label": wallet.label,
                "score": float(wallet.score),
            },
            "trade": {
                "tokenMint": token_mint,
                "tokenSymbol": token_symbol,
                "tokenName": token_name,
                "direction": direction,
                "amountSol": float(amount_sol),
                "priceUsd": float(price_usd) if price_usd else None,
                "txSignature": signature,
                "blockTime": block_time.isoformat(),
            },
        })

        # Fire notification if wallet is in analyzed_wallets DB and direction is buy
        if direction == "buy":
            try:
                analyzed_result = await self.session.execute(
                    select(AnalyzedWallet).where(AnalyzedWallet.address == fee_payer)
                )
                analyzed_wallet = analyzed_result.scalar_one_or_none()
                if analyzed_wallet:
                    # Count past early entries
                    from sqlalchemy import func as sa_func
                    hits_result = await self.session.execute(
                        select(sa_func.count()).select_from(WalletTokenEntry).where(
                            WalletTokenEntry.wallet_id == analyzed_wallet.id
                        )
                    )
                    past_hits = hits_result.scalar() or 0

                    from src.notifications.models import MemecoinBuyEvent
                    from src.notifications.service import NotificationService

                    svc = NotificationService(self.session)
                    await svc.notify_memecoin_buy(MemecoinBuyEvent(
                        wallet_address=fee_payer,
                        wallet_label=wallet.label,
                        wallet_score=float(wallet.score),
                        token_symbol=token_symbol,
                        token_name=token_name,
                        token_mint=token_mint,
                        amount_sol=amount_sol,
                        price_usd=price_usd,
                        past_hits=past_hits,
                        tx_signature=signature,
                    ))
            except Exception as e:
                logger.debug(f"Memecoin buy notification failed: {e}")

        return True

    async def sync_webhooks(self) -> dict:
        """Register webhooks for all active watched wallets.

        Called on startup and periodically to keep webhooks in sync.
        """
        result = await self.session.execute(
            select(WatchWallet.address).where(WatchWallet.is_active == True)  # noqa: E712
        )
        addresses = [row[0] for row in result.all()]

        if not addresses:
            return {"registered": 0, "addresses": 0}

        from src.config import settings

        webhook_url = f"https://alpha-worker.fly.dev/webhooks/helius/wallet-activity"
        try:
            webhook_id = await self.helius.register_webhook(addresses, webhook_url)
            logger.info(f"Registered Helius webhook for {len(addresses)} wallets: {webhook_id}")
            return {"registered": 1, "addresses": len(addresses), "webhook_id": webhook_id}
        except Exception as e:
            logger.error(f"Failed to register Helius webhook: {e}")
            return {"registered": 0, "addresses": len(addresses), "error": str(e)}
