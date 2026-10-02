import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { cacheGet, cacheSet } from '../config/redis';
import { prisma } from '../config/db';
import { IdempotencyStatus } from '../types';

export const idempotencyMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Only apply to state-changing operations
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const idempotencyKey = (req.headers['idempotency-key'] || req.headers['x-idempotency-key']) as string;

  if (!idempotencyKey) {
    return res.status(400).json({
      success: false,
      message: 'Header "Idempotency-Key" is required for critical banking transactions.',
    });
  }

  const userId = req.user?.id || 'anonymous';
  const redisKey = `idempotency:${userId}:${idempotencyKey}`;
  const requestPayloadHash = crypto
    .createHash('sha256')
    .update(req.originalUrl + JSON.stringify(req.body || {}))
    .digest('hex');

  try {
    // 1. Check Redis / Memory cache first (Sub-millisecond lookup)
    const cached = await cacheGet(redisKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.status === 'PROCESSING') {
        return res.status(409).json({
          success: false,
          message: 'An identical transaction is currently processing. Please do not re-submit.',
        });
      }

      if (parsed.status === 'RESOLVED') {
        return res.status(parsed.statusCode || 200).json(parsed.body);
      }
    }

    // 2. Check Database for long-term audit and verification
    const dbRecord = await prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });

    if (dbRecord) {
      if (dbRecord.status === IdempotencyStatus.PROCESSING) {
        return res.status(409).json({
          success: false,
          message: 'A transaction with this Idempotency-Key is currently in progress.',
        });
      }

      if (dbRecord.status === IdempotencyStatus.RESOLVED && dbRecord.responseBody) {
        return res.status(dbRecord.responseStatusCode || 200).json(JSON.parse(dbRecord.responseBody));
      }
    }

    // 3. Mark key as PROCESSING in Cache (expires in 60s in case worker crashes)
    await cacheSet(
      redisKey,
      JSON.stringify({ status: 'PROCESSING', requestHash: requestPayloadHash }),
      60
    );

    // Also persist in MySQL if user is authenticated
    if (req.user?.id) {
      await prisma.idempotencyKey.upsert({
        where: { key: idempotencyKey },
        create: {
          key: idempotencyKey,
          userId: req.user.id,
          requestPath: req.originalUrl,
          requestHash: requestPayloadHash,
          status: IdempotencyStatus.PROCESSING,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
        update: {
          status: IdempotencyStatus.PROCESSING,
        },
      });
    }

    // 4. Wrap res.json to capture response and commit idempotent record
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      const statusCode = res.statusCode;

      // Save to Cache with 24 hours TTL
      cacheSet(
        redisKey,
        JSON.stringify({
          status: 'RESOLVED',
          statusCode,
          body,
        }),
        86400
      ).catch((err) => console.error('Error caching idempotency record:', err));

      // Update DB record
      if (req.user?.id) {
        prisma.idempotencyKey.update({
          where: { key: idempotencyKey },
          data: {
            status: statusCode < 400 ? IdempotencyStatus.RESOLVED : IdempotencyStatus.REJECTED,
            responseStatusCode: statusCode,
            responseBody: JSON.stringify(body),
          },
        }).catch((err) => console.error('Error updating DB idempotency record:', err));
      }

      return originalJson(body);
    };

    next();
  } catch (error: any) {
    console.error('Idempotency middleware error:', error);
    next(error);
  }
};
