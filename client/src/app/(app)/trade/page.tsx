'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/Button';
import AssetSelector from '@/components/trading/AssetSelector';
import PriceDisplay from '@/components/trading/PriceDisplay';
import ActiveTrades from '@/components/trading/ActiveTrades';
import TradeResult from '@/components/trading/TradeResult';
import { useMarketStore } from '@/store/marketStore';
import { useTradeStore } from '@/store/tradeStore';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import { usePriceFeed } from '@/hooks/usePriceFeed';
import { QUICK_AMOUNTS, TRADE_TIMEFRAMES } from '@stakeoption/shared';
import { ArrowUp, ArrowDown, Wifi, WifiOff } from 'lucide-react';
import { toast } from '@/components/ui/Toast';
import clsx from 'clsx';

const TradingChart = dynamic(
  () => import('@/components/trading/TradingChart'),
  { ssr: false, loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-surface-800">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )}
);

export default function TradePage() {
  const [amount, setAmount] = useState(500);
  const [timeframe, setTimeframe] = useState(60);
  const { selectedAsset, fetchAssets } = useMarketStore();
  const { placeTrade, isPlacing, fetchActiveTrades, initSettlementListener } = useTradeStore();
  const { accountMode, updateDemoBalance } = useAuthStore();
  const { fetchBalance } = useWalletStore();
  const { price, isConnected } = usePriceFeed(selectedAsset?.symbol || null);

  useEffect(() => {
    fetchAssets();
    initSettlementListener();
  }, [fetchAssets, initSettlementListener]);

  const isDemo = accountMode === 'demo';

  useEffect(() => {
    fetchActiveTrades(isDemo);
  }, [isDemo, fetchActiveTrades]);

  const payoutRate = selectedAsset ? selectedAsset.payout_rate : 85;
  const potentialProfit = Math.round(amount * (payoutRate / 100));

  const handleTrade = async (direction: 'UP' | 'DOWN') => {
    if (!selectedAsset) return;

    try {
      const result = await placeTrade({
        asset_id: selectedAsset.id,
        direction,
        amount,
        timeframe_seconds: timeframe,
        is_demo: isDemo,
      });

      if (isDemo) {
        updateDemoBalance(result.new_balance);
      } else {
        fetchBalance();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to place trade');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-800 border-b border-surface-700">
        <AssetSelector />
        <div className="flex items-center gap-2">
          {price && (
            <PriceDisplay
              symbol={selectedAsset?.symbol || ''}
              price={price.price}
              bid={price.bid}
              ask={price.ask}
            />
          )}
          <div className="ml-2 flex items-center gap-1">
            {isConnected ? (
              <Wifi className="w-3.5 h-3.5 text-trade-up/70" />
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-trade-down/70" />
                <span className="text-[10px] text-yellow-400 animate-pulse">Reconnecting...</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 bg-surface-800 relative min-h-0">
        {selectedAsset ? (
          <TradingChart symbol={selectedAsset.symbol} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-surface-200/40 text-sm">Select an asset to view chart</p>
          </div>
        )}
      </div>

      {/* Active Trades Strip */}
      <ActiveTrades />

      {/* Trade Panel */}
      <div className="bg-surface-800 border-t border-surface-700 p-3 space-y-3">
        {/* Timeframe */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          {TRADE_TIMEFRAMES.map((tf) => (
            <button
              key={tf.seconds}
              onClick={() => setTimeframe(tf.seconds)}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                timeframe === tf.seconds
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface-700 text-surface-200/60 hover:text-surface-200'
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs text-surface-200/60">
              Amount (KSh){isDemo ? ' - Demo' : ''}
            </span>
            <span className="text-xs text-brand-400 ml-auto">
              Profit: +{potentialProfit.toLocaleString()} ({payoutRate}%)
            </span>
          </div>
          <div className="flex gap-1.5">
            {QUICK_AMOUNTS.map((qa) => (
              <button
                key={qa}
                onClick={() => setAmount(qa)}
                className={clsx(
                  'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  amount === qa
                    ? 'bg-brand-600/20 text-brand-400 border border-brand-600'
                    : 'bg-surface-700 text-surface-200/60 hover:text-surface-200'
                )}
              >
                {qa >= 1000 ? `${qa / 1000}K` : qa}
              </button>
            ))}
          </div>
        </div>

        {/* UP / DOWN */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="up"
            size="lg"
            className="text-base font-bold"
            onClick={() => handleTrade('UP')}
            disabled={isPlacing || !selectedAsset}
            isLoading={isPlacing}
          >
            <ArrowUp className="w-5 h-5" />
            UP
          </Button>
          <Button
            variant="down"
            size="lg"
            className="text-base font-bold"
            onClick={() => handleTrade('DOWN')}
            disabled={isPlacing || !selectedAsset}
            isLoading={isPlacing}
          >
            <ArrowDown className="w-5 h-5" />
            DOWN
          </Button>
        </div>
      </div>

      {/* Trade Result Popup */}
      <TradeResult />
    </div>
  );
}
