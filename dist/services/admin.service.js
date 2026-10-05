"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const db_1 = require("../config/db");
const client_1 = require("@prisma/client");
class AdminService {
    static async getUsers(page = 1, limit = 20, search) {
        const skip = (page - 1) * limit;
        const where = {};
        if (search) {
            where.OR = [
                { email: { contains: search } },
                { firstName: { contains: search } },
                { lastName: { contains: search } },
            ];
        }
        const [total, users] = await Promise.all([
            db_1.prisma.user.count({ where }),
            db_1.prisma.user.findMany({
                where,
                skip,
                take: limit,
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    status: true,
                    createdAt: true,
                    accounts: {
                        select: {
                            id: true,
                            accountNumber: true,
                            balance: true,
                            status: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
        ]);
        return {
            data: users,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    static async getKycList(status) {
        const documents = await db_1.prisma.kycDocument.findMany({
            where: status ? { status } : undefined,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return documents;
    }
    static async reviewKyc(adminId, kycId, status, notes) {
        const kyc = await db_1.prisma.kycDocument.findUnique({
            where: { id: kycId },
        });
        if (!kyc)
            throw new Error('KYC document not found');
        const updated = await db_1.prisma.kycDocument.update({
            where: { id: kycId },
            data: {
                status,
                notes: notes || undefined,
            },
        });
        await db_1.prisma.auditLog.create({
            data: {
                userId: adminId,
                action: `KYC_${status}`,
                details: `KYC document ${kycId} reviewed: ${status}. Note: ${notes || 'None'}`,
            },
        });
        return updated;
    }
    static async freezeAccount(adminId, accountId, shouldFreeze, reason) {
        const account = await db_1.prisma.account.findUnique({
            where: { id: accountId },
        });
        if (!account)
            throw new Error('Account not found');
        const newStatus = shouldFreeze ? client_1.AccountStatus.FROZEN : client_1.AccountStatus.ACTIVE;
        const updated = await db_1.prisma.account.update({
            where: { id: accountId },
            data: { status: newStatus },
        });
        await db_1.prisma.auditLog.create({
            data: {
                userId: adminId,
                action: shouldFreeze ? 'ACCOUNT_FROZEN_BY_ADMIN' : 'ACCOUNT_UNFROZEN_BY_ADMIN',
                details: `Account ${account.accountNumber} status changed to ${newStatus}. Reason: ${reason || 'Compliance'}`,
            },
        });
        return updated;
    }
    static async getAllTransactions(page = 1, limit = 25) {
        const skip = (page - 1) * limit;
        const [total, transactions] = await Promise.all([
            db_1.prisma.transaction.count(),
            db_1.prisma.transaction.findMany({
                skip,
                take: limit,
                include: {
                    sourceAccount: {
                        select: {
                            accountNumber: true,
                            user: { select: { firstName: true, lastName: true, email: true } },
                        },
                    },
                    destinationAccount: {
                        select: {
                            accountNumber: true,
                            user: { select: { firstName: true, lastName: true, email: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
        ]);
        return {
            data: transactions,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }
    static async getAuditLogs(limit = 50) {
        const logs = await db_1.prisma.auditLog.findMany({
            take: limit,
            include: {
                user: {
                    select: {
                        email: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return logs;
    }
    static async getFraudAlerts() {
        const alerts = await db_1.prisma.fraudAlert.findMany({
            include: {
                user: { select: { email: true, firstName: true, lastName: true } },
                account: { select: { accountNumber: true } },
            },
            orderBy: { flaggedAt: 'desc' },
        });
        return alerts;
    }
    static async getFinancialSummary() {
        const [userCount, accountCount, accounts, transactionCount, loanAgg,] = await Promise.all([
            db_1.prisma.user.count(),
            db_1.prisma.account.count(),
            db_1.prisma.account.findMany({ select: { balance: true } }),
            db_1.prisma.transaction.count(),
            db_1.prisma.loan.aggregate({
                _sum: { principal: true, remainingBalance: true },
                _count: true,
            }),
        ]);
        const totalLiquidity = accounts.reduce((acc, curr) => acc + Number(curr.balance), 0);
        return {
            totalUsers: userCount,
            totalAccounts: accountCount,
            totalLiquidity: Math.round(totalLiquidity * 100) / 100,
            totalTransactions: transactionCount,
            activeLoansCount: loanAgg._count || 0,
            totalLoansPrincipal: Number(loanAgg._sum.principal || 0),
            totalOutstandingLoans: Number(loanAgg._sum.remainingBalance || 0),
        };
    }
}
exports.AdminService = AdminService;
