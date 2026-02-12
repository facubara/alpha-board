"""Regime classification and persistence.

Computes market regime (trending_bull, trending_bear, ranging, volatile)
from the latest snapshots for a timeframe and upserts into timeframe_regimes.
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.db import Snapshot, TimeframeRegime

logger = logging.getLogger(__name__)


def classify_regime(
    avg_score: float,
    avg_adx: float,
    avg_bandwidth: float,
) -> tuple[str, float]:
    """Classify market regime from aggregated indicators.

    Returns:
        (regime, confidence) where regime is one of:
        "volatile", "trending_bull", "trending_bear", "ranging"
        and confidence is 0-100.
    """
    # Volatile: high bandwidth + strong directional movement
    if avg_bandwidth > 10 and avg_adx > 25:
        confidence = min(100.0, 50 + avg_adx + avg_bandwidth)
        return "volatile", round(confidence, 2)

    # Trending Bull: bullish scores + strong trend
    if avg_score > 0.60 and avg_adx > 25:
        confidence = min(100.0, (avg_score - 0.5) * 200 + avg_adx)
        return "trending_bull", round(confidence, 2)

    # Trending Bear: bearish scores + strong trend
    if avg_score < 0.40 and avg_adx > 25:
        confidence = min(100.0, (0.5 - avg_score) * 200 + avg_adx)
        return "trending_bear", round(confidence, 2)

    # Ranging: everything else
    confidence = max(30.0, 100 - avg_adx * 2)
    return "ranging", round(confidence, 2)


async def compute_and_persist_regime(
    session: AsyncSession,
    timeframe: str,
) -> TimeframeRegime | None:
    """Compute regime for a timeframe from latest snapshots and upsert.

    Reads the top 20 snapshots (by rank) from the latest computation run,
    extracts avg bullish_score, avg ADX, avg Bollinger bandwidth,
    classifies the regime, and upserts into timeframe_regimes.

    Returns:
        The upserted TimeframeRegime row, or None on failure.
    """
    try:
        # Get latest computation time for this timeframe
        subquery = (
            select(func.max(Snapshot.computed_at))
            .where(Snapshot.timeframe == timeframe)
            .scalar_subquery()
        )

        result = await session.execute(
            select(Snapshot)
            .where(
                Snapshot.timeframe == timeframe,
                Snapshot.computed_at == subquery,
            )
            .order_by(Snapshot.rank)
            .limit(20)
        )
        snapshots = result.scalars().all()

        if not snapshots:
            logger.debug(f"No snapshots for {timeframe}, skipping regime computation")
            return None

        # Extract averages from indicator_signals
        scores: list[float] = []
        adx_values: list[float] = []
        bandwidth_values: list[float] = []

        for snap in snapshots:
            scores.append(float(snap.bullish_score))

            signals = snap.indicator_signals or {}

            # ADX from adx_14.raw.adx
            adx_data = signals.get("adx_14", {})
            adx_raw = adx_data.get("raw", {})
            adx_val = adx_raw.get("adx")
            if adx_val is not None:
                adx_values.append(float(adx_val))

            # Bollinger bandwidth from bbands_20_2.raw.bandwidth
            bb_data = signals.get("bbands_20_2", {})
            bb_raw = bb_data.get("raw", {})
            bw_val = bb_raw.get("bandwidth")
            if bw_val is not None:
                bandwidth_values.append(float(bw_val))

        avg_score = sum(scores) / len(scores) if scores else 0.5
        avg_adx = sum(adx_values) / len(adx_values) if adx_values else 20.0
        avg_bandwidth = sum(bandwidth_values) / len(bandwidth_values) if bandwidth_values else 5.0

        regime, confidence = classify_regime(avg_score, avg_adx, avg_bandwidth)

        now = datetime.now(timezone.utc)

        # Upsert into timeframe_regimes
        stmt = insert(TimeframeRegime).values(
            timeframe=timeframe,
            regime=regime,
            confidence=Decimal(str(confidence)),
            avg_bullish_score=Decimal(str(round(avg_score, 3))),
            avg_adx=Decimal(str(round(avg_adx, 2))),
            avg_bandwidth=Decimal(str(round(avg_bandwidth, 2))),
            symbols_analyzed=len(snapshots),
            computed_at=now,
        ).on_conflict_do_update(
            index_elements=["timeframe"],
            set_={
                "regime": regime,
                "confidence": Decimal(str(confidence)),
                "avg_bullish_score": Decimal(str(round(avg_score, 3))),
                "avg_adx": Decimal(str(round(avg_adx, 2))),
                "avg_bandwidth": Decimal(str(round(avg_bandwidth, 2))),
                "symbols_analyzed": len(snapshots),
                "computed_at": now,
            },
        )
        await session.execute(stmt)
        await session.commit()

        logger.info(
            f"Regime for {timeframe}: {regime} (confidence={confidence:.1f}%, "
            f"avg_score={avg_score:.3f}, avg_adx={avg_adx:.1f}, "
            f"avg_bw={avg_bandwidth:.1f}, symbols={len(snapshots)})"
        )

        # Re-fetch to return the row
        result = await session.execute(
            select(TimeframeRegime).where(TimeframeRegime.timeframe == timeframe)
        )
        return result.scalar_one_or_none()

    except Exception as e:
        logger.exception(f"Failed to compute regime for {timeframe}: {e}")
        return None
