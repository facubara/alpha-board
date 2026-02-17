"""LLM settings cache — per-section toggle for cost control.

Usage:
    At the start of each pipeline cycle:
        await load_llm_settings(session)

    Before each call site:
        if not is_enabled("llm_trade_decisions"):
            return  # skip
"""

import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Module-level cache — refreshed once per pipeline cycle
_settings_cache: dict[str, bool] = {}


async def load_llm_settings(session: AsyncSession) -> None:
    """Load all llm_settings rows into module-level cache.

    Called once at the start of each pipeline cycle.
    """
    global _settings_cache
    try:
        result = await session.execute(
            text("SELECT section_key, enabled FROM llm_settings")
        )
        _settings_cache = {row[0]: row[1] for row in result.fetchall()}
        logger.debug(f"Loaded LLM settings: {_settings_cache}")
    except Exception:
        logger.warning("Failed to load llm_settings — all sections default to enabled")
        _settings_cache = {}


def is_enabled(section_key: str) -> bool:
    """Check if a section is enabled. Returns True if key missing (fail-open)."""
    return _settings_cache.get(section_key, True)
