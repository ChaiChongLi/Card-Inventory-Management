import 'dotenv/config';
// Must be imported first to patch async error handling before routes are registered
import 'express-async-errors';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { prisma } from './config/database';
import { errorHandler } from './middleware/error.middleware';

// Routers
import authRouter from './modules/auth/auth.router';
import usersRouter from './modules/users/users.router';
import platformsRouter from './modules/platforms/platforms.router';
import sessionsRouter from './modules/sessions/sessions.router';
import skusRouter from './modules/skus/skus.router';
import presetsRouter from './modules/presets/presets.router';
import adminRouter from './modules/admin/admin.router';
import dashboardRouter from './modules/dashboard/dashboard.router';
import partnersRouter from './modules/partners/partners.router';
import batchesRouter from './modules/batches/batches.router';
import shopPurchasesRouter from './modules/shop-purchases/shop-purchases.router';

const app = express();

// ------------------------------------------------------------------
// Security middleware
// ------------------------------------------------------------------
app.use(helmet());

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true, // Required for HttpOnly cookies to be sent cross-origin
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Global rate limiter — generous for general API usage
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
});
app.use(globalLimiter);

// ------------------------------------------------------------------
// Body parsing
// ------------------------------------------------------------------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ------------------------------------------------------------------
// Health check (unauthenticated)
// ------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ------------------------------------------------------------------
// API Routes
// ------------------------------------------------------------------
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/platforms', platformsRouter);
app.use('/api/sessions', sessionsRouter);
// SKU router is mounted with mergeParams so it can read :sessionId from the parent path
app.use('/api/sessions/:sessionId/skus', skusRouter);
app.use('/api/presets', presetsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/partners', partnersRouter);
app.use('/api/batches', batchesRouter);
app.use('/api/shop-purchases', shopPurchasesRouter);

// ------------------------------------------------------------------
// 404 handler for unmatched routes
// ------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' });
});

// ------------------------------------------------------------------
// Centralized error handler (must be last)
// ------------------------------------------------------------------
app.use(errorHandler);

// ------------------------------------------------------------------
// Server startup
// ------------------------------------------------------------------
async function startServer(): Promise<void> {
  try {
    // Verify database connection before accepting traffic
    await prisma.$connect();
    console.log('Database connection established.');

    app.listen(env.PORT, () => {
      console.log(`TCG Calculator API running on port ${env.PORT} [${env.NODE_ENV}]`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Handle unhandled rejections as fatal errors in production
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  if (env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

startServer();

export default app;
