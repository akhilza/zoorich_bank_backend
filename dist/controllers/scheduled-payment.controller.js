"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduledPaymentController = void 0;
const scheduled_payment_service_1 = require("../services/scheduled-payment.service");
class ScheduledPaymentController {
    static async create(req, res) {
        try {
            const payment = await scheduled_payment_service_1.ScheduledPaymentService.create(req.user.id, req.body);
            return res.status(201).json({ success: true, data: payment });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async list(req, res) {
        try {
            const payments = await scheduled_payment_service_1.ScheduledPaymentService.list(req.user.id);
            return res.json({ success: true, data: payments });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async cancel(req, res) {
        try {
            const payment = await scheduled_payment_service_1.ScheduledPaymentService.cancel(req.user.id, req.params.id);
            return res.json({ success: true, data: payment, message: 'Scheduled payment cancelled' });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
}
exports.ScheduledPaymentController = ScheduledPaymentController;
