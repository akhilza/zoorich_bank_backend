"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduledPaymentService = void 0;
const db_1 = require("../config/db");
const client_1 = require("@prisma/client");
class ScheduledPaymentService {
    static async create(userId, data) {
        const account = await db_1.prisma.account.findFirst({
            where: { id: data.sourceAccountId, userId },
        });
        if (!account)
            throw new Error('Source account not found');
        const recipient = await db_1.prisma.account.findUnique({
            where: { accountNumber: data.destinationAccountNumber },
        });
        if (!recipient)
            throw new Error('Recipient account number does not exist');
        if (recipient.id === account.id)
            throw new Error('Cannot schedule payment to the same account');
        const payment = await db_1.prisma.scheduledPayment.create({
            data: {
                userId,
                sourceAccountId: account.id,
                destinationAccountNumber: data.destinationAccountNumber,
                amount: data.amount,
                frequency: data.frequency || client_1.PaymentFrequency.MONTHLY,
                nextRunDate: new Date(data.nextRunDate),
                description: data.description,
                status: client_1.ScheduledPaymentStatus.ACTIVE,
            },
            include: {
                sourceAccount: {
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
                action: 'SCHEDULED_PAYMENT_CREATED',
                details: `Scheduled recurring payment of $${data.amount} to account ${data.destinationAccountNumber}`,
            },
        });
        return payment;
    }
    static async list(userId) {
        const payments = await db_1.prisma.scheduledPayment.findMany({
            where: { userId },
            include: {
                sourceAccount: {
                    select: {
                        accountNumber: true,
                        accountType: true,
                        currency: true,
                    },
                },
            },
            orderBy: { nextRunDate: 'asc' },
        });
        return payments;
    }
    static async cancel(userId, id) {
        const payment = await db_1.prisma.scheduledPayment.findFirst({
            where: { id, userId },
        });
        if (!payment)
            throw new Error('Scheduled payment not found');
        const updated = await db_1.prisma.scheduledPayment.update({
            where: { id },
            data: { status: client_1.ScheduledPaymentStatus.CANCELLED },
        });
        return updated;
    }
}
exports.ScheduledPaymentService = ScheduledPaymentService;
