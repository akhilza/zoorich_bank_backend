"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoanController = void 0;
const loan_service_1 = require("../services/loan.service");
class LoanController {
    static async applyLoan(req, res) {
        try {
            const loan = await loan_service_1.LoanService.applyLoan(req.user.id, req.body);
            return res.status(201).json({ success: true, data: loan });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async getLoans(req, res) {
        try {
            const loans = await loan_service_1.LoanService.getLoans(req.user.id);
            return res.json({ success: true, data: loans });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async getLoanSchedule(req, res) {
        try {
            const schedule = await loan_service_1.LoanService.getLoanSchedule(req.user.id, req.params.id);
            return res.json({ success: true, data: schedule });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async repayInstallment(req, res) {
        try {
            const result = await loan_service_1.LoanService.repayInstallment(req.user.id, req.params.id);
            return res.json({ success: true, data: result });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static calculateEmi(req, res) {
        try {
            const { principal, interestRate, tenureMonths } = req.query;
            const emi = loan_service_1.LoanService.calculateEmi(Number(principal || 5000), Number(interestRate || 8.5), Number(tenureMonths || 12));
            return res.json({
                success: true,
                data: {
                    principal: Number(principal || 5000),
                    interestRate: Number(interestRate || 8.5),
                    tenureMonths: Number(tenureMonths || 12),
                    monthlyEmi: emi,
                    totalRepayable: Math.round(emi * Number(tenureMonths || 12) * 100) / 100,
                },
            });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
}
exports.LoanController = LoanController;
