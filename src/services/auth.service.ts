import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { config } from '../config';
import { SecurityService } from './security.service';
import { AccountService } from './account.service';
import { Role, AccountType } from '../types';
import { cacheGet, cacheSet, cacheDelete } from '../config/redis';

export class AuthService {
  /**
   * Registers a new bank user and provisions their primary checking account
   */
  static async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    initialDeposit?: number;
    transactionPin?: string;
  }) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existing) {
      throw new Error('An account with this email address already exists');
    }

    const passwordHash = await SecurityService.hash(data.password);
    const transactionPinHash = data.transactionPin
      ? await SecurityService.hash(data.transactionPin)
      : null;

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        transactionPinHash,
        role: Role.CUSTOMER,
      },
    });

    // Auto-create initial checking account with $1,000 or custom deposit
    const deposit = data.initialDeposit !== undefined ? data.initialDeposit : 1500.0;
    const account = await AccountService.createAccount(user.id, AccountType.CHECKING, 'USD', deposit);

    const tokens = this.generateTokens(user.id, user.email, user.role as Role);

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
  static async login(data: { email: string; password: string; twoFactorCode?: string }) {
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (!user) {
      throw new Error('Invalid email or password combination');
    }

    const isMatch = await SecurityService.compare(data.password, user.passwordHash);
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

      if (!user.twoFactorSecret || !SecurityService.verifyTwoFactorToken(data.twoFactorCode, user.twoFactorSecret)) {
        throw new Error('Invalid 2FA verification code');
      }
    }

    const tokens = this.generateTokens(user.id, user.email, user.role as Role);

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
  static async setupTransactionPin(userId: string, currentPassword: string, newPin: string) {
    if (!/^\d{6}$/.test(newPin)) {
      throw new Error('Transaction PIN must be exactly 6 digits');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await SecurityService.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Incorrect account password provided');
    }

    const transactionPinHash = await SecurityService.hash(newPin);

    await prisma.user.update({
      where: { id: userId },
      data: {
        transactionPinHash,
        failedPinAttempts: 0,
        pinLockedUntil: null,
      },
    });

    return { success: true, message: 'Transaction PIN set successfully' };
  }

  private static generateTokens(userId: string, email: string, role: Role) {
    const accessToken = jwt.sign(
      { id: userId, email, role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn as any }
    );

    const refreshToken = jwt.sign(
      { id: userId },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn as any }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Generates and stores a 6-digit OTP for password reset via phone or email
   */
  static async requestPasswordResetOtp(identifier: string, method: 'phone' | 'email') {
    let user = null;

    if (method === 'phone') {
      const trimmed = identifier.trim();
      // Try exact match first
      user = await prisma.user.findFirst({
        where: { phone: trimmed },
      });

      // If not found, try normalized digit match
      if (!user) {
        const cleanTarget = trimmed.replace(/\D/g, '');
        if (cleanTarget.length >= 6) {
          const allWithPhone = await prisma.user.findMany({
            where: { phone: { not: null } },
            select: { id: true, email: true, firstName: true, lastName: true, phone: true, status: true },
          });
          user = allWithPhone.find(u => u.phone && u.phone.replace(/\D/g, '') === cleanTarget) || null;
        }
      }

      if (!user) {
        throw new Error('No registered account found with this phone number. Please check the number or register an account.');
      }
    } else {
      user = await prisma.user.findUnique({
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
    await cacheSet(cacheKey, JSON.stringify({ otp, attempts: 0, identifier, method, userId: user.id }), 600);

    // Format masked destination
    let maskedDestination = '';
    if (method === 'phone' && user.phone) {
      const p = user.phone.trim();
      maskedDestination = p.length > 4 ? `${'*'.repeat(Math.max(0, p.length - 4))}${p.slice(-4)}` : p;
    } else {
      const [local, domain] = user.email.split('@');
      maskedDestination = `${local.charAt(0)}${'*'.repeat(Math.max(1, local.length - 2))}${local.slice(-1)}@${domain}`;
    }

    console.log(`🔑 [PASSWORD RESET OTP] Target: ${user.email} | Phone: ${user.phone || 'none'} | OTP: ${otp}`);

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
  static async verifyPasswordResetOtp(userId: string, otp: string) {
    const cacheKey = `otp:pwd-reset:${userId}`;
    const rawData = await cacheGet(cacheKey);

    if (!rawData) {
      throw new Error('Verification code has expired or was not requested. Please request a new code.');
    }

    const data = JSON.parse(rawData);

    if (data.attempts >= 5) {
      await cacheDelete(cacheKey);
      throw new Error('Too many failed attempts. Please request a new verification code.');
    }

    if (data.otp !== otp.trim()) {
      data.attempts += 1;
      await cacheSet(cacheKey, JSON.stringify(data), 600);
      throw new Error(`Invalid verification code. ${5 - data.attempts} attempt(s) remaining.`);
    }

    // Successfully verified! Invalidate OTP and generate reset token (15 mins TTL)
    await cacheDelete(cacheKey);
    const resetToken = 'rst_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    await cacheSet(`reset-token:${userId}`, resetToken, 900);

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
  static async resetPasswordWithToken(userId: string, resetToken: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters in length');
    }

    const tokenKey = `reset-token:${userId}`;
    const cachedToken = await cacheGet(tokenKey);

    if (!cachedToken || cachedToken !== resetToken) {
      throw new Error('Reset session has expired or is invalid. Please restart the verification process.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const passwordHash = await SecurityService.hash(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
      },
    });

    // Invalidate reset token immediately
    await cacheDelete(tokenKey);

    return {
      success: true,
      message: 'Your password has been successfully reset. You can now log in with your new credentials.',
    };
  }

  /**
   * Updates profile data (e.g. phone number)
   */
  static async updateProfile(userId: string, data: { firstName?: string; lastName?: string; phone?: string }) {
    const updateData: any = {};
    if (data.firstName) updateData.firstName = data.firstName.trim();
    if (data.lastName) updateData.lastName = data.lastName.trim();
    if (data.phone !== undefined) updateData.phone = data.phone ? data.phone.trim() : null;

    const user = await prisma.user.update({
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
}

