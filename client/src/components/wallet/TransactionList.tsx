'use client';

import { useEffect, useState } from 'react';
import { useWalletStore } from '@/store/walletStore';
import { formatKES } from '@stakeoption/shared';
import { ArrowDownToLine, ArrowUpFromLine, TrendingUp, TrendingDown, Gift, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

const TX_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  deposit: { label: 'Deposit', icon: ArrowDownToLine, color: 'text-brand-400' },
  withdrawal: { label: 'Withdrawal', icon: ArrowUpFromLine, color: 'text-orange-400' },
  trade_debit: { label: 'Trade Placed', icon: TrendingDown, color: 'text-red-400' },
  trade_credit: { label: 'Trade Won', icon: TrendingUp, color: 'text-brand-400' },
  bonus: { label: 'Bonus', icon: Gift, color: 'text-gold-400' },
};

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-brand-600/20 text-brand-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
  processing: 'bg-blue-500/20 text-blue-400',
  failed: 'bg-red-500/20 text-red-400',
  reversed: 'bg-surface-700 text-surface-200/60',
};

type TxFilter = 'all' | 'deposit' | 'withdrawal' | 'trade_debit' | 'trade_credit';

export function TransactionList() {
  const { transactions, txPagination, fetchTransactions } = useWalletStore();
  const [filter, setFilter] = useState<TxFilter>('all');

  useEffect(() => {
    fetchTransactions(1, filter === 'all' ? undefined : filter);
  }, [filter, fetchTransactions]);

  const filters: { value: TxFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'deposit', label: 'Deposits' },
    { value: 'withdrawal', label: 'Withdrawals' },
    { value: 'trade_credit', label: 'Winnings' },
  ];

  return (
    <div>
      <h3 className="text-sm font-medium text-surface-200/60 mb-3">Transactions</h3>

      {/* Filters */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={clsx(
              'px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
              filter === f.value
                ? 'bg-brand-600 text-white'
                : 'bg-surface-700 text-surface-200/60 hover:text-surface-200'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Transaction List */}
      {transactions.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-surface-200/40 text-sm">No transactions yet</p>
          <p className="text-surface-200/30 text-xs mt-1">Your transactions will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => {
            const config = TX_TYPE_CONFIG[tx.type] || TX_TYPE_CONFIG.deposit;
            const Icon = config.icon;
            const isPositive = tx.amount > 0;

            return (
              <div key={tx.id} className="card flex items-center gap-3 py-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center bg-surface-700 ${config.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-50">{config.label}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[tx.status] || ''}`}>
                      {tx.status}
                    </span>
                    <span className="text-[10px] text-surface-200/40">
                      {new Date(tx.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className={clsx('text-sm font-semibold', isPositive ? 'text-brand-400' : 'text-red-400')}>
                    {isPositive ? '+' : ''}{formatKES(Math.abs(tx.amount))}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {txPagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => fetchTransactions(txPagination.page - 1, filter === 'all' ? undefined : filter)}
            disabled={txPagination.page <= 1}
            className="p-2 text-surface-200/60 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-surface-200/40">
            Page {txPagination.page} of {txPagination.pages}
          </span>
          <button
            onClick={() => fetchTransactions(txPagination.page + 1, filter === 'all' ? undefined : filter)}
            disabled={txPagination.page >= txPagination.pages}
            className="p-2 text-surface-200/60 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
