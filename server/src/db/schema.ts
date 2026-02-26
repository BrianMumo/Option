import {
  pgTable, uuid, varchar, text, boolean, decimal, integer, timestamp, jsonb, bigserial, inet, uniqueIndex, index, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ── Users ──────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: varchar('phone', { length: 15 }).unique().notNull(),
  email: varchar('email', { length: 255 }).unique(),
  password_hash: varchar('password_hash', { length: 255 }).notNull(),
  first_name: varchar('first_name', { length: 100 }),
  last_name: varchar('last_name', { length: 100 }),
  role: varchar('role', { length: 20 }).default('user').notNull(),
  is_verified: boolean('is_verified').default(false).notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  kyc_status: varchar('kyc_status', { length: 20 }).default('pending').notNull(),
  demo_balance: decimal('demo_balance', { precision: 15, scale: 2 }).default('10000.00').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  last_login_at: timestamp('last_login_at', { withTimezone: true }),
}, (table) => [
  index('idx_users_phone').on(table.phone),
  index('idx_users_email').on(table.email),
  index('idx_users_kyc_status').on(table.kyc_status),
]);

// ── Wallets ────────────────────────────────────────────
export const wallets = pgTable('wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  balance: decimal('balance', { precision: 15, scale: 2 }).default('0.00').notNull(),
  currency: varchar('currency', { length: 3 }).default('KES').notNull(),
  is_locked: boolean('is_locked').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('uq_user_wallet').on(table.user_id, table.currency),
  index('idx_wallets_user_id').on(table.user_id),
]);

// ── Transactions ───────────────────────────────────────
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id),
  wallet_id: uuid('wallet_id').notNull().references(() => wallets.id),
  type: varchar('type', { length: 20 }).notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  balance_before: decimal('balance_before', { precision: 15, scale: 2 }).notNull(),
  balance_after: decimal('balance_after', { precision: 15, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  reference: varchar('reference', { length: 100 }).unique(),
  external_reference: varchar('external_reference', { length: 100 }),
  metadata: jsonb('metadata'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_transactions_user_id').on(table.user_id),
  index('idx_transactions_wallet_id').on(table.wallet_id),
  index('idx_transactions_status').on(table.status),
  index('idx_transactions_created_at').on(table.created_at),
]);

// ── M-Pesa Requests ───────────────────────────────────
export const mpesaRequests = pgTable('mpesa_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id),
  transaction_id: uuid('transaction_id').references(() => transactions.id),
  type: varchar('type', { length: 20 }).notNull(),
  phone: varchar('phone', { length: 15 }).notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  merchant_request_id: varchar('merchant_request_id', { length: 100 }),
  checkout_request_id: varchar('checkout_request_id', { length: 100 }),
  conversation_id: varchar('conversation_id', { length: 100 }),
  originator_conversation_id: varchar('originator_conversation_id', { length: 100 }),
  result_code: integer('result_code'),
  result_desc: text('result_desc'),
  mpesa_receipt_number: varchar('mpesa_receipt_number', { length: 50 }),
  status: varchar('status', { length: 20 }).default('initiated').notNull(),
  callback_payload: jsonb('callback_payload'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_mpesa_checkout_req').on(table.checkout_request_id),
  index('idx_mpesa_user').on(table.user_id),
  index('idx_mpesa_status').on(table.status),
]);

// ── Assets ─────────────────────────────────────────────
export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  symbol: varchar('symbol', { length: 20 }).unique().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  category: varchar('category', { length: 20 }).notNull(),
  twelve_data_symbol: varchar('twelve_data_symbol', { length: 20 }).notNull(),
  payout_rate: decimal('payout_rate', { precision: 5, scale: 2 }).default('85.00').notNull(),
  min_trade: decimal('min_trade', { precision: 15, scale: 2 }).default('50.00').notNull(),
  max_trade: decimal('max_trade', { precision: 15, scale: 2 }).default('100000.00').notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  trading_hours: jsonb('trading_hours'),
  sort_order: integer('sort_order').default(0).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_assets_category').on(table.category),
  index('idx_assets_active').on(table.is_active),
]);

