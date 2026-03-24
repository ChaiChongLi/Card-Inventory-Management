import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/admin.middleware';
import { shopPurchasesService } from './shop-purchases.service';
import { AppError } from '../../middleware/error.middleware';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

const purchaseSchema = z.object({
  buyerName: z.string().min(1).max(200),
  itemName: z.string().min(1).max(200),
  quantity: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'purchaseDate must be YYYY-MM-DD'),
  category: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

const updateSchema = purchaseSchema.partial();

// GET /api/shop-purchases
router.get('/', async (_req, res) => {
  const records = await shopPurchasesService.list();
  res.json({ data: records });
});

// POST /api/shop-purchases
router.post('/', async (req, res) => {
  const dto = purchaseSchema.parse(req.body);
  const record = await shopPurchasesService.create(dto);
  res.status(201).json({ data: record });
});

// PATCH /api/shop-purchases/:id
router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id || id < 1) throw new AppError(400, 'INVALID_ID', 'Invalid purchase ID');
  const dto = updateSchema.parse(req.body);
  const record = await shopPurchasesService.update(id, dto);
  res.json({ data: record });
});

// DELETE /api/shop-purchases/:id
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id || id < 1) throw new AppError(400, 'INVALID_ID', 'Invalid purchase ID');
  await shopPurchasesService.remove(id);
  res.status(204).send();
});

export default router;
