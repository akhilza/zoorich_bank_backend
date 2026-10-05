"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const user_service_1 = require("../services/user.service");
class UserController {
    static async getMe(req, res) {
        try {
            const user = await user_service_1.UserService.getProfile(req.user.id);
            return res.json({ success: true, data: user });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async updateMe(req, res) {
        try {
            const updated = await user_service_1.UserService.updateProfile(req.user.id, req.body);
            return res.json({ success: true, data: updated });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            const result = await user_service_1.UserService.changePassword(req.user.id, currentPassword, newPassword);
            return res.json(result);
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
}
exports.UserController = UserController;
