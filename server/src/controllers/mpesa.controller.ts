import { Request, Response, NextFunction } from 'express';
import { handleSTKCallback, handleB2CResultCallback, handleB2CTimeoutCallback } from '../services/mpesa.service';
import { logger } from '../config/logger';

/**
 * M-Pesa STK Push callback - called by Safaricom after user enters PIN.
 * This endpoint MUST return 200 quickly, or Safaricom will retry.
 */
export async function stkCallback(req: Request, res: Response, _next: NextFunction) {
  // Always respond 200 to Safaricom immediately
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  // Process asynchronously
  try {
    await handleSTKCallback(req.body);
  } catch (error) {
    logger.error({ error }, 'Error processing STK callback');
  }
}

/**
 * M-Pesa B2C result callback - called when B2C payment succeeds or fails.
 */
export async function b2cResultCallback(req: Request, res: Response, _next: NextFunction) {
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  try {
    await handleB2CResultCallback(req.body);
  } catch (error) {
    logger.error({ error }, 'Error processing B2C result callback');
  }
}

/**
 * M-Pesa B2C timeout callback - called when B2C payment times out.
 */
export async function b2cTimeoutCallback(req: Request, res: Response, _next: NextFunction) {
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  try {
    await handleB2CTimeoutCallback(req.body);
  } catch (error) {
    logger.error({ error }, 'Error processing B2C timeout callback');
  }
}
