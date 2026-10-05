import { Request, Response } from 'express';
import { AdminService } from '../services/admin.service';
import { KycStatus } from '@prisma/client';

export class AdminController {
  static async getUsers(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);
      const search = req.query.search as string;

      const result = await AdminService.getUsers(page, limit, search);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async getKycQueue(req: Request, res: Response) {
    try {
      const status = req.query.status as KycStatus | undefined;
      const queue = await AdminService.getKycList(status);
      return res.json({ success: true, data: queue });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async reviewKyc(req: Request, res: Response) {
    try {
      const { status, notes } = req.body;
      const updated = await AdminService.reviewKyc(req.user!.id, req.params.id, status, notes);
      return res.json({ success: true, data: updated, message: `KYC document ${status}` });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async freezeAccount(req: Request, res: Response) {
    try {
      const { freeze, reason } = req.body;
      const shouldFreeze = freeze !== false; // default true
      const updated = await AdminService.freezeAccount(req.user!.id, req.params.id, shouldFreeze, reason);
      return res.json({
        success: true,
        data: updated,
        message: shouldFreeze ? 'Account has been frozen' : 'Account has been unfrozen',
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async getTransactions(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '25', 10);
      const result = await AdminService.getAllTransactions(page, limit);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async getAuditLogs(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string || '50', 10);
      const logs = await AdminService.getAuditLogs(limit);
      return res.json({ success: true, data: logs });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async getFraudAlerts(req: Request, res: Response) {
    try {
      const alerts = await AdminService.getFraudAlerts();
      return res.json({ success: true, data: alerts });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async getSummaryReport(req: Request, res: Response) {
    try {
      const summary = await AdminService.getFinancialSummary();
      return res.json({ success: true, data: summary });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
}
