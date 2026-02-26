'use client';

import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { FullPageLoader } from '@/components/ui/LoadingSpinner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth(true);

  if (isLoading) return <FullPageLoader />;
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen pb-16">
      <Header />
      <main className="max-w-lg mx-auto">{children}</main>
      <BottomNav />
    </div>
  );
}
