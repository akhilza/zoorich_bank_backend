"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const loan_controller_1 = require("../controllers/loan.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const router = (0, express_1.Router)();
const applyLoanSchema = zod_1.z.object({
    accountId: zod_1.z.string().uuid(),
    principal: zod_1.z.number().min(100, 'Minimum loan amount is $100'),
    tenureMonths: zod_1.z.number().int().min(1).max(60),
    purpose: zod_1.z.string().min(2).max(100),
});
router.use(auth_middleware_1.authenticateJwt);
router.get('/calculator', loan_controller_1.LoanController.calculateEmi);
router.post('/apply', (0, validate_middleware_1.validateRequest)(applyLoanSchema), loan_controller_1.LoanController.applyLoan);
router.get('/', loan_controller_1.LoanController.getLoans);
router.get('/:id/schedule', loan_controller_1.LoanController.getLoanSchedule);
router.post('/:id/repay', loan_controller_1.LoanController.repayInstallment);
exports.default = router;
