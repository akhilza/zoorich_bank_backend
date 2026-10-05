"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const account_controller_1 = require("../controllers/account.controller");
const transfer_controller_1 = require("../controllers/transfer.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const idempotency_middleware_1 = require("../middlewares/idempotency.middleware");
const rate_limit_middleware_1 = require("../middlewares/rate-limit.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const router = (0, express_1.Router)();
const createAccountSchema = zod_1.z.object({
    accountType: zod_1.z.enum(['CHECKING', 'SAVINGS', 'BUSINESS']).default('SAVINGS'),
    currency: zod_1.z.string().default('USD'),
    initialDeposit: zod_1.z.number().nonnegative().optional(),
});
const depositSchema = zod_1.z.object({
    amount: zod_1.z.number().positive(),
    description: zod_1.z.string().max(120).optional(),
});
const withdrawSchema = zod_1.z.object({
    amount: zod_1.z.number().positive(),
    description: zod_1.z.string().max(120).optional(),
    transactionPin: zod_1.z.string().regex(/^\d{6}$/, 'Transaction PIN must be 6 digits'),
});
router.use(auth_middleware_1.authenticateJwt);
// Accounts
router.get('/', account_controller_1.AccountController.getMyAccounts);
router.post('/', (0, validate_middleware_1.validateRequest)(createAccountSchema), account_controller_1.AccountController.createAccount);
router.post('/create', (0, validate_middleware_1.validateRequest)(createAccountSchema), account_controller_1.AccountController.createAccount);
router.get('/lookup/:accountNumber', account_controller_1.AccountController.lookupRecipient);
router.get('/transactions', account_controller_1.AccountController.getTransactions);
router.get('/statements', account_controller_1.AccountController.getStatement);
router.get('/audit-logs', account_controller_1.AccountController.getAuditLogs);
// Beneficiaries
router.get('/beneficiaries', account_controller_1.AccountController.getBeneficiaries);
router.post('/beneficiaries', account_controller_1.AccountController.addBeneficiary);
router.delete('/beneficiaries/:id', account_controller_1.AccountController.deleteBeneficiary);
// Single Account Operations
router.get('/:id', account_controller_1.AccountController.getAccountById);
router.get('/:id/transactions', account_controller_1.AccountController.getTransactions);
router.get('/:id/statements', account_controller_1.AccountController.getStatement);
router.post('/:id/deposit', rate_limit_middleware_1.transferLimiter, idempotency_middleware_1.idempotencyMiddleware, (0, validate_middleware_1.validateRequest)(depositSchema), (req, res, next) => {
    req.body.accountId = req.params.id;
    return transfer_controller_1.TransferController.deposit(req, res, next);
});
router.post('/:id/withdraw', rate_limit_middleware_1.transferLimiter, idempotency_middleware_1.idempotencyMiddleware, (0, validate_middleware_1.validateRequest)(withdrawSchema), (req, res, next) => {
    req.body.accountId = req.params.id;
    return transfer_controller_1.TransferController.withdraw(req, res, next);
});
exports.default = router;
