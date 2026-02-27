'use client';

import { useEffect, useCallback } from 'react';
import { create } from 'zustand';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import clsx from 'clsx';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((state) => ({
      toasts: [...state.toasts.slice(-4), { id, message, type }],
    }));
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

export const toast = {
  success: (message: string) => useToastStore.getState().addToast(message, 'success'),
  error: (message: string) => useToastStore.getState().addToast(message, 'error'),
  info: (message: string) => useToastStore.getState().addToast(message, 'info'),
};

function ToastItem({ toast: t, onRemove }: { toast: Toast; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 3500);
    return () => clearTimeout(timer);
  }, [onRemove]);

  const Icon = t.type === 'success' ? CheckCircle : t.type === 'error' ? AlertCircle : Info;

  return (
    <div
      className={clsx(
        'flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg max-w-sm w-full',
        'animate-in slide-in-from-top-2 fade-in duration-200',
        'border backdrop-blur-sm',
        t.type === 'success' && 'bg-trade-up/10 border-trade-up/30 text-trade-up',
        t.type === 'error' && 'bg-trade-down/10 border-trade-down/30 text-trade-down',
        t.type === 'info' && 'bg-brand-500/10 border-brand-500/30 text-brand-400',
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="text-sm font-medium flex-1">{t.message}</span>
      <button onClick={onRemove} className="p-0.5 opacity-60 hover:opacity-100 transition-opacity">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  const handleRemove = useCallback(
    (id: string) => () => removeToast(id),
    [removeToast]
  );

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onRemove={handleRemove(t.id)} />
        </div>
      ))}
    </div>
  );
}
