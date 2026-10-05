import { Router } from 'express';
import { z } from 'zod';
import { ScheduledPaymentController } from '../controllers/scheduled-payment.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';

const router = Router();

const createScheduledPaymentSchema = z.object({
  sourceAccountId: z.string().uuid(),
  destinationAccountNumber: z.string().min(8).max(20),
  amount: z.number().positive(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).default('MONTHLY'),
  nextRunDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid next run date' }),
  description: z.string().max(120).optional(),
});

router.use(authenticateJwt);

router.post('/', validateRequest(createScheduledPaymentSchema), ScheduledPaymentController.create);
router.get('/', ScheduledPaymentController.list);
router.delete('/:id', ScheduledPaymentController.cancel);

export default router;
