import { Request, Response, NextFunction } from 'express';
import { TransferService } from '../services/transfer.service';

export class TransferController {
  static async transfer(req: Request, res: Response, next: NextFunction) {
    try {
      const idempotencyKey = (req.headers['idempotency-key'] || req.headers['x-idempotency-key']) as string;
      const {
        sourceAccountId,
        destinationAccountNumber,
        amount,
        description,
        transactionPin,
      } = req.body;

      const result = await TransferService.executeTransfer({
        userId: req.user!.id,
        sourceAccountId,
        destinationAccountNumber,
        amount: Number(amount),
        description,
        transactionPin,
        idempotencyKey,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(200).json({
        success: true,
        message: `Successfully transferred $${Number(amount).toFixed(2)} to ${result.recipientName}`,
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Transfer failed',
      });
    }
  }

  static async deposit(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountId, amount, description } = req.body;
      const result = await TransferService.executeDepositOrWithdrawal({
        userId: req.user!.id,
        accountId,
        amount: Number(amount),
        type: 'DEPOSIT',
        description,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(200).json({
        success: true,
        message: `Successfully deposited $${Number(amount).toFixed(2)}`,
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Deposit failed',
      });
    }
  }

  static async withdraw(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountId, amount, description, transactionPin } = req.body;
      const result = await TransferService.executeDepositOrWithdrawal({
        userId: req.user!.id,
        accountId,
        amount: Number(amount),
        type: 'WITHDRAWAL',
        description,
        transactionPin,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(200).json({
        success: true,
        message: `Successfully withdrawn $${Number(amount).toFixed(2)}`,
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Withdrawal failed',
      });
    }
  }

  static async getTransferById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await TransferService.getTransferById(req.user!.id, req.params.id);
      return res.json({ success: true, data });
    } catch (error: any) {
      return res.status(404).json({ success: false, message: error.message });
    }
  }
}

