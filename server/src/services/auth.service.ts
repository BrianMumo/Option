import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { users, wallets } from '../db/schema';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { eq } from 'drizzle-orm';
import { createOTP, verifyOTP } from './otp.service';
import type { RegisterInput, LoginInput } from '@stakeoption/shared';

const SALT_ROUNDS = 12;

export async function register(input: RegisterInput) {
  const { phone, password, first_name, last_name, email } = input;

  // Check if user already exists
  const [existing] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  if (existing) {
    throw new AppError('Phone number already registered', 409, 'PHONE_EXISTS');
  }

  if (email) {
    const [emailExists] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (emailExists) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user
  const [user] = await db.insert(users).values({
    phone,
    password_hash,
    first_name: first_name || null,
    last_name: last_name || null,
    email: email || null,
  }).returning();

  // Create wallet
  await db.insert(wallets).values({
    user_id: user.id,
    currency: 'KES',
  });

  // Send OTP for verification
  await createOTP(phone, 'registration');

  return {
    user_id: user.id,
    requires_otp: true,
  };
}

export async function verifyRegistration(phone: string, code: string) {
  const verified = await verifyOTP(phone, code, 'registration');
  if (!verified) {
    throw new AppError('Invalid or expired OTP', 400, 'INVALID_OTP');
  }

  // Mark user as verified
  const [user] = await db
    .update(users)
    .set({ is_verified: true, updated_at: new Date() })
    .where(eq(users.phone, phone))
    .returning();

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Generate tokens
  const tokens = generateTokens(user.id, user.role);
  await storeSession(user.id, tokens.refresh_token);

  return {
    ...tokens,
    user: sanitizeUser(user),
  };
}

export async function login(input: LoginInput) {
  const { phone, password } = input;

  const [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  if (!user) {
    throw new AppError('Invalid phone number or password', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.is_active) {
    throw new AppError('Account has been deactivated', 403, 'ACCOUNT_DEACTIVATED');
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    throw new AppError('Invalid phone number or password', 401, 'INVALID_CREDENTIALS');
  }

  // Update last login
  await db.update(users).set({ last_login_at: new Date(), updated_at: new Date() }).where(eq(users.id, user.id));

  const tokens = generateTokens(user.id, user.role);
  await storeSession(user.id, tokens.refresh_token);

  return {
    ...tokens,
    user: sanitizeUser(user),
  };
}

export async function refreshToken(token: string) {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as { userId: string; role: string };

    // Check if session exists in Redis
    const sessionExists = await redis.sismember(`session:user:${payload.userId}`, token);
    if (!sessionExists) {
      throw new AppError('Invalid refresh token', 401, 'TOKEN_INVALID');
    }

    // Get fresh user data
    const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
    if (!user || !user.is_active) {
      throw new AppError('User not found or deactivated', 401, 'TOKEN_INVALID');
    }

    // Rotate tokens: remove old, create new
    await redis.srem(`session:user:${user.id}`, token);
    const tokens = generateTokens(user.id, user.role);
    await storeSession(user.id, tokens.refresh_token);

    return {
      ...tokens,
      user: sanitizeUser(user),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid refresh token', 401, 'TOKEN_INVALID');
  }
}

export async function logout(userId: string, refreshToken?: string) {
  if (refreshToken) {
    await redis.srem(`session:user:${userId}`, refreshToken);
  } else {
    await redis.del(`session:user:${userId}`);
  }
}

export async function getUserById(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;
  return sanitizeUser(user);
}

function generateTokens(userId: string, role: string) {
  const access_token = jwt.sign({ userId, role }, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRY } as jwt.SignOptions);
  const refresh_token = jwt.sign({ userId, role }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRY } as jwt.SignOptions);
  return { access_token, refresh_token };
}

async function storeSession(userId: string, refreshToken: string) {
  await redis.sadd(`session:user:${userId}`, refreshToken);
  // Set TTL of 7 days on the set
  await redis.expire(`session:user:${userId}`, 7 * 24 * 60 * 60);
}

function sanitizeUser(user: any) {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    is_verified: user.is_verified,
    kyc_status: user.kyc_status,
    demo_balance: parseFloat(user.demo_balance),
    created_at: user.created_at,
  };
}
