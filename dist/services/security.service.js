"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const otplib_1 = require("otplib");
const qrcode_1 = __importDefault(require("qrcode"));
const db_1 = require("../config/db");
const config_1 = require("../config");
class SecurityService {
    /**
     * Hashes a password or transaction PIN using Bcrypt with salt factor 12
     */
    static async hash(data) {
        const salt = await bcrypt_1.default.genSalt(12);
        return bcrypt_1.default.hash(data, salt);
    }
    /**
     * Compares plain data against bcrypt hash
     */
    static async compare(plain, hashed) {
        return bcrypt_1.default.compare(plain, hashed);
    }
    /**
     * Verifies the 6-digit transaction PIN and enforces lockout rules on repeated failures
     */
    static async verifyTransactionPin(userId, pin) {
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                transactionPinHash: true,
                failedPinAttempts: true,
                pinLockedUntil: true,
            },
        });
        if (!user) {
            return { valid: false, message: 'User not found' };
        }
        if (!user.transactionPinHash) {
            return { valid: false, message: 'Transaction PIN has not been set up. Please configure your PIN first.' };
        }
        // Check if account PIN is currently locked
        if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
            const remainingMinutes = Math.ceil((user.pinLockedUntil.getTime() - Date.now()) / (1000 * 60));
            return {
                valid: false,
                message: `Security lock active due to failed attempts. Try again in ${remainingMinutes} minute(s).`,
            };
        }
        const isMatch = await bcrypt_1.default.compare(pin, user.transactionPinHash);
        if (!isMatch) {
            const attempts = user.failedPinAttempts + 1;
            let lockoutDate = null;
            if (attempts >= config_1.config.security.maxPinAttempts) {
                lockoutDate = new Date(Date.now() + config_1.config.security.pinLockoutMinutes * 60 * 1000);
            }
            await db_1.prisma.user.update({
                where: { id: userId },
                data: {
                    failedPinAttempts: attempts,
                    pinLockedUntil: lockoutDate,
                },
            });
            if (lockoutDate) {
                return {
                    valid: false,
                    message: `PIN entered incorrectly ${attempts} times. Your transaction PIN is locked for ${config_1.config.security.pinLockoutMinutes} minutes.`,
                };
            }
            return {
                valid: false,
                message: `Invalid transaction PIN. ${config_1.config.security.maxPinAttempts - attempts} attempt(s) remaining.`,
            };
        }
        // Reset failed attempts on correct entry
        if (user.failedPinAttempts > 0 || user.pinLockedUntil) {
            await db_1.prisma.user.update({
                where: { id: userId },
                data: {
                    failedPinAttempts: 0,
                    pinLockedUntil: null,
                },
            });
        }
        return { valid: true };
    }
    /**
     * Generates a 2FA TOTP secret and QR code URL for Google Authenticator / Authy
     */
    static async generateTwoFactorSecret(userEmail) {
        const secret = otplib_1.authenticator.generateSecret();
        const otpAuthUrl = otplib_1.authenticator.keyuri(userEmail, 'Swiss Bank', secret);
        const qrCodeDataUrl = await qrcode_1.default.toDataURL(otpAuthUrl);
        return { secret, qrCodeDataUrl };
    }
    /**
     * Verifies a 6-digit TOTP token
     */
    static verifyTwoFactorToken(token, secret) {
        return otplib_1.authenticator.verify({ token, secret });
    }
    /**
     * Records an immutable entry in the bank audit log
     */
    static async logAudit(params) {
        try {
            await db_1.prisma.auditLog.create({
                data: {
                    userId: params.userId,
                    action: params.action,
                    ipAddress: params.ipAddress || 'unknown',
                    userAgent: params.userAgent || 'unknown',
                    details: params.details ? JSON.stringify(params.details) : null,
                },
            });
        }
        catch (err) {
            console.error('Audit log write failure:', err);
        }
    }
    /**
     * Checks velocity and daily transfer limits to mitigate fraud
     */
    static async checkVelocityAndLimits(sourceAccountId, transferAmount) {
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        // 1. Check transactions in the past 1 minute
        const recentTxCount = await db_1.prisma.transaction.count({
            where: {
                sourceAccountId,
                createdAt: { gte: oneMinuteAgo },
            },
        });
        if (recentTxCount >= config_1.config.security.transferVelocityLimitPerMinute) {
            return {
                allowed: false,
                reason: 'Velocity check failed: Too many transactions in a short window. Please wait a minute.',
            };
        }
        // 2. Check cumulative transfers today
        const todaysTransfers = await db_1.prisma.transaction.findMany({
            where: {
                sourceAccountId,
                createdAt: { gte: startOfDay },
                status: 'COMPLETED',
            },
            select: { amount: true },
        });
        const totalTransferredToday = todaysTransfers.reduce((sum, tx) => sum + Number(tx.amount), 0);
        const account = await db_1.prisma.account.findUnique({
            where: { id: sourceAccountId },
            select: { dailyTransferLimit: true },
        });
        const limit = account ? Number(account.dailyTransferLimit) : config_1.config.security.maxDailyTransferAmount;
        if (totalTransferredToday + transferAmount > limit) {
            return {
                allowed: false,
                reason: `Daily transfer limit exceeded. Remaining limit today is $${Math.max(0, limit - totalTransferredToday).toFixed(2)}.`,
            };
        }
        return { allowed: true };
    }
}
exports.SecurityService = SecurityService;
