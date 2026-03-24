import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import * as dashboardService from './dashboard.service';

const router = Router();

router.use(authenticate);

// GET /api/dashboard?period=30d|all
router.get('/', async (req: Request, res: Response) => {
  const period = req.query['period'] === 'all' ? 'all' : '30d';
  const stats = await dashboardService.getDashboardStats(period);
  res.status(200).json({ data: stats });
});

export default router;
