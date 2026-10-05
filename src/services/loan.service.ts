import { prisma } from '../config/db';
import { LoanStatus, InstallmentStatus, TransactionType, TransactionStatus, LedgerEntryType } from '@prisma/client';
import crypto from 'crypto';

export class LoanService {
  /**
   * Standard Banking EMI Formula:
   * EMI = [P x r x (1+r)^n] / [(1+r)^n - 1]
   */
  static calculateEmi(principal: number, annualRatePercent: number, tenureMonths: number): number {
    const monthlyRate = annualRatePercent / 12 / 100;
    if (monthlyRate === 0) return principal / tenureMonths;
    const factor = Math.pow(1 + monthlyRate, tenureMonths);
    const emi = (principal * monthlyRate * factor) / (factor - 1);
    return Math.round(emi * 100) / 100;
  }

  static async applyLoan(
    userId: string,
    data: { accountId: string; principal: number; tenureMonths: number; purpose: string }
  ) {
    if (data.principal < 100) throw new Error('Minimum loan principal is $100');
    if (data.tenureMonths < 1 || data.tenureMonths > 60) throw new Error('Tenure must be between 1 and 60 months');

    const account = await prisma.account.findFirst({
      where: { id: data.accountId, userId },
    });
    if (!account) throw new Error('Disbursement account not found');

    const annualInterestRate = 8.5; // Competitive 8.5% APR
    const monthlyEmi = this.calculateEmi(data.principal, annualInterestRate, data.tenureMonths);
    const totalRepayable = Math.round(monthlyEmi * data.tenureMonths * 100) / 100;

    return await prisma.$transaction(async (tx) => {
      // 1. Create Loan record
      const loan = await tx.loan.create({
        data: {
          userId,
          accountId: account.id,
          principal: data.principal,
          interestRate: annualInterestRate,
          tenureMonths: data.tenureMonths,
          monthlyEmi,
          totalRepayable,
          remainingBalance: totalRepayable,
          purpose: data.purpose || 'Personal Financing',
          status: LoanStatus.ACTIVE,
        },
      });

      // 2. Generate Amortization Schedule Installments
      const installmentsData = [];
      const now = new Date();
      for (let i = 1; i <= data.tenureMonths; i++) {
        const dueDate = new Date(now);
        dueDate.setMonth(dueDate.getMonth() + i);

        installmentsData.push({
          loanId: loan.id,
          installmentNumber: i,
          dueDate,
          amount: monthlyEmi,
          status: InstallmentStatus.PENDING,
        });
      }

      await tx.loanInstallment.createMany({
        data: installmentsData,
      });

      // 3. Disburse Principal Funds to Account
      const newBalance = Number(account.balance) + data.principal;
      await tx.account.update({
        where: { id: account.id },
        data: { balance: newBalance },
      });

      // 4. Create Transaction & Ledger Entry
      const ref = `DISB-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const transaction = await tx.transaction.create({
        data: {
          reference: ref,
          destinationAccountId: account.id,
          type: TransactionType.LOAN_DISBURSEMENT,
          amount: data.principal,
          status: TransactionStatus.COMPLETED,
          description: `Loan Disbursement: ${data.purpose || 'Personal Loan'}`,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          transactionId: transaction.id,
          accountId: account.id,
          entryType: LedgerEntryType.CREDIT,
          amount: data.principal,
          balanceAfter: newBalance,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'LOAN_APPROVED_AND_DISBURSED',
          details: `Disbursed $${data.principal} into account ${account.accountNumber} with loan ID ${loan.id}`,
        },
      });

      return {
        ...loan,
        installmentsCount: data.tenureMonths,
        disbursedAmount: data.principal,
      };
    });
  }

  static async getLoans(userId: string) {
    const loans = await prisma.loan.findMany({
      where: { userId },
      include: {
        account: {
          select: {
            accountNumber: true,
            accountType: true,
          },
        },
        installments: {
          orderBy: { installmentNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return loans;
  }

  static async getLoanSchedule(userId: string, loanId: string) {
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, userId },
      include: {
        account: true,
        installments: {
          orderBy: { installmentNumber: 'asc' },
        },
      },
    });

    if (!loan) throw new Error('Loan not found');
    return loan;
  }

  static async repayInstallment(userId: string, loanId: string) {
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, userId },
      include: {
        account: true,
        installments: {
          where: { status: InstallmentStatus.PENDING },
          orderBy: { installmentNumber: 'asc' },
          take: 1,
        },
      },
    });

    if (!loan) throw new Error('Loan not found');
    if (loan.installments.length === 0) {
      throw new Error('All installments for this loan have already been paid');
    }

    const nextInstallment = loan.installments[0];
    const amountToPay = Number(nextInstallment.amount);

    return await prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({
        where: { id: loan.accountId },
      });

      if (!account) throw new Error('Linked repayment account not found');
      if (Number(account.balance) < amountToPay) {
        throw new Error(`Insufficient funds. Available: $${Number(account.balance).toFixed(2)}, Required: $${amountToPay.toFixed(2)}`);
      }

      // Deduct from account
      const newBalance = Number(account.balance) - amountToPay;
      await tx.account.update({
        where: { id: account.id },
        data: { balance: newBalance },
      });

      // Mark installment paid
      await tx.loanInstallment.update({
        where: { id: nextInstallment.id },
        data: {
          status: InstallmentStatus.PAID,
          paidAt: new Date(),
        },
      });

      // Update remaining loan balance
      const newRemaining = Math.max(0, Number(loan.remainingBalance) - amountToPay);
      const isFullyPaid = newRemaining === 0;

      const updatedLoan = await tx.loan.update({
        where: { id: loan.id },
        data: {
          remainingBalance: newRemaining,
          status: isFullyPaid ? LoanStatus.REPAID : LoanStatus.ACTIVE,
        },
      });

      // Ledger entry
      const ref = `REPAY-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const transaction = await tx.transaction.create({
        data: {
          reference: ref,
          sourceAccountId: account.id,
          type: TransactionType.LOAN_REPAYMENT,
          amount: amountToPay,
          status: TransactionStatus.COMPLETED,
          description: `Loan Repayment - Installment #${nextInstallment.installmentNumber}`,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          transactionId: transaction.id,
          accountId: account.id,
          entryType: LedgerEntryType.DEBIT,
          amount: amountToPay,
          balanceAfter: newBalance,
        },
      });

      return {
        success: true,
        paidInstallment: nextInstallment.installmentNumber,
        amountPaid: amountToPay,
        remainingLoanBalance: newRemaining,
        isFullyPaid,
      };
    });
  }
}
