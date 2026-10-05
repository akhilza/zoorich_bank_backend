"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const scheduled_payment_controller_1 = require("../controllers/scheduled-payment.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const router = (0, express_1.Router)();
const createScheduledPaymentSchema = zod_1.z.object({
    sourceAccountId: zod_1.z.string().uuid(),
    destinationAccountNumber: zod_1.z.string().min(8).max(20),
    amount: zod_1.z.number().positive(),
    frequency: zod_1.z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).default('MONTHLY'),
    nextRunDate: zod_1.z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid next run date' }),
    description: zod_1.z.string().max(120).optional(),
});
router.use(auth_middleware_1.authenticateJwt);
router.post('/', (0, validate_middleware_1.validateRequest)(createScheduledPaymentSchema), scheduled_payment_controller_1.ScheduledPaymentController.create);
router.get('/', scheduled_payment_controller_1.ScheduledPaymentController.list);
router.delete('/:id', scheduled_payment_controller_1.ScheduledPaymentController.cancel);
exports.default = router;
