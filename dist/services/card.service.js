"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardService = void 0;
const db_1 = require("../config/db");
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
class CardService {
    static async getCards(userId) {
        const cards = await db_1.prisma.card.findMany({
            where: {
                account: {
                    userId,
                },
            },
            include: {
                account: {
                    select: {
                        id: true,
                        accountNumber: true,
                        accountType: true,
                        currency: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return cards;
    }
    static async issueCard(userId, data) {
        // Verify account ownership
        const account = await db_1.prisma.account.findFirst({
            where: { id: data.accountId, userId },
        });
        if (!account)
            throw new Error('Account not found or unauthorized');
        // Generate simulated card details
        const bin = '4532'; // Visa prefix
        const middle = Math.floor(10000000 + Math.random() * 90000000).toString();
        const last4 = Math.floor(1000 + Math.random() * 9000).toString();
        const cardNumber = `${bin}${middle}${last4}`;
        const cardToken = `crd_tok_${crypto_1.default.randomBytes(16).toString('hex')}`;
        const cvv = Math.floor(100 + Math.random() * 900).toString();
        const now = new Date();
        const expiryMonth = (now.getMonth() + 1);
        const expiryYear = now.getFullYear() + 4; // 4-year validity
        const card = await db_1.prisma.card.create({
            data: {
                accountId: account.id,
                cardNumber,
                cardToken,
                last4,
                expiryMonth,
                expiryYear,
                cvv,
                cardLimit: data.cardLimit || 5000,
                status: client_1.CardStatus.ACTIVE,
            },
            include: {
                account: {
                    select: {
                        accountNumber: true,
                        accountType: true,
                    },
                },
            },
        });
        await db_1.prisma.auditLog.create({
            data: {
                userId,
                action: 'CARD_ISSUED',
                details: `Issued new virtual card ending in ${last4} for account ${account.accountNumber}`,
            },
        });
        return card;
    }
    static async freezeCard(userId, cardId) {
        const card = await db_1.prisma.card.findFirst({
            where: {
                id: cardId,
                account: { userId },
            },
        });
        if (!card)
            throw new Error('Card not found');
        const updated = await db_1.prisma.card.update({
            where: { id: cardId },
            data: { status: client_1.CardStatus.FROZEN },
        });
        await db_1.prisma.auditLog.create({
            data: {
                userId,
                action: 'CARD_FROZEN',
                details: `Froze card ending in ${card.last4}`,
            },
        });
        return updated;
    }
    static async unfreezeCard(userId, cardId) {
        const card = await db_1.prisma.card.findFirst({
            where: {
                id: cardId,
                account: { userId },
            },
        });
        if (!card)
            throw new Error('Card not found');
        const updated = await db_1.prisma.card.update({
            where: { id: cardId },
            data: { status: client_1.CardStatus.ACTIVE },
        });
        await db_1.prisma.auditLog.create({
            data: {
                userId,
                action: 'CARD_UNFROZEN',
                details: `Unfroze card ending in ${card.last4}`,
            },
        });
        return updated;
    }
    static async updateLimit(userId, cardId, limit) {
        const card = await db_1.prisma.card.findFirst({
            where: {
                id: cardId,
                account: { userId },
            },
        });
        if (!card)
            throw new Error('Card not found');
        if (limit <= 0)
            throw new Error('Limit must be greater than zero');
        const updated = await db_1.prisma.card.update({
            where: { id: cardId },
            data: { cardLimit: limit },
        });
        return updated;
    }
}
exports.CardService = CardService;
