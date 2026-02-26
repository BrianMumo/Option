import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  CLIENT_URL: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  MPESA_CONSUMER_KEY: z.string().default(''),
  MPESA_CONSUMER_SECRET: z.string().default(''),
  MPESA_PASSKEY: z.string().default(''),
  MPESA_SHORTCODE: z.string().default('174379'),
  MPESA_B2C_SHORTCODE: z.string().default('600000'),
  MPESA_INITIATOR_NAME: z.string().default('StakeOptionAdmin'),
  MPESA_SECURITY_CREDENTIAL: z.string().default(''),
  MPESA_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  MPESA_CALLBACK_BASE_URL: z.string().default('http://localhost:5000'),

  TWELVE_DATA_API_KEY: z.string().default(''),

  AT_API_KEY: z.string().default(''),
  AT_USERNAME: z.string().default(''),
  AT_SENDER_ID: z.string().default('StakeOpt'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
