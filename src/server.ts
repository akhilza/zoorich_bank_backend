import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config';
import routes from './routes';
import { errorHandler } from './middlewares/error.middleware';
import { globalLimiter } from './middlewares/rate-limit.middleware';

const app = express();

// Security HTTP headers
app.use(helmet());

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow any localhost port (3000, 3001, etc.) or same-origin requests
      if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'x-idempotency-key'],
  })
);

// Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP logging
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Global IP Rate Limiter
app.use(globalLimiter);

// Root Route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Zoorich Bank API!',
    status: 'ONLINE',
    health: '/api/v1/health'
  });
});

// API Routes
app.use('/api/v1', routes);

// Global Error Handler
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`🚀 Banking Core Engine listening on port ${config.port} [${config.nodeEnv}]`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export default app;
