import { create } from 'zustand';
import { api } from '@/lib/api';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  status: string;
  reference: string;
  external_reference: string | null;
  created_at: string;
}

interface WalletState {
  balance: number;
  isLoading: boolean;
  transactions: Transaction[];
  txPagination: { page: number; limit: number; total: number; pages: number };
  depositLoading: boolean;
  withdrawLoading: boolean;
  depositStatus: 'idle' | 'pending' | 'success' | 'failed';
  depositMessage: string;

  fetchBalance: () => Promise<void>;
  fetchTransactions: (page?: number, type?: string) => Promise<void>;
  deposit: (amount: number, phone?: string) => Promise<void>;
  withdraw: (amount: number, phone?: string) => Promise<void>;
  resetDepositStatus: () => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  balance: 0,
  isLoading: false,
  transactions: [],
  txPagination: { page: 1, limit: 20, total: 0, pages: 0 },
  depositLoading: false,
  withdrawLoading: false,
  depositStatus: 'idle',
  depositMessage: '',

  fetchBalance: async () => {
    set({ isLoading: true });
    try {
      const res = await api<{ balance: number }>('/wallet/balance');
      if (res.success && res.data) {
        set({ balance: res.data.balance });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  fetchTransactions: async (page = 1, type?: string) => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (type) params.set('type', type);

    const res = await api<{
      transactions: Transaction[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>(`/wallet/transactions?${params}`);

    if (res.success && res.data) {
      set({
        transactions: res.data.transactions,
        txPagination: res.data.pagination,
      });
    }
  },

  deposit: async (amount, phone) => {
    set({ depositLoading: true, depositStatus: 'pending', depositMessage: '' });
    try {
      const res = await api<{ checkout_request_id: string; amount: number }>(
        '/wallet/deposit',
        {
          method: 'POST',
          body: JSON.stringify({ amount, phone }),
        }
      );

      if (res.success) {
        set({
          depositStatus: 'pending',
          depositMessage: 'STK Push sent! Enter your M-Pesa PIN on your phone.',
        });
        // Poll for completion (the WebSocket will handle this in Phase 3,
        // for now we poll balance after a delay)
        setTimeout(() => {
          get().fetchBalance();
          get().fetchTransactions();
        }, 15000);
      } else {
        set({
          depositStatus: 'failed',
          depositMessage: res.error?.message || 'Deposit failed',
        });
      }
    } catch (err: any) {
      set({
        depositStatus: 'failed',
        depositMessage: err.message || 'Deposit failed',
      });
    } finally {
      set({ depositLoading: false });
    }
  },

  withdraw: async (amount, phone) => {
    set({ withdrawLoading: true });
    try {
      const res = await api<{ withdrawal_id: string }>(
        '/wallet/withdraw',
        {
          method: 'POST',
          body: JSON.stringify({ amount, phone }),
        }
      );

      if (res.success) {
        // Refresh balance and transactions
        await get().fetchBalance();
        await get().fetchTransactions();
      } else {
        throw new Error(res.error?.message || 'Withdrawal failed');
      }
    } finally {
      set({ withdrawLoading: false });
    }
  },

  resetDepositStatus: () => {
    set({ depositStatus: 'idle', depositMessage: '' });
  },
}));
