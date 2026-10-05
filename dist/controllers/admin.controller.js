"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const admin_service_1 = require("../services/admin.service");
class AdminController {
    static async getUsers(req, res) {
        try {
            const page = parseInt(req.query.page || '1', 10);
            const limit = parseInt(req.query.limit || '20', 10);
            const search = req.query.search;
            const result = await admin_service_1.AdminService.getUsers(page, limit, search);
            return res.json({ success: true, ...result });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async getKycQueue(req, res) {
        try {
            const status = req.query.status;
            const queue = await admin_service_1.AdminService.getKycList(status);
            return res.json({ success: true, data: queue });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async reviewKyc(req, res) {
        try {
            const { status, notes } = req.body;
            const updated = await admin_service_1.AdminService.reviewKyc(req.user.id, req.params.id, status, notes);
            return res.json({ success: true, data: updated, message: `KYC document ${status}` });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async freezeAccount(req, res) {
        try {
            const { freeze, reason } = req.body;
            const shouldFreeze = freeze !== false; // default true
            const updated = await admin_service_1.AdminService.freezeAccount(req.user.id, req.params.id, shouldFreeze, reason);
            return res.json({
                success: true,
                data: updated,
                message: shouldFreeze ? 'Account has been frozen' : 'Account has been unfrozen',
            });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async getTransactions(req, res) {
        try {
            const page = parseInt(req.query.page || '1', 10);
            const limit = parseInt(req.query.limit || '25', 10);
            const result = await admin_service_1.AdminService.getAllTransactions(page, limit);
            return res.json({ success: true, ...result });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async getAuditLogs(req, res) {
        try {
            const limit = parseInt(req.query.limit || '50', 10);
            const logs = await admin_service_1.AdminService.getAuditLogs(limit);
            return res.json({ success: true, data: logs });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async getFraudAlerts(req, res) {
        try {
            const alerts = await admin_service_1.AdminService.getFraudAlerts();
            return res.json({ success: true, data: alerts });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async getSummaryReport(req, res) {
        try {
            const summary = await admin_service_1.AdminService.getFinancialSummary();
            return res.json({ success: true, data: summary });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
}
exports.AdminController = AdminController;
