"""Rankings router — serves latest ranking snapshots per timeframe."""

import asyncio

from fastapi import APIRouter, HTTPException
from sqlalchemy import select, func

from src.db import async_session
from src.models.db import Snapshot, Symbol

router = APIRouter(prefix="/rankings", tags=["rankings"])

VALID_TIMEFRAMES = ["15m", "30m", "1h", "4h", "1d", "1w"]


def _validate_timeframe(timeframe: str) -> None:
    if timeframe not in VALID_TIMEFRAMES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid timeframe '{timeframe}'. Must be one of: {', '.join(VALID_TIMEFRAMES)}",
        )


def _parse_snapshot(snap: Snapshot, sym: Symbol) -> dict:
    """Convert a Snapshot + Symbol row pair into camelCase JSON-ready dict."""
    indicator_signals = []
    price_change_pct = None
    volume_change_pct = None
    price_change_abs = None
    volume_change_abs = None
    funding_rate = None

    if snap.indicator_signals:
        for name, data in snap.indicator_signals.items():
            # Extract _market metadata (not a real indicator)
            if name == "_market":
                price_change_pct = data.get("price_change_pct")
                volume_change_pct = data.get("volume_change_pct")
                price_change_abs = data.get("price_change_abs")
                volume_change_abs = data.get("volume_change_abs")
                funding_rate = data.get("funding_rate")
                continue

            # Skip any other internal/private keys
            if name.startswith("_"):
                continue

            indicator_signals.append({
                "name": name,
                "displayName": name.replace("_", " ").title(),
                "signal": float(data.get("signal", 0)),
                "label": data.get("label", "neutral"),
                "description": str(data.get("label", "neutral")),
                "rawValues": data.get("raw", {}),
            })

    return {
        "id": snap.id,
        "symbol": sym.symbol,
        "symbolId": sym.id,
        "baseAsset": sym.base_asset,
        "quoteAsset": sym.quote_asset,
        "timeframe": snap.timeframe,
        "bullishScore": float(snap.bullish_score),
        "confidence": int(snap.confidence),
        "rank": int(snap.rank),
        "highlights": snap.highlights or [],
        "indicatorSignals": indicator_signals,
        "priceChangePct": price_change_pct,
        "volumeChangePct": volume_change_pct,
        "priceChangeAbs": price_change_abs,
        "volumeChangeAbs": volume_change_abs,
        "fundingRate": funding_rate,
        "computedAt": snap.computed_at.isoformat(),
        "runId": str(snap.run_id),
    }


async def _get_rankings_for_timeframe(timeframe: str) -> dict:
    """Fetch latest rankings for a single timeframe."""
    async with async_session() as session:
        subquery = (
            select(func.max(Snapshot.computed_at))
            .where(Snapshot.timeframe == timeframe)
            .scalar_subquery()
        )
        result = await session.execute(
            select(Snapshot, Symbol)
            .join(Symbol, Symbol.id == Snapshot.symbol_id)
            .where(
                Snapshot.timeframe == timeframe,
                Snapshot.computed_at == subquery,
            )
            .order_by(Snapshot.rank.asc())
        )
        rows = result.all()

    if not rows:
        return {
            "timeframe": timeframe,
            "snapshots": [],
            "computedAt": None,
        }

    computed_at = rows[0][0].computed_at.isoformat()
    snapshots = [_parse_snapshot(snap, sym) for snap, sym in rows]

    return {
        "timeframe": timeframe,
        "snapshots": snapshots,
        "computedAt": computed_at,
    }


# ---------------------------------------------------------------------------
# GET /rankings — all 6 timeframes in parallel
# ---------------------------------------------------------------------------
@router.get("")
async def get_all_rankings():
    """Return latest rankings for all timeframes."""
    results = await asyncio.gather(
        *[_get_rankings_for_timeframe(tf) for tf in VALID_TIMEFRAMES]
    )
    return {r["timeframe"]: r for r in results}


# ---------------------------------------------------------------------------
# GET /rankings/{timeframe} — single timeframe
# ---------------------------------------------------------------------------
@router.get("/{timeframe}")
async def get_rankings(timeframe: str):
    """Return latest rankings for a single timeframe."""
    _validate_timeframe(timeframe)
    return await _get_rankings_for_timeframe(timeframe)


# ---------------------------------------------------------------------------
# GET /rankings/{timeframe}/latest-time — just the timestamp
# ---------------------------------------------------------------------------
@router.get("/{timeframe}/latest-time")
async def get_latest_time(timeframe: str):
    """Return the latest computed_at timestamp for a timeframe."""
    _validate_timeframe(timeframe)

    async with async_session() as session:
        result = await session.execute(
            select(func.max(Snapshot.computed_at)).where(Snapshot.timeframe == timeframe)
        )
        latest = result.scalar()

    return {"latestComputedAt": latest.isoformat() if latest else None}
