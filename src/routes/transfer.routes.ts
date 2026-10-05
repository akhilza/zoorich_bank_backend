import { Router } from 'express';
import { z } from 'zod';
import { TransferController } from '../controllers/transfer.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware';
import { transferLimiter } from '../middlewares/rate-limit.middleware';
import { validateRequest } from '../middlewares/validate.middleware';

const router = Router();

const transferSchema = z.object({
  sourceAccountId: z.string().uuid(),
  destinationAccountNumber: z.string().min(8).max(20),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().max(120).optional(),
  transactionPin: z.string().regex(/^\d{6}$/, 'Transaction PIN must be 6 digits'),
});

const depositSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.number().positive(),
  description: z.string().max(120).optional(),
});

const withdrawSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.number().positive(),
  description: z.string().max(120).optional(),
  transactionPin: z.string().regex(/^\d{6}$/, 'Transaction PIN must be 6 digits'),
});

router.use(authenticateJwt);

router.post(
  '/',
  transferLimiter,
  idempotencyMiddleware,
  validateRequest(transferSchema),
  TransferController.transfer
);

router.post(
  '/send',
  transferLimiter,
  idempotencyMiddleware,
  validateRequest(transferSchema),
  TransferController.transfer
);

router.get('/:id', TransferController.getTransferById);


router.post(
  '/deposit',
  transferLimiter,
  idempotencyMiddleware,
  validateRequest(depositSchema),
  TransferController.deposit
);

router.post(
  '/withdraw',
  transferLimiter,
  idempotencyMiddleware,
  validateRequest(withdrawSchema),
  TransferController.withdraw
);

export default router;
