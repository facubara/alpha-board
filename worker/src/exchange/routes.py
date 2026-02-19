"""Exchange API routes for copy-trade execution and settings management."""

import logging
from decimal import Decimal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from src.config import settings
from src.db import async_session
from src.exchange.crypto import encrypt, decrypt
from src.exchange.trading import BinanceTradingClient
from src.models.db import ExchangeSettings, TradeExecution

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/exchange", tags=["exchange"])


# ------------------------------------------------------------------
# Request / Response models
# ------------------------------------------------------------------


class SaveSettingsRequest(BaseModel):
    api_key: str
    api_secret: str
    trading_mode: str = "futures"
    default_leverage: int = 1
    max_position_usd: float = 100.0
    enabled: bool = True


class ExecuteTradeRequest(BaseModel):
    symbol: str
    direction: str  # "long" | "short"
    size_usd: float
    stop_loss: float | None = None
    take_profit: float | None = None


def _mask(value: str) -> str:
    """Mask a key for display: show first 4 + last 4 chars."""
    if len(value) <= 8:
        return "****"
    return f"{value[:4]}...{value[-4:]}"


def _require_encryption_key() -> None:
    if not settings.exchange_encryption_key:
        raise HTTPException(
            status_code=500,
            detail="EXCHANGE_ENCRYPTION_KEY not configured on worker",
        )


# ------------------------------------------------------------------
# GET /exchange/settings
# ------------------------------------------------------------------


@router.get("/settings")
async def get_settings():
    """Return exchange settings with masked keys."""
    async with async_session() as session:
        result = await session.execute(
            select(ExchangeSettings).where(ExchangeSettings.id == 1)
        )
        row = result.scalar_one_or_none()

        if not row:
            return {"configured": False}

        masked_key = ""
        if row.encrypted_api_key:
            try:
                _require_encryption_key()
                masked_key = _mask(decrypt(row.encrypted_api_key))
            except Exception:
                masked_key = "****"

        return {
            "configured": True,
            "enabled": row.enabled,
            "maskedApiKey": masked_key,
            "tradingMode": row.trading_mode,
            "defaultLeverage": row.default_leverage,
            "maxPositionUsd": float(row.max_position_usd),
            "updatedAt": row.updated_at.isoformat(),
        }


# ------------------------------------------------------------------
# POST /exchange/settings
# ------------------------------------------------------------------


@router.post("/settings")
async def save_settings(req: SaveSettingsRequest):
    """Save or update exchange API keys + preferences."""
    _require_encryption_key()

    if req.trading_mode not in ("spot", "futures", "both"):
        raise HTTPException(status_code=400, detail="trading_mode must be spot, futures, or both")
    if req.max_position_usd <= 0:
        raise HTTPException(status_code=400, detail="max_position_usd must be positive")
    if req.default_leverage < 1 or req.default_leverage > 125:
        raise HTTPException(status_code=400, detail="default_leverage must be 1-125")

    encrypted_key = encrypt(req.api_key)
    encrypted_secret = encrypt(req.api_secret)

    async with async_session() as session:
        result = await session.execute(
            select(ExchangeSettings).where(ExchangeSettings.id == 1)
        )
        row = result.scalar_one_or_none()

        if row:
            row.encrypted_api_key = encrypted_key
            row.encrypted_api_secret = encrypted_secret
            row.trading_mode = req.trading_mode
            row.default_leverage = req.default_leverage
            row.max_position_usd = Decimal(str(req.max_position_usd))
            row.enabled = req.enabled
        else:
            row = ExchangeSettings(
                id=1,
                encrypted_api_key=encrypted_key,
                encrypted_api_secret=encrypted_secret,
                trading_mode=req.trading_mode,
                default_leverage=req.default_leverage,
                max_position_usd=Decimal(str(req.max_position_usd)),
                enabled=req.enabled,
            )
            session.add(row)

        await session.commit()

    return {
        "status": "saved",
        "maskedApiKey": _mask(req.api_key),
        "enabled": req.enabled,
    }


# ------------------------------------------------------------------
# DELETE /exchange/settings
# ------------------------------------------------------------------


@router.delete("/settings")
async def delete_settings():
    """Remove stored API keys."""
    async with async_session() as session:
        result = await session.execute(
            select(ExchangeSettings).where(ExchangeSettings.id == 1)
        )
        row = result.scalar_one_or_none()
        if row:
            await session.delete(row)
            await session.commit()
    return {"status": "deleted"}


# ------------------------------------------------------------------
# POST /exchange/test
# ------------------------------------------------------------------


