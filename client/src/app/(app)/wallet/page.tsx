'use client';

import { useEffect, useState } from 'react';
import { useWalletStore } from '@/store/walletStore';
import { formatKES } from '@stakeoption/shared';
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw } from 'lucide-react';
import { DepositForm } from '@/components/wallet/DepositForm';
import { WithdrawForm } from '@/components/wallet/WithdrawForm';
import { TransactionList } from '@/components/wallet/TransactionList';
import clsx from 'clsx';

export default function WalletPage() {
  const { balance, isLoading, fetchBalance, initWalletListener } = useWalletStore();
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');

  useEffect(() => {
    fetchBalance();
    initWalletListener();
  }, [fetchBalance, initWalletListener]);

  return (
    <div className="p-4 space-y-6">
      {/* Balance Card */}
      <div className="card text-center py-8 relative">
        <button
          onClick={fetchBalance}
          className="absolute top-3 right-3 p-2 text-surface-200/40 hover:text-surface-200 transition-colors"
          title="Refresh balance"
        >
          <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
        </button>
        <p className="text-sm text-surface-200/60 mb-1">Available Balance</p>
        <p className="text-4xl font-bold text-brand-400">{formatKES(balance)}</p>
      </div>

      {/* Deposit/Withdraw Tabs */}
      <div className="flex bg-surface-800 rounded-xl p-1 border border-surface-700">
        <button
          onClick={() => setActiveTab('deposit')}
          className={clsx(
            'flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
            activeTab === 'deposit' ? 'bg-brand-600 text-white' : 'text-surface-200/60'
          )}
        >
          <ArrowDownToLine className="w-4 h-4" />
          Deposit
        </button>
        <button
          onClick={() => setActiveTab('withdraw')}
          className={clsx(
            'flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
            activeTab === 'withdraw' ? 'bg-brand-600 text-white' : 'text-surface-200/60'
          )}
        >
          <ArrowUpFromLine className="w-4 h-4" />
          Withdraw
        </button>
      </div>

      {/* Form */}
      <div className="card">
        {activeTab === 'deposit' ? <DepositForm /> : <WithdrawForm />}
      </div>

      {/* Transaction History */}
      <TransactionList />
    </div>
  );
}
