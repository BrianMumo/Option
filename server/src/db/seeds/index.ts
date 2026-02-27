import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import 'dotenv/config';
import { assets, platformSettings } from '../schema';

const SEED_ASSETS = [
  // Velocity Index — smooth random walk, tiered by volatility
  { symbol: 'V10',       name: 'Velocity 10 Index',     category: 'velocity',    payout_rate: '82.00', sort_order: 1 },
  { symbol: 'V25',       name: 'Velocity 25 Index',     category: 'velocity',    payout_rate: '84.00', sort_order: 2 },
  { symbol: 'V50',       name: 'Velocity 50 Index',     category: 'velocity',    payout_rate: '86.00', sort_order: 3 },
  { symbol: 'V75',       name: 'Velocity 75 Index',     category: 'velocity',    payout_rate: '88.00', sort_order: 4 },
  { symbol: 'V100',      name: 'Velocity 100 Index',    category: 'velocity',    payout_rate: '90.00', sort_order: 5 },
  { symbol: 'V10-1s',    name: 'Velocity 10 (1s)',      category: 'velocity',    payout_rate: '80.00', sort_order: 6 },
  { symbol: 'V100-1s',   name: 'Velocity 100 (1s)',     category: 'velocity',    payout_rate: '92.00', sort_order: 7 },

  // Crash/Boom — trending with sudden reversal events
  { symbol: 'CRASH-300',  name: 'Crash 300 Index',      category: 'crash_boom',  payout_rate: '87.00', sort_order: 8 },
  { symbol: 'CRASH-500',  name: 'Crash 500 Index',      category: 'crash_boom',  payout_rate: '85.00', sort_order: 9 },
  { symbol: 'CRASH-1000', name: 'Crash 1000 Index',     category: 'crash_boom',  payout_rate: '83.00', sort_order: 10 },
  { symbol: 'BOOM-300',   name: 'Boom 300 Index',       category: 'crash_boom',  payout_rate: '87.00', sort_order: 11 },
  { symbol: 'BOOM-500',   name: 'Boom 500 Index',       category: 'crash_boom',  payout_rate: '85.00', sort_order: 12 },
  { symbol: 'BOOM-1000',  name: 'Boom 1000 Index',      category: 'crash_boom',  payout_rate: '83.00', sort_order: 13 },

  // Step Index — discrete fixed-size up/down, 50/50
  { symbol: 'STEP-100',  name: 'Step 100 Index',        category: 'step',        payout_rate: '85.00', sort_order: 14 },
  { symbol: 'STEP-200',  name: 'Step 200 Index',        category: 'step',        payout_rate: '87.00', sort_order: 15 },
  { symbol: 'STEP-500',  name: 'Step 500 Index',        category: 'step',        payout_rate: '89.00', sort_order: 16 },

  // Range Break — oscillates in band, periodic breakout
  { symbol: 'RB-100',    name: 'Range Break 100',       category: 'range_break', payout_rate: '88.00', sort_order: 17 },
  { symbol: 'RB-150',    name: 'Range Break 150',       category: 'range_break', payout_rate: '86.00', sort_order: 18 },
  { symbol: 'RB-200',    name: 'Range Break 200',       category: 'range_break', payout_rate: '84.00', sort_order: 19 },
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

  console.log('Clearing old assets...');
  await db.delete(assets);

  console.log('Seeding velocity assets...');
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
