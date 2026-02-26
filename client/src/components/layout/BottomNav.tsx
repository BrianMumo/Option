'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TrendingUp, Wallet, Clock, User } from 'lucide-react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { href: '/trade', label: 'Trade', icon: TrendingUp },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/history', label: 'History', icon: Clock },
  { href: '/profile', label: 'Profile', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface-800 border-t border-surface-700 z-50 safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors min-w-[64px]',
                isActive ? 'text-brand-500' : 'text-surface-200/60 hover:text-surface-200'
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
