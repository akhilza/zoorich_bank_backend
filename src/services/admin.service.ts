import { prisma } from '../config/db';
import { AccountStatus, KycStatus, UserStatus } from '@prisma/client';

export class AdminService {
  static async getUsers(page: number = 1, limit: number = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
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

  static async getKycList(status?: KycStatus) {
    const documents = await prisma.kycDocument.findMany({
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

  static async reviewKyc(adminId: string, kycId: string, status: KycStatus, notes?: string) {
    const kyc = await prisma.kycDocument.findUnique({
      where: { id: kycId },
    });
    if (!kyc) throw new Error('KYC document not found');

    const updated = await prisma.kycDocument.update({
      where: { id: kycId },
      data: {
        status,
        notes: notes || undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: `KYC_${status}`,
        details: `KYC document ${kycId} reviewed: ${status}. Note: ${notes || 'None'}`,
      },
    });

    return updated;
  }

  static async freezeAccount(adminId: string, accountId: string, shouldFreeze: boolean, reason?: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new Error('Account not found');

    const newStatus = shouldFreeze ? AccountStatus.FROZEN : AccountStatus.ACTIVE;
    const updated = await prisma.account.update({
      where: { id: accountId },
      data: { status: newStatus },
    });

    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: shouldFreeze ? 'ACCOUNT_FROZEN_BY_ADMIN' : 'ACCOUNT_UNFROZEN_BY_ADMIN',
        details: `Account ${account.accountNumber} status changed to ${newStatus}. Reason: ${reason || 'Compliance'}`,
      },
    });

    return updated;
  }

  static async getAllTransactions(page: number = 1, limit: number = 25) {
    const skip = (page - 1) * limit;
    const [total, transactions] = await Promise.all([
      prisma.transaction.count(),
      prisma.transaction.findMany({
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

  static async getAuditLogs(limit: number = 50) {
    const logs = await prisma.auditLog.findMany({
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
    const alerts = await prisma.fraudAlert.findMany({
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        account: { select: { accountNumber: true } },
      },
      orderBy: { flaggedAt: 'desc' },
    });

    return alerts;
  }

  static async getFinancialSummary() {
    const [
      userCount,
      accountCount,
      accounts,
      transactionCount,
      loanAgg,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.account.count(),
      prisma.account.findMany({ select: { balance: true } }),
      prisma.transaction.count(),
      prisma.loan.aggregate({
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
