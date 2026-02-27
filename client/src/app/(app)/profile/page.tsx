'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { AccountModeToggle } from '@/components/layout/AccountModeToggle';
import { formatKES, DEMO_INITIAL_BALANCE } from '@stakeoption/shared';
import { api } from '@/lib/api';
import { User, Shield, Phone, Mail, LogOut, ChevronRight, RefreshCw, Wallet } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const { user, updateDemoBalance, logout } = useAuthStore();
  const { balance } = useWalletStore();
  const [resetting, setResetting] = useState(false);

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  async function handleResetDemo() {
    setResetting(true);
    try {
      const res = await api<{ demo_balance: number }>('/auth/reset-demo-balance', {
        method: 'POST',
      });
      if (res.success && res.data) {
        updateDemoBalance(res.data.demo_balance);
      }
    } catch {
      // silently handle
    } finally {
      setResetting(false);
    }
  }

  const demoBalance = user?.demo_balance ?? DEMO_INITIAL_BALANCE;

  return (
    <div className="p-4 space-y-4">
      {/* Profile Header */}
      <div className="card flex items-center gap-4 py-6">
        <div className="w-14 h-14 bg-brand-600/20 rounded-full flex items-center justify-center">
          <User className="w-7 h-7 text-brand-400" />
        </div>
        <div>
          <p className="font-semibold text-surface-50">
            {user?.first_name || 'Trader'} {user?.last_name || ''}
          </p>
          <p className="text-sm text-surface-200/60">{user?.phone}</p>
        </div>
      </div>

      {/* Account Mode */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-surface-200">Account Mode</span>
          <AccountModeToggle />
        </div>

        {/* Demo Account Card */}
        <div className="bg-surface-900 rounded-lg p-3 border border-surface-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-brand-400" />
              <span className="text-xs font-medium text-brand-400">Demo Account</span>
            </div>
            <button
              onClick={handleResetDemo}
              disabled={resetting}
              className="flex items-center gap-1 text-xs text-surface-200/60 hover:text-brand-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${resetting ? 'animate-spin' : ''}`} />
              Reset
            </button>
          </div>
          <p className="text-lg font-bold text-brand-400">{formatKES(demoBalance)}</p>
          <p className="text-xs text-surface-200/40 mt-1">Practice trading with virtual money</p>
        </div>

        {/* Real Account Card */}
        <div className="bg-surface-900 rounded-lg p-3 border border-surface-700">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-gold-400" />
            <span className="text-xs font-medium text-gold-400">Real Account</span>
          </div>
          <p className="text-lg font-bold text-gold-400">{formatKES(balance)}</p>
          <p className="text-xs text-surface-200/40 mt-1">Your live trading balance</p>
        </div>
      </div>

      {/* Account Info */}
      <div className="card divide-y divide-surface-700">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-surface-200/40" />
            <span className="text-sm text-surface-200">Phone</span>
          </div>
          <span className="text-sm text-surface-50">{user?.phone}</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-surface-200/40" />
            <span className="text-sm text-surface-200">Email</span>
          </div>
          <span className="text-sm text-surface-50">{user?.email || 'Not set'}</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 text-surface-200/40" />
            <span className="text-sm text-surface-200">KYC Status</span>
          </div>
          <span className={`text-sm px-2 py-0.5 rounded-full text-xs font-medium ${
            user?.kyc_status === 'approved' ? 'bg-green-500/20 text-green-400' :
            user?.kyc_status === 'submitted' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-surface-700 text-surface-200/60'
          }`}>
            {user?.kyc_status || 'Pending'}
          </span>
        </div>
      </div>

      {/* Menu Items */}
      <div className="card divide-y divide-surface-700">
        {[
          { label: 'Verification (KYC)', desc: 'Verify your identity' },
          { label: 'Security', desc: 'Password & 2FA' },
          { label: 'Help & Support', desc: 'Get assistance' },
        ].map((item) => (
          <button key={item.label} className="flex items-center justify-between py-3 w-full text-left">
            <div>
              <p className="text-sm text-surface-50">{item.label}</p>
              <p className="text-xs text-surface-200/40">{item.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-surface-200/30" />
          </button>
        ))}
      </div>

      {/* Logout */}
      <Button variant="secondary" className="w-full text-red-400 border-red-500/30" onClick={handleLogout}>
        <LogOut className="w-4 h-4" />
        Log Out
      </Button>
    </div>
  );
}
