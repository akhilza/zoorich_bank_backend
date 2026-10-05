"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KycController = void 0;
const kyc_service_1 = require("../services/kyc.service");
class KycController {
    static async submitDocument(req, res) {
        try {
            const document = await kyc_service_1.KycService.submitDocument(req.user.id, req.body);
            return res.status(201).json({ success: true, data: document });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async getStatus(req, res) {
        try {
            const status = await kyc_service_1.KycService.getStatus(req.user.id);
            return res.json({ success: true, data: status });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
}
exports.KycController = KycController;
