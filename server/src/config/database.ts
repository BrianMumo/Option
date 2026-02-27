import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from './env';
import * as schema from '../db/schema';

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.NODE_ENV === 'production' ? 5 : 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export const db = drizzle(pool, { schema });
export { pool };
