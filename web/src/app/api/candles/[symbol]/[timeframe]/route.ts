import { NextRequest, NextResponse } from "next/server";
import { computeIndicators } from "@/lib/indicators";
import type { CandleData, Timeframe, ChartDataResponse } from "@/lib/types";

const VALID_TIMEFRAMES = new Set(["15m", "30m", "1h", "4h", "1d", "1w"]);
const SYMBOL_RE = /^[A-Z0-9]{2,20}$/;

/**
 * GET /api/candles/[symbol]/[timeframe]?limit=200
 *
 * Proxies Binance public klines API, transforms to CandleData[],
 * computes indicators client-side, returns ChartDataResponse.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string; timeframe: string }> }
) {
  const { symbol, timeframe } = await params;
  const upperSymbol = symbol.toUpperCase();

  if (!SYMBOL_RE.test(upperSymbol)) {
    return NextResponse.json(
      { error: "Invalid symbol format" },
      { status: 400 }
    );
  }

  if (!VALID_TIMEFRAMES.has(timeframe)) {
    return NextResponse.json(
      { error: "Invalid timeframe" },
      { status: 400 }
    );
  }

  const url = request.nextUrl;
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam) || 200, 50), 1000);

  // Map our timeframes to Binance interval format
  const binanceInterval = timeframe === "15m" ? "15m"
    : timeframe === "30m" ? "30m"
    : timeframe === "1h" ? "1h"
    : timeframe === "4h" ? "4h"
    : timeframe === "1d" ? "1d"
    : timeframe === "1w" ? "1w"
    : "1h";

  try {
    const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${upperSymbol}&interval=${binanceInterval}&limit=${limit}`;
    const res = await fetch(binanceUrl, { next: { revalidate: 0 } });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Binance API error: ${text}` },
        { status: res.status }
      );
    }

    const raw: unknown[][] = await res.json();

    const candles: CandleData[] = raw.map((k) => ({
      openTime: k[0] as number,
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
      volume: parseFloat(k[5] as string),
    }));

    const indicators = computeIndicators(candles);

    const data: ChartDataResponse = {
      symbol: upperSymbol,
      timeframe: timeframe as Timeframe,
      candles,
      indicators,
    };

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch candles: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 }
    );
  }
}
