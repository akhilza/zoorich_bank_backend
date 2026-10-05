import { Router } from 'express';
import { z } from 'zod';
import { LoanController } from '../controllers/loan.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';

const router = Router();

const applyLoanSchema = z.object({
  accountId: z.string().uuid(),
  principal: z.number().min(100, 'Minimum loan amount is $100'),
  tenureMonths: z.number().int().min(1).max(60),
  purpose: z.string().min(2).max(100),
});

router.use(authenticateJwt);

router.get('/calculator', LoanController.calculateEmi);
router.post('/apply', validateRequest(applyLoanSchema), LoanController.applyLoan);
router.get('/', LoanController.getLoans);
router.get('/:id/schedule', LoanController.getLoanSchedule);
router.post('/:id/repay', LoanController.repayInstallment);

export default router;
