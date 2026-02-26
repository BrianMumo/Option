import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { depositSchema, withdrawSchema, transactionQuerySchema } from '@stakeoption/shared';
import * as walletController from '../controllers/wallet.controller';

const router = Router();

// All wallet routes require authentication
router.use(authenticate);

router.get('/balance', walletController.getBalance);
router.get('/transactions', validate(transactionQuerySchema, 'query'), walletController.getTransactions);
router.post('/deposit', validate(depositSchema), walletController.deposit);
router.post('/withdraw', validate(withdrawSchema), walletController.withdraw);

export default router;
