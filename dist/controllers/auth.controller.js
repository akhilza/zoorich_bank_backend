"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("../services/auth.service");
const security_service_1 = require("../services/security.service");
const sms_service_1 = require("../services/sms.service");
const email_service_1 = require("../services/email.service");
const db_1 = require("../config/db");
class AuthController {
    static async register(req, res, next) {
        try {
            const result = await auth_service_1.AuthService.register(req.body);
            await security_service_1.SecurityService.logAudit({
                userId: result.user.id,
                action: 'USER_REGISTERED',
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
            });
            return res.status(201).json({
                success: true,
                message: 'Account created successfully',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async login(req, res, next) {
        try {
            const result = await auth_service_1.AuthService.login(req.body);
            if (!result.requires2FA && result.user) {
                await security_service_1.SecurityService.logAudit({
                    userId: result.user.id,
                    action: 'USER_LOGGED_IN',
                    ipAddress: req.ip,
                    userAgent: req.get('user-agent'),
                });
                // Dispatch Login Alert Email asynchronously
                email_service_1.EmailService.sendLoginAlert(result.user.email, result.user.firstName, req.ip, req.get('user-agent')).catch((err) => console.warn('Could not dispatch login email:', err.message));
            }
            return res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getProfile(req, res, next) {
        try {
            const user = await db_1.prisma.user.findUnique({
                where: { id: req.user.id },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    role: true,
                    status: true,
                    isTwoFactorEnabled: true,
                    transactionPinHash: true,
                    createdAt: true,
                },
            });
            return res.json({
                success: true,
                data: {
                    ...user,
                    hasPin: !!user?.transactionPinHash,
                    transactionPinHash: undefined,
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async setupPin(req, res, next) {
        try {
            const { password, pin } = req.body;
            const result = await auth_service_1.AuthService.setupTransactionPin(req.user.id, password, pin);
            await security_service_1.SecurityService.logAudit({
                userId: req.user.id,
                action: 'TRANSACTION_PIN_CONFIGURED',
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
            });
            return res.json({ success: true, message: result.message });
        }
        catch (error) {
            next(error);
        }
    }
    static async generate2FA(req, res, next) {
        try {
            const user = await db_1.prisma.user.findUnique({ where: { id: req.user.id } });
            if (!user)
                return res.status(404).json({ success: false, message: 'User not found' });
            const { secret, qrCodeDataUrl } = await security_service_1.SecurityService.generateTwoFactorSecret(user.email);
            // Save secret temporarily until verified
            await db_1.prisma.user.update({
                where: { id: user.id },
                data: { twoFactorSecret: secret },
            });
            return res.json({
                success: true,
                data: { secret, qrCodeDataUrl },
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async verifyAndEnable2FA(req, res, next) {
        try {
            const { token } = req.body;
            const user = await db_1.prisma.user.findUnique({ where: { id: req.user.id } });
            if (!user || !user.twoFactorSecret) {
                return res.status(400).json({ success: false, message: '2FA initialization not found' });
            }
            const isValid = security_service_1.SecurityService.verifyTwoFactorToken(token, user.twoFactorSecret);
            if (!isValid) {
                return res.status(400).json({ success: false, message: 'Invalid 6-digit 2FA code' });
            }
            await db_1.prisma.user.update({
                where: { id: user.id },
                data: { isTwoFactorEnabled: true },
            });
            await security_service_1.SecurityService.logAudit({
                userId: user.id,
                action: 'TWO_FACTOR_ENABLED',
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
            });
            return res.json({
                success: true,
                message: 'Two-Factor Authentication successfully activated',
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async requestPasswordResetOtp(req, res, next) {
        try {
            const { identifier, method = 'phone' } = req.body;
            const result = await auth_service_1.AuthService.requestPasswordResetOtp(identifier, method);
            await security_service_1.SecurityService.logAudit({
                userId: result.userId,
                action: 'PASSWORD_RESET_OTP_REQUESTED',
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
            });
            return res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    userId: result.userId,
                    method: result.method,
                    maskedDestination: result.maskedDestination,
                    demoOtp: result.demoOtp, // Display in dev/demo UI for ease of testing
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async verifyPasswordResetOtp(req, res, next) {
        try {
            const { userId, otp } = req.body;
            const result = await auth_service_1.AuthService.verifyPasswordResetOtp(userId, otp);
            await security_service_1.SecurityService.logAudit({
                userId,
                action: 'PASSWORD_RESET_OTP_VERIFIED',
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
            });
            return res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    userId: result.userId,
                    resetToken: result.resetToken,
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async resetPassword(req, res, next) {
        try {
            const { userId, resetToken, newPassword } = req.body;
            const result = await auth_service_1.AuthService.resetPasswordWithToken(userId, resetToken, newPassword);
            await security_service_1.SecurityService.logAudit({
                userId,
                action: 'PASSWORD_RESET_COMPLETED',
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
            });
            return res.status(200).json({
                success: true,
                message: result.message,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateProfile(req, res, next) {
        try {
            const result = await auth_service_1.AuthService.updateProfile(req.user.id, req.body);
            await security_service_1.SecurityService.logAudit({
                userId: req.user.id,
                action: 'USER_PROFILE_UPDATED',
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
            });
            return res.status(200).json({
                success: true,
                message: 'Profile updated successfully',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async refresh(req, res, next) {
        try {
            const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'];
            if (!refreshToken) {
                return res.status(400).json({ success: false, message: 'Refresh token is required' });
            }
            const tokens = await auth_service_1.AuthService.refreshAccessToken(refreshToken);
            return res.json({ success: true, data: { tokens } });
        }
        catch (error) {
            return res.status(401).json({ success: false, message: error.message });
        }
    }
    static async logout(req, res, next) {
        try {
            if (req.user?.id) {
                await auth_service_1.AuthService.logout(req.user.id);
            }
            return res.json({ success: true, message: 'Logged out successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    static async verifyEmail(req, res, next) {
        try {
            const result = await auth_service_1.AuthService.verifyEmail(req.user?.id || req.body.userId, req.body.code);
            return res.json(result);
        }
        catch (error) {
            next(error);
        }
    }
    static async testSms(req, res, next) {
        try {
            const { to, message } = req.body;
            if (!to) {
                return res.status(400).json({ success: false, message: 'Recipient phone number is required (e.g. +919876543210)' });
            }
            const text = message || '🏦 Nova Bank Test Alert: Your Twilio SMS integration is working successfully!';
            const result = await sms_service_1.SmsService.sendSms(to, text);
            return res.json({
                success: true,
                message: result.simulated ? 'SMS simulated (view server console)' : 'Real SMS dispatched via Twilio',
                result,
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Failed to dispatch SMS',
            });
        }
    }
}
exports.AuthController = AuthController;
