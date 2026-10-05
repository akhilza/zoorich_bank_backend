import { Request, Response } from 'express';
import { CardService } from '../services/card.service';

export class CardController {
  static async getCards(req: Request, res: Response) {
    try {
      const cards = await CardService.getCards(req.user!.id);
      return res.json({ success: true, data: cards });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async issueCard(req: Request, res: Response) {
    try {
      const card = await CardService.issueCard(req.user!.id, req.body);
      return res.status(201).json({ success: true, data: card });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async freezeCard(req: Request, res: Response) {
    try {
      const card = await CardService.freezeCard(req.user!.id, req.params.id);
      return res.json({ success: true, data: card, message: 'Card frozen successfully' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async unfreezeCard(req: Request, res: Response) {
    try {
      const card = await CardService.unfreezeCard(req.user!.id, req.params.id);
      return res.json({ success: true, data: card, message: 'Card unfrozen successfully' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async updateLimit(req: Request, res: Response) {
    try {
      const { limit } = req.body;
      const card = await CardService.updateLimit(req.user!.id, req.params.id, Number(limit));
      return res.json({ success: true, data: card, message: 'Card limit updated' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
}
