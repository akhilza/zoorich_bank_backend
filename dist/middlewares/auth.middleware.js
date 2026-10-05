"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.authenticateJwt = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const db_1 = require("../config/db");
const types_1 = require("../types");
const authenticateJwt = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Authentication token missing or invalid',
            });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
        const user = await db_1.prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, email: true, role: true, status: true },
        });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User account not found',
            });
        }
        if (user.status === types_1.UserStatus.FROZEN || user.status === types_1.UserStatus.SUSPENDED) {
            return res.status(403).json({
                success: false,
                message: `Account is ${user.status.toLowerCase()}. Please contact banking compliance.`,
            });
        }
        req.user = user;
        next();
    }
    catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired session token',
            error: error.message,
        });
    }
};
exports.authenticateJwt = authenticateJwt;
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: insufficient administrative privileges',
            });
        }
        next();
    };
};
exports.requireRole = requireRole;
