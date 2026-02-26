import { Router } from 'express';
import * as mpesaController from '../controllers/mpesa.controller';

const router = Router();

// These endpoints are called by Safaricom - no JWT auth, but should be IP-whitelisted in production
router.post('/callback/stk', mpesaController.stkCallback);
router.post('/callback/b2c/result', mpesaController.b2cResultCallback);
router.post('/callback/b2c/timeout', mpesaController.b2cTimeoutCallback);

export default router;
