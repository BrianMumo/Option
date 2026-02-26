'use client';

import { useEffect, useState } from 'react';
import { useTradeStore } from '@/store/tradeStore';
import { usePriceStore } from '@/store/priceStore';
import { ArrowUp, ArrowDown, Clock } from 'lucide-react';
import clsx from 'clsx';

export default function ActiveTrades() {
  const { activeTrades } = useTradeStore();

  if (activeTrades.length === 0) return null;

  return (
    <div className="bg-surface-800/80 border-t border-surface-700">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-surface-700/50">
        <Clock className="w-3 h-3 text-surface-200/40" />
        <span className="text-[10px] uppercase tracking-wider text-surface-200/40 font-medium">
          Active Trades ({activeTrades.length})
        </span>
      </div>
      <div className="flex gap-2 px-3 py-2 overflow-x-auto scrollbar-hide">
        {activeTrades.map((trade) => (
          <ActiveTradeCard key={trade.id} trade={trade} />
        ))}
      </div>
    </div>
  );
}

function ActiveTradeCard({ trade }: { trade: any }) {
  const { prices } = usePriceStore();
  const [timeLeft, setTimeLeft] = useState('');

  const currentPrice = prices[trade.asset_symbol];

  // Countdown timer
  useEffect(() => {
    const update = () => {
      const remaining = new Date(trade.expires_at).getTime() - Date.now();
      if (remaining <= 0) {
        setTimeLeft('Settling...');
        return;
      }
      const secs = Math.floor(remaining / 1000);
      const mins = Math.floor(secs / 60);
      if (mins > 0) {
        setTimeLeft(`${mins}:${String(secs % 60).padStart(2, '0')}`);
      } else {
        setTimeLeft(`${secs}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [trade.expires_at]);

  // Current P/L
  const currentPriceNum = currentPrice?.price || trade.entry_price;
  const isWinning = trade.direction === 'UP'
    ? currentPriceNum > trade.entry_price
    : currentPriceNum < trade.entry_price;
  const isLosing = trade.direction === 'UP'
    ? currentPriceNum < trade.entry_price
    : currentPriceNum > trade.entry_price;

  return (
    <div
      className={clsx(
        'flex-shrink-0 w-40 rounded-lg p-2 border transition-colors',
        isWinning && 'bg-trade-up/5 border-trade-up/30',
        isLosing && 'bg-trade-down/5 border-trade-down/30',
        !isWinning && !isLosing && 'bg-surface-700/30 border-surface-600/30'
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          {trade.direction === 'UP' ? (
            <ArrowUp className="w-3 h-3 text-trade-up" />
          ) : (
            <ArrowDown className="w-3 h-3 text-trade-down" />
          )}
          <span className="text-[10px] font-medium text-surface-50">
            {trade.asset_symbol}
          </span>
        </div>
        <span className="text-[10px] font-mono text-surface-200/60">{timeLeft}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-surface-200/80">
          KSh {trade.amount.toLocaleString()}
        </span>
        <span
          className={clsx(
            'text-[10px] font-medium',
            isWinning && 'text-trade-up',
            isLosing && 'text-trade-down',
            !isWinning && !isLosing && 'text-surface-200/40'
          )}
        >
          {isWinning ? '+' : isLosing ? '-' : ''}
          {Math.round(trade.amount * (trade.payout_rate / 100)).toLocaleString()}
        </span>
      </div>
    </div>
  );
}
