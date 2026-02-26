'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useMarketStore } from '@/store/marketStore';
import { usePriceFeed } from '@/hooks/usePriceFeed';

interface TradingChartProps {
  symbol: string;
}

export default function TradingChart({ symbol }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const areaSeriesRef = useRef<any>(null);
  const lastTimeRef = useRef<number>(0);
  const { candles, fetchCandles, candlesLoading } = useMarketStore();
  const { price } = usePriceFeed(symbol);

  // Initialize chart
  const initChart = useCallback(async () => {
    if (!containerRef.current) return;

    const lc = await import('lightweight-charts');

    // Re-check ref after async import (component may have unmounted)
    if (!containerRef.current) return;

    // Clean up existing chart
    if (chartRef.current) {
      try { chartRef.current.remove(); } catch {}
      chartRef.current = null;
    }

    lastTimeRef.current = 0;

    const chart = lc.createChart(containerRef.current, {
      layout: {
        background: { type: lc.ColorType.Solid, color: '#0f1419' },
        textColor: '#6b7280',
        fontSize: 10,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: '#1f293720', style: 2 },
      },
      crosshair: {
        mode: lc.CrosshairMode.Normal,
        vertLine: {
          color: '#3b82f680',
          width: 1,
          style: 2,
          labelBackgroundColor: '#1e3a5f',
        },
        horzLine: {
          color: '#3b82f680',
          width: 1,
          style: 2,
          labelBackgroundColor: '#1e3a5f',
        },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.05 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 5,
      },
      handleScroll: { vertTouchDrag: false },
    });

    // Area series — smooth line with gradient fill
    const areaSeries = chart.addSeries(lc.AreaSeries, {
      lineColor: '#3b82f6',
      lineWidth: 2,
      topColor: 'rgba(59, 130, 246, 0.4)',
      bottomColor: 'rgba(59, 130, 246, 0.0)',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: '#3b82f6',
      crosshairMarkerBackgroundColor: '#ffffff',
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: '#3b82f6',
      priceLineWidth: 1,
      priceLineStyle: 2,
    });

    chartRef.current = chart;
    areaSeriesRef.current = areaSeries;

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      try { chart.remove(); } catch {}
    };
  }, []);

  // Init chart on mount
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let mounted = true;

    initChart().then((fn) => {
      if (mounted) {
        cleanup = fn;
      } else {
        // Component unmounted before init finished — clean up immediately
        fn?.();
      }
    });

    return () => {
      mounted = false;
      try { cleanup?.(); } catch {}
      chartRef.current = null;
      areaSeriesRef.current = null;
    };
  }, [initChart]);

  // Fetch candles when symbol changes
  useEffect(() => {
    if (symbol) {
      lastTimeRef.current = 0;
      fetchCandles(symbol, '1min', 200);
    }
  }, [symbol, fetchCandles]);

  // Convert OHLC candles to line data (close prices) and load
  useEffect(() => {
    if (areaSeriesRef.current && candles.length > 0) {
      const lineData = candles.map((c) => ({
        time: c.time as any,
        value: c.close,
      }));
      areaSeriesRef.current.setData(lineData);
      chartRef.current?.timeScale().fitContent();

      // Track the last timestamp from historical data
      const lastCandle = candles[candles.length - 1];
      if (lastCandle) {
        lastTimeRef.current = lastCandle.time;
      }
    }
  }, [candles]);

  // Update chart with real-time price ticks
  useEffect(() => {
    if (!areaSeriesRef.current || !price) return;

    // Convert timestamp: if in ms (>1e12), convert to seconds
    let tickTime = price.timestamp > 1e12
      ? Math.floor(price.timestamp / 1000)
      : Math.floor(price.timestamp);

    // Ensure time is always >= last known time (Lightweight Charts requires monotonic time)
    if (tickTime <= lastTimeRef.current) {
      tickTime = lastTimeRef.current + 1;
    }

    try {
      areaSeriesRef.current.update({
        time: tickTime as any,
        value: price.price,
      });
      lastTimeRef.current = tickTime;
    } catch {
      // Silently ignore update errors (e.g., chart removed during unmount)
    }
  }, [price]);

  return (
    <div className="relative w-full h-full min-h-[200px]">
      <div ref={containerRef} className="w-full h-full" />
      {candlesLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-800/50">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
