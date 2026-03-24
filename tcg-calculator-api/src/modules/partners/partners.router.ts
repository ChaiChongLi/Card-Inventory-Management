import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/admin.middleware';
import * as partnersService from './partners.service';

function getParam(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? (val[0] ?? '') : (val ?? '');
}

const router = Router();

router.use(authenticate, requireAdmin);

// GET /api/partners/available-users — users not yet linked to a partner
router.get('/available-users', async (_req: Request, res: Response) => {
  const users = await partnersService.getAvailableUsers();
  res.status(200).json({ data: users });
});

const createPartnerSchema = z.object({
  userId: z.number().int().positive('userId must be a positive integer'),
  displayName: z.string().min(1, 'Display name is required').max(100),
});

const updatePartnerSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/partners
router.get('/', async (_req: Request, res: Response) => {
  const partners = await partnersService.listPartners();
  res.status(200).json({ data: partners });
});

// POST /api/partners
router.post('/', async (req: Request, res: Response) => {
  const body = createPartnerSchema.parse(req.body);
  const partner = await partnersService.createPartner(body.userId, body.displayName);
  res.status(201).json({ data: partner });
});

// PATCH /api/partners/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, 'id'), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid partner ID', code: 'INVALID_ID' });
    return;
  }
  const body = updatePartnerSchema.parse(req.body);
  const partner = await partnersService.updatePartner(id, body);
  res.status(200).json({ data: partner });
});

// DELETE /api/partners/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, 'id'), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid partner ID', code: 'INVALID_ID' });
    return;
  }
  await partnersService.deletePartner(id);
  res.status(200).json({ message: 'Partner deleted successfully' });
});

export default router;
