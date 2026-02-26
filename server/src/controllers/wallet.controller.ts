import { Request, Response, NextFunction } from 'express';
import * as walletService from '../services/wallet.service';
import * as mpesaService from '../services/mpesa.service';
import { AppError } from '../middleware/errorHandler';
import { db } from '../config/database';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function getBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const wallet = await walletService.getWallet(req.user!.userId);
    res.json({ success: true, data: wallet });
  } catch (error) {
    next(error);
  }
}

export async function getTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const { page = 1, limit = 20, type, status } = req.query;
    const result = await walletService.getTransactions(req.user!.userId, {
      page: Number(page),
      limit: Number(limit),
      type: type as string | undefined,
      status: status as string | undefined,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function deposit(req: Request, res: Response, next: NextFunction) {
  try {
    const { amount, phone } = req.body;
    const userId = req.user!.userId;

    // Use user's registered phone if not provided
    let depositPhone = phone;
    if (!depositPhone) {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) throw new AppError('User not found', 404);
      depositPhone = user.phone;
    }

    const result = await mpesaService.initiateSTKPush(userId, amount, depositPhone);

    res.json({
      success: true,
      message: 'STK Push sent. Please enter your M-Pesa PIN on your phone.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function withdraw(req: Request, res: Response, next: NextFunction) {
  try {
    const { amount, phone } = req.body;
    const userId = req.user!.userId;

    // Use user's registered phone if not provided
    let withdrawPhone = phone;
    if (!withdrawPhone) {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) throw new AppError('User not found', 404);
      withdrawPhone = user.phone;
    }

    // Check KYC for larger amounts
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (amount > 5000 && user?.kyc_status !== 'approved') {
      throw new AppError(
        'KYC verification required for withdrawals above KSh 5,000',
        403,
        'KYC_REQUIRED'
      );
    }

    const result = await mpesaService.initiateB2CWithdrawal(userId, amount, withdrawPhone);

    res.json({
      success: true,
      message: 'Withdrawal request submitted. Processing within 24 hours.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
