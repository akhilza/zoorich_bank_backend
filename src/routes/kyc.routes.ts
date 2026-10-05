import { Router } from 'express';
import { z } from 'zod';
import { KycController } from '../controllers/kyc.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';

const router = Router();

const documentSchema = z.object({
  type: z.enum(['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE']),
  fileUrl: z.string().min(1, 'Document file/data is required'),
  documentNum: z.string().optional(),
});

router.use(authenticateJwt);

router.post('/documents', validateRequest(documentSchema), KycController.submitDocument);
router.get('/status', KycController.getStatus);

export default router;
