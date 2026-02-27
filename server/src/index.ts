import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';
import authRoutes from './routes/auth.routes';
import walletRoutes from './routes/wallet.routes';
import mpesaRoutes from './routes/mpesa.routes';
import marketRoutes from './routes/market.routes';
import tradeRoutes from './routes/trade.routes';
import { setupWebSocketServer } from './websocket/wsServer';
import { priceFeedService } from './services/priceFeed.service';
import { startSettlementWorker } from './services/settlement.service';

const app = express();
const server = createServer(app);

// Security & parsing middleware
app.use(helmet());
app.use(cors({
  origin: env.CLIENT_URL.split(',').map(s => s.trim()),
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'healthy', timestamp: new Date().toISOString() } });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/trades', tradeRoutes);

// Error handler (must be last)
app.use(errorHandler);

// WebSocket server
setupWebSocketServer(server);

// Start price feed
priceFeedService.connect();
priceFeedService.subscribe([
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD',
  'EUR/GBP', 'USD/CHF', 'NZD/USD', 'EUR/JPY', 'GBP/JPY',
  'BTC/USD', 'ETH/USD', 'XRP/USD', 'SOL/USD', 'BNB/USD',
  'XAU/USD', 'XAG/USD', 'WTI/USD',
]);

// Start settlement worker
startSettlementWorker();

const PORT = env.PORT;
server.listen(PORT, () => {
  logger.info(`StakeOption server running on port ${PORT}`);
  logger.info(`WebSocket available at ws://localhost:${PORT}/ws`);
  logger.info(`Environment: ${env.NODE_ENV}`);
});

export default app;
