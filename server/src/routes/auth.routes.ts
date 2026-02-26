import { Router } from 'express';
import { validate } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { authLimiter, otpLimiter } from '../middleware/rateLimiter';
import { registerSchema, loginSchema, sendOtpSchema, verifyOtpSchema, refreshTokenSchema } from '@stakeoption/shared';
import * as authController from '../controllers/auth.controller';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/send-otp', otpLimiter, validate(sendOtpSchema), authController.sendOtp);
router.post('/verify-otp', authLimiter, validate(verifyOtpSchema), authController.verifyOtp);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.post('/reset-demo-balance', authenticate, authController.resetDemoBalance);

export default router;
