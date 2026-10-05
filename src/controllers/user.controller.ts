import { Request, Response } from 'express';
import { UserService } from '../services/user.service';

export class UserController {
  static async getMe(req: Request, res: Response) {
    try {
      const user = await UserService.getProfile(req.user!.id);
      return res.json({ success: true, data: user });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async updateMe(req: Request, res: Response) {
    try {
      const updated = await UserService.updateProfile(req.user!.id, req.body);
      return res.json({ success: true, data: updated });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async changePassword(req: Request, res: Response) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await UserService.changePassword(req.user!.id, currentPassword, newPassword);
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
}
