import { z } from 'zod';

export const registerSchema = z.object({
  phone: z.string().regex(/^\+254[0-9]{9}$/, 'Invalid Kenyan phone number. Use format +254XXXXXXXXX'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  email: z.string().email('Invalid email address').optional(),
});

export const loginSchema = z.object({
  phone: z.string().regex(/^\+254[0-9]{9}$/, 'Invalid Kenyan phone number'),
  password: z.string().min(1, 'Password is required'),
});

export const sendOtpSchema = z.object({
  phone: z.string().regex(/^\+254[0-9]{9}$/, 'Invalid Kenyan phone number'),
  purpose: z.enum(['registration', 'login', 'withdrawal', 'password_reset']),
});

export const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\+254[0-9]{9}$/, 'Invalid Kenyan phone number'),
  code: z.string().length(6, 'OTP must be 6 digits').regex(/^[0-9]{6}$/, 'OTP must be numeric'),
  purpose: z.enum(['registration', 'login', 'withdrawal', 'password_reset']),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1),
});

export const resetPasswordSchema = z.object({
  phone: z.string().regex(/^\+254[0-9]{9}$/, 'Invalid Kenyan phone number'),
  code: z.string().length(6),
  new_password: z.string().min(8).max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
