import { create } from 'zustand';
import { api } from '@/lib/api';

interface Asset {
  id: string;
  symbol: string;
  name: string;
  category: string;
  twelve_data_symbol: string;
  payout_rate: string;
  min_trade: string;
  max_trade: string;
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

  fetchAssets: async () => {
    set({ assetsLoading: true });
    try {
      const res = await api<Asset[]>('/market/assets');
      if (res.success && res.data) {
        const assetsList = res.data;
        set({ assets: assetsList });

        // Auto-select first asset if none selected
        if (assetsList.length > 0) {
          set((state) => ({
            selectedAsset: state.selectedAsset || assetsList[0],
          }));
        }
      }
    } catch {
      // Assets unavailable
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
      // Candles unavailable
    } finally {
      set({ candlesLoading: false });
    }
  },
}));
