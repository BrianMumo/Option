export type AssetCategory = 'velocity' | 'crash_boom' | 'step' | 'range_break';

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  category: AssetCategory;
  payout_rate: number;
  min_trade: number;
  max_trade: number;
  is_active: boolean;
  sort_order: number;
}

export interface PriceTick {
  symbol: string;
  price: number;
  bid?: number;
  ask?: number;
  timestamp: number;
  change_24h?: number;
  change_pct_24h?: number;
}

export interface OHLCCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: number;
  volume?: number;
}
