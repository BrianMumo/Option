import { Request, Response, NextFunction } from 'express';
import * as marketService from '../services/market.service';
import { AppError } from '../middleware/errorHandler';

export async function getAssets(req: Request, res: Response, next: NextFunction) {
  try {
    const { category } = req.query;
    let assetsList;

    if (category && typeof category === 'string') {
      assetsList = await marketService.getAssetsByCategory(category);
    } else {
      assetsList = await marketService.getActiveAssets();
    }

    // Attach current prices
    const symbols = assetsList.map((a) => a.symbol);
    const prices = await marketService.getCurrentPrices(symbols);

    const enriched = assetsList.map((asset) => ({
      ...asset,
      current_price: prices[asset.symbol] || null,
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
}

export async function getAsset(req: Request, res: Response, next: NextFunction) {
  try {
    const symbol = req.params.symbol as string;
    const asset = await marketService.getAssetBySymbol(symbol);

    if (!asset) {
      throw new AppError('Asset not found', 404, 'NOT_FOUND');
    }

    const price = await marketService.getCurrentPrice(symbol);

    res.json({ success: true, data: { ...asset, current_price: price } });
  } catch (err) {
    next(err);
  }
}

export async function getCandles(req: Request, res: Response, next: NextFunction) {
  try {
    const symbol = req.params.symbol as string;
    const interval = (req.query.interval as string) || '1min';
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

    const candles = await marketService.getCandles(symbol, interval, limit);

    res.json({ success: true, data: candles });
  } catch (err) {
    next(err);
  }
}

export async function getPrices(_req: Request, res: Response, next: NextFunction) {
  try {
    const assets = await marketService.getActiveAssets();
    const symbols = assets.map((a) => a.symbol);
    const prices = await marketService.getCurrentPrices(symbols);

    res.json({ success: true, data: prices });
  } catch (err) {
    next(err);
  }
}
