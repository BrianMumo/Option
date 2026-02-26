import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { createOTP } from '../services/otp.service';
import { db } from '../config/database';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { DEMO_INITIAL_BALANCE } from '@stakeoption/shared';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({
      success: true,
      message: `OTP sent to ${req.body.phone}`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { phone, code, purpose } = req.body;

    if (purpose === 'registration') {
      const result = await authService.verifyRegistration(phone, code);
      return res.json({ success: true, data: result });
    }

    // For other purposes (login, withdrawal), just verify and return success
    const { verifyOTP } = require('../services/otp.service');
    const valid = await verifyOTP(phone, code, purpose);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid or expired OTP', code: 'INVALID_OTP' },
      });
    }
    return res.json({ success: true, data: { verified: true } });
  } catch (error) {
    next(error);
  }
}

export async function sendOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { phone, purpose } = req.body;
    await createOTP(phone, purpose);
    res.json({
      success: true,
      message: `OTP sent to ${phone}`,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refresh_token } = req.body;
    const result = await authService.refreshToken(refresh_token);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { refresh_token } = req.body;
    await authService.logout(userId, refresh_token);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getUserById(req.user!.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found', code: 'USER_NOT_FOUND' },
      });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

export async function resetDemoBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    await db.update(users)
      .set({ demo_balance: String(DEMO_INITIAL_BALANCE) })
      .where(eq(users.id, userId));

    res.json({
      success: true,
      data: { demo_balance: DEMO_INITIAL_BALANCE },
      message: 'Demo balance reset successfully',
    });
  } catch (error) {
    next(error);
  }
}
