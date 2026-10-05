import { Request, Response } from 'express';
import { ScheduledPaymentService } from '../services/scheduled-payment.service';

export class ScheduledPaymentController {
  static async create(req: Request, res: Response) {
    try {
      const payment = await ScheduledPaymentService.create(req.user!.id, req.body);
      return res.status(201).json({ success: true, data: payment });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const payments = await ScheduledPaymentService.list(req.user!.id);
      return res.json({ success: true, data: payments });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async cancel(req: Request, res: Response) {
    try {
      const payment = await ScheduledPaymentService.cancel(req.user!.id, req.params.id);
      return res.json({ success: true, data: payment, message: 'Scheduled payment cancelled' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
}
