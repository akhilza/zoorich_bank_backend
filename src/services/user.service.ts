import bcrypt from 'bcrypt';
import { prisma } from '../config/db';

export class UserService {
  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
        updatedAt: true,
      },
    });

    if (!user) throw new Error('User not found');

    return {
      ...user,
      hasPin: Boolean(user.transactionPinHash),
      transactionPinHash: undefined,
    };
  }

  static async updateProfile(userId: string, data: { firstName?: string; lastName?: string; phone?: string | null }) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName ? { firstName: data.firstName } : {}),
        ...(data.lastName ? { lastName: data.lastName } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        isTwoFactorEnabled: true,
      },
    });

    return user;
  }

  static async changePassword(userId: string, currentPass: string, newPass: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new Error('User not found');

    const isValid = await bcrypt.compare(currentPass, user.passwordHash);
    if (!isValid) throw new Error('Current password is incorrect');

    const newHash = await bcrypt.hash(newPass, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'PASSWORD_CHANGED',
        details: 'User successfully updated account password',
      },
    });

    return { success: true, message: 'Password updated successfully' };
  }
}
