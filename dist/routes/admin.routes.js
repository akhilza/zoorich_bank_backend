"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const admin_controller_1 = require("../controllers/admin.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const types_1 = require("../types");
const router = (0, express_1.Router)();
const reviewKycSchema = zod_1.z.object({
    status: zod_1.z.enum(['APPROVED', 'REJECTED']),
    notes: zod_1.z.string().optional(),
});
const freezeAccountSchema = zod_1.z.object({
    freeze: zod_1.z.boolean().default(true),
    reason: zod_1.z.string().optional(),
});
// Protect all admin endpoints: require JWT and ADMIN or TELLER role
router.use(auth_middleware_1.authenticateJwt);
router.use((0, auth_middleware_1.requireRole)(types_1.Role.ADMIN, types_1.Role.TELLER));
router.get('/users', admin_controller_1.AdminController.getUsers);
router.get('/kyc', admin_controller_1.AdminController.getKycQueue);
router.patch('/kyc/:id', (0, validate_middleware_1.validateRequest)(reviewKycSchema), admin_controller_1.AdminController.reviewKyc);
router.patch('/accounts/:id/freeze', (0, validate_middleware_1.validateRequest)(freezeAccountSchema), admin_controller_1.AdminController.freezeAccount);
router.get('/transactions', admin_controller_1.AdminController.getTransactions);
router.get('/audit-logs', admin_controller_1.AdminController.getAuditLogs);
router.get('/fraud-alerts', admin_controller_1.AdminController.getFraudAlerts);
router.get('/reports/summary', admin_controller_1.AdminController.getSummaryReport);
exports.default = router;
