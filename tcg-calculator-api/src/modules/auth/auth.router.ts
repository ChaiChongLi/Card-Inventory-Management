import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import * as authService from './auth.service';
import { env } from '../../config/env';

const router = Router();

const REFRESH_COOKIE_NAME = 'refreshToken';

// Strict rate limiting for auth endpoints to mitigate brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
});

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(100),
  password: z.string().min(1, 'Password is required'),
});

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/api/auth',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
}

// POST /api/auth/login
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  const body = loginSchema.parse(req.body);
  const result = await authService.loginUser(body.username, body.password);

  setRefreshCookie(res, result.refreshToken);

  res.status(200).json({
    accessToken: result.accessToken,
    user: result.user,
  });
});

// POST /api/auth/refresh
router.post('/refresh', authLimiter, async (req: Request, res: Response) => {
  const token: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!token) {
    res.status(401).json({ error: 'Refresh token not found', code: 'MISSING_REFRESH_TOKEN' });
    return;
  }

  const result = await authService.refreshAccessToken(token);
  res.status(200).json({ accessToken: result.accessToken, user: result.user });
});

// POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  const token: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME];

  if (token) {
    await authService.logoutUser(token);
  }

  clearRefreshCookie(res);
  res.status(200).json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response) => {
  const user = await authService.getCurrentUser(req.user!.userId);
  res.status(200).json({ data: user });
});

export default router;
