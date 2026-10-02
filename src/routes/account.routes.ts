import { Router } from 'express';
import { z } from 'zod';
import { AccountController } from '../controllers/account.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';

const router = Router();

const createAccountSchema = z.object({
  accountType: z.enum(['CHECKING', 'SAVINGS', 'BUSINESS']),
  currency: z.string().default('USD'),
  initialDeposit: z.number().nonnegative().optional(),
});

router.use(authenticateJwt);

router.get('/', AccountController.getMyAccounts);
router.post('/create', validateRequest(createAccountSchema), AccountController.createAccount);
router.get('/lookup/:accountNumber', AccountController.lookupRecipient);
router.get('/transactions', AccountController.getTransactions);
router.get('/audit-logs', AccountController.getAuditLogs);
router.get('/beneficiaries', AccountController.getBeneficiaries);
router.post('/beneficiaries', AccountController.addBeneficiary);
router.delete('/beneficiaries/:id', AccountController.deleteBeneficiary);

export default router;
