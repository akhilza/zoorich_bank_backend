import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { acquireDistributedLock, releaseDistributedLock } from '../config/redis';
import { SecurityService } from './security.service';
import { EmailService } from './email.service';
import { v4 as uuidv4 } from 'uuid';

export interface TransferParams {
  userId: string;
  sourceAccountId: string;
  destinationAccountNumber: string;
  amount: number;
  description?: string;
  transactionPin: string;
  idempotencyKey?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface DepositWithdrawParams {
  userId: string;
  accountId: string;
  amount: number;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  description?: string;
  transactionPin?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class TransferService {
  /**
   * Executes an atomic, double-entry peer-to-peer or inter-account transfer
   * Enforces:
   * 1. Distributed lock to prevent concurrent double-spends
   * 2. Transaction PIN validation & lockout enforcement
   * 3. Velocity and daily limit checks
   * 4. ACID Transaction with balance validation
   * 5. Double-Entry Ledger Bookkeeping (Debit & Credit records)
   */
  static async executeTransfer(params: TransferParams) {
    const {
      userId,
      sourceAccountId,
      destinationAccountNumber,
      amount,
      description,
      transactionPin,
      idempotencyKey,
      ipAddress,
      userAgent,
    } = params;

    if (amount <= 0) {
      throw new Error('Transfer amount must be strictly greater than 0.00');
    }

    // Step 1: Validate 6-digit transaction PIN
    const pinCheck = await SecurityService.verifyTransactionPin(userId, transactionPin);
    if (!pinCheck.valid) {
      throw new Error(pinCheck.message || 'Invalid transaction PIN');
    }

    // Step 2: Validate accounts exist
    const sourceAccount = await prisma.account.findUnique({
      where: { id: sourceAccountId },
      include: { user: true },
    });

    if (!sourceAccount) {
      throw new Error('Source account not found');
    }

    if (sourceAccount.userId !== userId) {
      throw new Error('Unauthorized access to source account');
    }

    if (sourceAccount.status !== 'ACTIVE') {
      throw new Error(`Source account is currently ${sourceAccount.status}. Transactions not permitted.`);
    }

    const destAccount = await prisma.account.findUnique({
      where: { accountNumber: destinationAccountNumber },
      include: { user: true },
    });

    if (!destAccount) {
      throw new Error('Beneficiary account number not found in banking system');
    }

    if (destAccount.id === sourceAccount.id) {
      throw new Error('Source and destination accounts cannot be the same');
    }

    if (destAccount.status !== 'ACTIVE') {
      throw new Error('Destination account is not active to receive funds');
    }

    if (destAccount.currency !== sourceAccount.currency) {
      throw new Error(`Currency mismatch: Source is ${sourceAccount.currency} and Destination is ${destAccount.currency}`);
    }

    // Step 3: Velocity & Daily Limit fraud checks
    const velocityCheck = await SecurityService.checkVelocityAndLimits(sourceAccountId, amount);
    if (!velocityCheck.allowed) {
      throw new Error(velocityCheck.reason);
    }

    // Step 4: Acquire Redis Distributed Lock on the source account to guarantee serialization
    const lockKey = `account-transfer:${sourceAccountId}`;
    const lockToken = await acquireDistributedLock(lockKey, 15);
    if (!lockToken) {
      throw new Error('A transaction is already being processed for this account. Please wait a moment.');
    }

    try {
      // Step 5: Execute atomic database transaction (ACID compliant)
      const result = await prisma.$transaction(async (tx) => {
        // Fetch current source balance inside transaction with latest state
        const currentSource = await tx.account.findUnique({
          where: { id: sourceAccountId },
        });

        if (!currentSource) {
          throw new Error('Source account unavailable');
        }

        const sourceBal = Number(currentSource.balance);
        if (sourceBal < amount) {
          throw new Error(`Insufficient funds. Available balance: $${sourceBal.toFixed(2)}, Requested: $${amount.toFixed(2)}`);
        }

        const newSourceBalance = new Prisma.Decimal(sourceBal - amount);
        const currentDest = await tx.account.findUnique({
          where: { id: destAccount.id },
        });

        if (!currentDest) {
          throw new Error('Destination account unavailable');
        }

        const newDestBalance = new Prisma.Decimal(Number(currentDest.balance) + amount);

        // Deduct from source
        await tx.account.update({
          where: { id: sourceAccountId },
          data: { balance: newSourceBalance },
        });

        // Credit to destination
        await tx.account.update({
          where: { id: destAccount.id },
          data: { balance: newDestBalance },
        });

        // Generate standard Bank Reference
        const reference = `TRX-${Date.now().toString().slice(-8)}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Create transaction master record
        const transactionRecord = await tx.transaction.create({
          data: {
            reference,
            sourceAccountId: sourceAccount.id,
            destinationAccountId: destAccount.id,
            type: 'TRANSFER',
            amount: new Prisma.Decimal(amount),
            currency: sourceAccount.currency,
            status: 'COMPLETED',
            description: description || `Transfer to ${destAccount.user.firstName} ${destAccount.user.lastName}`,
            idempotencyKey: idempotencyKey || null,
          },
        });

        // Double-Entry Ledger Bookkeeping:
        // 1. DEBIT source account (decrease asset)
        await tx.ledgerEntry.create({
          data: {
            transactionId: transactionRecord.id,
            accountId: sourceAccount.id,
            entryType: 'DEBIT',
            amount: new Prisma.Decimal(amount),
            balanceAfter: newSourceBalance,
          },
        });

        // 2. CREDIT destination account (increase liability/deposit)
        await tx.ledgerEntry.create({
          data: {
            transactionId: transactionRecord.id,
            accountId: destAccount.id,
            entryType: 'CREDIT',
            amount: new Prisma.Decimal(amount),
            balanceAfter: newDestBalance,
          },
        });

        return {
          transaction: transactionRecord,
          newSourceBalance: Number(newSourceBalance),
          recipientName: `${destAccount.user.firstName} ${destAccount.user.lastName}`,
        };
      }, {
        timeout: 10000,
      });

      // Audit Log
      await SecurityService.logAudit({
        userId,
        action: 'FUNDS_TRANSFERRED',
        ipAddress,
        userAgent,
        details: {
          reference: result.transaction.reference,
          amount,
          sourceAccountId,
          destinationAccountNumber,
        },
      });

      // 1. Send Balance Deduct Email to Sender
      if (sourceAccount.user?.email) {
        EmailService.sendBalanceDebitedAlert(
          sourceAccount.user.email,
          sourceAccount.user.firstName,
          amount,
          sourceAccount.currency,
          result.newSourceBalance,
          description || `Transfer to ${destAccount.user.firstName} ${destAccount.user.lastName}`,
          result.transaction.reference
        ).catch((err) => console.warn('Could not dispatch sender debit email:', err.message));
      }

      // 2. Send Balance Credit Email to Recipient
      if (destAccount.user?.email) {
        EmailService.sendBalanceCreditedAlert(
          destAccount.user.email,
          destAccount.user.firstName,
          amount,
          destAccount.currency,
          Number(destAccount.balance) + amount,
          description || `Transfer received from ${sourceAccount.user.firstName} ${sourceAccount.user.lastName}`,
          result.transaction.reference
        ).catch((err) => console.warn('Could not dispatch recipient credit email:', err.message));
      }

      return result;
    } finally {
      // Step 6: Always release the distributed lock
      await releaseDistributedLock(lockKey, lockToken);
    }
  }

  /**
   * Deposit / Withdrawal handling with double-entry ledger entries
   */
  static async executeDepositOrWithdrawal(params: DepositWithdrawParams) {
    const { userId, accountId, amount, type, description, transactionPin, ipAddress, userAgent } = params;

    if (amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    if (type === 'WITHDRAWAL') {
      if (!transactionPin) {
        throw new Error('Transaction PIN required for withdrawal');
      }
      const pinCheck = await SecurityService.verifyTransactionPin(userId, transactionPin);
      if (!pinCheck.valid) {
        throw new Error(pinCheck.message || 'Invalid transaction PIN');
      }
    }

    const lockKey = `account-op:${accountId}`;
    const lockToken = await acquireDistributedLock(lockKey, 10);
    if (!lockToken) {
      throw new Error('Account is busy processing another operation. Please retry.');
    }

    try {
      const result = await prisma.$transaction(async (tx: any) => {
        const account = await tx.account.findUnique({
          where: { id: accountId },
          include: { user: true },
        });

        if (!account || account.userId !== userId) {
          throw new Error('Account not found or unauthorized');
        }

        const currentBal = Number(account.balance);
        let newBal: number;

        if (type === 'WITHDRAWAL') {
          if (currentBal < amount) {
            throw new Error(`Insufficient funds. Balance: $${currentBal.toFixed(2)}`);
          }
          newBal = currentBal - amount;
        } else {
          newBal = currentBal + amount;
        }

        await tx.account.update({
          where: { id: accountId },
          data: { balance: new Prisma.Decimal(newBal) },
        });

        const reference = `${type === 'DEPOSIT' ? 'DEP' : 'WTH'}-${Date.now().toString().slice(-8)}-${Math.floor(1000 + Math.random() * 9000)}`;

        const transactionRecord = await tx.transaction.create({
          data: {
            reference,
            sourceAccountId: type === 'WITHDRAWAL' ? accountId : null,
            destinationAccountId: type === 'DEPOSIT' ? accountId : null,
            type: type === 'DEPOSIT' ? 'DEPOSIT' : 'WITHDRAWAL',
            amount: new Prisma.Decimal(amount),
            currency: account.currency,
            status: 'COMPLETED',
            description: description || `${type} via Online Banking`,
          },
        });

        // Ledger Entry
        await tx.ledgerEntry.create({
          data: {
            transactionId: transactionRecord.id,
            accountId: account.id,
            entryType: type === 'DEPOSIT' ? 'CREDIT' : 'DEBIT',
            amount: new Prisma.Decimal(amount),
            balanceAfter: new Prisma.Decimal(newBal),
          },
        });

        return {
          transaction: transactionRecord,
          newBalance: newBal,
          user: account.user,
          currency: account.currency,
        };
      });

      await SecurityService.logAudit({
        userId,
        action: `FUNDS_${type}`,
        ipAddress,
        userAgent,
        details: { reference: result.transaction.reference, amount, accountId },
      });

      // Dispatch Email Notification based on Credit or Deduct
      if (result.user?.email) {
        if (type === 'DEPOSIT') {
          EmailService.sendBalanceCreditedAlert(
            result.user.email,
            result.user.firstName,
            amount,
            result.currency,
            result.newBalance,
            description || 'Online Bank Deposit',
            result.transaction.reference
          ).catch((err) => console.warn('Could not dispatch deposit credit email:', err.message));
        } else {
          EmailService.sendBalanceDebitedAlert(
            result.user.email,
            result.user.firstName,
            amount,
            result.currency,
            result.newBalance,
            description || 'Online Bank Cash Withdrawal',
            result.transaction.reference
          ).catch((err) => console.warn('Could not dispatch withdrawal debit email:', err.message));
        }
      }

      return result;
    } finally {
      await releaseDistributedLock(lockKey, lockToken);
    }
  }

  static async getTransferById(userId: string, transferId: string) {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transferId,
        OR: [
          { sourceAccount: { userId } },
          { destinationAccount: { userId } },
        ],
      },
      include: {
        sourceAccount: {
          select: {
            accountNumber: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        destinationAccount: {
          select: {
            accountNumber: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        ledgerEntries: true,
      },
    });

    if (!transaction) throw new Error('Transaction not found or unauthorized');
    return transaction;
  }
}

