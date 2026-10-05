"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const config_1 = require("./config");
const routes_1 = __importDefault(require("./routes"));
const error_middleware_1 = require("./middlewares/error.middleware");
const rate_limit_middleware_1 = require("./middlewares/rate-limit.middleware");
const app = (0, express_1.default)();
// Security HTTP headers
app.use((0, helmet_1.default)());
// Cross-Origin Resource Sharing
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow any localhost port (3000, 3001, etc.) or same-origin requests
        if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
            callback(null, true);
        }
        else {
            callback(null, true);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'x-idempotency-key'],
}));
// Body parsers
app.use(express_1.default.json({ limit: '1mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// HTTP logging
if (config_1.config.nodeEnv === 'development') {
    app.use((0, morgan_1.default)('dev'));
}
// Global IP Rate Limiter
app.use(rate_limit_middleware_1.globalLimiter);
// API Routes
app.use('/api/v1', routes_1.default);
// Global Error Handler
app.use(error_middleware_1.errorHandler);
const server = app.listen(config_1.config.port, () => {
    console.log(`🚀 Banking Core Engine listening on port ${config_1.config.port} [${config_1.config.nodeEnv}]`);
});
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});
exports.default = app;
