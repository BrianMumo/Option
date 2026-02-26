import { create } from 'zustand';
import { api } from '@/lib/api';
import type { TradeWithAsset, TradeDirection } from '@stakeoption/shared';
import { wsClient } from '@/lib/websocket';

interface TradeSettlementEvent {
  trade_id: string;
  asset_symbol: string;
  direction: string;
  amount: number;
  result: 'win' | 'loss' | 'draw';
  profit: number;
  exit_price: number;
  entry_price: number;
}

interface TradeState {
  activeTrades: TradeWithAsset[];
  tradeHistory: TradeWithAsset[];
  historyPagination: { page: number; limit: number; total: number; pages: number } | null;
  isPlacing: boolean;
  lastSettlement: TradeSettlementEvent | null;
  showResult: boolean;

  placeTrade: (params: {
    asset_id: string;
    direction: TradeDirection;
    amount: number;
    timeframe_seconds: number;
    is_demo: boolean;
  }) => Promise<{ trade: TradeWithAsset; new_balance: number }>;

  fetchActiveTrades: (isDemo?: boolean) => Promise<void>;
  fetchTradeHistory: (options?: { page?: number; limit?: number; result?: string; is_demo?: boolean }) => Promise<void>;
  initSettlementListener: () => void;
  dismissResult: () => void;
}

export const useTradeStore = create<TradeState>((set, get) => ({
  activeTrades: [],
  tradeHistory: [],
  historyPagination: null,
  isPlacing: false,
  lastSettlement: null,
  showResult: false,

  placeTrade: async (params) => {
    set({ isPlacing: true });
    try {
      const res = await api<{ trade: TradeWithAsset; new_balance: number }>('/trades/place', {
        method: 'POST',
        body: JSON.stringify(params),
      });

      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to place trade');
      }

      // Add to active trades
      set((state) => ({
        activeTrades: [res.data!.trade, ...state.activeTrades],
      }));

      return res.data!;
    } finally {
      set({ isPlacing: false });
    }
  },

  fetchActiveTrades: async (isDemo = false) => {
    try {
      const res = await api<TradeWithAsset[]>(`/trades/active?is_demo=${isDemo}`);
      if (res.success && res.data) {
        set({ activeTrades: res.data });
      }
    } catch {
      // Trades unavailable
    }
  },

  fetchTradeHistory: async (options = {}) => {
    try {
      const params = new URLSearchParams();
      if (options.page) params.set('page', String(options.page));
      if (options.limit) params.set('limit', String(options.limit));
      if (options.result) params.set('result', options.result);
      if (options.is_demo !== undefined) params.set('is_demo', String(options.is_demo));

      const res = await api<{
        trades: TradeWithAsset[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>(`/trades/history?${params.toString()}`);

      if (res.success && res.data) {
        set({
          tradeHistory: res.data.trades,
          historyPagination: res.data.pagination,
        });
      }
    } catch {
      // History unavailable
    }
  },

  initSettlementListener: () => {
    wsClient.on('trade:settled', (_event, data: TradeSettlementEvent) => {
      // Remove from active trades
      set((state) => ({
        activeTrades: state.activeTrades.filter((t) => t.id !== data.trade_id),
        lastSettlement: data,
        showResult: true,
      }));

      // Auto-dismiss after 5s
      setTimeout(() => {
        set((state) => {
          if (state.lastSettlement?.trade_id === data.trade_id) {
            return { showResult: false };
          }
          return {};
        });
      }, 5000);
    });
  },

  dismissResult: () => {
    set({ showResult: false });
  },
}));
