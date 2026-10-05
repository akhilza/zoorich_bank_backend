"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.PORT || '5000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl: process.env.DATABASE_URL || 'mysql://bank_user:bank_password@localhost:3306/banking_db',
    redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || 'redis_password',
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'super_secret_jwt_key_banking_project_2026',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'super_secret_refresh_jwt_key_banking_project_2026',
        expiresIn: '2h',
        refreshExpiresIn: '7d',
    },
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID || '',
        authToken: process.env.TWILIO_AUTH_TOKEN || '',
        phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    },
    security: {
        maxPinAttempts: 3,
        pinLockoutMinutes: 15,
        maxDailyTransferAmount: 10000,
        transferVelocityLimitPerMinute: 5,
    },
    email: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.EMAIL_FROM || 'Zoorich Bank <no-reply@zoorichbank.com>',
    },
};
