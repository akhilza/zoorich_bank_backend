import dotenv from 'dotenv';
dotenv.config();

export const config = {
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
  security: {
    maxPinAttempts: 3,
    pinLockoutMinutes: 15,
    maxDailyTransferAmount: 10000,
    transferVelocityLimitPerMinute: 5,
  }
};
