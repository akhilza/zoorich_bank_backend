"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountController = void 0;
const account_service_1 = require("../services/account.service");
const db_1 = require("../config/db");
class AccountController {
    static async getMyAccounts(req, res, next) {
        try {
            const data = await account_service_1.AccountService.getUserAccounts(req.user.id);
            return res.json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    static async getAccountById(req, res, next) {
        try {
            const account = await account_service_1.AccountService.getAccountById(req.user.id, req.params.id);
            return res.json({ success: true, data: account });
        }
        catch (error) {
            return res.status(404).json({ success: false, message: error.message });
        }
    }
    static async createAccount(req, res, next) {
        try {
            const { accountType, currency, initialDeposit } = req.body;
            const account = await account_service_1.AccountService.createAccount(req.user.id, accountType || 'SAVINGS', currency || 'USD', Number(initialDeposit) || 0);
            return res.status(201).json({ success: true, data: account });
        }
        catch (error) {
            next(error);
        }
    }
    static async lookupRecipient(req, res, next) {
        try {
            const { accountNumber } = req.params;
            const info = await account_service_1.AccountService.lookupRecipient(accountNumber);
            if (!info) {
                return res.status(404).json({ success: false, message: 'Account number does not exist' });
            }
            return res.json({ success: true, data: info });
        }
        catch (error) {
            next(error);
        }
    }
    static async getTransactions(req, res, next) {
        try {
            const accountId = (req.params.id || req.query.accountId);
            const limit = parseInt(req.query.limit) || 20;
            const page = parseInt(req.query.page) || 1;
            const type = req.query.type;
            const from = req.query.from;
            const to = req.query.to;
            const result = await account_service_1.AccountService.getTransactionHistory(req.user.id, accountId, limit, page, type, from, to);
            return res.json({ success: true, ...result, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    static async getStatement(req, res, next) {
        try {
            const month = req.query.month;
            const accountId = (req.params.id || req.query.accountId);
            const statement = await account_service_1.AccountService.getStatement(req.user.id, month, accountId);
            return res.json({ success: true, data: statement });
        }
        catch (error) {
            return res.status(400).json({ success: false, message: error.message });
        }
    }
    static async getAuditLogs(req, res, next) {
        try {
            const logs = await db_1.prisma.auditLog.findMany({
                where: { userId: req.user.id },
                orderBy: { createdAt: 'desc' },
                take: 30,
            });
            return res.json({ success: true, data: logs });
        }
        catch (error) {
            next(error);
        }
    }
    static async getBeneficiaries(req, res, next) {
        try {
            const data = await account_service_1.AccountService.getBeneficiaries(req.user.id);
            return res.json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    static async addBeneficiary(req, res, next) {
        try {
            const { name, accountNumber, bankName, nickname } = req.body;
            if (!name || !accountNumber) {
                return res.status(400).json({ success: false, message: 'Name and account number are required' });
            }
            const beneficiary = await account_service_1.AccountService.addBeneficiary(req.user.id, {
                name,
                accountNumber,
                bankName,
                nickname,
            });
            return res.status(201).json({ success: true, data: beneficiary });
        }
        catch (error) {
            next(error);
        }
    }
    static async deleteBeneficiary(req, res, next) {
        try {
            const { id } = req.params;
            await account_service_1.AccountService.deleteBeneficiary(req.user.id, id);
            return res.json({ success: true, message: 'Beneficiary removed' });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AccountController = AccountController;
