import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../config/redis';

function createRedisStore(prefix?: string) {
  return new RedisStore({
    // @ts-expect-error - ioredis call signature compatible with rate-limit-redis
    sendCommand: (...args: string[]) => redis.call(...args),
    ...(prefix ? { prefix } : {}),
  });
}

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests, please try again later', code: 'RATE_LIMITED' } },
  store: createRedisStore(),
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many login attempts, please try again later', code: 'RATE_LIMITED' } },
  store: createRedisStore('rl:auth:'),
});

export const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'OTP already sent. Please wait 60 seconds.', code: 'OTP_RATE_LIMITED' } },
  keyGenerator: (req) => req.body?.phone || req.ip || 'unknown',
  store: createRedisStore('rl:otp:'),
});
