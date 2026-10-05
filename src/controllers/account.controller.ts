import { Request, Response, NextFunction } from 'express';
import { AccountService } from '../services/account.service';
import { prisma } from '../config/db';

export class AccountController {
  static async getMyAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AccountService.getUserAccounts(req.user!.id);
      return res.json({ success: true, data });
    } catch (error: any) {
      next(error);
    }
  }

  static async getAccountById(req: Request, res: Response, next: NextFunction) {
    try {
      const account = await AccountService.getAccountById(req.user!.id, req.params.id);
      return res.json({ success: true, data: account });
    } catch (error: any) {
      return res.status(404).json({ success: false, message: error.message });
    }
  }

  static async createAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountType, currency, initialDeposit } = req.body;
      const account = await AccountService.createAccount(
        req.user!.id,
        accountType || 'SAVINGS',
        currency || 'USD',
        Number(initialDeposit) || 0
      );
      return res.status(201).json({ success: true, data: account });
    } catch (error: any) {
      next(error);
    }
  }

  static async lookupRecipient(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountNumber } = req.params;
      const info = await AccountService.lookupRecipient(accountNumber);
      if (!info) {
        return res.status(404).json({ success: false, message: 'Account number does not exist' });
      }
      return res.json({ success: true, data: info });
    } catch (error: any) {
      next(error);
    }
  }

  static async getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const accountId = (req.params.id || req.query.accountId) as string;
      const limit = parseInt(req.query.limit as string) || 20;
      const page = parseInt(req.query.page as string) || 1;
      const type = req.query.type as string;
      const from = req.query.from as string;
      const to = req.query.to as string;

      const result = await AccountService.getTransactionHistory(
        req.user!.id,
        accountId,
        limit,
        page,
        type,
        from,
        to
      );
      return res.json({ success: true, ...result, data: result });
    } catch (error: any) {
      next(error);
    }
  }

  static async getStatement(req: Request, res: Response, next: NextFunction) {
    try {
      const month = req.query.month as string;
      const accountId = (req.params.id || req.query.accountId) as string;
      const statement = await AccountService.getStatement(req.user!.id, month, accountId);
      return res.json({ success: true, data: statement });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const logs = await prisma.auditLog.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
      return res.json({ success: true, data: logs });
    } catch (error: any) {
      next(error);
    }
  }

  static async getBeneficiaries(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AccountService.getBeneficiaries(req.user!.id);
      return res.json({ success: true, data });
    } catch (error: any) {
      next(error);
    }
  }

  static async addBeneficiary(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, accountNumber, bankName, nickname } = req.body;
      if (!name || !accountNumber) {
        return res.status(400).json({ success: false, message: 'Name and account number are required' });
      }
      const beneficiary = await AccountService.addBeneficiary(req.user!.id, {
        name,
        accountNumber,
        bankName,
        nickname,
      });
      return res.status(201).json({ success: true, data: beneficiary });
    } catch (error: any) {
      next(error);
    }
  }

  static async deleteBeneficiary(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await AccountService.deleteBeneficiary(req.user!.id, id);
      return res.json({ success: true, message: 'Beneficiary removed' });
    } catch (error: any) {
      next(error);
    }
  }
}
