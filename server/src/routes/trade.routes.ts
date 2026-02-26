import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { placeTradeSchema } from '@stakeoption/shared';
import * as tradeController from '../controllers/trade.controller';

const router = Router();

// All trade routes require authentication
router.use(authenticate);

router.post('/place', validate(placeTradeSchema), tradeController.placeTrade);
router.get('/active', tradeController.getActiveTrades);
router.get('/history', tradeController.getTradeHistory);
router.get('/:id', tradeController.getTradeById);

export default router;
