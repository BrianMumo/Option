import { db } from '../config/database';
import { pool } from '../config/database';
import { wallets, transactions } from '../db/schema';
import { AppError } from '../middleware/errorHandler';
import { generateReference } from '../utils/crypto';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { TransactionType, TransactionStatus } from '@stakeoption/shared';

export async function getWallet(userId: string) {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.user_id, userId), eq(wallets.currency, 'KES')))
    .limit(1);

  if (!wallet) {
    throw new AppError('Wallet not found', 404, 'WALLET_NOT_FOUND');
  }

  return {
    id: wallet.id,
    balance: parseFloat(wallet.balance),
    currency: wallet.currency,
    is_locked: wallet.is_locked,
  };
}

export async function getTransactions(
  userId: string,
  options: { page: number; limit: number; type?: string; status?: string }
) {
  const { page, limit, type, status } = options;
  const offset = (page - 1) * limit;

  const conditions = [eq(transactions.user_id, userId)];
  if (type) conditions.push(eq(transactions.type, type));
  if (status) conditions.push(eq(transactions.status, status));

  const where = and(...conditions);

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(where)
      .orderBy(desc(transactions.created_at))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(where),
  ]);

  const total = countResult[0]?.count || 0;

  return {
    transactions: items.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: parseFloat(tx.amount),
      balance_before: parseFloat(tx.balance_before),
      balance_after: parseFloat(tx.balance_after),
      status: tx.status,
      reference: tx.reference,
      external_reference: tx.external_reference,
      metadata: tx.metadata,
      created_at: tx.created_at,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Atomically credit a wallet with row-level locking.
 * Used for deposits and trade winnings.
 */
export async function creditWallet(
  userId: string,
  amount: number,
  type: TransactionType,
  externalReference?: string,
  metadata?: Record<string, unknown>
) {
  if (amount <= 0) throw new AppError('Credit amount must be positive', 400);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the wallet row for update
    const walletResult = await client.query(
      `SELECT id, balance FROM wallets WHERE user_id = $1 AND currency = 'KES' FOR UPDATE`,
      [userId]
    );

    if (walletResult.rows.length === 0) {
      throw new AppError('Wallet not found', 404, 'WALLET_NOT_FOUND');
    }

    const wallet = walletResult.rows[0];
    const balanceBefore = parseFloat(wallet.balance);
    const balanceAfter = balanceBefore + amount;
    const reference = generateReference(type === 'deposit' ? 'DEP' : 'CR');

    // Update wallet balance
    await client.query(
      `UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2`,
      [balanceAfter, wallet.id]
    );

    // Create transaction record
    const txResult = await client.query(
      `INSERT INTO transactions (user_id, wallet_id, type, amount, balance_before, balance_after, status, reference, external_reference, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7, $8, $9)
       RETURNING *`,
      [userId, wallet.id, type, amount, balanceBefore, balanceAfter, reference, externalReference || null, metadata ? JSON.stringify(metadata) : null]
    );

    await client.query('COMMIT');

    return {
      transaction: txResult.rows[0],
      new_balance: balanceAfter,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Atomically debit a wallet with row-level locking.
 * Used for withdrawals and trade placements.
 */
export async function debitWallet(
  userId: string,
  amount: number,
  type: TransactionType,
  status: TransactionStatus = 'completed',
  metadata?: Record<string, unknown>
) {
  if (amount <= 0) throw new AppError('Debit amount must be positive', 400);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the wallet row for update
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
    const reference = generateReference(type === 'withdrawal' ? 'WD' : 'DB');

    // Update wallet balance
    await client.query(
      `UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2`,
      [balanceAfter, wallet.id]
    );

    // Create transaction record
    const txResult = await client.query(
      `INSERT INTO transactions (user_id, wallet_id, type, amount, balance_before, balance_after, status, reference, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [userId, wallet.id, type, -amount, balanceBefore, balanceAfter, status, reference, metadata ? JSON.stringify(metadata) : null]
    );

    await client.query('COMMIT');

    return {
      transaction: txResult.rows[0],
      new_balance: balanceAfter,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Reverse a wallet debit (used when M-Pesa B2C withdrawal fails).
 */
export async function reverseDebit(userId: string, transactionId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get original transaction
    const txResult = await client.query(
      `SELECT * FROM transactions WHERE id = $1 AND user_id = $2 AND type = 'withdrawal' AND status = 'processing' FOR UPDATE`,
      [transactionId, userId]
    );

    if (txResult.rows.length === 0) {
      throw new AppError('Transaction not found or not reversible', 404);
    }

    const originalTx = txResult.rows[0];
    const refundAmount = Math.abs(parseFloat(originalTx.amount));

    // Lock and credit wallet
    const walletResult = await client.query(
      `SELECT id, balance FROM wallets WHERE id = $1 FOR UPDATE`,
      [originalTx.wallet_id]
    );

    const wallet = walletResult.rows[0];
    const newBalance = parseFloat(wallet.balance) + refundAmount;

    await client.query(
      `UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2`,
      [newBalance, wallet.id]
    );

    // Mark original transaction as reversed
    await client.query(
      `UPDATE transactions SET status = 'reversed', updated_at = NOW() WHERE id = $1`,
      [transactionId]
    );

    // Create reversal transaction
    await client.query(
      `INSERT INTO transactions (user_id, wallet_id, type, amount, balance_before, balance_after, status, reference, metadata)
       VALUES ($1, $2, 'deposit', $3, $4, $5, 'completed', $6, $7)`,
      [userId, wallet.id, refundAmount, wallet.balance, newBalance, generateReference('REV'),
        JSON.stringify({ reversed_transaction_id: transactionId, reason: 'withdrawal_failed' })]
    );

    await client.query('COMMIT');

    return { new_balance: newBalance };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
