import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV !== 'production';

// In development mode, completely disable rate limiting to avoid 429 errors during local testing
const passThrough = (req: Request, res: Response, next: NextFunction) => next();

export const globalLimiter = isDev
  ? passThrough
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: 'Too many requests, please try again later',
      },
    });

export const authLimiter = isDev
  ? passThrough
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: 'Too many authentication attempts, please try again in 15 minutes',
      },
    });

export const transferLimiter = isDev
  ? passThrough
  : rateLimit({
      windowMs: 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: 'Transfer rate limit exceeded. Please wait 60 seconds.',
      },
    });
