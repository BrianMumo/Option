import { db } from '../config/database';
import { pool } from '../config/database';
import { redis } from '../config/redis';
import { trades, assets, users } from '../db/schema';
import { AppError } from '../middleware/errorHandler';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { MAX_CONCURRENT_TRADES, DEMO_INITIAL_BALANCE } from '@stakeoption/shared';
import * as walletService from './wallet.service';
import { logger } from '../config/logger';

interface PlaceTradeParams {
  userId: string;
  assetId: string;
  direction: 'UP' | 'DOWN';
  amount: number;
  timeframeSeconds: number;
  isDemo: boolean;
}

export async function placeTrade(params: PlaceTradeParams) {
  const { userId, assetId, direction, amount, timeframeSeconds, isDemo } = params;

  // 1. Validate the asset
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.is_active, true)))
    .limit(1);

  if (!asset) {
    throw new AppError('Asset not found or inactive', 404, 'ASSET_NOT_FOUND');
  }

  const minTrade = parseFloat(asset.min_trade);
  const maxTrade = parseFloat(asset.max_trade);

  if (amount < minTrade) {
    throw new AppError(`Minimum trade is KSh ${minTrade}`, 400, 'BELOW_MIN_TRADE');
  }
  if (amount > maxTrade) {
    throw new AppError(`Maximum trade is KSh ${maxTrade}`, 400, 'ABOVE_MAX_TRADE');
  }

  // 2. Check concurrent active trades
  const [activeCount] = await db
    .select({ count: count() })
    .from(trades)
    .where(
      and(
        eq(trades.user_id, userId),
        eq(trades.status, 'active'),
        eq(trades.is_demo, isDemo)
      )
    );

  if ((activeCount?.count || 0) >= MAX_CONCURRENT_TRADES) {
    throw new AppError(
      `Maximum ${MAX_CONCURRENT_TRADES} concurrent trades allowed`,
      400,
      'MAX_CONCURRENT_TRADES'
    );
  }

  // 3. Get entry price from Redis
  const cachedPrice = await redis.get(`price:${asset.symbol}`);
  if (!cachedPrice) {
    throw new AppError('Price unavailable for this asset', 503, 'PRICE_UNAVAILABLE');
  }

  const priceData = JSON.parse(cachedPrice);
  const entryPrice = direction === 'UP' ? priceData.ask : priceData.bid;
  const payoutRate = parseFloat(asset.payout_rate);

  const expiresAt = new Date(Date.now() + timeframeSeconds * 1000);

  if (isDemo) {
    return placeDemoTrade({
      userId, assetId, direction, amount, timeframeSeconds,
      entryPrice, payoutRate, expiresAt, symbol: asset.symbol,
    });
  }

  // 4. Real trade — atomic wallet debit + trade creation
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock wallet and debit
    const walletResult = await client.query(
      `SELECT id, balance, is_locked FROM wallets WHERE user_id = $1 AND currency = 'KES' FOR UPDATE`,
      [userId]
    );

    if (walletResult.rows.length === 0) {
      throw new AppError('Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const wallet = walletResult.rows[0];
    if (wallet.is_locked) {
      throw new AppError('Wallet is temporarily locked', 423, 'WALLET_LOCKED');
    }

    const balanceBefore = parseFloat(wallet.balance);
    if (balanceBefore < amount) {
      throw new AppError('Insufficient balance', 400, 'INSUFFICIENT_BALANCE');
    }

    const balanceAfter = balanceBefore - amount;

    // Debit wallet
    await client.query(
      `UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2`,
      [balanceAfter, wallet.id]
    );

    // Create debit transaction
    const txResult = await client.query(
      `INSERT INTO transactions (user_id, wallet_id, type, amount, balance_before, balance_after, status, reference, metadata)
       VALUES ($1, $2, 'trade_debit', $3, $4, $5, 'completed', $6, $7) RETURNING id`,
      [
        userId, wallet.id, -amount, balanceBefore, balanceAfter,
        `TD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        JSON.stringify({ asset_symbol: asset.symbol, direction, timeframe: timeframeSeconds }),
      ]
    );

    // Create trade
    const tradeResult = await client.query(
      `INSERT INTO trades (user_id, asset_id, is_demo, direction, amount, payout_rate, entry_price, timeframe_seconds, expires_at, status, transaction_debit_id)
       VALUES ($1, $2, false, $3, $4, $5, $6, $7, $8, 'active', $9) RETURNING *`,
      [userId, assetId, direction, amount, payoutRate, entryPrice, timeframeSeconds, expiresAt, txResult.rows[0].id]
    );

    await client.query('COMMIT');

    const trade = tradeResult.rows[0];

    // Track in Redis sorted set for settlement (score = expiry timestamp)
    await redis.zadd('trades:active', expiresAt.getTime(), trade.id);

    logger.info({ tradeId: trade.id, symbol: asset.symbol, direction, amount }, 'Trade placed');

    return {
      trade: formatTrade(trade, asset.symbol, asset.name),
      new_balance: balanceAfter,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function placeDemoTrade(params: {
  userId: string;
  assetId: string;
  direction: 'UP' | 'DOWN';
  amount: number;
  timeframeSeconds: number;
  entryPrice: number;
  payoutRate: number;
  expiresAt: Date;
  symbol: string;
}) {
  const { userId, assetId, direction, amount, timeframeSeconds, entryPrice, payoutRate, expiresAt, symbol } = params;

  // Check demo balance
  const [user] = await db
    .select({ demo_balance: users.demo_balance })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const demoBalance = parseFloat(user.demo_balance);
  if (demoBalance < amount) {
    throw new AppError('Insufficient demo balance', 400, 'INSUFFICIENT_BALANCE');
  }

  // Debit demo balance
  await db
    .update(users)
    .set({ demo_balance: (demoBalance - amount).toFixed(2) })
    .where(eq(users.id, userId));

  // Create trade
  const [trade] = await db
    .insert(trades)
    .values({
      user_id: userId,
      asset_id: assetId,
      is_demo: true,
      direction,
      amount: amount.toFixed(2),
      payout_rate: payoutRate.toFixed(2),
      entry_price: entryPrice.toFixed(8),
      timeframe_seconds: timeframeSeconds,
      expires_at: expiresAt,
      status: 'active',
    })
    .returning();

  // Track in Redis for settlement
  await redis.zadd('trades:active', expiresAt.getTime(), trade.id);

  logger.info({ tradeId: trade.id, symbol, direction, amount, demo: true }, 'Demo trade placed');

  return {
    trade: formatTrade(trade, symbol, ''),
    new_balance: demoBalance - amount,
  };
}

export async function getActiveTrades(userId: string, isDemo: boolean = false) {
  const result = await db
    .select({
      trade: trades,
      asset_symbol: assets.symbol,
      asset_name: assets.name,
    })
    .from(trades)
    .innerJoin(assets, eq(trades.asset_id, assets.id))
    .where(
      and(
        eq(trades.user_id, userId),
        eq(trades.status, 'active'),
        eq(trades.is_demo, isDemo)
      )
    )
    .orderBy(desc(trades.created_at));

  return result.map((r) => formatTrade(r.trade, r.asset_symbol, r.asset_name));
}

export async function getTradeHistory(
  userId: string,
  options: {
    page: number;
    limit: number;
    result?: string;
    is_demo?: boolean;
    asset_id?: string;
  }
) {
  const { page, limit, result, is_demo, asset_id } = options;
  const offset = (page - 1) * limit;

  const conditions = [eq(trades.user_id, userId), eq(trades.status, 'settled')];
  if (result) conditions.push(eq(trades.result, result));
  if (is_demo !== undefined) conditions.push(eq(trades.is_demo, is_demo));
  if (asset_id) conditions.push(eq(trades.asset_id, asset_id));

  const where = and(...conditions);

  const [items, totalResult] = await Promise.all([
    db
      .select({
        trade: trades,
        asset_symbol: assets.symbol,
        asset_name: assets.name,
      })
      .from(trades)
      .innerJoin(assets, eq(trades.asset_id, assets.id))
      .where(where)
      .orderBy(desc(trades.settled_at))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(trades)
      .where(where),
  ]);

  const total = totalResult[0]?.count || 0;

  return {
    trades: items.map((r) => formatTrade(r.trade, r.asset_symbol, r.asset_name)),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(Number(total) / limit),
    },
  };
}

export async function getTradeById(tradeId: string) {
  const [result] = await db
    .select({
      trade: trades,
      asset_symbol: assets.symbol,
      asset_name: assets.name,
    })
    .from(trades)
    .innerJoin(assets, eq(trades.asset_id, assets.id))
    .where(eq(trades.id, tradeId))
    .limit(1);

  if (!result) return null;
  return formatTrade(result.trade, result.asset_symbol, result.asset_name);
}

function formatTrade(trade: any, symbol: string, name: string) {
  return {
    id: trade.id,
    user_id: trade.user_id,
    asset_id: trade.asset_id,
    asset_symbol: symbol,
    asset_name: name,
    is_demo: trade.is_demo,
    direction: trade.direction,
    amount: parseFloat(trade.amount),
    payout_rate: parseFloat(trade.payout_rate),
    entry_price: parseFloat(trade.entry_price),
    exit_price: trade.exit_price ? parseFloat(trade.exit_price) : null,
    timeframe_seconds: trade.timeframe_seconds,
    expires_at: trade.expires_at,
    settled_at: trade.settled_at,
    result: trade.result,
    profit: trade.profit ? parseFloat(trade.profit) : null,
    status: trade.status,
    created_at: trade.created_at,
  };
}
