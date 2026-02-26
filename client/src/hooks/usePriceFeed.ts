'use client';

import { useEffect } from 'react';
import { usePriceStore } from '@/store/priceStore';

/** Subscribe to real-time price updates for a symbol */
export function usePriceFeed(symbol: string | null) {
  const { prices, subscribe, unsubscribe, initWebSocket, isConnected } = usePriceStore();

  useEffect(() => {
    initWebSocket();
  }, [initWebSocket]);

  useEffect(() => {
    if (!symbol) return;
    subscribe(symbol);
    return () => {
      unsubscribe(symbol);
    };
  }, [symbol, subscribe, unsubscribe]);

  const price = symbol ? prices[symbol] || null : null;

  return { price, isConnected };
}

/** Subscribe to multiple symbols at once */
export function useMultiPriceFeed(symbols: string[]) {
  const { prices, subscribe, unsubscribe, initWebSocket, isConnected } = usePriceStore();

  useEffect(() => {
    initWebSocket();
  }, [initWebSocket]);

  useEffect(() => {
    for (const s of symbols) {
      subscribe(s);
    }
    return () => {
      for (const s of symbols) {
        unsubscribe(s);
      }
    };
  }, [symbols.join(','), subscribe, unsubscribe]);

  const symbolPrices = symbols.reduce(
    (acc, s) => {
      if (prices[s]) acc[s] = prices[s];
      return acc;
    },
    {} as Record<string, typeof prices[string]>
  );

  return { prices: symbolPrices, isConnected };
}
