"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const kyc_controller_1 = require("../controllers/kyc.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const router = (0, express_1.Router)();
const documentSchema = zod_1.z.object({
    type: zod_1.z.enum(['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE']),
    fileUrl: zod_1.z.string().min(1, 'Document file/data is required'),
    documentNum: zod_1.z.string().optional(),
});
router.use(auth_middleware_1.authenticateJwt);
router.post('/documents', (0, validate_middleware_1.validateRequest)(documentSchema), kyc_controller_1.KycController.submitDocument);
router.get('/status', kyc_controller_1.KycController.getStatus);
exports.default = router;
