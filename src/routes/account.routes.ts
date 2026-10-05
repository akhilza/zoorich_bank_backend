import { Router } from 'express';
import { z } from 'zod';
import { AccountController } from '../controllers/account.controller';
import { TransferController } from '../controllers/transfer.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware';
import { transferLimiter } from '../middlewares/rate-limit.middleware';
import { validateRequest } from '../middlewares/validate.middleware';

const router = Router();

const createAccountSchema = z.object({
  accountType: z.enum(['CHECKING', 'SAVINGS', 'BUSINESS']).default('SAVINGS'),
  currency: z.string().default('USD'),
  initialDeposit: z.number().nonnegative().optional(),
});

const depositSchema = z.object({
  amount: z.number().positive(),
  description: z.string().max(120).optional(),
});

const withdrawSchema = z.object({
  amount: z.number().positive(),
  description: z.string().max(120).optional(),
  transactionPin: z.string().regex(/^\d{6}$/, 'Transaction PIN must be 6 digits'),
});

router.use(authenticateJwt);

// Accounts
router.get('/', AccountController.getMyAccounts);
router.post('/', validateRequest(createAccountSchema), AccountController.createAccount);
router.post('/create', validateRequest(createAccountSchema), AccountController.createAccount);
router.get('/lookup/:accountNumber', AccountController.lookupRecipient);
router.get('/transactions', AccountController.getTransactions);
router.get('/statements', AccountController.getStatement);
router.get('/audit-logs', AccountController.getAuditLogs);

// Beneficiaries
router.get('/beneficiaries', AccountController.getBeneficiaries);
router.post('/beneficiaries', AccountController.addBeneficiary);
router.delete('/beneficiaries/:id', AccountController.deleteBeneficiary);

// Single Account Operations
router.get('/:id', AccountController.getAccountById);
router.get('/:id/transactions', AccountController.getTransactions);
router.get('/:id/statements', AccountController.getStatement);

router.post(
  '/:id/deposit',
  transferLimiter,
  idempotencyMiddleware,
  validateRequest(depositSchema),
  (req, res, next) => {
    req.body.accountId = req.params.id;
    return TransferController.deposit(req, res, next);
  }
);

router.post(
  '/:id/withdraw',
  transferLimiter,
  idempotencyMiddleware,
  validateRequest(withdrawSchema),
  (req, res, next) => {
    req.body.accountId = req.params.id;
    return TransferController.withdraw(req, res, next);
  }
);

export default router;
