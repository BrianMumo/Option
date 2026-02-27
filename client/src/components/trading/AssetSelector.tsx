'use client';

import { useState, useEffect } from 'react';
import { useMarketStore } from '@/store/marketStore';
import { usePriceStore } from '@/store/priceStore';
import { ChevronDown, Search, X } from 'lucide-react';
import clsx from 'clsx';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'velocity', label: 'Velocity' },
  { key: 'crash_boom', label: 'Crash/Boom' },
  { key: 'step', label: 'Step' },
  { key: 'range_break', label: 'Range Break' },
];

const CATEGORY_LABELS: Record<string, string> = {
  velocity: 'Velocity',
  crash_boom: 'Crash/Boom',
  step: 'Step',
  range_break: 'Range Break',
};

interface AssetSelectorProps {
  onSelect?: () => void;
}

export default function AssetSelector({ onSelect }: AssetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const { assets, selectedAsset, fetchAssets, selectAsset } = useMarketStore();
  const { prices } = usePriceStore();

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const filtered = assets.filter((a) => {
    if (category !== 'all' && a.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
    }
    return true;
  });

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-surface-700/50 rounded-lg hover:bg-surface-700 transition-colors"
      >
        <span className="text-sm font-medium text-surface-50">
          {selectedAsset?.symbol || 'Select Asset'}
        </span>
        <ChevronDown className="w-4 h-4 text-surface-200/60" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-surface-900/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-surface-700">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/40" />
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-50 placeholder:text-surface-200/40 focus:outline-none focus:border-brand-500"
            autoFocus
          />
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-2 text-surface-200/60 hover:text-surface-50"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 p-3 border-b border-surface-700 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
              category === cat.key
                ? 'bg-brand-600 text-white'
                : 'bg-surface-800 text-surface-200/60 hover:text-surface-200'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Asset List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((asset) => {
          const livePrice = prices[asset.symbol];
          const isSelected = selectedAsset?.symbol === asset.symbol;

          return (
            <button
              key={asset.id}
              onClick={() => {
                selectAsset(asset);
                setIsOpen(false);
                onSelect?.();
              }}
              className={clsx(
                'w-full flex items-center justify-between px-4 py-3 border-b border-surface-800 hover:bg-surface-800/50 transition-colors',
                isSelected && 'bg-brand-600/10 border-l-2 border-l-brand-500'
              )}
            >
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-surface-50">
                    {asset.symbol}
                  </span>
                  <span className={clsx(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                    asset.category === 'velocity' && 'bg-blue-500/20 text-blue-400',
                    asset.category === 'crash_boom' && 'bg-red-500/20 text-red-400',
                    asset.category === 'step' && 'bg-green-500/20 text-green-400',
                    asset.category === 'range_break' && 'bg-amber-500/20 text-amber-400'
                  )}>
                    {CATEGORY_LABELS[asset.category] || asset.category}
                  </span>
                </div>
                <p className="text-xs text-surface-200/50 mt-0.5">{asset.name}</p>
              </div>

              <div className="text-right">
                {livePrice ? (
                  <>
                    <p className="text-sm font-mono text-surface-50">
                      {livePrice.price.toFixed(2)}
                    </p>
                    <p className="text-xs text-surface-200/40">
                      {asset.payout_rate}% payout
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-surface-200/40">--</p>
                )}
              </div>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-surface-200/40 text-sm">
            No assets found
          </div>
        )}
      </div>
    </div>
  );
}
