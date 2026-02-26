import { z } from 'zod';
import { DEPOSIT_LIMITS, WITHDRAWAL_LIMITS } from '../constants/currencies';

export const depositSchema = z.object({
  amount: z.number()
    .int('Amount must be a whole number')
    .min(DEPOSIT_LIMITS.min, `Minimum deposit is KSh ${DEPOSIT_LIMITS.min}`)
    .max(DEPOSIT_LIMITS.max, `Maximum deposit is KSh ${DEPOSIT_LIMITS.max.toLocaleString()}`),
  phone: z.string().regex(/^\+254[0-9]{9}$/, 'Invalid Kenyan phone number').optional(),
});

export const withdrawSchema = z.object({
  amount: z.number()
    .int('Amount must be a whole number')
    .min(WITHDRAWAL_LIMITS.min, `Minimum withdrawal is KSh ${WITHDRAWAL_LIMITS.min}`)
    .max(WITHDRAWAL_LIMITS.max, `Maximum withdrawal is KSh ${WITHDRAWAL_LIMITS.max.toLocaleString()}`),
  phone: z.string().regex(/^\+254[0-9]{9}$/, 'Invalid Kenyan phone number').optional(),
});

export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(['deposit', 'withdrawal', 'trade_debit', 'trade_credit', 'bonus']).optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'reversed']).optional(),
});

export type DepositInput = z.infer<typeof depositSchema>;
export type WithdrawInput = z.infer<typeof withdrawSchema>;
