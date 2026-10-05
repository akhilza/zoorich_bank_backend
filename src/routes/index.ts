import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import kycRoutes from './kyc.routes';
import accountRoutes from './account.routes';
import transferRoutes from './transfer.routes';
import cardRoutes from './card.routes';
import loanRoutes from './loan.routes';
import scheduledPaymentRoutes from './scheduled-payment.routes';
import adminRoutes from './admin.routes';
import { AccountController } from '../controllers/account.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';

const router = Router();

// Modular Monolith API Routes as per specification
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/kyc', kycRoutes);
router.use('/accounts', accountRoutes);
router.use('/transfers', transferRoutes);
router.use('/cards', cardRoutes);
router.use('/loans', loanRoutes);
router.use('/scheduled-payments', scheduledPaymentRoutes);
router.use('/admin', adminRoutes);

// Direct statement endpoint: GET /api/v1/statements?month=YYYY-MM
router.get('/statements', authenticateJwt, AccountController.getStatement);

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'Banking Core API Engine (Modular Monolith)',
    timestamp: new Date().toISOString(),
  });
});

export default router;
