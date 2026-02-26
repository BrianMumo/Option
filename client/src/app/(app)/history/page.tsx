'use client';

import { useEffect, useState } from 'react';
import { useTradeStore } from '@/store/tradeStore';
import { useAuthStore } from '@/store/authStore';
import { Clock, ArrowUp, ArrowDown, Trophy, TrendingDown, Minus, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'win', label: 'Wins' },
  { key: 'loss', label: 'Losses' },
  { key: 'draw', label: 'Draws' },
];

export default function HistoryPage() {
  const [filter, setFilter] = useState('all');
  const { tradeHistory, historyPagination, fetchTradeHistory } = useTradeStore();
  const { isPreview } = useAuthStore();

  useEffect(() => {
    if (!isPreview) {
      fetchTradeHistory({
        result: filter !== 'all' ? filter : undefined,
        page: 1,
        limit: 20,
      });
    }
  }, [filter, isPreview, fetchTradeHistory]);

  const handlePageChange = (page: number) => {
    fetchTradeHistory({
      result: filter !== 'all' ? filter : undefined,
      page,
      limit: 20,
    });
  };

  // Preview mode — show sample trades
  if (isPreview) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold text-surface-50 mb-4">Trade History</h2>
        <div className="card text-center py-12">
          <Clock className="w-12 h-12 text-surface-200/20 mx-auto mb-3" />
          <p className="text-surface-200/60 text-sm">Demo Mode</p>
          <p className="text-surface-200/40 text-xs mt-1">
            Place trades to see your history here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-surface-50 mb-4">Trade History</h2>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              filter === f.key
                ? 'bg-brand-600 text-white'
                : 'bg-surface-800 text-surface-200/60 hover:text-surface-200'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Trade List */}
      {tradeHistory.length === 0 ? (
        <div className="card text-center py-12">
          <Clock className="w-12 h-12 text-surface-200/20 mx-auto mb-3" />
          <p className="text-surface-200/60 text-sm">No trades yet</p>
          <p className="text-surface-200/40 text-xs mt-1">
            Your completed trades will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tradeHistory.map((trade) => (
            <div
              key={trade.id}
              className={clsx(
                'card flex items-center gap-3 p-3',
                trade.result === 'win' && 'border-l-2 border-l-trade-up',
                trade.result === 'loss' && 'border-l-2 border-l-trade-down',
                trade.result === 'draw' && 'border-l-2 border-l-yellow-500'
              )}
            >
              {/* Result Icon */}
              <div
                className={clsx(
                  'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                  trade.result === 'win' && 'bg-trade-up/10',
                  trade.result === 'loss' && 'bg-trade-down/10',
                  trade.result === 'draw' && 'bg-yellow-500/10'
                )}
              >
                {trade.result === 'win' && <Trophy className="w-4 h-4 text-trade-up" />}
                {trade.result === 'loss' && <TrendingDown className="w-4 h-4 text-trade-down" />}
                {trade.result === 'draw' && <Minus className="w-4 h-4 text-yellow-500" />}
              </div>

              {/* Trade Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-surface-50">
                    {trade.asset_symbol}
                  </span>
                  {trade.direction === 'UP' ? (
                    <ArrowUp className="w-3 h-3 text-trade-up" />
                  ) : (
                    <ArrowDown className="w-3 h-3 text-trade-down" />
                  )}
                  {trade.is_demo && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-surface-700 text-surface-200/50">
                      DEMO
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-surface-200/40 mt-0.5">
                  <span>KSh {trade.amount.toLocaleString()}</span>
                  <span>|</span>
                  <span>{new Date(trade.settled_at || trade.created_at).toLocaleDateString()}</span>
                  <span>
                    {new Date(trade.settled_at || trade.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Profit/Loss */}
              <div className="text-right flex-shrink-0">
                <p
                  className={clsx(
                    'text-sm font-medium font-mono',
                    trade.result === 'win' && 'text-trade-up',
                    trade.result === 'loss' && 'text-trade-down',
                    trade.result === 'draw' && 'text-yellow-500'
                  )}
                >
                  {trade.profit != null && trade.profit > 0 ? '+' : ''}
                  {trade.profit != null ? `KSh ${Math.abs(trade.profit).toLocaleString()}` : '--'}
                </p>
                <p className="text-[10px] text-surface-200/30 font-mono">
                  {trade.entry_price} → {trade.exit_price || '--'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {historyPagination && historyPagination.pages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            onClick={() => handlePageChange(historyPagination.page - 1)}
            disabled={historyPagination.page <= 1}
            className="p-2 text-surface-200/60 hover:text-surface-50 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-surface-200/60">
            Page {historyPagination.page} of {historyPagination.pages}
          </span>
          <button
            onClick={() => handlePageChange(historyPagination.page + 1)}
            disabled={historyPagination.page >= historyPagination.pages}
            className="p-2 text-surface-200/60 hover:text-surface-50 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
