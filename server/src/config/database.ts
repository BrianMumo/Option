import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from './env';
import * as schema from '../db/schema';

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.NODE_ENV === 'production' ? 5 : 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000, // 20s for Neon cold starts
});

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err.message);
});

export const db = drizzle(pool, { schema });
export { pool };
