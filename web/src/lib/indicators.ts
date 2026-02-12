/**
 * Client-side technical indicator computations.
 * Pure TypeScript — no dependencies.
 * All functions return arrays aligned with candle indices, null for warmup periods.
 */

import type { CandleData, IndicatorValues } from "./types";

export function computeEMA(
  values: number[],
  period: number
): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return result;

  // SMA for first value
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  result[period - 1] = sum / period;

  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    result[i] = values[i] * k + (result[i - 1] as number) * (1 - k);
  }
  return result;
}

export function computeRSI(
  closes: number[],
  period = 14
): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return result;

  let avgGain = 0;
  let avgLoss = 0;

  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) result[period] = 100;
  else {
    const rs = avgGain / avgLoss;
    result[period] = 100 - 100 / (1 + rs);
  }

  // Wilder's smoothing
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) result[i] = 100;
    else {
      const rs = avgGain / avgLoss;
      result[i] = 100 - 100 / (1 + rs);
    }
  }

  return result;
}

export function computeMACD(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const emaFast = computeEMA(closes, fast);
  const emaSlow = computeEMA(closes, slow);

  const macdLine: (number | null)[] = new Array(closes.length).fill(null);
  const macdValues: number[] = [];
  const macdIndices: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      macdLine[i] = (emaFast[i] as number) - (emaSlow[i] as number);
      macdValues.push(macdLine[i] as number);
      macdIndices.push(i);
    }
  }

  // Compute signal line (EMA of MACD values)
  const signalRaw = computeEMA(macdValues, signalPeriod);
  const signal: (number | null)[] = new Array(closes.length).fill(null);
  const histogram: (number | null)[] = new Array(closes.length).fill(null);

  for (let j = 0; j < macdValues.length; j++) {
    const idx = macdIndices[j];
    if (signalRaw[j] !== null) {
      signal[idx] = signalRaw[j];
      histogram[idx] = (macdLine[idx] as number) - (signalRaw[j] as number);
    }
  }

  return { macd: macdLine, signal, histogram };
}

export function computeBollingerBands(
  closes: number[],
  period = 20,
  stdDev = 2
): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
} {
  const upper: (number | null)[] = new Array(closes.length).fill(null);
  const middle: (number | null)[] = new Array(closes.length).fill(null);
  const lower: (number | null)[] = new Array(closes.length).fill(null);

  if (closes.length < period) return { upper, middle, lower };

  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    const sma = sum / period;

    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) {
      variance += (closes[j] - sma) ** 2;
    }
    const std = Math.sqrt(variance / period);

    middle[i] = sma;
    upper[i] = sma + stdDev * std;
    lower[i] = sma - stdDev * std;
  }

  return { upper, middle, lower };
}

export function computeIndicators(candles: CandleData[]): IndicatorValues {
  const closes = candles.map((c) => c.close);

  const rsi = computeRSI(closes);
  const { macd, signal: macdSignal, histogram: macdHistogram } = computeMACD(closes);
  const ema20 = computeEMA(closes, 20);
  const ema50 = computeEMA(closes, 50);
  const ema200 = computeEMA(closes, 200);
  const { upper: bbUpper, middle: bbMiddle, lower: bbLower } = computeBollingerBands(closes);

  return {
    rsi,
    macd,
    macdSignal,
    macdHistogram,
    ema20,
    ema50,
    ema200,
    bbUpper,
    bbMiddle,
    bbLower,
  };
}
