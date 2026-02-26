import { Router } from 'express';
import * as marketController from '../controllers/market.controller';

const router = Router();

// Public routes — no auth required for price data
router.get('/assets', marketController.getAssets);
router.get('/assets/:symbol', marketController.getAsset);
router.get('/candles/:symbol', marketController.getCandles);
router.get('/prices', marketController.getPrices);

export default router;