@router.post("/test")
async def test_connection():
    """Test Binance API key validity."""
    _require_encryption_key()

    async with async_session() as session:
        result = await session.execute(
            select(ExchangeSettings).where(ExchangeSettings.id == 1)
        )
        row = result.scalar_one_or_none()

    if not row or not row.encrypted_api_key:
        raise HTTPException(status_code=400, detail="No API keys configured")

    try:
        api_key = decrypt(row.encrypted_api_key)
        api_secret = decrypt(row.encrypted_api_secret)
        client = BinanceTradingClient(api_key, api_secret)
        info = await client.test_connectivity()
        return {"success": True, **info}
    except Exception as e:
        logger.exception("Binance API test failed")
        return {"success": False, "error": str(e)}


# ------------------------------------------------------------------
# POST /exchange/execute
# ------------------------------------------------------------------


@router.post("/execute")
async def execute_trade(req: ExecuteTradeRequest):
    """Execute a copy trade on Binance."""
    _require_encryption_key()

    # Load settings
    async with async_session() as session:
        result = await session.execute(
            select(ExchangeSettings).where(ExchangeSettings.id == 1)
        )
        es = result.scalar_one_or_none()

    if not es or not es.encrypted_api_key:
        raise HTTPException(status_code=400, detail="Exchange not configured")
    if not es.enabled:
        raise HTTPException(status_code=400, detail="Exchange trading is disabled")

    # Safety: cap position size
    size = min(req.size_usd, float(es.max_position_usd))
    if size <= 0:
        raise HTTPException(status_code=400, detail="Invalid size")

    # Determine market
    direction = req.direction.lower()
    if direction not in ("long", "short"):
        raise HTTPException(status_code=400, detail="direction must be long or short")

    # Shorts require futures
    if direction == "short" and es.trading_mode == "spot":
        raise HTTPException(status_code=400, detail="Cannot short in spot-only mode")

    use_futures = direction == "short" or es.trading_mode in ("futures", "both")
    market = "futures" if use_futures else "spot"
    side = "BUY" if direction == "long" else "SELL"

    # Decrypt keys and execute
    api_key = decrypt(es.encrypted_api_key)
    api_secret = decrypt(es.encrypted_api_secret)
    client = BinanceTradingClient(api_key, api_secret)

    execution = TradeExecution(
        symbol=req.symbol.upper(),
        direction=direction,
        market=market,
        quote_qty=Decimal(str(size)),
        leverage=es.default_leverage if use_futures else None,
        status="pending",
    )

    try:
        if use_futures:
            resp = await client.place_futures_order(
                symbol=req.symbol.upper(),
                side=side,
                quantity=Decimal(str(size)),
                leverage=es.default_leverage,
            )
        else:
            resp = await client.place_spot_order(
                symbol=req.symbol.upper(),
                side=side,
                quote_qty=Decimal(str(size)),
            )

        execution.binance_order_id = str(resp.get("orderId", ""))
        execution.status = "filled"
        execution.response = resp
        logger.info(f"Copy trade executed: {req.symbol} {direction} ${size} → {resp.get('orderId')}")

        # Place SL/TP if futures
        sl_resp = None
        tp_resp = None
        if use_futures:
            close_side = "SELL" if direction == "long" else "BUY"
            qty = Decimal(str(resp.get("executedQty", "0")))
            if req.stop_loss and qty > 0:
                try:
                    sl_resp = await client.place_futures_stop_loss(
                        req.symbol.upper(), close_side, Decimal(str(req.stop_loss)), qty
                    )
                except Exception as e:
                    logger.warning(f"SL order failed: {e}")
            if req.take_profit and qty > 0:
                try:
                    tp_resp = await client.place_futures_take_profit(
                        req.symbol.upper(), close_side, Decimal(str(req.take_profit)), qty
                    )
                except Exception as e:
                    logger.warning(f"TP order failed: {e}")

    except Exception as e:
        execution.status = "error"
        execution.error = str(e)
        logger.exception(f"Copy trade failed: {req.symbol} {direction}")

    # Save audit log
    async with async_session() as session:
        session.add(execution)
        await session.commit()

    if execution.status == "error":
        raise HTTPException(status_code=502, detail=execution.error or "Order failed")

    return {
        "status": "filled",
        "orderId": execution.binance_order_id,
        "symbol": execution.symbol,
        "direction": execution.direction,
        "market": execution.market,
        "size": float(execution.quote_qty),
        "slOrderId": sl_resp.get("orderId") if sl_resp else None,
        "tpOrderId": tp_resp.get("orderId") if tp_resp else None,
    }
