import { pool } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { publishToUser } from '../websocket/wsServer';

let settlementInterval: NodeJS.Timeout | null = null;
let isSettling = false;

/**
 * Settlement worker: polls Redis sorted set every 500ms for expired trades.
 * Compares entry vs exit price, settles win/loss/draw, credits wallet for wins.
 */
export function startSettlementWorker() {
  logger.info('Settlement worker started (polling every 500ms)');

  settlementInterval = setInterval(async () => {
    if (isSettling) return; // Prevent overlapping runs
    isSettling = true;
    try {
      await settleExpiredTrades();
    } catch (err) {
      logger.error({ err }, 'Settlement worker error');
    } finally {
      isSettling = false;
    }
  }, 500);
}

export function stopSettlementWorker() {
  if (settlementInterval) {
    clearInterval(settlementInterval);
    settlementInterval = null;
    logger.info('Settlement worker stopped');
  }
}

async function settleExpiredTrades() {
  const now = Date.now();
  const BATCH_SIZE = 50;

  // Peek at expired trades (score <= now)
  const expiredTradeIds = await redis.zrangebyscore('trades:active', 0, now, 'LIMIT', 0, BATCH_SIZE);
  if (expiredTradeIds.length === 0) return;

  for (const tradeId of expiredTradeIds) {
    // Atomically remove from set — if zrem returns 0, another worker already claimed it
    const removed = await redis.zrem('trades:active', tradeId);
    if (removed === 0) continue;

    try {
      await settleTrade(tradeId);
    } catch (err) {
      logger.error({ err, tradeId }, 'Failed to settle trade');
      // Trade stays as 'active' in DB for manual review — do not re-add to Redis
    }
  }
}

async function settleTrade(tradeId: string) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock the trade row
    const tradeResult = await client.query(
      `SELECT t.*, a.symbol as asset_symbol
       FROM trades t
       JOIN assets a ON t.asset_id = a.id
       WHERE t.id = $1 AND t.status = 'active'
       FOR UPDATE OF t`,
      [tradeId]
    );

    if (tradeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return; // Already settled or cancelled
    }

    const trade = tradeResult.rows[0];
    const symbol = trade.asset_symbol;

    // Get current price from Redis
    const cachedPrice = await redis.get(`price:${symbol}`);
    if (!cachedPrice) {
      // Price unavailable — try again next cycle
      await client.query('ROLLBACK');
      // Re-add to sorted set with 2s delay
      await redis.zadd('trades:active', Date.now() + 2000, tradeId);
      return;
    }

    const priceData = JSON.parse(cachedPrice);
    const exitPrice = trade.direction === 'UP' ? priceData.bid : priceData.ask;
    const entryPrice = parseFloat(trade.entry_price);
    const amount = parseFloat(trade.amount);
    const payoutRate = parseFloat(trade.payout_rate);

    // Determine result
    let result: 'win' | 'loss' | 'draw';
    let profit: number;

    if (trade.direction === 'UP') {
      if (exitPrice > entryPrice) {
        result = 'win';
        profit = amount * (payoutRate / 100);
      } else if (exitPrice < entryPrice) {
        result = 'loss';
        profit = -amount;
      } else {
        result = 'draw';
        profit = 0;
      }
    } else {
      // DOWN
      if (exitPrice < entryPrice) {
        result = 'win';
        profit = amount * (payoutRate / 100);
      } else if (exitPrice > entryPrice) {
        result = 'loss';
        profit = -amount;
      } else {
        result = 'draw';
        profit = 0;
      }
    }

    // Update trade
    await client.query(
      `UPDATE trades
       SET exit_price = $1, result = $2, profit = $3, status = 'settled', settled_at = NOW(), updated_at = NOW()
       WHERE id = $4`,
      [exitPrice, result, profit, tradeId]
    );

    // Handle wallet impact
    if (trade.is_demo) {
      // Demo trade: credit/refund demo_balance
      if (result === 'win') {
        const payout = amount + profit; // original + winnings
        await client.query(
          `UPDATE users SET demo_balance = demo_balance + $1 WHERE id = $2`,
          [payout, trade.user_id]
        );
      } else if (result === 'draw') {
        // Refund stake
        await client.query(
          `UPDATE users SET demo_balance = demo_balance + $1 WHERE id = $2`,
          [amount, trade.user_id]
        );
      }
      // loss: nothing to do, already debited
    } else {
      // Real trade: credit wallet for wins/draws
      if (result === 'win') {
        const payout = amount + profit;

        // Lock wallet
        const walletResult = await client.query(
          `SELECT id, balance FROM wallets WHERE user_id = $1 AND currency = 'KES' FOR UPDATE`,
          [trade.user_id]
        );

        if (walletResult.rows.length > 0) {
          const wallet = walletResult.rows[0];
          const balanceBefore = parseFloat(wallet.balance);
          const balanceAfter = balanceBefore + payout;

          await client.query(
            `UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2`,
            [balanceAfter, wallet.id]
          );

          // Create credit transaction
          const txResult = await client.query(
            `INSERT INTO transactions (user_id, wallet_id, type, amount, balance_before, balance_after, status, reference, metadata)
             VALUES ($1, $2, 'trade_credit', $3, $4, $5, 'completed', $6, $7) RETURNING id`,
            [
              trade.user_id, wallet.id, payout, balanceBefore, balanceAfter,
              `TC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              JSON.stringify({ trade_id: tradeId, result, payout_rate: payoutRate }),
            ]
          );

          // Link credit transaction to trade
          await client.query(
            `UPDATE trades SET transaction_credit_id = $1 WHERE id = $2`,
            [txResult.rows[0].id, tradeId]
          );
        }
      } else if (result === 'draw') {
        // Refund the original stake
        const walletResult = await client.query(
          `SELECT id, balance FROM wallets WHERE user_id = $1 AND currency = 'KES' FOR UPDATE`,
          [trade.user_id]
        );

        if (walletResult.rows.length > 0) {
          const wallet = walletResult.rows[0];
          const balanceBefore = parseFloat(wallet.balance);
          const balanceAfter = balanceBefore + amount;

          await client.query(
            `UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2`,
            [balanceAfter, wallet.id]
          );

          await client.query(
            `INSERT INTO transactions (user_id, wallet_id, type, amount, balance_before, balance_after, status, reference, metadata)
             VALUES ($1, $2, 'trade_credit', $3, $4, $5, 'completed', $6, $7)`,
            [
              trade.user_id, wallet.id, amount, balanceBefore, balanceAfter,
              `TR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              JSON.stringify({ trade_id: tradeId, result: 'draw', refund: true }),
            ]
          );
        }
      }
      // loss: already debited at trade placement
    }

    await client.query('COMMIT');

    // Notify user via WebSocket
    publishToUser(trade.user_id, 'trade:settled', {
      trade_id: tradeId,
      asset_symbol: symbol,
      direction: trade.direction,
      amount,
      result,
      profit,
      exit_price: exitPrice,
      entry_price: entryPrice,
    });

    logger.info(
      { tradeId, symbol, direction: trade.direction, result, profit, demo: trade.is_demo },
      'Trade settled'
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
