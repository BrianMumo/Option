export const TRADE_TIMEFRAMES = [
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 },
  { label: '30m', seconds: 1800 },
  { label: '1h', seconds: 3600 },
] as const;

export const TRADE_TIMEFRAME_SECONDS = [30, 60, 300, 900, 1800, 3600] as const;

export const DEFAULT_PAYOUT_RATE = 85;
export const DEFAULT_MIN_TRADE = 50;
export const DEFAULT_MAX_TRADE = 100_000;
export const MAX_CONCURRENT_TRADES = 10;
export const DEMO_INITIAL_BALANCE = 10_000;

export const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000] as const;

export const ASSET_CATEGORIES = ['forex', 'crypto', 'commodity', 'stock', 'index'] as const;
