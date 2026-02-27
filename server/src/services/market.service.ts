import { db } from '../config/database';
import { assets, priceSnapshots } from '../db/schema';
import { eq, and, asc, desc } from 'drizzle-orm';
import { redis } from '../config/redis';

export async function getActiveAssets() {
  const result = await db
    .select()
    .from(assets)
    .where(eq(assets.is_active, true))
    .orderBy(asc(assets.sort_order), asc(assets.name));
  return result.map(formatAsset);
}

export async function getAssetsByCategory(category: string) {
  const result = await db
    .select()
    .from(assets)
    .where(and(eq(assets.is_active, true), eq(assets.category, category)))
    .orderBy(asc(assets.sort_order), asc(assets.name));
  return result.map(formatAsset);
}

/** Parse numeric string fields from DB into actual numbers */
function formatAsset(asset: typeof assets.$inferSelect) {
  return {
    ...asset,
    payout_rate: parseFloat(asset.payout_rate),
    min_trade: parseFloat(asset.min_trade),
    max_trade: parseFloat(asset.max_trade),
  };
}

export async function getAssetBySymbol(symbol: string) {
  const [asset] = await db
    .select()
    .from(assets)
    .where(eq(assets.symbol, symbol))
    .limit(1);
  return asset || null;
}

/** Get current cached price from Redis */
export async function getCurrentPrice(symbol: string) {
  const cached = await redis.get(`price:${symbol}`);
  if (!cached) return null;
  return JSON.parse(cached);
}

/** Get cached prices for multiple symbols */
export async function getCurrentPrices(symbols: string[]) {
  if (symbols.length === 0) return {};

  const pipeline = redis.pipeline();
  for (const s of symbols) {
    pipeline.get(`price:${s}`);
  }
  const results = await pipeline.exec();
  if (!results) return {};

  const prices: Record<string, any> = {};
  symbols.forEach((s, i) => {
    const [err, val] = results[i];
    if (!err && val) {
      prices[s] = JSON.parse(val as string);
    }
  });
  return prices;
}

/** Get historical OHLC candles from price_snapshots table */
export async function getCandles(
  symbol: string,
  interval: string = '1min',
  limit: number = 100
) {
  const snapshots = await db
    .select()
    .from(priceSnapshots)
    .where(eq(priceSnapshots.asset_symbol, symbol))
    .orderBy(desc(priceSnapshots.captured_at))
    .limit(limit);

  if (snapshots.length >= 10) {
    return snapshots.reverse().map((s) => ({
      time: Math.floor(new Date(s.captured_at).getTime() / 1000),
      open: parseFloat(s.price),
      high: parseFloat(s.price) * (1 + Math.random() * 0.0005),
      low: parseFloat(s.price) * (1 - Math.random() * 0.0005),
      close: parseFloat(s.price),
    }));
  }

  return generateSimulatedCandles(symbol, interval, limit);
}

// Velocity asset base prices (fallback when Redis has no data)
const FALLBACK_PRICES: Record<string, number> = {
  'V10': 5000, 'V25': 5000, 'V50': 5000, 'V75': 5000, 'V100': 5000,
  'V10-1s': 5000, 'V100-1s': 5000,
  'CRASH-300': 6000, 'CRASH-500': 6000, 'CRASH-1000': 6000,
  'BOOM-300': 4000, 'BOOM-500': 4000, 'BOOM-1000': 4000,
  'STEP-100': 5000, 'STEP-200': 5000, 'STEP-500': 5000,
  'RB-100': 5000, 'RB-150': 5000, 'RB-200': 5000,
};

// Per-asset candle volatility for chart generation
const CANDLE_VOLATILITIES: Record<string, number> = {
  'V10': 0.001, 'V25': 0.002, 'V50': 0.004, 'V75': 0.006, 'V100': 0.008,
  'V10-1s': 0.001, 'V100-1s': 0.008,
  'CRASH-300': 0.005, 'CRASH-500': 0.004, 'CRASH-1000': 0.003,
  'BOOM-300': 0.005, 'BOOM-500': 0.004, 'BOOM-1000': 0.003,
  'STEP-100': 0.002, 'STEP-200': 0.003, 'STEP-500': 0.005,
  'RB-100': 0.003, 'RB-150': 0.003, 'RB-200': 0.003,
};

async function generateSimulatedCandles(symbol: string, interval: string, limit: number) {
  const cached = await redis.get(`price:${symbol}`);
  let base: number;

  if (cached) {
    base = JSON.parse(cached).price;
  } else {
    base = FALLBACK_PRICES[symbol] || 5000;
  }

  const intervalSeconds = parseIntervalSeconds(interval);
  const now = Math.floor(Date.now() / 1000);
  const candles = [];
  const volatility = CANDLE_VOLATILITIES[symbol] || 0.003;

  let price = base * (0.995 + Math.random() * 0.005);

  for (let i = limit - 1; i >= 0; i--) {
    const time = now - i * intervalSeconds;
    const trend = Math.sin(i / 20) * volatility * 0.3;
    const noise = (Math.random() - 0.5) * 2 * volatility;
    const change = trend + noise;

    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);

    candles.push({
      time,
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
    });

    price = close;
  }

  return candles;
}

function parseIntervalSeconds(interval: string): number {
  const map: Record<string, number> = {
    '1min': 60, '5min': 300, '15min': 900, '30min': 1800,
    '1h': 3600, '4h': 14400, '1day': 86400,
  };
  return map[interval] || 60;
}

function round2(price: number): number {
  return Math.round(price * 100) / 100;
}
