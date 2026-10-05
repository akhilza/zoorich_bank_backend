"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransferController = void 0;
const transfer_service_1 = require("../services/transfer.service");
class TransferController {
    static async transfer(req, res, next) {
        try {
            const idempotencyKey = (req.headers['idempotency-key'] || req.headers['x-idempotency-key']);
            const { sourceAccountId, destinationAccountNumber, amount, description, transactionPin, } = req.body;
            const result = await transfer_service_1.TransferService.executeTransfer({
                userId: req.user.id,
                sourceAccountId,
                destinationAccountNumber,
                amount: Number(amount),
                description,
                transactionPin,
                idempotencyKey,
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
            });
            return res.status(200).json({
                success: true,
                message: `Successfully transferred $${Number(amount).toFixed(2)} to ${result.recipientName}`,
                data: result,
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Transfer failed',
            });
        }
    }
    static async deposit(req, res, next) {
        try {
            const { accountId, amount, description } = req.body;
            const result = await transfer_service_1.TransferService.executeDepositOrWithdrawal({
                userId: req.user.id,
                accountId,
                amount: Number(amount),
                type: 'DEPOSIT',
                description,
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
            });
            return res.status(200).json({
                success: true,
                message: `Successfully deposited $${Number(amount).toFixed(2)}`,
                data: result,
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Deposit failed',
            });
        }
    }
    static async withdraw(req, res, next) {
        try {
            const { accountId, amount, description, transactionPin } = req.body;
            const result = await transfer_service_1.TransferService.executeDepositOrWithdrawal({
                userId: req.user.id,
                accountId,
                amount: Number(amount),
                type: 'WITHDRAWAL',
                description,
                transactionPin,
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
            });
            return res.status(200).json({
                success: true,
                message: `Successfully withdrawn $${Number(amount).toFixed(2)}`,
                data: result,
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Withdrawal failed',
            });
        }
    }
    static async getTransferById(req, res, next) {
        try {
            const data = await transfer_service_1.TransferService.getTransferById(req.user.id, req.params.id);
            return res.json({ success: true, data });
        }
        catch (error) {
            return res.status(404).json({ success: false, message: error.message });
        }
    }
}
exports.TransferController = TransferController;
