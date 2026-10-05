"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const user_controller_1 = require("../controllers/user.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const router = (0, express_1.Router)();
const updateMeSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(2).optional(),
    lastName: zod_1.z.string().min(2).optional(),
    phone: zod_1.z.string().optional().nullable(),
});
const changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, 'Current password is required'),
    newPassword: zod_1.z.string().min(8, 'New password must be at least 8 characters'),
});
router.use(auth_middleware_1.authenticateJwt);
router.get('/me', user_controller_1.UserController.getMe);
router.patch('/me', (0, validate_middleware_1.validateRequest)(updateMeSchema), user_controller_1.UserController.updateMe);
router.post('/me/change-password', (0, validate_middleware_1.validateRequest)(changePasswordSchema), user_controller_1.UserController.changePassword);
exports.default = router;
