export type TransactionType = 'deposit' | 'withdrawal' | 'trade_debit' | 'trade_credit' | 'bonus';
export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'reversed';

export interface Transaction {
  id: string;
  user_id: string;
  wallet_id: string;
  type: TransactionType;
  amount: number;
  balance_before: number;
  balance_after: number;
  status: TransactionStatus;
  reference: string;
  external_reference: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}
