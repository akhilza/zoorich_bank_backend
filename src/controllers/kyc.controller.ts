import { Request, Response } from 'express';
import { KycService } from '../services/kyc.service';

export class KycController {
  static async submitDocument(req: Request, res: Response) {
    try {
      const document = await KycService.submitDocument(req.user!.id, req.body);
      return res.status(201).json({ success: true, data: document });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async getStatus(req: Request, res: Response) {
    try {
      const status = await KycService.getStatus(req.user!.id);
      return res.json({ success: true, data: status });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
}
