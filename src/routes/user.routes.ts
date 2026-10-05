import { Router } from 'express';
import { z } from 'zod';
import { UserController } from '../controllers/user.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';

const router = Router();

const updateMeSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

router.use(authenticateJwt);

router.get('/me', UserController.getMe);
router.patch('/me', validateRequest(updateMeSchema), UserController.updateMe);
router.post('/me/change-password', validateRequest(changePasswordSchema), UserController.changePassword);

export default router;
