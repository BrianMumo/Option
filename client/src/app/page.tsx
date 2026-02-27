'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <span className="text-brand-500">Stake</span>
            <span className="text-gold-400">Option</span>
          </h1>
          <p className="text-surface-200/60 text-sm">Trade Smart. Earn More.</p>
        </div>

        <h2 className="text-2xl font-bold text-surface-50 mb-4 max-w-sm">
          Trade Binary Options with M-Pesa
        </h2>
        <p className="text-surface-200/80 mb-8 max-w-sm">
          Deposit instantly. Trade Velocity synthetic indices 24/7. Withdraw to M-Pesa in minutes.
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link href="/register" className="btn-primary text-center text-lg py-4">
            Get Started
          </Link>
          <Link href="/login" className="btn-secondary text-center">
            I have an account
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mt-12 max-w-sm w-full">
          <div className="text-center">
            <div className="text-2xl font-bold text-brand-400">85%</div>
            <div className="text-xs text-surface-200/60 mt-1">Payout Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-brand-400">KSh 50</div>
            <div className="text-xs text-surface-200/60 mt-1">Min Trade</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-brand-400">30s</div>
            <div className="text-xs text-surface-200/60 mt-1">Fastest Trade</div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-surface-200/40">
        <p>Trading involves risk. Trade responsibly.</p>
      </footer>
    </div>
  );
}
