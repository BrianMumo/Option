'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import { AccountModeToggle } from './AccountModeToggle';
import { formatKES } from '@stakeoption/shared';
import { Bell } from 'lucide-react';
import Link from 'next/link';

export function Header() {
  const { balance, fetchBalance } = useWalletStore();
  const { user, accountMode } = useAuthStore();

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const displayBalance = accountMode === 'demo'
    ? (user?.demo_balance ?? 10000)
    : balance;

  return (
    <header className="sticky top-0 bg-surface-800/95 backdrop-blur-sm border-b border-surface-700 z-40">
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        <Link href="/trade" className="flex items-center gap-1">
          <span className="text-brand-500 font-bold text-lg">Stake</span>
          <span className="text-gold-400 font-bold text-lg">Option</span>
        </Link>

        <div className="flex items-center gap-2">
          <AccountModeToggle />
          <Link href="/wallet" className="text-right min-w-[70px]">
            <p className="text-[10px] text-surface-200/60 leading-none">
              {accountMode === 'demo' ? 'Demo' : 'Balance'}
            </p>
            <p className={`text-sm font-semibold leading-tight ${accountMode === 'demo' ? 'text-brand-400' : 'text-gold-400'}`}>
              {formatKES(displayBalance)}
            </p>
          </Link>
          <button className="p-1.5 text-surface-200/60 hover:text-surface-200 transition-colors relative">
            <Bell className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
