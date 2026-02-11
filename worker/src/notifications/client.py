"""Telegram Bot API client with retry logic.

Mirrors the BinanceClient pattern: retries with exponential backoff,
respects rate limits, and never raises exceptions to callers.
"""

import asyncio
import logging

import httpx

from src.config import settings

logger = logging.getLogger(__name__)

TELEGRAM_API_BASE = "https://api.telegram.org"
MAX_RETRIES = 2
BASE_RETRY_DELAY = 1.0


class TelegramClient:
    """Async Telegram Bot API client for sending notifications."""

    def __init__(
        self,
        bot_token: str | None = None,
        chat_id: str | None = None,
    ):
        self.bot_token = bot_token or settings.telegram_bot_token
        self.chat_id = chat_id or settings.telegram_chat_id

    @property
    def is_configured(self) -> bool:
        """Check if both bot token and chat ID are set."""
        return bool(self.bot_token) and bool(self.chat_id)

    async def send_message_to(self, chat_id: str, text: str, parse_mode: str = "HTML") -> bool:
        """Send a message to a specific chat ID.

        Args:
            chat_id: Target chat ID.
            text: Message text.
            parse_mode: Telegram parse mode.

        Returns:
            True if sent successfully.
        """
        if not self.bot_token:
            return False

        url = f"{TELEGRAM_API_BASE}/bot{self.bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": True,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload)
                return response.status_code == 200
        except Exception:
            logger.error("Failed to send reply", exc_info=True)
            return False

    async def set_webhook(self, webhook_url: str) -> bool:
        """Register a webhook URL with Telegram."""
        if not self.bot_token:
            return False

        url = f"{TELEGRAM_API_BASE}/bot{self.bot_token}/setWebhook"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json={"url": webhook_url})
                data = response.json()
                if data.get("ok"):
                    logger.info(f"Telegram webhook set to {webhook_url}")
                    return True
                logger.error(f"Failed to set webhook: {data}")
                return False
        except Exception:
            logger.error("Failed to set webhook", exc_info=True)
            return False

    async def send_message(self, text: str, parse_mode: str = "HTML") -> bool:
        """Send a message to the configured Telegram chat.

        Args:
            text: Message text (HTML or plain).
            parse_mode: Telegram parse mode ("HTML" or "MarkdownV2").

        Returns:
            True if the message was sent successfully, False otherwise.
            Never raises exceptions.
        """
        if not self.is_configured:
            logger.debug("Telegram not configured, skipping notification")
            return False

        url = f"{TELEGRAM_API_BASE}/bot{self.bot_token}/sendMessage"
        payload = {
            "chat_id": self.chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": True,
        }

        for attempt in range(MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(url, json=payload)

                    if response.status_code == 200:
                        return True

                    # Handle rate limiting
                    if response.status_code == 429:
                        data = response.json()
                        retry_after = data.get("parameters", {}).get("retry_after", 5)
                        if attempt < MAX_RETRIES:
                            logger.warning(
                                f"Telegram rate limited, waiting {retry_after}s"
                            )
                            await asyncio.sleep(retry_after)
                            continue
                        logger.error("Telegram rate limit exceeded after retries")
                        return False

                    # Retry on server errors
                    if response.status_code >= 500 and attempt < MAX_RETRIES:
                        delay = BASE_RETRY_DELAY * (2**attempt)
                        logger.warning(
                            f"Telegram server error {response.status_code}, "
                            f"retrying in {delay}s (attempt {attempt + 1})"
                        )
                        await asyncio.sleep(delay)
                        continue

                    logger.error(
                        f"Telegram API error {response.status_code}: {response.text}"
                    )
                    return False

            except (httpx.TimeoutException, httpx.RequestError) as e:
                if attempt < MAX_RETRIES:
                    delay = BASE_RETRY_DELAY * (2**attempt)
                    logger.warning(
                        f"Telegram request error: {e}, retrying in {delay}s"
                    )
                    await asyncio.sleep(delay)
                    continue
                logger.error(f"Telegram request failed after retries: {e}")
                return False

        return False
