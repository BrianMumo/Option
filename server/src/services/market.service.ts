import { db } from '../config/database';
import { assets, priceSnapshots } from '../db/schema';
import { eq, and, gte, lte, asc, desc } from 'drizzle-orm';
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
  // Check if we have enough real snapshots
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

  // Generate simulated candles based on current live price from Redis
  return generateSimulatedCandles(symbol, interval, limit);
}

/** Generate simulated OHLC candles anchored to the current live price */
async function generateSimulatedCandles(
  symbol: string,
  interval: string,
  limit: number
) {
  // Use current live price from Redis as the base (so chart matches the live feed)
  const cached = await redis.get(`price:${symbol}`);
  let base: number;

  if (cached) {
    const liveData = JSON.parse(cached);
    base = liveData.price;
  } else {
    // Fallback hardcoded prices only if no live data at all
    const fallbackPrices: Record<string, number> = {
      'EUR/USD': 1.0854, 'GBP/USD': 1.2650, 'USD/JPY': 149.85,
      'AUD/USD': 0.6540, 'USD/CAD': 1.3580, 'EUR/GBP': 0.8580,
      'USD/CHF': 0.8820, 'NZD/USD': 0.6020, 'EUR/JPY': 162.55,
      'GBP/JPY': 189.45, 'BTC/USD': 62450.00, 'ETH/USD': 3420.00,
      'XRP/USD': 0.5840, 'SOL/USD': 145.20, 'BNB/USD': 580.00,
      'XAU/USD': 2340.50, 'XAG/USD': 27.85, 'WTI/USD': 78.40,
    };
    base = fallbackPrices[symbol] || 100;
  }

  const intervalSeconds = parseIntervalSeconds(interval);
  const now = Math.floor(Date.now() / 1000);
  const candles = [];

  // Start slightly below current price and walk towards it
  let price = base * (0.995 + Math.random() * 0.005);

  for (let i = limit - 1; i >= 0; i--) {
    const time = now - i * intervalSeconds;
    const volatility = symbol.includes('BTC') ? 0.008 : symbol.includes('ETH') ? 0.006 : symbol.includes('XAU') ? 0.003 : 0.002;
    // Use multiple random sources for more organic movement
    const trend = Math.sin(i / 20) * volatility * 0.3;
    const noise = (Math.random() - 0.5) * 2 * volatility;
    const change = trend + noise;

    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);

    candles.push({
      time,
      open: roundPrice(open, symbol),
      high: roundPrice(high, symbol),
      low: roundPrice(low, symbol),
      close: roundPrice(close, symbol),
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

function roundPrice(price: number, symbol: string): number {
  if (symbol.includes('JPY')) return Math.round(price * 1000) / 1000;
  if (symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('XAU'))
    return Math.round(price * 100) / 100;
  return Math.round(price * 100000) / 100000;
}
