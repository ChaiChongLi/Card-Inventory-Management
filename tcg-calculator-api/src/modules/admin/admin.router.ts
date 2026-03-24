import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/admin.middleware';
import * as adminService from './admin.service';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin);

// GET /api/admin/dashboard
router.get('/dashboard', async (_req: Request, res: Response) => {
  const stats = await adminService.getDashboardStats();
  res.status(200).json({ data: stats });
});

export default router;
