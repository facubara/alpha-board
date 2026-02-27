"""Helius API client (free tier) for Solana token/wallet data.

Free tier: 1M credits/mo, 10 RPS.
Uses same httpx + semaphore + backoff pattern as TwitterClient.
"""

import asyncio
import json
import logging
from typing import Any

import httpx

from src.cache import cache_get, cache_set
from src.config import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://api.helius.xyz/v0"
RPC_URL = "https://mainnet.helius-rpc.com"
CACHE_TTL_SECONDS = 300  # 5 minutes


class HeliusAPIError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"Helius API error {status_code}: {message}")


class HeliusClient:
    """HTTP client for Helius API with rate limiting and caching."""

    MAX_CONCURRENT_REQUESTS = 5
    MAX_RETRIES = 3
    BASE_RETRY_DELAY = 1.0

    def __init__(self, api_key: str | None = None, timeout: float = 30.0):
        self.api_key = api_key or settings.helius_api_key
        self.timeout = timeout
        self._semaphore = asyncio.Semaphore(self.MAX_CONCURRENT_REQUESTS)

    async def _request(
        self,
        method: str,
        url: str,
        params: dict[str, Any] | None = None,
        json_body: dict[str, Any] | None = None,
    ) -> dict | list:
        """Make an authenticated request with retry logic."""
        if params is None:
            params = {}
        params["api-key"] = self.api_key

        for attempt in range(self.MAX_RETRIES + 1):
            async with self._semaphore:
                try:
                    async with httpx.AsyncClient(timeout=self.timeout) as client:
                        if method == "GET":
                            response = await client.get(url, params=params)
                        else:
                            response = await client.post(url, params=params, json=json_body)

                        if response.status_code == 200:
                            return response.json()

                        if response.status_code == 429:
                            if attempt < self.MAX_RETRIES:
                                delay = self.BASE_RETRY_DELAY * (2 ** attempt)
                                logger.warning(f"Helius rate limited, waiting {delay}s")
                                await asyncio.sleep(delay)
                                continue
                            raise HeliusAPIError(429, "Rate limit exceeded")

                        if response.status_code >= 500:
                            if attempt < self.MAX_RETRIES:
                                delay = self.BASE_RETRY_DELAY * (2 ** attempt)
                                logger.warning(
                                    f"Helius server error {response.status_code}, "
                                    f"retrying in {delay}s (attempt {attempt + 1})"
                                )
                                await asyncio.sleep(delay)
                                continue

                        raise HeliusAPIError(response.status_code, response.text[:200])

                except httpx.TimeoutException:
                    if attempt < self.MAX_RETRIES:
                        delay = self.BASE_RETRY_DELAY * (2 ** attempt)
                        logger.warning(f"Helius timeout, retrying in {delay}s")
                        await asyncio.sleep(delay)
                        continue
                    raise HeliusAPIError(0, "Request timeout after all retries")

                except httpx.RequestError as e:
                    if attempt < self.MAX_RETRIES:
                        delay = self.BASE_RETRY_DELAY * (2 ** attempt)
                        logger.warning(f"Helius request error: {e}, retrying in {delay}s")
                        await asyncio.sleep(delay)
                        continue
                    raise HeliusAPIError(0, f"Request failed: {e}")

        raise HeliusAPIError(0, "Max retries exceeded")

    async def get_token_metadata(self, mint: str) -> dict:
        """Get token metadata via DAS API (cached)."""
        cache_key = f"helius:meta:{mint}"
        cached = await cache_get(cache_key)
        if cached:
            return json.loads(cached)

        url = f"{RPC_URL}/?api-key={self.api_key}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json={
                    "jsonrpc": "2.0",
                    "id": "ab-meta",
                    "method": "getAsset",
                    "params": {"id": mint},
                },
            )
            data = response.json()
            result = data.get("result", {})

        try:
            await cache_set(cache_key, json.dumps(result), CACHE_TTL_SECONDS)
        except Exception:
            pass

        return result

    async def get_wallet_transactions(
        self, address: str, limit: int = 100, before: str | None = None
    ) -> list[dict]:
        """Get parsed transaction history for a wallet address.

        Args:
            address: Wallet or token mint address.
            limit: Max transactions per page (up to 100).
            before: Transaction signature to paginate from (exclusive).
        """
        url = f"{BASE_URL}/addresses/{address}/transactions"
        params: dict[str, Any] = {"limit": limit}
        if before:
            params["before"] = before
        result = await self._request("GET", url, params=params)
        return result if isinstance(result, list) else []

    async def get_token_holders(self, mint: str) -> list[dict]:
        """Get token holder list via DAS API."""
        url = f"{RPC_URL}/?api-key={self.api_key}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json={
                    "jsonrpc": "2.0",
                    "id": "ab-holders",
                    "method": "getTokenAccounts",
                    "params": {"mint": mint, "limit": 100},
                },
            )
            data = response.json()
            return data.get("result", {}).get("token_accounts", [])

    async def register_webhook(
        self, addresses: list[str], webhook_url: str
    ) -> str:
        """Register an enhanced webhook for wallet addresses. Returns webhook ID."""
        url = f"{BASE_URL}/webhooks"
        body = {
            "webhookURL": webhook_url,
            "transactionTypes": ["SWAP"],
            "accountAddresses": addresses,
            "webhookType": "enhanced",
        }
        if settings.memecoin_webhook_secret:
            body["authHeader"] = settings.memecoin_webhook_secret

        result = await self._request("POST", url, json_body=body)
        return result.get("webhookID", "") if isinstance(result, dict) else ""

    async def delete_webhook(self, webhook_id: str) -> bool:
        """Delete a webhook by ID."""
        url = f"{BASE_URL}/webhooks/{webhook_id}"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.delete(
                    url, params={"api-key": self.api_key}
                )
                return response.status_code == 200
        except Exception as e:
            logger.warning(f"Failed to delete webhook {webhook_id}: {e}")
            return False

    async def _rpc_call(self, method: str, params: list | dict) -> Any:
        """Make a JSON-RPC call to the Helius RPC endpoint."""
        url = f"{RPC_URL}/?api-key={self.api_key}"
        body = {
            "jsonrpc": "2.0",
            "id": f"ab-{method}",
            "method": method,
            "params": params,
        }
        async with self._semaphore:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=body)
                data = response.json()
                if "error" in data:
                    raise HeliusAPIError(
                        response.status_code,
                        data["error"].get("message", str(data["error"])),
                    )
                return data.get("result")

    async def get_sol_balance(self, address: str) -> float:
        """Get SOL balance for a wallet in SOL (not lamports)."""
        try:
            result = await self._rpc_call("getBalance", [address])
            lamports = result.get("value", 0) if isinstance(result, dict) else 0
            return lamports / 1e9
        except Exception as e:
            logger.debug(f"Failed to get SOL balance for {address}: {e}")
            return 0.0

    async def get_token_balances(self, address: str) -> list[dict]:
        """Get SPL token balances for a wallet."""
        try:
            result = await self._rpc_call(
                "getTokenAccountsByOwner",
                [
                    address,
                    {"programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"},
                    {"encoding": "jsonParsed"},
                ],
            )
            accounts = result.get("value", []) if isinstance(result, dict) else []
            balances = []
            for acc in accounts:
                info = acc.get("account", {}).get("data", {}).get("parsed", {}).get("info", {})
                mint = info.get("mint", "")
                amount = info.get("tokenAmount", {})
                ui_amount = amount.get("uiAmount", 0)
                if ui_amount and ui_amount > 0:
                    balances.append({
                        "mint": mint,
                        "amount": ui_amount,
                        "decimals": amount.get("decimals", 0),
                    })
            return balances
        except Exception as e:
            logger.debug(f"Failed to get token balances for {address}: {e}")
            return []

    async def get_signatures_count(self, address: str, limit: int = 1000) -> int:
        """Get approximate transaction count for a wallet."""
        try:
            result = await self._rpc_call(
                "getSignaturesForAddress",
                [address, {"limit": limit}],
            )
            return len(result) if isinstance(result, list) else 0
        except Exception as e:
            logger.debug(f"Failed to get sig count for {address}: {e}")
            return 0

    async def get_assets_by_owner(self, address: str, limit: int = 50) -> list[dict]:
        """Get token assets owned by a wallet via DAS API."""
        try:
            result = await self._rpc_call(
                "getAssetsByOwner",
                {
                    "ownerAddress": address,
                    "displayOptions": {"showFungible": True},
                    "limit": limit,
                },
            )
            items = result.get("items", []) if isinstance(result, dict) else []
            holdings = []
            for item in items:
                if item.get("interface") != "FungibleToken":
                    continue
                token_info = item.get("token_info", {})
                content = item.get("content", {}).get("metadata", {})
                balance = token_info.get("balance", 0)
                decimals = token_info.get("decimals", 0)
                ui_amount = balance / (10 ** decimals) if decimals else balance
                if ui_amount > 0:
                    holdings.append({
                        "mint": item.get("id", ""),
                        "symbol": content.get("symbol", ""),
                        "amount": ui_amount,
                        "price_usd": token_info.get("price_info", {}).get("price_per_token"),
                        "value_usd": token_info.get("price_info", {}).get("total_price"),
                    })
            return holdings
        except Exception as e:
            logger.debug(f"Failed to get assets for {address}: {e}")
            return []
