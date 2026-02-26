import { z } from 'zod';
import { TRADE_TIMEFRAME_SECONDS } from '../constants/trading';

export const placeTradeSchema = z.object({
  asset_id: z.string().uuid('Invalid asset ID'),
  direction: z.enum(['UP', 'DOWN']),
  amount: z.number().positive('Amount must be positive').max(100_000, 'Maximum trade is KSh 100,000'),
  timeframe_seconds: z.number().refine(
    (val) => (TRADE_TIMEFRAME_SECONDS as readonly number[]).includes(val),
    'Invalid timeframe'
  ),
  is_demo: z.boolean().default(false),
});

export const tradeHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  asset_id: z.string().uuid().optional(),
  result: z.enum(['win', 'loss', 'draw']).optional(),
  is_demo: z.coerce.boolean().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type PlaceTradeInput = z.infer<typeof placeTradeSchema>;
