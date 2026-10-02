import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { SecurityService } from '../services/security.service';
import { prisma } from '../config/db';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.register(req.body);
      await SecurityService.logAudit({
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
    } catch (error: any) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.login(req.body);
      if (!result.requires2FA && result.user) {
        await SecurityService.logAudit({
          userId: result.user.id,
          action: 'USER_LOGGED_IN',
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  static async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
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
    } catch (error: any) {
      next(error);
    }
  }

  static async setupPin(req: Request, res: Response, next: NextFunction) {
    try {
      const { password, pin } = req.body;
      const result = await AuthService.setupTransactionPin(req.user!.id, password, pin);
      await SecurityService.logAudit({
        userId: req.user!.id,
        action: 'TRANSACTION_PIN_CONFIGURED',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      return res.json({ success: true, message: result.message });
    } catch (error: any) {
      next(error);
    }
  }

  static async generate2FA(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      const { secret, qrCodeDataUrl } = await SecurityService.generateTwoFactorSecret(user.email);

      // Save secret temporarily until verified
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorSecret: secret },
      });

      return res.json({
        success: true,
        data: { secret, qrCodeDataUrl },
      });
    } catch (error: any) {
      next(error);
    }
  }

  static async verifyAndEnable2FA(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body;
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user || !user.twoFactorSecret) {
        return res.status(400).json({ success: false, message: '2FA initialization not found' });
      }

      const isValid = SecurityService.verifyTwoFactorToken(token, user.twoFactorSecret);
      if (!isValid) {
        return res.status(400).json({ success: false, message: 'Invalid 6-digit 2FA code' });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { isTwoFactorEnabled: true },
      });

      await SecurityService.logAudit({
        userId: user.id,
        action: 'TWO_FACTOR_ENABLED',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.json({
        success: true,
        message: 'Two-Factor Authentication successfully activated',
      });
    } catch (error: any) {
      next(error);
    }
  }

  static async requestPasswordResetOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { identifier, method = 'phone' } = req.body;
      const result = await AuthService.requestPasswordResetOtp(identifier, method);

      await SecurityService.logAudit({
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
    } catch (error: any) {
      next(error);
    }
  }

  static async verifyPasswordResetOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, otp } = req.body;
      const result = await AuthService.verifyPasswordResetOtp(userId, otp);

      await SecurityService.logAudit({
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
    } catch (error: any) {
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, resetToken, newPassword } = req.body;
      const result = await AuthService.resetPasswordWithToken(userId, resetToken, newPassword);

      await SecurityService.logAudit({
        userId,
        action: 'PASSWORD_RESET_COMPLETED',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error: any) {
      next(error);
    }
  }

  static async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.updateProfile(req.user!.id, req.body);

      await SecurityService.logAudit({
        userId: req.user!.id,
        action: 'USER_PROFILE_UPDATED',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }
}

