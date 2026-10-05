"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const transfer_controller_1 = require("../controllers/transfer.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const idempotency_middleware_1 = require("../middlewares/idempotency.middleware");
const rate_limit_middleware_1 = require("../middlewares/rate-limit.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const router = (0, express_1.Router)();
const transferSchema = zod_1.z.object({
    sourceAccountId: zod_1.z.string().uuid(),
    destinationAccountNumber: zod_1.z.string().min(8).max(20),
    amount: zod_1.z.number().positive('Amount must be positive'),
    description: zod_1.z.string().max(120).optional(),
    transactionPin: zod_1.z.string().regex(/^\d{6}$/, 'Transaction PIN must be 6 digits'),
});
const depositSchema = zod_1.z.object({
    accountId: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive(),
    description: zod_1.z.string().max(120).optional(),
});
const withdrawSchema = zod_1.z.object({
    accountId: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive(),
    description: zod_1.z.string().max(120).optional(),
    transactionPin: zod_1.z.string().regex(/^\d{6}$/, 'Transaction PIN must be 6 digits'),
});
router.use(auth_middleware_1.authenticateJwt);
router.post('/', rate_limit_middleware_1.transferLimiter, idempotency_middleware_1.idempotencyMiddleware, (0, validate_middleware_1.validateRequest)(transferSchema), transfer_controller_1.TransferController.transfer);
router.post('/send', rate_limit_middleware_1.transferLimiter, idempotency_middleware_1.idempotencyMiddleware, (0, validate_middleware_1.validateRequest)(transferSchema), transfer_controller_1.TransferController.transfer);
router.get('/:id', transfer_controller_1.TransferController.getTransferById);
router.post('/deposit', rate_limit_middleware_1.transferLimiter, idempotency_middleware_1.idempotencyMiddleware, (0, validate_middleware_1.validateRequest)(depositSchema), transfer_controller_1.TransferController.deposit);
router.post('/withdraw', rate_limit_middleware_1.transferLimiter, idempotency_middleware_1.idempotencyMiddleware, (0, validate_middleware_1.validateRequest)(withdrawSchema), transfer_controller_1.TransferController.withdraw);
exports.default = router;
