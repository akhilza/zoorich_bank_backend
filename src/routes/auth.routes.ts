import { Router } from 'express';
import { z } from 'zod';
import { AuthController } from '../controllers/auth.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { authLimiter } from '../middlewares/rate-limit.middleware';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  phone: z.string().optional(),
  transactionPin: z.string().regex(/^\d{6}$/, 'PIN must be exactly 6 digits').optional(),
  initialDeposit: z.number().nonnegative().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  twoFactorCode: z.string().optional(),
});

const setupPinSchema = z.object({
  password: z.string().min(1),
  pin: z.string().regex(/^\d{6}$/, 'PIN must be exactly 6 digits'),
});

const verify2FASchema = z.object({
  token: z.string().regex(/^\d{6}$/, '2FA code must be 6 digits'),
});

const requestResetOtpSchema = z.object({
  identifier: z.string().min(2, 'Phone number or email is required'),
  method: z.enum(['phone', 'email']).default('phone'),
});

const verifyResetOtpSchema = z.object({
  userId: z.string().uuid(),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
});

const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
  resetToken: z.string().min(10, 'Invalid reset token'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const updateProfileSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
});

router.post('/register', authLimiter, validateRequest(registerSchema), AuthController.register);
router.post('/login', authLimiter, validateRequest(loginSchema), AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', authenticateJwt, AuthController.logout);
router.post('/verify-email', AuthController.verifyEmail);
router.post('/test-sms', AuthController.testSms);


// Spec MFA routes
router.post('/mfa/setup', authenticateJwt, AuthController.generate2FA);
router.post('/mfa/verify', authenticateJwt, validateRequest(verify2FASchema), AuthController.verifyAndEnable2FA);

router.get('/profile', authenticateJwt, AuthController.getProfile);
router.put('/profile', authenticateJwt, validateRequest(updateProfileSchema), AuthController.updateProfile);
router.post('/pin/setup', authenticateJwt, validateRequest(setupPinSchema), AuthController.setupPin);
router.post('/2fa/generate', authenticateJwt, AuthController.generate2FA);
router.post('/2fa/verify', authenticateJwt, validateRequest(verify2FASchema), AuthController.verifyAndEnable2FA);

// Forgot Password / OTP Verification Routes
router.post('/forgot-password', authLimiter, validateRequest(requestResetOtpSchema), AuthController.requestPasswordResetOtp);
router.post('/forgot-password/request-otp', authLimiter, validateRequest(requestResetOtpSchema), AuthController.requestPasswordResetOtp);
router.post('/forgot-password/verify-otp', authLimiter, validateRequest(verifyResetOtpSchema), AuthController.verifyPasswordResetOtp);
router.post('/reset-password', authLimiter, validateRequest(resetPasswordSchema), AuthController.resetPassword);
router.post('/forgot-password/reset', authLimiter, validateRequest(resetPasswordSchema), AuthController.resetPassword);


export default router;

