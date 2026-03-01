"""Rankings router — serves latest ranking snapshots per timeframe."""

import asyncio

from fastapi import APIRouter, HTTPException
from sqlalchemy import select, func, text

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
# ---------------------------------------------------------------------------
# GET /rankings/{timeframe}/history/{symbol_id} — previous closes for a symbol
# ---------------------------------------------------------------------------
VALID_COUNTS = {3, 5, 7, 10}

TIMEFRAME_INTERVALS = {
    "15m": "15 minutes",
    "30m": "30 minutes",
    "1h": "1 hour",
    "4h": "4 hours",
    "1d": "1 day",
    "1w": "7 days",
}


def _parse_close_row(row) -> dict:
    """Extract slim payload from a raw SQL row for previous-closes display."""
    price_change_pct = None
    indicator_signals = row.indicator_signals
    if indicator_signals:
        market = indicator_signals.get("_market")
        if market:
            price_change_pct = market.get("price_change_pct")

    return {
        "bullishScore": float(row.bullish_score),
        "priceChangePct": price_change_pct,
        "highlights": row.highlights or [],
        "computedAt": row.computed_at.isoformat(),
    }


@router.get("/{timeframe}/history/{symbol_id}")
async def get_symbol_history(timeframe: str, symbol_id: int, count: int = 5):
    """Return previous closes for a symbol in a timeframe (skips latest).

    Uses date_bin to bucket snapshots by timeframe interval, returning
    only one snapshot per period (the latest within each bucket).
    """
    _validate_timeframe(timeframe)

    if count not in VALID_COUNTS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid count '{count}'. Must be one of: {sorted(VALID_COUNTS)}",
        )

    interval = TIMEFRAME_INTERVALS[timeframe]

    async with async_session() as session:
        # Fetch symbol for response metadata
        sym_result = await session.execute(
            select(Symbol).where(Symbol.id == symbol_id)
        )
        sym = sym_result.scalar_one_or_none()
        if not sym:
            raise HTTPException(status_code=404, detail="Symbol not found")

        # Use date_bin to bucket snapshots by timeframe interval.
        # ROW_NUMBER picks the latest snapshot per bucket.
        # OFFSET 1 skips the current bucket (already shown in main row).
        result = await session.execute(
            text("""
                SELECT bullish_score, indicator_signals, highlights, computed_at
                FROM (
                    SELECT bullish_score, indicator_signals, highlights, computed_at,
                        ROW_NUMBER() OVER (
                            PARTITION BY date_bin(:interval ::interval, computed_at, '2000-01-01'::timestamptz)
                            ORDER BY computed_at DESC
                        ) AS rn,
                        date_bin(:interval ::interval, computed_at, '2000-01-01'::timestamptz) AS bucket
                    FROM snapshots
                    WHERE symbol_id = :symbol_id AND timeframe = :timeframe
                ) sub
                WHERE rn = 1
                ORDER BY bucket DESC
                OFFSET 1
                LIMIT :count
            """),
            {
                "symbol_id": symbol_id,
                "timeframe": timeframe,
                "interval": interval,
                "count": count,
            },
        )
        rows = result.fetchall()

    return {
        "symbolId": sym.id,
        "symbol": sym.symbol,
        "timeframe": timeframe,
        "closes": [_parse_close_row(row) for row in rows],
    }


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
