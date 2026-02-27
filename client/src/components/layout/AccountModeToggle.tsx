'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/components/ui/Toast';
import clsx from 'clsx';

export function AccountModeToggle() {
  const { accountMode, setAccountMode, isPreview } = useAuthStore();
  const router = useRouter();

  const handleRealClick = () => {
    if (isPreview) {
      toast.info('Create an account to trade with real money');
      router.push('/register');
      return;
    }
    setAccountMode('real');
  };

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
        onClick={handleRealClick}
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
