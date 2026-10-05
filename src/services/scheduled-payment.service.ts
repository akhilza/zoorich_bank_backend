import { prisma } from '../config/db';
import { PaymentFrequency, ScheduledPaymentStatus } from '@prisma/client';

export class ScheduledPaymentService {
  static async create(
    userId: string,
    data: {
      sourceAccountId: string;
      destinationAccountNumber: string;
      amount: number;
      frequency: PaymentFrequency;
      nextRunDate: string | Date;
      description?: string;
    }
  ) {
    const account = await prisma.account.findFirst({
      where: { id: data.sourceAccountId, userId },
    });
    if (!account) throw new Error('Source account not found');

    const recipient = await prisma.account.findUnique({
      where: { accountNumber: data.destinationAccountNumber },
    });
    if (!recipient) throw new Error('Recipient account number does not exist');
    if (recipient.id === account.id) throw new Error('Cannot schedule payment to the same account');

    const payment = await prisma.scheduledPayment.create({
      data: {
        userId,
        sourceAccountId: account.id,
        destinationAccountNumber: data.destinationAccountNumber,
        amount: data.amount,
        frequency: data.frequency || PaymentFrequency.MONTHLY,
        nextRunDate: new Date(data.nextRunDate),
        description: data.description,
        status: ScheduledPaymentStatus.ACTIVE,
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

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'SCHEDULED_PAYMENT_CREATED',
        details: `Scheduled recurring payment of $${data.amount} to account ${data.destinationAccountNumber}`,
      },
    });

    return payment;
  }

  static async list(userId: string) {
    const payments = await prisma.scheduledPayment.findMany({
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

  static async cancel(userId: string, id: string) {
    const payment = await prisma.scheduledPayment.findFirst({
      where: { id, userId },
    });
    if (!payment) throw new Error('Scheduled payment not found');

    const updated = await prisma.scheduledPayment.update({
      where: { id },
      data: { status: ScheduledPaymentStatus.CANCELLED },
    });

    return updated;
  }
}
