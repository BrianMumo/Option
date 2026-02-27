import { create } from 'zustand';
import { api } from '@/lib/api';

interface Asset {
  id: string;
  symbol: string;
  name: string;
  category: string;
  twelve_data_symbol: string;
  payout_rate: number;
  min_trade: number;
  max_trade: number;
  is_active: boolean;
  sort_order: number;
  current_price?: {
    price: number;
    bid: number;
    ask: number;
    timestamp: number;
  } | null;
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface MarketState {
  assets: Asset[];
  assetsLoading: boolean;
  selectedAsset: Asset | null;
  candles: Candle[];
  candlesLoading: boolean;
  error: string | null;

  fetchAssets: () => Promise<void>;
  selectAsset: (asset: Asset) => void;
  fetchCandles: (symbol: string, interval?: string, limit?: number) => Promise<void>;
}

export const useMarketStore = create<MarketState>((set) => ({
  assets: [],
  assetsLoading: false,
  selectedAsset: null,
  candles: [],
  candlesLoading: false,
  error: null,

  fetchAssets: async () => {
    set({ assetsLoading: true });
    try {
      const res = await api<Asset[]>('/market/assets');
      if (res.success && res.data) {
        const assetsList = res.data;
        set({ assets: assetsList, error: null });

        // Auto-select first asset if none selected
        if (assetsList.length > 0) {
          set((state) => ({
            selectedAsset: state.selectedAsset || assetsList[0],
          }));
        }
      }
    } catch {
      set({ error: 'Failed to load assets' });
    } finally {
      set({ assetsLoading: false });
    }
  },

  selectAsset: (asset) => {
    set({ selectedAsset: asset, candles: [] });
  },

  fetchCandles: async (symbol, interval = '1min', limit = 200) => {
    set({ candlesLoading: true });
    try {
      const res = await api<Candle[]>(`/market/candles/${encodeURIComponent(symbol)}?interval=${interval}&limit=${limit}`);
      if (res.success && res.data) {
        set({ candles: res.data });
      }
    } catch {
      set({ error: 'Failed to load chart data' });
    } finally {
      set({ candlesLoading: false });
    }
  },
}));
