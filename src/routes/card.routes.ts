import { Router } from 'express';
import { z } from 'zod';
import { CardController } from '../controllers/card.controller';
import { authenticateJwt } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';

const router = Router();

const issueCardSchema = z.object({
  accountId: z.string().uuid(),
  cardLimit: z.number().positive().optional(),
});

const limitSchema = z.object({
  limit: z.number().positive('Limit must be greater than zero'),
});

router.use(authenticateJwt);

router.get('/', CardController.getCards);
router.post('/', validateRequest(issueCardSchema), CardController.issueCard);
router.post('/:id/freeze', CardController.freezeCard);
router.post('/:id/unfreeze', CardController.unfreezeCard);
router.patch('/:id/limit', validateRequest(limitSchema), CardController.updateLimit);

export default router;
