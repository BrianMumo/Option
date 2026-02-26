export type TradeDirection = 'UP' | 'DOWN';
export type TradeResult = 'win' | 'loss' | 'draw';
export type TradeStatus = 'active' | 'settled' | 'cancelled' | 'error';

export interface Trade {
  id: string;
  user_id: string;
  asset_id: string;
  is_demo: boolean;
  direction: TradeDirection;
  amount: number;
  payout_rate: number;
  entry_price: number;
  exit_price: number | null;
  timeframe_seconds: number;
  expires_at: string;
  settled_at: string | null;
  result: TradeResult | null;
  profit: number | null;
  status: TradeStatus;
  created_at: string;
  updated_at: string;
}

export interface TradeWithAsset extends Trade {
  asset_symbol: string;
  asset_name: string;
}

export interface PlaceTradeRequest {
  asset_id: string;
  direction: TradeDirection;
  amount: number;
  timeframe_seconds: number;
  is_demo: boolean;
}

export interface TradeSettlement {
  trade_id: string;
  result: TradeResult;
  entry_price: number;
  exit_price: number;
  profit: number;
  new_balance: number;
}
