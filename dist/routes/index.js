"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const user_routes_1 = __importDefault(require("./user.routes"));
const kyc_routes_1 = __importDefault(require("./kyc.routes"));
const account_routes_1 = __importDefault(require("./account.routes"));
const transfer_routes_1 = __importDefault(require("./transfer.routes"));
const card_routes_1 = __importDefault(require("./card.routes"));
const loan_routes_1 = __importDefault(require("./loan.routes"));
const scheduled_payment_routes_1 = __importDefault(require("./scheduled-payment.routes"));
const admin_routes_1 = __importDefault(require("./admin.routes"));
const account_controller_1 = require("../controllers/account.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Modular Monolith API Routes as per specification
router.use('/auth', auth_routes_1.default);
router.use('/users', user_routes_1.default);
router.use('/kyc', kyc_routes_1.default);
router.use('/accounts', account_routes_1.default);
router.use('/transfers', transfer_routes_1.default);
router.use('/cards', card_routes_1.default);
router.use('/loans', loan_routes_1.default);
router.use('/scheduled-payments', scheduled_payment_routes_1.default);
router.use('/admin', admin_routes_1.default);
// Direct statement endpoint: GET /api/v1/statements?month=YYYY-MM
router.get('/statements', auth_middleware_1.authenticateJwt, account_controller_1.AccountController.getStatement);
// Health check
router.get('/health', (req, res) => {
    res.json({
        status: 'HEALTHY',
        service: 'Banking Core API Engine (Modular Monolith)',
        timestamp: new Date().toISOString(),
    });
});
exports.default = router;
