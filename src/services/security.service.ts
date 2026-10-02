import bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { prisma } from '../config/db';
import { config } from '../config';

export class SecurityService {
  /**
   * Hashes a password or transaction PIN using Bcrypt with salt factor 12
   */
  static async hash(data: string): Promise<string> {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(data, salt);
  }

  /**
   * Compares plain data against bcrypt hash
   */
  static async compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }

  /**
   * Verifies the 6-digit transaction PIN and enforces lockout rules on repeated failures
   */
  static async verifyTransactionPin(userId: string, pin: string): Promise<{ valid: boolean; message?: string }> {
    const user = await prisma.user.findUnique({
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

    const isMatch = await bcrypt.compare(pin, user.transactionPinHash);

    if (!isMatch) {
      const attempts = user.failedPinAttempts + 1;
      let lockoutDate: Date | null = null;

      if (attempts >= config.security.maxPinAttempts) {
        lockoutDate = new Date(Date.now() + config.security.pinLockoutMinutes * 60 * 1000);
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          failedPinAttempts: attempts,
          pinLockedUntil: lockoutDate,
        },
      });

      if (lockoutDate) {
        return {
          valid: false,
          message: `PIN entered incorrectly ${attempts} times. Your transaction PIN is locked for ${config.security.pinLockoutMinutes} minutes.`,
        };
      }

      return {
        valid: false,
        message: `Invalid transaction PIN. ${config.security.maxPinAttempts - attempts} attempt(s) remaining.`,
      };
    }

    // Reset failed attempts on correct entry
    if (user.failedPinAttempts > 0 || user.pinLockedUntil) {
      await prisma.user.update({
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
  static async generateTwoFactorSecret(userEmail: string) {
    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(userEmail, 'Swiss Bank', secret);
    const qrCodeDataUrl = await qrcode.toDataURL(otpAuthUrl);

    return { secret, qrCodeDataUrl };
  }

  /**
   * Verifies a 6-digit TOTP token
   */
  static verifyTwoFactorToken(token: string, secret: string): boolean {
    return authenticator.verify({ token, secret });
  }

  /**
   * Records an immutable entry in the bank audit log
   */
  static async logAudit(params: {
    userId?: string;
    action: string;
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, any>;
  }) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          ipAddress: params.ipAddress || 'unknown',
          userAgent: params.userAgent || 'unknown',
          details: params.details ? JSON.stringify(params.details) : null,
        },
      });
    } catch (err) {
      console.error('Audit log write failure:', err);
    }
  }

  /**
   * Checks velocity and daily transfer limits to mitigate fraud
   */
  static async checkVelocityAndLimits(sourceAccountId: string, transferAmount: number): Promise<{ allowed: boolean; reason?: string }> {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // 1. Check transactions in the past 1 minute
    const recentTxCount = await prisma.transaction.count({
      where: {
        sourceAccountId,
        createdAt: { gte: oneMinuteAgo },
      },
    });

    if (recentTxCount >= config.security.transferVelocityLimitPerMinute) {
      return {
        allowed: false,
        reason: 'Velocity check failed: Too many transactions in a short window. Please wait a minute.',
      };
    }

    // 2. Check cumulative transfers today
    const todaysTransfers = await prisma.transaction.findMany({
      where: {
        sourceAccountId,
        createdAt: { gte: startOfDay },
        status: 'COMPLETED',
      },
      select: { amount: true },
    });

    const totalTransferredToday = todaysTransfers.reduce(
      (sum, tx) => sum + Number(tx.amount),
      0
    );

    const account = await prisma.account.findUnique({
      where: { id: sourceAccountId },
      select: { dailyTransferLimit: true },
    });

    const limit = account ? Number(account.dailyTransferLimit) : config.security.maxDailyTransferAmount;

    if (totalTransferredToday + transferAmount > limit) {
      return {
        allowed: false,
        reason: `Daily transfer limit exceeded. Remaining limit today is $${Math.max(0, limit - totalTransferredToday).toFixed(2)}.`,
      };
    }

    return { allowed: true };
  }
}
