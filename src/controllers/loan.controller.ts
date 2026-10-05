import { Request, Response } from 'express';
import { LoanService } from '../services/loan.service';

export class LoanController {
  static async applyLoan(req: Request, res: Response) {
    try {
      const loan = await LoanService.applyLoan(req.user!.id, req.body);
      return res.status(201).json({ success: true, data: loan });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async getLoans(req: Request, res: Response) {
    try {
      const loans = await LoanService.getLoans(req.user!.id);
      return res.json({ success: true, data: loans });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async getLoanSchedule(req: Request, res: Response) {
    try {
      const schedule = await LoanService.getLoanSchedule(req.user!.id, req.params.id);
      return res.json({ success: true, data: schedule });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async repayInstallment(req: Request, res: Response) {
    try {
      const result = await LoanService.repayInstallment(req.user!.id, req.params.id);
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static calculateEmi(req: Request, res: Response) {
    try {
      const { principal, interestRate, tenureMonths } = req.query;
      const emi = LoanService.calculateEmi(
        Number(principal || 5000),
        Number(interestRate || 8.5),
        Number(tenureMonths || 12)
      );
      return res.json({
        success: true,
        data: {
          principal: Number(principal || 5000),
          interestRate: Number(interestRate || 8.5),
          tenureMonths: Number(tenureMonths || 12),
          monthlyEmi: emi,
          totalRepayable: Math.round(emi * Number(tenureMonths || 12) * 100) / 100,
        },
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
}
