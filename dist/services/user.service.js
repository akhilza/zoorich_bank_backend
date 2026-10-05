"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const db_1 = require("../config/db");
class UserService {
    static async getProfile(userId) {
        const user = await db_1.prisma.user.findUnique({
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
        if (!user)
            throw new Error('User not found');
        return {
            ...user,
            hasPin: Boolean(user.transactionPinHash),
            transactionPinHash: undefined,
        };
    }
    static async updateProfile(userId, data) {
        const user = await db_1.prisma.user.update({
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
    static async changePassword(userId, currentPass, newPass) {
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user)
            throw new Error('User not found');
        const isValid = await bcrypt_1.default.compare(currentPass, user.passwordHash);
        if (!isValid)
            throw new Error('Current password is incorrect');
        const newHash = await bcrypt_1.default.hash(newPass, 12);
        await db_1.prisma.user.update({
            where: { id: userId },
            data: { passwordHash: newHash },
        });
        await db_1.prisma.auditLog.create({
            data: {
                userId,
                action: 'PASSWORD_CHANGED',
                details: 'User successfully updated account password',
            },
        });
        return { success: true, message: 'Password updated successfully' };
    }
}
exports.UserService = UserService;
