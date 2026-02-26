import { create } from 'zustand';
import { wsClient } from '@/lib/websocket';

interface PriceTick {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  timestamp: number;
  updated_at: number;
}

interface PriceState {
  prices: Record<string, PriceTick>;
  isConnected: boolean;

  initWebSocket: () => void;
  subscribe: (symbol: string) => void;
  unsubscribe: (symbol: string) => void;
  disconnect: () => void;
}

export const usePriceStore = create<PriceState>((set, get) => ({
  prices: {},
  isConnected: false,

  initWebSocket: () => {
    // Listen to price updates
    wsClient.on('price:update', (_event, data: PriceTick) => {
      set((state) => ({
        prices: { ...state.prices, [data.symbol]: data },
      }));
    });

    wsClient.on('connected', () => {
      set({ isConnected: true });
    });

    wsClient.on('disconnected', () => {
      set({ isConnected: false });
    });

    wsClient.connect();
  },

  subscribe: (symbol: string) => {
    wsClient.subscribe(symbol);
  },

  unsubscribe: (symbol: string) => {
    wsClient.unsubscribe(symbol);
  },

  disconnect: () => {
    wsClient.disconnect();
    set({ isConnected: false });
  },
}));
