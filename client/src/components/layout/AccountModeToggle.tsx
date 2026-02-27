'use client';

import { useAuthStore } from '@/store/authStore';
import clsx from 'clsx';

export function AccountModeToggle() {
  const { accountMode, setAccountMode } = useAuthStore();

  return (
    <div className="flex bg-surface-900 rounded-lg p-0.5 border border-surface-700">
      <button
        onClick={() => setAccountMode('demo')}
        className={clsx(
          'px-3 py-1 rounded-md text-[11px] font-semibold transition-all duration-200',
          accountMode === 'demo'
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-surface-200/50 hover:text-surface-200'
        )}
      >
        Demo
      </button>
      <button
        onClick={() => setAccountMode('real')}
        className={clsx(
          'px-3 py-1 rounded-md text-[11px] font-semibold transition-all duration-200',
          accountMode === 'real'
            ? 'bg-gold-500 text-surface-900 shadow-sm'
            : 'text-surface-200/50 hover:text-surface-200'
        )}
      >
        Real
      </button>
    </div>
  );
}
