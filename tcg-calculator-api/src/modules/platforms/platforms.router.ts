import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/admin.middleware';
import * as platformsService from './platforms.service';

function getParam(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? (val[0] ?? '') : (val ?? '');
}

const router = Router();

// All platform routes require authentication
router.use(authenticate);

const createPlatformSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens only'),
  name: z.string().min(1).max(100),
  feePercent: z.number().min(0).max(100),
  isCustomizable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const updatePlatformSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  feePercent: z.number().min(0).max(100).optional(),
  isCustomizable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const reorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      sortOrder: z.number().int(),
    }),
  ).min(1),
});

// GET /api/platforms — all authenticated users
router.get('/', async (_req: Request, res: Response) => {
  const platforms = await platformsService.listPlatforms();
  res.status(200).json({ data: platforms });
});

// All write operations require admin
// Note: PATCH /reorder must be declared before /:id to avoid route conflict
router.patch('/reorder', requireAdmin, async (req: Request, res: Response) => {
  const body = reorderSchema.parse(req.body);
  await platformsService.reorderPlatforms(body.items);
  res.status(200).json({ message: 'Platforms reordered successfully' });
});

// POST /api/platforms
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  const body = createPlatformSchema.parse(req.body);
  const platform = await platformsService.createPlatform(body);
  res.status(201).json({ data: platform });
});

// PATCH /api/platforms/:id
router.patch('/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, 'id'), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid platform ID', code: 'INVALID_ID' });
    return;
  }
  const body = updatePlatformSchema.parse(req.body);
  const platform = await platformsService.updatePlatform(id, body);
  res.status(200).json({ data: platform });
});

// DELETE /api/platforms/:id
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, 'id'), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid platform ID', code: 'INVALID_ID' });
    return;
  }
  await platformsService.deletePlatform(id);
  res.status(200).json({ message: 'Platform deleted successfully' });
});

export default router;