// ── Trades ─────────────────────────────────────────────
export const trades = pgTable('trades', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id),
  asset_id: uuid('asset_id').notNull().references(() => assets.id),
  is_demo: boolean('is_demo').default(false).notNull(),
  direction: varchar('direction', { length: 4 }).notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  payout_rate: decimal('payout_rate', { precision: 5, scale: 2 }).notNull(),
  entry_price: decimal('entry_price', { precision: 20, scale: 8 }).notNull(),
  exit_price: decimal('exit_price', { precision: 20, scale: 8 }),
  timeframe_seconds: integer('timeframe_seconds').notNull(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  settled_at: timestamp('settled_at', { withTimezone: true }),
  result: varchar('result', { length: 10 }),
  profit: decimal('profit', { precision: 15, scale: 2 }),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  transaction_debit_id: uuid('transaction_debit_id').references(() => transactions.id),
  transaction_credit_id: uuid('transaction_credit_id').references(() => transactions.id),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_trades_user_id').on(table.user_id),
  index('idx_trades_asset_id').on(table.asset_id),
  index('idx_trades_status').on(table.status),
  index('idx_trades_expires_at').on(table.expires_at),
  index('idx_trades_user_history').on(table.user_id, table.created_at),
]);

// ── KYC Documents ──────────────────────────────────────
export const kycDocuments = pgTable('kyc_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id),
  document_type: varchar('document_type', { length: 30 }).notNull(),
  file_url: varchar('file_url', { length: 500 }).notNull(),
  file_hash: varchar('file_hash', { length: 64 }),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  rejection_reason: text('rejection_reason'),
  reviewed_by: uuid('reviewed_by').references(() => users.id),
  reviewed_at: timestamp('reviewed_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_kyc_user').on(table.user_id),
  index('idx_kyc_status').on(table.status),
]);

// ── OTP Codes ──────────────────────────────────────────
export const otpCodes = pgTable('otp_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: varchar('phone', { length: 15 }).notNull(),
  code: varchar('code', { length: 6 }).notNull(),
  purpose: varchar('purpose', { length: 20 }).notNull(),
  attempts: integer('attempts').default(0).notNull(),
  max_attempts: integer('max_attempts').default(3).notNull(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  is_used: boolean('is_used').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_otp_phone').on(table.phone, table.purpose, table.is_used),
  index('idx_otp_expiry').on(table.expires_at),
]);

// ── Notifications ──────────────────────────────────────
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id),
  type: varchar('type', { length: 30 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  message: text('message').notNull(),
  is_read: boolean('is_read').default(false).notNull(),
  metadata: jsonb('metadata'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_notifications_user').on(table.user_id, table.is_read, table.created_at),
]);

// ── Price Snapshots ────────────────────────────────────
export const priceSnapshots = pgTable('price_snapshots', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  asset_symbol: varchar('asset_symbol', { length: 20 }).notNull(),
  price: decimal('price', { precision: 20, scale: 8 }).notNull(),
  source: varchar('source', { length: 20 }).default('twelve_data').notNull(),
  captured_at: timestamp('captured_at', { withTimezone: true }).notNull(),
}, (table) => [
  uniqueIndex('uq_price_snapshot').on(table.asset_symbol, table.captured_at),
  index('idx_price_snapshots_symbol_time').on(table.asset_symbol, table.captured_at),
]);

// ── Admin Audit Log ────────────────────────────────────
export const adminAuditLog = pgTable('admin_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  admin_id: uuid('admin_id').notNull().references(() => users.id),
  action: varchar('action', { length: 50 }).notNull(),
  target_type: varchar('target_type', { length: 30 }),
  target_id: uuid('target_id'),
  details: jsonb('details'),
  ip_address: varchar('ip_address', { length: 45 }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_audit_admin').on(table.admin_id, table.created_at),
]);

// ── Platform Settings ──────────────────────────────────
export const platformSettings = pgTable('platform_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').notNull(),
  description: text('description'),
  updated_by: uuid('updated_by').references(() => users.id),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
