import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import Redis from 'ioredis';

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  role?: string;
  subscribedSymbols: Set<string>;
  isAlive: boolean;
}

// Map of symbol -> set of subscribed client sockets
const symbolSubscriptions = new Map<string, Set<AuthenticatedSocket>>();
// Map of userId -> socket
const userSockets = new Map<string, AuthenticatedSocket>();

export function setupWebSocketServer(server: HTTPServer) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Redis subscriber for price fan-out
  const redisSub = new Redis(env.REDIS_URL);
  redisSub.subscribe('price:updates', 'wallet:events');

  redisSub.on('message', (channel, message) => {
    if (channel === 'price:updates') {
      handlePriceBroadcast(message);
    } else if (channel === 'wallet:events') {
      handleWalletEvent(message);
    }
  });

  // Connection handler
  wss.on('connection', (ws: AuthenticatedSocket, req) => {
    ws.subscribedSymbols = new Set();
    ws.isAlive = true;

    // Authenticate via query string token
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (token && token !== 'preview') {
        const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { userId: string; role: string };
        ws.userId = payload.userId;
        ws.role = payload.role;
        userSockets.set(payload.userId, ws);
      }
      // Allow unauthenticated connections for price feeds (preview mode)
    } catch {
      // Invalid token — still allow connection for price data
    }

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleClientMessage(ws, msg);
      } catch {
        ws.send(JSON.stringify({ event: 'error', data: { code: 'INVALID_MESSAGE', message: 'Invalid JSON' } }));
      }
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      // Clean up subscriptions
      for (const symbol of ws.subscribedSymbols) {
        const subs = symbolSubscriptions.get(symbol);
        if (subs) {
          subs.delete(ws);
          if (subs.size === 0) symbolSubscriptions.delete(symbol);
        }
      }
      if (ws.userId) {
        userSockets.delete(ws.userId);
      }
    });
  });

  // Heartbeat — ping every 30s, drop dead connections
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      const socket = ws as AuthenticatedSocket;
      if (!socket.isAlive) {
        socket.terminate();
        return;
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeat);
    redisSub.disconnect();
  });

  logger.info('WebSocket server initialized on /ws');
  return wss;
}

function handleClientMessage(ws: AuthenticatedSocket, msg: { event: string; data?: any }) {
  switch (msg.event) {
    case 'subscribe:price': {
      const symbol = msg.data?.symbol;
      if (!symbol || typeof symbol !== 'string') return;

      ws.subscribedSymbols.add(symbol);
      if (!symbolSubscriptions.has(symbol)) {
        symbolSubscriptions.set(symbol, new Set());
      }
      symbolSubscriptions.get(symbol)!.add(ws);

      // Send current cached price immediately
      redis.get(`price:${symbol}`).then((cached) => {
        if (cached && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event: 'price:update', data: JSON.parse(cached) }));
        }
      });
      break;
    }

    case 'unsubscribe:price': {
      const symbol = msg.data?.symbol;
      if (!symbol) return;

      ws.subscribedSymbols.delete(symbol);
      const subs = symbolSubscriptions.get(symbol);
      if (subs) {
        subs.delete(ws);
        if (subs.size === 0) symbolSubscriptions.delete(symbol);
      }
      break;
    }

    case 'ping': {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'pong', data: { server_time: Date.now() } }));
      }
      break;
    }
  }
}

function handlePriceBroadcast(message: string) {
  try {
    const priceData = JSON.parse(message);
    const symbol = priceData.symbol;
    const subs = symbolSubscriptions.get(symbol);
    if (!subs || subs.size === 0) return;

    const payload = JSON.stringify({ event: 'price:update', data: priceData });

    for (const ws of subs) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  } catch {
    // ignore parse errors
  }
}

function handleWalletEvent(message: string) {
  try {
    const event = JSON.parse(message);
    const { userId, ...eventData } = event;
    const ws = userSockets.get(userId);

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(eventData));
    }
  } catch {
    // ignore
  }
}

/** Send a message to a specific user via WebSocket */
export function publishToUser(userId: string, event: string, data: any) {
  redis.publish('wallet:events', JSON.stringify({ event, userId, data }));
}
