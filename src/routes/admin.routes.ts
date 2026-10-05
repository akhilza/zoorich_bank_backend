import { Router } from 'express';
import { z } from 'zod';
import { AdminController } from '../controllers/admin.controller';
import { authenticateJwt, requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { Role } from '../types';

const router = Router();

const reviewKycSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().optional(),
});

const freezeAccountSchema = z.object({
  freeze: z.boolean().default(true),
  reason: z.string().optional(),
});

// Protect all admin endpoints: require JWT and ADMIN or TELLER role
router.use(authenticateJwt);
router.use(requireRole(Role.ADMIN, Role.TELLER));

router.get('/users', AdminController.getUsers);
router.get('/kyc', AdminController.getKycQueue);
router.patch('/kyc/:id', validateRequest(reviewKycSchema), AdminController.reviewKyc);
router.patch('/accounts/:id/freeze', validateRequest(freezeAccountSchema), AdminController.freezeAccount);
router.get('/transactions', AdminController.getTransactions);
router.get('/audit-logs', AdminController.getAuditLogs);
router.get('/fraud-alerts', AdminController.getFraudAlerts);
router.get('/reports/summary', AdminController.getSummaryReport);

export default router;
