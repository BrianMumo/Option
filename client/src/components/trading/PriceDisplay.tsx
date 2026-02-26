'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

interface PriceDisplayProps {
  symbol: string;
  price: number | null;
  bid?: number | null;
  ask?: number | null;
}

export default function PriceDisplay({ symbol, price, bid, ask }: PriceDisplayProps) {
  const prevPriceRef = useRef<number | null>(null);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (price === null || prevPriceRef.current === null) {
      prevPriceRef.current = price;
      return;
    }

    if (price > prevPriceRef.current) {
      setDirection('up');
    } else if (price < prevPriceRef.current) {
      setDirection('down');
    }

    prevPriceRef.current = price;

    const timer = setTimeout(() => setDirection(null), 500);
    return () => clearTimeout(timer);
  }, [price]);

  const formatPrice = (p: number) => {
    if (symbol.includes('JPY')) return p.toFixed(3);
    if (symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('XAU'))
      return p.toFixed(2);
    return p.toFixed(5);
  };

  if (!price) {
    return (
      <div className="text-center">
        <p className="text-2xl font-mono font-bold text-surface-200/30">--</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p
        className={clsx(
          'text-3xl font-mono font-bold transition-colors duration-300',
          direction === 'up' && 'text-trade-up',
          direction === 'down' && 'text-trade-down',
          !direction && 'text-surface-50'
        )}
      >
        {formatPrice(price)}
      </p>
      {bid != null && ask != null && (
        <div className="flex items-center justify-center gap-4 mt-1">
          <span className="text-xs text-trade-down/70 font-mono">
            Bid: {formatPrice(bid)}
          </span>
          <span className="text-xs text-surface-200/30">|</span>
          <span className="text-xs text-trade-up/70 font-mono">
            Ask: {formatPrice(ask)}
          </span>
        </div>
      )}
    </div>
  );
}
