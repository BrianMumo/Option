import { db } from '../config/database';
import { otpCodes } from '../db/schema';
import { generateOTP } from '../utils/crypto';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { eq, and, gt } from 'drizzle-orm';

export async function createOTP(phone: string, purpose: string): Promise<string> {
  const code = generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await db.insert(otpCodes).values({
    phone,
    code,
    purpose,
    expires_at: expiresAt,
  });

  // Send SMS via Africa's Talking
  await sendSMS(phone, `Your StakeOption verification code is: ${code}. Valid for 5 minutes.`);

  return code;
}

export async function verifyOTP(phone: string, code: string, purpose: string): Promise<boolean> {
  const now = new Date();

  // Find the latest unused OTP for this phone+purpose (without checking code)
  const [otp] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.phone, phone),
        eq(otpCodes.purpose, purpose),
        eq(otpCodes.is_used, false),
        gt(otpCodes.expires_at, now)
      )
    )
    .limit(1);

  if (!otp) return false;

  // Check max attempts before incrementing
  if (otp.attempts >= otp.max_attempts) return false;

  // Increment attempt counter on every verification try
  await db
    .update(otpCodes)
    .set({ attempts: otp.attempts + 1 })
    .where(eq(otpCodes.id, otp.id));

  // Now check if the code matches
  if (otp.code !== code) return false;

  // Mark as used
  await db
    .update(otpCodes)
    .set({ is_used: true })
    .where(eq(otpCodes.id, otp.id));

  return true;
}

async function sendSMS(phone: string, message: string): Promise<void> {
  if (env.NODE_ENV === 'development') {
    logger.info({ phone, message }, 'DEV: SMS would be sent');
    return;
  }

  if (!env.AT_API_KEY || !env.AT_USERNAME) {
    logger.warn('Africa\'s Talking credentials not configured, skipping SMS');
    return;
  }

  try {
    const response = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'apiKey': env.AT_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        username: env.AT_USERNAME,
        to: phone,
        message,
        from: env.AT_SENDER_ID,
      }),
    });

    if (!response.ok) {
      throw new Error(`SMS send failed: ${response.status}`);
    }

    logger.info({ phone }, 'OTP SMS sent');
  } catch (error) {
    logger.error({ error, phone }, 'Failed to send OTP SMS');
    throw error;
  }
}
