import { PriceTick, OHLCCandle } from './market';
import { TradeSettlement } from './trade';

// Client -> Server events
export type WSClientEvent =
  | { event: 'subscribe:price'; data: { symbol: string } }
  | { event: 'unsubscribe:price'; data: { symbol: string } }
  | { event: 'subscribe:trades'; data: Record<string, never> }
  | { event: 'ping'; data: Record<string, never> };

// Server -> Client events
export type WSServerEvent =
  | { event: 'price:update'; data: PriceTick }
  | { event: 'candle:update'; data: { symbol: string; timeframe: string; candle: OHLCCandle } }
  | { event: 'trade:opened'; data: { trade_id: string; asset_symbol: string; direction: string; amount: number; entry_price: number; payout_rate: number; expires_at: string } }
  | { event: 'trade:settled'; data: TradeSettlement }
  | { event: 'balance:updated'; data: { balance: number; change: number; reason: string } }
  | { event: 'deposit:confirmed'; data: { amount: number; mpesa_receipt: string; new_balance: number } }
  | { event: 'deposit:failed'; data: { amount: number; reason: string } }
  | { event: 'notification'; data: { id: string; type: string; title: string; message: string; created_at: string } }
  | { event: 'pong'; data: { server_time: number } }
  | { event: 'error'; data: { code: string; message: string } };
