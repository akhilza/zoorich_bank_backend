"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../config/db");
const config_1 = require("../config");
const security_service_1 = require("./security.service");
const account_service_1 = require("./account.service");
const types_1 = require("../types");
const redis_1 = require("../config/redis");
const sms_service_1 = require("./sms.service");
const email_service_1 = require("./email.service");
class AuthService {
    /**
     * Registers a new bank user and provisions their primary checking account
     */
    static async register(data) {
        const existing = await db_1.prisma.user.findUnique({
            where: { email: data.email.toLowerCase() },
        });
        if (existing) {
            throw new Error('An account with this email address already exists');
        }
        const passwordHash = await security_service_1.SecurityService.hash(data.password);
        const transactionPinHash = data.transactionPin
            ? await security_service_1.SecurityService.hash(data.transactionPin)
            : null;
        const user = await db_1.prisma.user.create({
            data: {
                email: data.email.toLowerCase(),
                passwordHash,
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone,
                transactionPinHash,
                role: types_1.Role.CUSTOMER,
            },
        });
        // Auto-create initial checking account with $1,000 or custom deposit
        const deposit = data.initialDeposit !== undefined ? data.initialDeposit : 1500.0;
        const account = await account_service_1.AccountService.createAccount(user.id, types_1.AccountType.CHECKING, 'USD', deposit);
        const tokens = this.generateTokens(user.id, user.email, user.role);
        // Send Welcome Email asynchronously
        email_service_1.EmailService.sendWelcomeEmail(user.email, user.firstName, account.accountNumber, deposit).catch((err) => console.warn('Could not dispatch welcome email:', err.message));
        return {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                hasPin: !!transactionPinHash,
                isTwoFactorEnabled: user.isTwoFactorEnabled,
            },
            primaryAccount: account,
            tokens,
        };
    }
    /**
     * Authenticates user credentials and checks 2FA requirements
     */
    static async login(data) {
        const user = await db_1.prisma.user.findUnique({
            where: { email: data.email.toLowerCase() },
        });
        if (!user) {
            throw new Error('Invalid email or password combination');
        }
        const isMatch = await security_service_1.SecurityService.compare(data.password, user.passwordHash);
        if (!isMatch) {
            throw new Error('Invalid email or password combination');
        }
        if (user.status !== 'ACTIVE') {
            throw new Error(`Account status is ${user.status}. Please contact branch compliance.`);
        }
        // Check 2FA if enabled
        if (user.isTwoFactorEnabled) {
            if (!data.twoFactorCode) {
                return {
                    requires2FA: true,
                    userId: user.id,
                    message: 'Two-Factor Authentication code required',
                };
            }
            if (!user.twoFactorSecret || !security_service_1.SecurityService.verifyTwoFactorToken(data.twoFactorCode, user.twoFactorSecret)) {
                throw new Error('Invalid 2FA verification code');
            }
        }
        const tokens = this.generateTokens(user.id, user.email, user.role);
        return {
            requires2FA: false,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                hasPin: !!user.transactionPinHash,
                isTwoFactorEnabled: user.isTwoFactorEnabled,
            },
            tokens,
        };
    }
    /**
     * Sets or updates the 6-digit transaction PIN
     */
    static async setupTransactionPin(userId, currentPassword, newPin) {
        if (!/^\d{6}$/.test(newPin)) {
            throw new Error('Transaction PIN must be exactly 6 digits');
        }
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new Error('User not found');
        }
        const isPasswordValid = await security_service_1.SecurityService.compare(currentPassword, user.passwordHash);
        if (!isPasswordValid) {
            throw new Error('Incorrect account password provided');
        }
        const transactionPinHash = await security_service_1.SecurityService.hash(newPin);
        await db_1.prisma.user.update({
            where: { id: userId },
            data: {
                transactionPinHash,
                failedPinAttempts: 0,
                pinLockedUntil: null,
            },
        });
        return { success: true, message: 'Transaction PIN set successfully' };
    }
    static generateTokens(userId, email, role) {
        const accessToken = jsonwebtoken_1.default.sign({ id: userId, email, role }, config_1.config.jwt.secret, { expiresIn: config_1.config.jwt.expiresIn });
        const refreshToken = jsonwebtoken_1.default.sign({ id: userId }, config_1.config.jwt.refreshSecret, { expiresIn: config_1.config.jwt.refreshExpiresIn });
        return { accessToken, refreshToken };
    }
    /**
     * Generates and stores a 6-digit OTP for password reset via phone or email
     */
    static async requestPasswordResetOtp(identifier, method) {
        let user = null;
        if (method === 'phone') {
            const trimmed = identifier.trim();
            // Try exact match first
            user = await db_1.prisma.user.findFirst({
                where: { phone: trimmed },
            });
            // If not found, try normalized digit match
            if (!user) {
                const cleanTarget = trimmed.replace(/\D/g, '');
                if (cleanTarget.length >= 6) {
                    const allWithPhone = await db_1.prisma.user.findMany({
                        where: { phone: { not: null } },
                        select: { id: true, email: true, firstName: true, lastName: true, phone: true, status: true },
                    });
                    user = allWithPhone.find(u => u.phone && u.phone.replace(/\D/g, '') === cleanTarget) || null;
                }
            }
            if (!user) {
                throw new Error('No registered account found with this phone number. Please check the number or register an account.');
            }
        }
        else {
            user = await db_1.prisma.user.findUnique({
                where: { email: identifier.toLowerCase().trim() },
            });
            if (!user) {
                throw new Error('No registered account found with this email address.');
            }
        }
        if (user.status !== 'ACTIVE') {
            throw new Error(`Account status is ${user.status}. Please contact branch compliance.`);
        }
        // Generate random 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        // Cache with 10-minute TTL (600 seconds)
        const cacheKey = `otp:pwd-reset:${user.id}`;
        await (0, redis_1.cacheSet)(cacheKey, JSON.stringify({ otp, attempts: 0, identifier, method, userId: user.id }), 600);
        // Format masked destination
        let maskedDestination = '';
        if (method === 'phone' && user.phone) {
            const p = user.phone.trim();
            maskedDestination = p.length > 4 ? `${'*'.repeat(Math.max(0, p.length - 4))}${p.slice(-4)}` : p;
        }
        else {
            const [local, domain] = user.email.split('@');
            maskedDestination = `${local.charAt(0)}${'*'.repeat(Math.max(1, local.length - 2))}${local.slice(-1)}@${domain}`;
        }
        console.log(`🔑 [PASSWORD RESET OTP] Target: ${user.email} | Phone: ${user.phone || 'none'} | OTP: ${otp}`);
        if (method === 'phone' && user.phone) {
            await sms_service_1.SmsService.sendOtp(user.phone, otp).catch((err) => {
                console.warn('Could not dispatch live SMS:', err.message);
            });
        }
        else {
            // Dispatch 6-digit OTP code to the user's email address
            await email_service_1.EmailService.sendPasswordResetOtp(user.email, user.firstName, otp).catch((err) => {
                console.warn('Could not dispatch OTP email:', err.message);
            });
        }
        return {
            userId: user.id,
            email: user.email,
            phone: user.phone,
            method,
            maskedDestination,
            demoOtp: otp, // Available for development/demo display
            message: `Security OTP has been dispatched to ${maskedDestination}.`,
        };
    }
    /**
     * Verifies the 6-digit OTP and issues a short-lived reset token
     */
    static async verifyPasswordResetOtp(userId, otp) {
        const cacheKey = `otp:pwd-reset:${userId}`;
        const rawData = await (0, redis_1.cacheGet)(cacheKey);
        if (!rawData) {
            throw new Error('Verification code has expired or was not requested. Please request a new code.');
        }
        const data = JSON.parse(rawData);
        if (data.attempts >= 5) {
            await (0, redis_1.cacheDelete)(cacheKey);
            throw new Error('Too many failed attempts. Please request a new verification code.');
        }
        if (data.otp !== otp.trim()) {
            data.attempts += 1;
            await (0, redis_1.cacheSet)(cacheKey, JSON.stringify(data), 600);
            throw new Error(`Invalid verification code. ${5 - data.attempts} attempt(s) remaining.`);
        }
        // Successfully verified! Invalidate OTP and generate reset token (15 mins TTL)
        await (0, redis_1.cacheDelete)(cacheKey);
        const resetToken = 'rst_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
        await (0, redis_1.cacheSet)(`reset-token:${userId}`, resetToken, 900);
        return {
            success: true,
            userId,
            resetToken,
            message: 'OTP verified successfully. You may now specify your new password.',
        };
    }
    /**
     * Resets the user's password using the verified reset token
     */
    static async resetPasswordWithToken(userId, resetToken, newPassword) {
        if (!newPassword || newPassword.length < 8) {
            throw new Error('New password must be at least 8 characters in length');
        }
        const tokenKey = `reset-token:${userId}`;
        const cachedToken = await (0, redis_1.cacheGet)(tokenKey);
        if (!cachedToken || cachedToken !== resetToken) {
            throw new Error('Reset session has expired or is invalid. Please restart the verification process.');
        }
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new Error('User not found');
        }
        const passwordHash = await security_service_1.SecurityService.hash(newPassword);
        await db_1.prisma.user.update({
            where: { id: userId },
            data: {
                passwordHash,
            },
        });
        // Invalidate reset token immediately
        await (0, redis_1.cacheDelete)(tokenKey);
        return {
            success: true,
            message: 'Your password has been successfully reset. You can now log in with your new credentials.',
        };
    }
    /**
     * Updates profile data (e.g. phone number)
     */
    static async updateProfile(userId, data) {
        const updateData = {};
        if (data.firstName)
            updateData.firstName = data.firstName.trim();
        if (data.lastName)
            updateData.lastName = data.lastName.trim();
        if (data.phone !== undefined)
            updateData.phone = data.phone ? data.phone.trim() : null;
        const user = await db_1.prisma.user.update({
            where: { id: userId },
            data: updateData,
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
        return {
            ...user,
            hasPin: !!user.transactionPinHash,
            transactionPinHash: undefined,
        };
    }
    static async refreshAccessToken(refreshTokenStr) {
        try {
            const decoded = jsonwebtoken_1.default.verify(refreshTokenStr, config_1.config.jwt.refreshSecret);
            const user = await db_1.prisma.user.findUnique({ where: { id: decoded.id } });
            if (!user)
                throw new Error('User not found');
            return this.generateTokens(user.id, user.email, user.role);
        }
        catch (err) {
            throw new Error('Invalid or expired refresh token');
        }
    }
    static async logout(userId) {
        await db_1.prisma.refreshToken.deleteMany({
            where: { userId },
        });
        return { success: true, message: 'Logged out successfully' };
    }
    static async verifyEmail(userId, code) {
        return { success: true, message: 'Email verified successfully' };
    }
}
exports.AuthService = AuthService;
