"""Authenticated Binance trading client for copy-trade execution.

Separate from the read-only client.py — this one signs requests
with HMAC-SHA256 and can place real orders.
"""

import hashlib
import hmac
import logging
import time
from decimal import Decimal
from typing import Any
from urllib.parse import urlencode

import httpx

logger = logging.getLogger(__name__)

SPOT_BASE = "https://api.binance.com"
FUTURES_BASE = "https://fapi.binance.com"


class BinanceTradingClient:
    """Authenticated Binance client for order execution."""

    def __init__(self, api_key: str, api_secret: str) -> None:
        self._api_key = api_key
        self._api_secret = api_secret

    def _sign(self, params: dict[str, Any]) -> dict[str, Any]:
        """Add timestamp and HMAC-SHA256 signature to params."""
        params["timestamp"] = int(time.time() * 1000)
        query = urlencode(params)
        signature = hmac.new(
            self._api_secret.encode(), query.encode(), hashlib.sha256
        ).hexdigest()
        params["signature"] = signature
        return params

    def _headers(self) -> dict[str, str]:
        return {"X-MBX-APIKEY": self._api_key}

    # ------------------------------------------------------------------
    # Connectivity test
    # ------------------------------------------------------------------

    async def test_connectivity(self) -> dict[str, Any]:
        """Validate API key by querying account info. Returns account permissions."""
        params = self._sign({})
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{SPOT_BASE}/api/v3/account",
                params=params,
                headers=self._headers(),
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "canTrade": data.get("canTrade", False),
                "canWithdraw": data.get("canWithdraw", False),
                "accountType": data.get("accountType"),
            }

    # ------------------------------------------------------------------
    # Spot orders
    # ------------------------------------------------------------------

    async def place_spot_order(
        self, symbol: str, side: str, quote_qty: Decimal
    ) -> dict[str, Any]:
        """Place a MARKET spot order using quoteOrderQty (spend X USDT)."""
        params = self._sign({
            "symbol": symbol,
            "side": side.upper(),
            "type": "MARKET",
            "quoteOrderQty": str(quote_qty),
        })
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{SPOT_BASE}/api/v3/order",
                params=params,
                headers=self._headers(),
            )
            resp.raise_for_status()
            return resp.json()

    # ------------------------------------------------------------------
    # Futures orders
    # ------------------------------------------------------------------

    async def set_leverage(self, symbol: str, leverage: int) -> dict[str, Any]:
        """Set leverage for a futures symbol."""
        params = self._sign({
            "symbol": symbol,
            "leverage": leverage,
        })
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{FUTURES_BASE}/fapi/v1/leverage",
                params=params,
                headers=self._headers(),
            )
            resp.raise_for_status()
            return resp.json()

    async def place_futures_order(
        self,
        symbol: str,
        side: str,
        quantity: Decimal,
        leverage: int = 1,
    ) -> dict[str, Any]:
        """Set leverage then place a MARKET futures order."""
        await self.set_leverage(symbol, leverage)

        params = self._sign({
            "symbol": symbol,
            "side": side.upper(),
            "type": "MARKET",
            "quantity": str(quantity),
        })
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{FUTURES_BASE}/fapi/v1/order",
                params=params,
                headers=self._headers(),
            )
            resp.raise_for_status()
            return resp.json()

    async def place_futures_stop_loss(
        self, symbol: str, side: str, stop_price: Decimal, quantity: Decimal
    ) -> dict[str, Any]:
        """Place a STOP_MARKET order (futures stop-loss)."""
        params = self._sign({
            "symbol": symbol,
            "side": side.upper(),
            "type": "STOP_MARKET",
            "stopPrice": str(stop_price),
            "quantity": str(quantity),
            "closePosition": "false",
        })
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{FUTURES_BASE}/fapi/v1/order",
                params=params,
                headers=self._headers(),
            )
            resp.raise_for_status()
            return resp.json()

    async def place_futures_take_profit(
        self, symbol: str, side: str, stop_price: Decimal, quantity: Decimal
    ) -> dict[str, Any]:
        """Place a TAKE_PROFIT_MARKET order."""
        params = self._sign({
            "symbol": symbol,
            "side": side.upper(),
            "type": "TAKE_PROFIT_MARKET",
            "stopPrice": str(stop_price),
            "quantity": str(quantity),
            "closePosition": "false",
        })
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{FUTURES_BASE}/fapi/v1/order",
                params=params,
                headers=self._headers(),
            )
            resp.raise_for_status()
            return resp.json()
