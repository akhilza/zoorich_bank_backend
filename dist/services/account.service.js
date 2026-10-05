"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountService = void 0;
const db_1 = require("../config/db");
const client_1 = require("@prisma/client");
class AccountService {
    /**
     * Generates a unique 10-digit account number and formatted IBAN
     */
    static generateAccountIdentifiers() {
        const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        const iban = `CH93ZOOR${randomDigits}`;
        return { accountNumber: randomDigits, iban };
    }
    /**
     * Creates an account for a user with initial welcome deposit
     */
    static async createAccount(userId, accountType, currency = 'USD', initialDeposit = 0) {
        const { accountNumber, iban } = this.generateAccountIdentifiers();
        return db_1.prisma.$transaction(async (tx) => {
            const account = await tx.account.create({
                data: {
                    accountNumber,
                    iban,
                    userId,
                    accountType,
                    currency,
                    balance: new client_1.Prisma.Decimal(initialDeposit),
                },
            });
            if (initialDeposit > 0) {
                const reference = `DEP-INIT-${Date.now().toString().slice(-6)}`;
                const txRecord = await tx.transaction.create({
                    data: {
                        reference,
                        destinationAccountId: account.id,
                        type: 'DEPOSIT',
                        amount: new client_1.Prisma.Decimal(initialDeposit),
                        currency,
                        status: 'COMPLETED',
                        description: 'Initial Opening Deposit',
                    },
                });
                await tx.ledgerEntry.create({
                    data: {
                        transactionId: txRecord.id,
                        accountId: account.id,
                        entryType: 'CREDIT',
                        amount: new client_1.Prisma.Decimal(initialDeposit),
                        balanceAfter: new client_1.Prisma.Decimal(initialDeposit),
                    },
                });
            }
            return account;
        });
    }
    /**
     * Retrieves all accounts belonging to a user with totals
     */
    static async getUserAccounts(userId) {
        const accounts = await db_1.prisma.account.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
        });
        const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
        return {
            accounts,
            totalBalance,
        };
    }
    /**
     * Retrieves single account by ID with ownership check
     */
    static async getAccountById(userId, accountId) {
        const account = await db_1.prisma.account.findFirst({
            where: { id: accountId, userId },
            include: {
                cards: true,
                loans: true,
            },
        });
        if (!account)
            throw new Error('Account not found');
        return account;
    }
    /**
     * Resolves recipient name by account number for confirmation before transferring
     */
    static async lookupRecipient(accountNumber) {
        const account = await db_1.prisma.account.findUnique({
            where: { accountNumber },
            include: {
                user: {
                    select: { firstName: true, lastName: true },
                },
            },
        });
        if (!account) {
            return null;
        }
        return {
            accountNumber: account.accountNumber,
            accountType: account.accountType,
            currency: account.currency,
            recipientName: `${account.user.firstName} ${account.user.lastName}`,
        };
    }
    /**
     * Retrieves paginated transaction history with ledger entries and filters
     */
    static async getTransactionHistory(userId, accountId, limit = 20, page = 1, type, from, to) {
        const userAccounts = await db_1.prisma.account.findMany({
            where: { userId },
            select: { id: true },
        });
        const accountIds = accountId ? [accountId] : userAccounts.map((a) => a.id);
        const whereClause = {
            OR: [
                { sourceAccountId: { in: accountIds } },
                { destinationAccountId: { in: accountIds } },
            ],
        };
        if (type) {
            whereClause.type = type;
        }
        if (from || to) {
            whereClause.createdAt = {};
            if (from)
                whereClause.createdAt.gte = new Date(from);
            if (to)
                whereClause.createdAt.lte = new Date(to);
        }
        const [transactions, total] = await Promise.all([
            db_1.prisma.transaction.findMany({
                where: whereClause,
                include: {
                    sourceAccount: {
                        include: { user: { select: { firstName: true, lastName: true } } },
                    },
                    destinationAccount: {
                        include: { user: { select: { firstName: true, lastName: true } } },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: (page - 1) * limit,
            }),
            db_1.prisma.transaction.count({ where: whereClause }),
        ]);
        return {
            transactions,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    /**
     * Generates periodic banking statement for an account or month
     */
    static async getStatement(userId, month, accountId) {
        const accounts = await db_1.prisma.account.findMany({
            where: accountId ? { id: accountId, userId } : { userId },
        });
        if (accounts.length === 0)
            throw new Error('No accounts found');
        const targetAccountIds = accounts.map((a) => a.id);
        let startDate;
        let endDate;
        if (month && /^\d{4}-\d{2}$/.test(month)) {
            const [yearStr, monthStr] = month.split('-');
            const year = parseInt(yearStr, 10);
            const m = parseInt(monthStr, 10) - 1;
            startDate = new Date(year, m, 1);
            endDate = new Date(year, m + 1, 0, 23, 59, 59, 999);
        }
        else {
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        }
        const entries = await db_1.prisma.ledgerEntry.findMany({
            where: {
                accountId: { in: targetAccountIds },
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            include: {
                transaction: true,
                account: {
                    select: { accountNumber: true, accountType: true, currency: true },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
        const totalDebits = entries
            .filter((e) => e.entryType === 'DEBIT')
            .reduce((sum, e) => sum + Number(e.amount), 0);
        const totalCredits = entries
            .filter((e) => e.entryType === 'CREDIT')
            .reduce((sum, e) => sum + Number(e.amount), 0);
        return {
            period: {
                from: startDate.toISOString().split('T')[0],
                to: endDate.toISOString().split('T')[0],
            },
            accounts: accounts.map((a) => ({
                id: a.id,
                accountNumber: a.accountNumber,
                currency: a.currency,
                currentBalance: a.balance,
            })),
            totalDebits,
            totalCredits,
            netFlow: totalCredits - totalDebits,
            entriesCount: entries.length,
            entries,
        };
    }
    /**
     * Retrieves user saved beneficiaries / payees
     */
    static async getBeneficiaries(userId) {
        return db_1.prisma.beneficiary.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }
    /**
     * Adds a new beneficiary
     */
    static async addBeneficiary(userId, data) {
        return db_1.prisma.beneficiary.create({
            data: {
                userId,
                name: data.name,
                accountNumber: data.accountNumber,
                bankName: data.bankName || 'Nova Bank',
                nickname: data.nickname,
            },
        });
    }
    /**
     * Deletes a beneficiary
     */
    static async deleteBeneficiary(userId, id) {
        return db_1.prisma.beneficiary.deleteMany({
            where: { id, userId },
        });
    }
}
exports.AccountService = AccountService;
