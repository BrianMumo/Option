import { redis } from '../config/redis';
import { logger } from '../config/logger';

// ── Asset Configuration ─────────────────────────────────

interface AssetConfig {
  basePrice: number;
  behavior: 'velocity' | 'crash' | 'boom' | 'step' | 'range_break';
  volatility?: number;
  eventProbability?: number;
  stepSize?: number;
  rangeWidth?: number;
  breakProbability?: number;
}

const ASSET_CONFIGS: Record<string, AssetConfig> = {
  // Velocity Index — smooth random walk
  'V10':        { basePrice: 5000, behavior: 'velocity', volatility: 0.00010 },
  'V25':        { basePrice: 5000, behavior: 'velocity', volatility: 0.00025 },
  'V50':        { basePrice: 5000, behavior: 'velocity', volatility: 0.00050 },
  'V75':        { basePrice: 5000, behavior: 'velocity', volatility: 0.00075 },
  'V100':       { basePrice: 5000, behavior: 'velocity', volatility: 0.00100 },
  'V10-1s':     { basePrice: 5000, behavior: 'velocity', volatility: 0.00010 },
  'V100-1s':    { basePrice: 5000, behavior: 'velocity', volatility: 0.00100 },

  // Crash — slow uptrend with rare sharp drops
  'CRASH-300':  { basePrice: 6000, behavior: 'crash', eventProbability: 1 / 300 },
  'CRASH-500':  { basePrice: 6000, behavior: 'crash', eventProbability: 1 / 500 },
  'CRASH-1000': { basePrice: 6000, behavior: 'crash', eventProbability: 1 / 1000 },

  // Boom — slow downtrend with rare sharp spikes
  'BOOM-300':   { basePrice: 4000, behavior: 'boom', eventProbability: 1 / 300 },
  'BOOM-500':   { basePrice: 4000, behavior: 'boom', eventProbability: 1 / 500 },
  'BOOM-1000':  { basePrice: 4000, behavior: 'boom', eventProbability: 1 / 1000 },

  // Step — discrete fixed-size jumps
  'STEP-100':   { basePrice: 5000, behavior: 'step', stepSize: 0.10 },
  'STEP-200':   { basePrice: 5000, behavior: 'step', stepSize: 0.20 },
  'STEP-500':   { basePrice: 5000, behavior: 'step', stepSize: 0.50 },

  // Range Break — oscillates in band, periodic breakout
  'RB-100':     { basePrice: 5000, behavior: 'range_break', rangeWidth: 0.004, breakProbability: 1 / 100 },
  'RB-150':     { basePrice: 5000, behavior: 'range_break', rangeWidth: 0.004, breakProbability: 1 / 150 },
  'RB-200':     { basePrice: 5000, behavior: 'range_break', rangeWidth: 0.004, breakProbability: 1 / 200 },
};

// ── Range Break State ───────────────────────────────────

interface RangeState {
  center: number;
  width: number;
  isBreaking: boolean;
  breakTicks: number;
  breakDirection: number;
}

// ── Price Feed Service ──────────────────────────────────

class PriceFeedService {
  private timer: NodeJS.Timeout | null = null;
  private currentPrices: Record<string, number> = {};
  private rangeStates: Record<string, RangeState> = {};

  connect() {
    this.startSyntheticFeed();
  }

  private startSyntheticFeed() {
    // Initialize prices from base configs
    for (const [symbol, config] of Object.entries(ASSET_CONFIGS)) {
      this.currentPrices[symbol] = config.basePrice;
    }

    // Tick every 1 second
    this.timer = setInterval(() => this.tickAll(), 1000);
    logger.info({ assetCount: Object.keys(ASSET_CONFIGS).length }, 'Velocity synthetic price feed started');
  }

  private async tickAll() {
    for (const [symbol, config] of Object.entries(ASSET_CONFIGS)) {
      let newPrice: number;

      switch (config.behavior) {
        case 'velocity':
          newPrice = this.tickVelocity(symbol, config);
          break;
        case 'crash':
          newPrice = this.tickCrash(symbol, config);
          break;
        case 'boom':
          newPrice = this.tickBoom(symbol, config);
          break;
        case 'step':
          newPrice = this.tickStep(symbol, config);
          break;
        case 'range_break':
          newPrice = this.tickRangeBreak(symbol, config);
          break;
      }

      // Round to 2 decimals
      newPrice = Math.round(newPrice * 100) / 100;
      this.currentPrices[symbol] = newPrice;

      await this.publishPrice(symbol, newPrice, config);
    }
  }

  // ── Velocity: Gaussian random walk with mean reversion ──

  private tickVelocity(symbol: string, config: AssetConfig): number {
    const current = this.currentPrices[symbol];
    const base = config.basePrice;
    const vol = config.volatility!;

    // Box-Muller transform for Gaussian noise
    const u1 = Math.random();
    const u2 = Math.random();
    const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

    const change = gaussian * vol * current;
    const meanReversion = (base - current) * 0.005;

    return Math.max(base * 0.80, Math.min(base * 1.20, current + change + meanReversion));
  }

