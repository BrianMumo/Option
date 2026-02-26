import WebSocket from 'ws';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../config/logger';

class PriceFeedService {
  private ws: WebSocket | null = null;
  private subscribedSymbols: Set<string> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  connect() {
    if (!env.TWELVE_DATA_API_KEY) {
      logger.warn('Twelve Data API key not set — price feed disabled. Using simulated prices.');
      this.startSimulatedFeed();
      return;
    }

    const url = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${env.TWELVE_DATA_API_KEY}`;
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      logger.info('Connected to Twelve Data WebSocket');
      this.reconnectAttempts = 0;
      // Re-subscribe after reconnect
      if (this.subscribedSymbols.size > 0) {
        this.subscribe([...this.subscribedSymbols]);
      }
      this.startHeartbeat();
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.event === 'price') {
          this.handlePriceUpdate(message);
        } else if (message.event === 'subscribe-status') {
          logger.info({ status: message.status, symbols: message.success }, 'Twelve Data subscription status');
        } else if (message.event === 'heartbeat') {
          // Keep-alive from Twelve Data
        }
      } catch (err) {
        logger.error({ err, data: data.toString() }, 'Failed to parse Twelve Data message');
      }
    });

    this.ws.on('close', (code, reason) => {
      logger.warn({ code, reason: reason.toString() }, 'Twelve Data WS disconnected');
      this.stopHeartbeat();
      this.attemptReconnect();
    });

    this.ws.on('error', (error) => {
      logger.error({ error }, 'Twelve Data WS error');
    });
  }

  subscribe(symbols: string[]) {
    symbols.forEach((s) => this.subscribedSymbols.add(s));

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: 'subscribe',
        params: { symbols: symbols.join(',') },
      }));
      logger.info({ symbols }, 'Subscribed to Twelve Data symbols');
    }
  }

  unsubscribe(symbols: string[]) {
    symbols.forEach((s) => this.subscribedSymbols.delete(s));

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: 'unsubscribe',
        params: { symbols: symbols.join(',') },
      }));
    }
  }

  private async handlePriceUpdate(message: any) {
    const { symbol, price, timestamp, bid, ask, day_volume } = message;
    const priceNum = parseFloat(price);

    const priceData = {
      symbol,
      price: priceNum,
      bid: bid ? parseFloat(bid) : priceNum - 0.00002,
      ask: ask ? parseFloat(ask) : priceNum + 0.00002,
      timestamp: timestamp || Date.now(),
      updated_at: Date.now(),
    };

    // Cache in Redis
    await redis.set(`price:${symbol}`, JSON.stringify(priceData));

    // Publish for WebSocket fan-out to clients
    await redis.publish('price:updates', JSON.stringify(priceData));
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnect attempts reached for Twelve Data WS');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    logger.info({ attempt: this.reconnectAttempts, delay }, 'Reconnecting to Twelve Data...');
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  /**
   * Simulated price feed for development without a Twelve Data API key.
   * Generates realistic-looking price movements.
   */
  private startSimulatedFeed() {
    const basePrices: Record<string, number> = {
      'EUR/USD': 1.0854, 'GBP/USD': 1.2650, 'USD/JPY': 149.85,
      'AUD/USD': 0.6540, 'USD/CAD': 1.3580, 'EUR/GBP': 0.8580,
      'USD/CHF': 0.8820, 'NZD/USD': 0.6020, 'EUR/JPY': 162.55,
      'GBP/JPY': 189.45, 'BTC/USD': 62450.00, 'ETH/USD': 3420.00,
      'XRP/USD': 0.5840, 'SOL/USD': 145.20, 'BNB/USD': 580.00,
      'XAU/USD': 2340.50, 'XAG/USD': 27.85, 'WTI/USD': 78.40,
    };

    const currentPrices = { ...basePrices };

    setInterval(async () => {
      for (const [symbol, base] of Object.entries(currentPrices)) {
        // Random walk with mean reversion
        const volatility = symbol.includes('BTC') ? 0.0005 : symbol.includes('XAU') ? 0.0002 : 0.00008;
        const change = (Math.random() - 0.5) * 2 * volatility * base;
        const meanReversion = (basePrices[symbol] - currentPrices[symbol]) * 0.01;
        currentPrices[symbol] = Math.max(base * 0.95, Math.min(base * 1.05, currentPrices[symbol] + change + meanReversion));

        const price = currentPrices[symbol];
        const spread = price * 0.00005;

        const priceData = {
          symbol,
          price,
          bid: price - spread,
          ask: price + spread,
          timestamp: Date.now(),
          updated_at: Date.now(),
        };

        await redis.set(`price:${symbol}`, JSON.stringify(priceData)).catch(() => {});
        await redis.publish('price:updates', JSON.stringify(priceData)).catch(() => {});
      }
    }, 1000);

    logger.info('Simulated price feed started (no Twelve Data API key)');
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const priceFeedService = new PriceFeedService();
