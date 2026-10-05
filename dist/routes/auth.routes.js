"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const rate_limit_middleware_1 = require("../middlewares/rate-limit.middleware");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
    firstName: zod_1.z.string().min(2),
    lastName: zod_1.z.string().min(2),
    phone: zod_1.z.string().optional(),
    transactionPin: zod_1.z.string().regex(/^\d{6}$/, 'PIN must be exactly 6 digits').optional(),
    initialDeposit: zod_1.z.number().nonnegative().optional(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
    twoFactorCode: zod_1.z.string().optional(),
});
const setupPinSchema = zod_1.z.object({
    password: zod_1.z.string().min(1),
    pin: zod_1.z.string().regex(/^\d{6}$/, 'PIN must be exactly 6 digits'),
});
const verify2FASchema = zod_1.z.object({
    token: zod_1.z.string().regex(/^\d{6}$/, '2FA code must be 6 digits'),
});
const requestResetOtpSchema = zod_1.z.object({
    identifier: zod_1.z.string().min(2, 'Phone number or email is required'),
    method: zod_1.z.enum(['phone', 'email']).default('phone'),
});
const verifyResetOtpSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    otp: zod_1.z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
});
const resetPasswordSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    resetToken: zod_1.z.string().min(10, 'Invalid reset token'),
    newPassword: zod_1.z.string().min(8, 'New password must be at least 8 characters'),
});
const updateProfileSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(2).optional(),
    lastName: zod_1.z.string().min(2).optional(),
    phone: zod_1.z.string().optional().nullable(),
});
router.post('/register', rate_limit_middleware_1.authLimiter, (0, validate_middleware_1.validateRequest)(registerSchema), auth_controller_1.AuthController.register);
router.post('/login', rate_limit_middleware_1.authLimiter, (0, validate_middleware_1.validateRequest)(loginSchema), auth_controller_1.AuthController.login);
router.post('/refresh', auth_controller_1.AuthController.refresh);
router.post('/logout', auth_middleware_1.authenticateJwt, auth_controller_1.AuthController.logout);
router.post('/verify-email', auth_controller_1.AuthController.verifyEmail);
router.post('/test-sms', auth_controller_1.AuthController.testSms);
// Spec MFA routes
router.post('/mfa/setup', auth_middleware_1.authenticateJwt, auth_controller_1.AuthController.generate2FA);
router.post('/mfa/verify', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(verify2FASchema), auth_controller_1.AuthController.verifyAndEnable2FA);
router.get('/profile', auth_middleware_1.authenticateJwt, auth_controller_1.AuthController.getProfile);
router.put('/profile', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(updateProfileSchema), auth_controller_1.AuthController.updateProfile);
router.post('/pin/setup', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(setupPinSchema), auth_controller_1.AuthController.setupPin);
router.post('/2fa/generate', auth_middleware_1.authenticateJwt, auth_controller_1.AuthController.generate2FA);
router.post('/2fa/verify', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(verify2FASchema), auth_controller_1.AuthController.verifyAndEnable2FA);
// Forgot Password / OTP Verification Routes
router.post('/forgot-password', rate_limit_middleware_1.authLimiter, (0, validate_middleware_1.validateRequest)(requestResetOtpSchema), auth_controller_1.AuthController.requestPasswordResetOtp);
router.post('/forgot-password/request-otp', rate_limit_middleware_1.authLimiter, (0, validate_middleware_1.validateRequest)(requestResetOtpSchema), auth_controller_1.AuthController.requestPasswordResetOtp);
router.post('/forgot-password/verify-otp', rate_limit_middleware_1.authLimiter, (0, validate_middleware_1.validateRequest)(verifyResetOtpSchema), auth_controller_1.AuthController.verifyPasswordResetOtp);
router.post('/reset-password', rate_limit_middleware_1.authLimiter, (0, validate_middleware_1.validateRequest)(resetPasswordSchema), auth_controller_1.AuthController.resetPassword);
router.post('/forgot-password/reset', rate_limit_middleware_1.authLimiter, (0, validate_middleware_1.validateRequest)(resetPasswordSchema), auth_controller_1.AuthController.resetPassword);
exports.default = router;