  // ── Crash: Slow uptrend with rare sharp drops ──

  private tickCrash(symbol: string, config: AssetConfig): number {
    const current = this.currentPrices[symbol];
    const base = config.basePrice;

    // Small upward drift + minor noise
    const drift = current * 0.00005;
    const noise = (Math.random() - 0.5) * current * 0.0001;

    // Crash event check
    if (Math.random() < config.eventProbability!) {
      const crashMagnitude = 0.02 + Math.random() * 0.03; // 2-5% drop
      return Math.max(base * 0.70, current * (1 - crashMagnitude));
    }

    const meanReversion = (base - current) * 0.002;
    return Math.max(base * 0.70, Math.min(base * 1.30, current + drift + noise + meanReversion));
  }

  // ── Boom: Slow downtrend with rare sharp spikes ──

  private tickBoom(symbol: string, config: AssetConfig): number {
    const current = this.currentPrices[symbol];
    const base = config.basePrice;

    // Small downward drift + minor noise
    const drift = -current * 0.00005;
    const noise = (Math.random() - 0.5) * current * 0.0001;

    // Boom event check
    if (Math.random() < config.eventProbability!) {
      const boomMagnitude = 0.02 + Math.random() * 0.03; // 2-5% spike
      return Math.min(base * 1.30, current * (1 + boomMagnitude));
    }

    const meanReversion = (base - current) * 0.002;
    return Math.max(base * 0.70, Math.min(base * 1.30, current + drift + noise + meanReversion));
  }

  // ── Step: Equal probability fixed-size up/down ──

  private tickStep(symbol: string, config: AssetConfig): number {
    const current = this.currentPrices[symbol];
    const base = config.basePrice;
    const step = config.stepSize!;

    const direction = Math.random() < 0.5 ? 1 : -1;
    let newPrice = current + direction * step;

    // Soft boundary reversion at extremes
    const distFromBase = Math.abs(newPrice - base) / base;
    if (distFromBase > 0.10) {
      newPrice += (base - newPrice) * 0.01;
    }

    return Math.max(base * 0.80, Math.min(base * 1.20, newPrice));
  }

  // ── Range Break: Oscillate in band, periodic breakout ──

  private tickRangeBreak(symbol: string, config: AssetConfig): number {
    const current = this.currentPrices[symbol];
    const base = config.basePrice;

    let state = this.rangeStates[symbol];
    if (!state) {
      state = {
        center: base,
        width: base * config.rangeWidth!,
        isBreaking: false,
        breakTicks: 0,
        breakDirection: 1,
      };
      this.rangeStates[symbol] = state;
    }

    if (state.isBreaking) {
      // During breakout: strong directional move
      state.breakTicks--;
      const breakMove = state.breakDirection * current * 0.001;
      const noise = (Math.random() - 0.5) * current * 0.0002;

      if (state.breakTicks <= 0) {
        // End breakout, establish new range around current price
        state.center = current;
        state.width = base * config.rangeWidth!;
        state.isBreaking = false;
      }

      const meanReversion = (base - current) * 0.001;
      return Math.max(base * 0.80, Math.min(base * 1.20, current + breakMove + noise + meanReversion));
    }

    // Normal: oscillate within range
    const noise = (Math.random() - 0.5) * current * 0.0003;
    let newPrice = current + noise;

    // Bounce off range boundaries
    const upper = state.center + state.width / 2;
    const lower = state.center - state.width / 2;
    if (newPrice > upper) newPrice = upper - Math.abs(noise);
    if (newPrice < lower) newPrice = lower + Math.abs(noise);

    // Check for breakout event
    if (Math.random() < config.breakProbability!) {
      state.isBreaking = true;
      state.breakTicks = 5 + Math.floor(Math.random() * 10);
      state.breakDirection = Math.random() < 0.5 ? 1 : -1;
    }

    return newPrice;
  }

  // ── Price Publishing ──────────────────────────────────

  private async publishPrice(symbol: string, price: number, config: AssetConfig) {
    // Volatility-aware spread
    const spreadFactor = config.volatility
      ? Math.max(0.5, Math.min(3, config.volatility * 100))
      : 1;
    const spread = price * 0.00005 * spreadFactor;

    const priceData = {
      symbol,
      price,
      bid: Math.round((price - spread) * 100) / 100,
      ask: Math.round((price + spread) * 100) / 100,
      timestamp: Date.now(),
      updated_at: Date.now(),
    };

    await redis.set(`price:${symbol}`, JSON.stringify(priceData), 'EX', 60).catch(() => {});
    await redis.publish('price:updates', JSON.stringify(priceData)).catch(() => {});
  }

  disconnect() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const priceFeedService = new PriceFeedService();
