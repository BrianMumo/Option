'use client';

import { useTradeStore } from '@/store/tradeStore';
import { Trophy, TrendingDown, Minus, X } from 'lucide-react';
import clsx from 'clsx';

export default function TradeResult() {
  const { lastSettlement, showResult, dismissResult } = useTradeStore();

  if (!showResult || !lastSettlement) return null;

  const { result, amount, profit, asset_symbol, direction, entry_price, exit_price } = lastSettlement;

  const isWin = result === 'win';
  const isDraw = result === 'draw';
  const payout = isWin ? amount + profit : isDraw ? amount : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className={clsx(
          'relative w-[85%] max-w-sm rounded-2xl p-6 text-center shadow-2xl animate-scaleIn',
          isWin && 'bg-gradient-to-b from-trade-up/20 to-surface-800 border border-trade-up/30',
          result === 'loss' && 'bg-gradient-to-b from-trade-down/20 to-surface-800 border border-trade-down/30',
          isDraw && 'bg-gradient-to-b from-yellow-500/20 to-surface-800 border border-yellow-500/30'
        )}
      >
        {/* Close button */}
        <button
          onClick={dismissResult}
          className="absolute top-3 right-3 p-1 text-surface-200/40 hover:text-surface-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div
          className={clsx(
            'w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center',
            isWin && 'bg-trade-up/20',
            result === 'loss' && 'bg-trade-down/20',
            isDraw && 'bg-yellow-500/20'
          )}
        >
          {isWin && <Trophy className="w-8 h-8 text-trade-up" />}
          {result === 'loss' && <TrendingDown className="w-8 h-8 text-trade-down" />}
          {isDraw && <Minus className="w-8 h-8 text-yellow-500" />}
        </div>

        {/* Result Title */}
        <h3
          className={clsx(
            'text-2xl font-bold mb-1',
            isWin && 'text-trade-up',
            result === 'loss' && 'text-trade-down',
            isDraw && 'text-yellow-500'
          )}
        >
          {isWin ? 'YOU WON!' : result === 'loss' ? 'YOU LOST' : 'DRAW'}
        </h3>

        {/* Profit/Loss Amount */}
        <p
          className={clsx(
            'text-3xl font-bold font-mono mb-3',
            isWin && 'text-trade-up',
            result === 'loss' && 'text-trade-down',
            isDraw && 'text-yellow-500'
          )}
        >
          {isWin ? '+' : result === 'loss' ? '-' : ''}KSh {Math.abs(profit).toLocaleString()}
        </p>

        {/* Trade Details */}
        <div className="space-y-1.5 text-sm text-surface-200/60 mb-4">
          <div className="flex justify-between">
            <span>Asset</span>
            <span className="text-surface-50">{asset_symbol}</span>
          </div>
          <div className="flex justify-between">
            <span>Direction</span>
            <span className={direction === 'UP' ? 'text-trade-up' : 'text-trade-down'}>
              {direction}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Entry</span>
            <span className="text-surface-50 font-mono">{entry_price}</span>
          </div>
          <div className="flex justify-between">
            <span>Exit</span>
            <span className="text-surface-50 font-mono">{exit_price}</span>
          </div>
          <div className="flex justify-between">
            <span>Stake</span>
            <span className="text-surface-50">KSh {amount.toLocaleString()}</span>
          </div>
          {isWin && (
            <div className="flex justify-between pt-1 border-t border-surface-700">
              <span>Payout</span>
              <span className="text-trade-up font-medium">
                KSh {payout.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={dismissResult}
          className={clsx(
            'w-full py-2.5 rounded-xl font-medium transition-colors',
            isWin && 'bg-trade-up/20 text-trade-up hover:bg-trade-up/30',
            result === 'loss' && 'bg-trade-down/20 text-trade-down hover:bg-trade-down/30',
            isDraw && 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'
          )}
        >
          Continue Trading
        </button>
      </div>
    </div>
  );
}
