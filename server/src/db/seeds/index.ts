import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import 'dotenv/config';
import { assets, platformSettings } from '../schema';

const SEED_ASSETS = [
  // Forex
  { symbol: 'EUR/USD', name: 'Euro / US Dollar', category: 'forex', twelve_data_symbol: 'EUR/USD', payout_rate: '85.00', sort_order: 1 },
  { symbol: 'GBP/USD', name: 'British Pound / US Dollar', category: 'forex', twelve_data_symbol: 'GBP/USD', payout_rate: '85.00', sort_order: 2 },
  { symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen', category: 'forex', twelve_data_symbol: 'USD/JPY', payout_rate: '85.00', sort_order: 3 },
  { symbol: 'AUD/USD', name: 'Australian Dollar / US Dollar', category: 'forex', twelve_data_symbol: 'AUD/USD', payout_rate: '82.00', sort_order: 4 },
  { symbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar', category: 'forex', twelve_data_symbol: 'USD/CAD', payout_rate: '82.00', sort_order: 5 },
  { symbol: 'EUR/GBP', name: 'Euro / British Pound', category: 'forex', twelve_data_symbol: 'EUR/GBP', payout_rate: '83.00', sort_order: 6 },
  { symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc', category: 'forex', twelve_data_symbol: 'USD/CHF', payout_rate: '82.00', sort_order: 7 },
  { symbol: 'NZD/USD', name: 'New Zealand Dollar / US Dollar', category: 'forex', twelve_data_symbol: 'NZD/USD', payout_rate: '80.00', sort_order: 8 },
  { symbol: 'EUR/JPY', name: 'Euro / Japanese Yen', category: 'forex', twelve_data_symbol: 'EUR/JPY', payout_rate: '83.00', sort_order: 9 },
  { symbol: 'GBP/JPY', name: 'British Pound / Japanese Yen', category: 'forex', twelve_data_symbol: 'GBP/JPY', payout_rate: '83.00', sort_order: 10 },

  // Crypto
  { symbol: 'BTC/USD', name: 'Bitcoin / US Dollar', category: 'crypto', twelve_data_symbol: 'BTC/USD', payout_rate: '90.00', sort_order: 11 },
  { symbol: 'ETH/USD', name: 'Ethereum / US Dollar', category: 'crypto', twelve_data_symbol: 'ETH/USD', payout_rate: '88.00', sort_order: 12 },
  { symbol: 'XRP/USD', name: 'Ripple / US Dollar', category: 'crypto', twelve_data_symbol: 'XRP/USD', payout_rate: '87.00', sort_order: 13 },
  { symbol: 'SOL/USD', name: 'Solana / US Dollar', category: 'crypto', twelve_data_symbol: 'SOL/USD', payout_rate: '88.00', sort_order: 14 },
  { symbol: 'BNB/USD', name: 'Binance Coin / US Dollar', category: 'crypto', twelve_data_symbol: 'BNB/USD', payout_rate: '86.00', sort_order: 15 },

  // Commodities
  { symbol: 'XAU/USD', name: 'Gold / US Dollar', category: 'commodity', twelve_data_symbol: 'XAU/USD', payout_rate: '85.00', sort_order: 16 },
  { symbol: 'XAG/USD', name: 'Silver / US Dollar', category: 'commodity', twelve_data_symbol: 'XAG/USD', payout_rate: '82.00', sort_order: 17 },
  { symbol: 'WTI/USD', name: 'Crude Oil WTI', category: 'commodity', twelve_data_symbol: 'WTI/USD', payout_rate: '80.00', sort_order: 18 },
];

const SEED_SETTINGS = [
  { key: 'min_deposit', value: { amount: 100, currency: 'KES' }, description: 'Minimum deposit amount' },
  { key: 'max_deposit', value: { amount: 300000, currency: 'KES' }, description: 'Maximum deposit amount' },
  { key: 'min_withdrawal', value: { amount: 100, currency: 'KES' }, description: 'Minimum withdrawal amount' },
  { key: 'max_withdrawal', value: { amount: 150000, currency: 'KES' }, description: 'Maximum withdrawal amount' },
  { key: 'default_payout_rate', value: { rate: 85 }, description: 'Default payout rate for new assets' },
  { key: 'withdrawal_processing_hours', value: { hours: 24 }, description: 'Max hours to process withdrawals' },
  { key: 'demo_initial_balance', value: { amount: 10000 }, description: 'Initial demo account balance in KES' },
  { key: 'max_concurrent_trades', value: { count: 10 }, description: 'Maximum concurrent trades per user' },
  { key: 'kyc_withdrawal_threshold', value: { amount: 5000 }, description: 'KYC required for withdrawals above this amount' },
];

async function seed() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://stakeoption:stakeoption_dev@localhost:5432/stakeoption',
  });
  const db = drizzle(pool);

  console.log('Seeding assets...');
  for (const asset of SEED_ASSETS) {
    await db.insert(assets).values(asset).onConflictDoNothing({ target: assets.symbol });
  }

  console.log('Seeding platform settings...');
  for (const setting of SEED_SETTINGS) {
    await db.insert(platformSettings).values(setting).onConflictDoNothing({ target: platformSettings.key });
  }

  console.log('Seeding complete!');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
