import { Request, Response, NextFunction } from 'express';
import * as tradeService from '../services/trade.service';
import { AppError } from '../middleware/errorHandler';

export async function placeTrade(req: Request, res: Response, next: NextFunction) {
  try {
    const { asset_id, direction, amount, timeframe_seconds, is_demo } = req.body;

    const result = await tradeService.placeTrade({
      userId: req.user!.userId,
      assetId: asset_id,
      direction,
      amount,
      timeframeSeconds: timeframe_seconds,
      isDemo: is_demo || false,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getActiveTrades(req: Request, res: Response, next: NextFunction) {
  try {
    const isDemo = req.query.is_demo === 'true';
    const activeTrades = await tradeService.getActiveTrades(req.user!.userId, isDemo);

    res.json({ success: true, data: activeTrades });
  } catch (err) {
    next(err);
  }
}

export async function getTradeHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, result, is_demo, asset_id } = req.query;

    const history = await tradeService.getTradeHistory(req.user!.userId, {
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 20,
      result: result as string | undefined,
      is_demo: is_demo !== undefined ? is_demo === 'true' : undefined,
      asset_id: asset_id as string | undefined,
    });

    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
}

export async function getTradeById(req: Request, res: Response, next: NextFunction) {
  try {
    const trade = await tradeService.getTradeById(req.params.id as string);

    if (!trade) {
      throw new AppError('Trade not found', 404, 'NOT_FOUND');
    }

    if (trade.user_id !== req.user!.userId) {
      throw new AppError('Unauthorized', 403, 'FORBIDDEN');
    }

    res.json({ success: true, data: trade });
  } catch (err) {
    next(err);
  }
}
