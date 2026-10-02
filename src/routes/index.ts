import { Router } from 'express';
import authRoutes from './auth.routes';
import accountRoutes from './account.routes';
import transferRoutes from './transfer.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/accounts', accountRoutes);
router.use('/transfers', transferRoutes);

router.get('/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'Banking Core API Engine',
    timestamp: new Date().toISOString(),
  });
});

export default router;
