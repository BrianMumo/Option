'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useWalletStore } from '@/store/walletStore';
import { useAuthStore } from '@/store/authStore';
import { formatKES } from '@stakeoption/shared';
import { ArrowUpFromLine, AlertTriangle } from 'lucide-react';

export function WithdrawForm() {
  const user = useAuthStore((s) => s.user);
  const { balance, withdraw, withdrawLoading } = useWalletStore();
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const withdrawAmount = parseInt(amount);
    if (!withdrawAmount || withdrawAmount < 100) {
      setError('Minimum withdrawal is KSh 100');
      return;
    }
    if (withdrawAmount > 150000) {
      setError('Maximum withdrawal is KSh 150,000');
      return;
    }
    if (withdrawAmount > balance) {
      setError('Insufficient balance');
      return;
    }

    try {
      await withdraw(withdrawAmount, phone || undefined);
      setSuccess(`Withdrawal of ${formatKES(withdrawAmount)} submitted! Processing within 24 hours.`);
      setAmount('');
    } catch (err: any) {
      setError(err.message);
    }
  }

  const needsKyc = parseInt(amount || '0') > 5000 && user?.kyc_status !== 'approved';

  return (
    <form onSubmit={handleWithdraw} className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-brand-600/10 border border-brand-600/30 text-brand-400 px-4 py-3 rounded-xl text-sm">
          {success}
        </div>
      )}

      <div className="bg-surface-700/50 rounded-xl p-3 flex items-center justify-between">
        <span className="text-sm text-surface-200/60">Available Balance</span>
        <span className="font-semibold text-brand-400">{formatKES(balance)}</span>
      </div>

      <Input
        id="withdraw-amount"
        label="Amount (KSh)"
        type="number"
        placeholder="Enter amount (min 100)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        min={100}
        max={150000}
        required
      />

      <div className="flex gap-2 flex-wrap">
        {[500, 1000, 2000, 5000].map((qa) => (
          <button
            key={qa}
            type="button"
            onClick={() => setAmount(String(Math.min(qa, balance)))}
            disabled={balance < qa}
            className="px-3 py-1.5 bg-surface-700 hover:bg-surface-700/80 rounded-lg text-xs text-surface-200/60 transition-colors disabled:opacity-30"
          >
            {qa.toLocaleString()}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAmount(String(Math.floor(balance)))}
          disabled={balance < 100}
          className="px-3 py-1.5 bg-surface-700 hover:bg-surface-700/80 rounded-lg text-xs text-brand-400 transition-colors disabled:opacity-30"
        >
          Max
        </button>
      </div>

      <Input
        id="withdraw-phone"
        label="M-Pesa Phone Number"
        type="tel"
        placeholder={user?.phone || '+254712345678'}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <p className="text-xs text-surface-200/40 -mt-2">
        Leave empty to withdraw to your registered number
      </p>

      {needsKyc && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-yellow-400">
            KYC verification is required for withdrawals above KSh 5,000. Please complete verification in your Profile.
          </p>
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        size="lg"
        isLoading={withdrawLoading}
        disabled={needsKyc || balance < 100}
      >
        <ArrowUpFromLine className="w-5 h-5" />
        Withdraw to M-Pesa
      </Button>

      <p className="text-xs text-surface-200/40 text-center">
        Withdrawals are processed within 24 hours. You&apos;ll receive the funds directly to your M-Pesa.
      </p>
    </form>
  );
}
