'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useWalletStore } from '@/store/walletStore';
import { useAuthStore } from '@/store/authStore';
import { Smartphone, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import clsx from 'clsx';

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

export function DepositForm() {
  const user = useAuthStore((s) => s.user);
  const { deposit, depositLoading, depositStatus, depositMessage, resetDepositStatus } = useWalletStore();
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const depositPhone = phone || user?.phone || '';

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const depositAmount = parseInt(amount);
    if (!depositAmount || depositAmount < 100) {
      setError('Minimum deposit is KSh 100');
      return;
    }
    if (depositAmount > 300000) {
      setError('Maximum deposit is KSh 300,000');
      return;
    }

    try {
      await deposit(depositAmount, phone || undefined);
    } catch (err: any) {
      setError(err.message);
    }
  }

  // STK Push pending state
  if (depositStatus === 'pending') {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="w-16 h-16 bg-brand-600/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
          <Smartphone className="w-8 h-8 text-brand-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-surface-50">Check Your Phone</h3>
          <p className="text-sm text-surface-200/60 mt-1 max-w-xs mx-auto">
            {depositMessage}
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-surface-200/40">
          <Loader2 className="w-3 h-3 animate-spin" />
          Waiting for M-Pesa confirmation...
        </div>
        <Button variant="ghost" size="sm" onClick={resetDepositStatus}>
          Make another deposit
        </Button>
      </div>
    );
  }

  // Success state
  if (depositStatus === 'success') {
    return (
      <div className="text-center py-8 space-y-4">
        <CheckCircle className="w-16 h-16 text-brand-500 mx-auto" />
        <div>
          <h3 className="text-lg font-semibold text-surface-50">Deposit Successful!</h3>
          <p className="text-sm text-surface-200/60 mt-1">{depositMessage}</p>
        </div>
        <Button variant="secondary" onClick={resetDepositStatus}>
          Make another deposit
        </Button>
      </div>
    );
  }

  // Failed state
  if (depositStatus === 'failed') {
    return (
      <div className="text-center py-8 space-y-4">
        <XCircle className="w-16 h-16 text-red-400 mx-auto" />
        <div>
          <h3 className="text-lg font-semibold text-surface-50">Deposit Failed</h3>
          <p className="text-sm text-red-400 mt-1">{depositMessage}</p>
        </div>
        <Button variant="secondary" onClick={resetDepositStatus}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleDeposit} className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <Input
        id="deposit-amount"
        label="Amount (KSh)"
        type="number"
        placeholder="Enter amount (min 100)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        min={100}
        max={300000}
        required
      />

      <div className="flex gap-2 flex-wrap">
        {QUICK_AMOUNTS.map((qa) => (
          <button
            key={qa}
            type="button"
            onClick={() => setAmount(String(qa))}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              amount === String(qa)
                ? 'bg-brand-600/20 text-brand-400 border border-brand-600'
                : 'bg-surface-700 text-surface-200/60 hover:text-surface-200'
            )}
          >
            {qa.toLocaleString()}
          </button>
        ))}
      </div>

      <Input
        id="deposit-phone"
        label="M-Pesa Phone Number"
        type="tel"
        placeholder={depositPhone || '+254712345678'}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <p className="text-xs text-surface-200/40 -mt-2">
        Leave empty to use your registered number ({user?.phone})
      </p>

      <Button type="submit" className="w-full" size="lg" isLoading={depositLoading}>
        <Smartphone className="w-5 h-5" />
        Deposit via M-Pesa
      </Button>

      <p className="text-xs text-surface-200/40 text-center">
        You&apos;ll receive an STK push on your phone. Enter your M-Pesa PIN to complete the deposit.
      </p>
    </form>
  );
}
