import { prisma } from '../config/db';
import { Prisma } from '@prisma/client';
import { AccountType } from '../types';

export class AccountService {
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
  static async createAccount(userId: string, accountType: AccountType, currency: string = 'USD', initialDeposit: number = 0) {
    const { accountNumber, iban } = this.generateAccountIdentifiers();

    return prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          accountNumber,
          iban,
          userId,
          accountType,
          currency,
          balance: new Prisma.Decimal(initialDeposit),
        },
      });

      if (initialDeposit > 0) {
        const reference = `DEP-INIT-${Date.now().toString().slice(-6)}`;
        const txRecord = await tx.transaction.create({
          data: {
            reference,
            destinationAccountId: account.id,
            type: 'DEPOSIT',
            amount: new Prisma.Decimal(initialDeposit),
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
            amount: new Prisma.Decimal(initialDeposit),
            balanceAfter: new Prisma.Decimal(initialDeposit),
          },
        });
      }

      return account;
    });
  }

  /**
   * Retrieves all accounts belonging to a user with totals
   */
  static async getUserAccounts(userId: string) {
    const accounts = await prisma.account.findMany({
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
   * Resolves recipient name by account number for confirmation before transferring
   */
  static async lookupRecipient(accountNumber: string) {
    const account = await prisma.account.findUnique({
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
   * Retrieves paginated transaction history with ledger entries
   */
  static async getTransactionHistory(userId: string, accountId?: string, limit: number = 20, page: number = 1) {
    const userAccounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });

    const accountIds = accountId ? [accountId] : userAccounts.map((a) => a.id);

    const whereClause: Prisma.TransactionWhereInput = {
      OR: [
        { sourceAccountId: { in: accountIds } },
        { destinationAccountId: { in: accountIds } },
      ],
    };

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
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
      prisma.transaction.count({ where: whereClause }),
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
   * Retrieves user saved beneficiaries / payees
   */
  static async getBeneficiaries(userId: string) {
    return prisma.beneficiary.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Adds a new beneficiary
   */
  static async addBeneficiary(
    userId: string,
    data: { name: string; accountNumber: string; bankName?: string; nickname?: string }
  ) {
    return prisma.beneficiary.create({
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
  static async deleteBeneficiary(userId: string, id: string) {
    return prisma.beneficiary.deleteMany({
      where: { id, userId },
    });
  }
}

