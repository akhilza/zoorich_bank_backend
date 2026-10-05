"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const card_controller_1 = require("../controllers/card.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const router = (0, express_1.Router)();
const issueCardSchema = zod_1.z.object({
    accountId: zod_1.z.string().uuid(),
    cardLimit: zod_1.z.number().positive().optional(),
});
const limitSchema = zod_1.z.object({
    limit: zod_1.z.number().positive('Limit must be greater than zero'),
});
router.use(auth_middleware_1.authenticateJwt);
router.get('/', card_controller_1.CardController.getCards);
router.post('/', (0, validate_middleware_1.validateRequest)(issueCardSchema), card_controller_1.CardController.issueCard);
router.post('/:id/freeze', card_controller_1.CardController.freezeCard);
router.post('/:id/unfreeze', card_controller_1.CardController.unfreezeCard);
router.patch('/:id/limit', (0, validate_middleware_1.validateRequest)(limitSchema), card_controller_1.CardController.updateLimit);
exports.default = router;
