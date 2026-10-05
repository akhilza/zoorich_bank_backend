"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferLimiter = exports.authLimiter = exports.globalLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const isDev = process.env.NODE_ENV !== 'production';
// In development mode, completely disable rate limiting to avoid 429 errors during local testing
const passThrough = (req, res, next) => next();
exports.globalLimiter = isDev
    ? passThrough
    : (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 1000,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            message: 'Too many requests, please try again later',
        },
    });
exports.authLimiter = isDev
    ? passThrough
    : (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 30,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            message: 'Too many authentication attempts, please try again in 15 minutes',
        },
    });
exports.transferLimiter = isDev
    ? passThrough
    : (0, express_rate_limit_1.default)({
        windowMs: 60 * 1000,
        max: 30,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            message: 'Transfer rate limit exceeded. Please wait 60 seconds.',
        },
    });
