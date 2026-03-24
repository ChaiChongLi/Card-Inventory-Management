import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import * as skusService from './skus.service';

// This router is mounted at /api/sessions/:sessionId/skus
// Express mergeParams must be true so we can read sessionId from the parent router
const router = Router({ mergeParams: true });

router.use(authenticate);

const skuItemSchema = z.object({
  id: z.number().int().positive().optional(),
  platformId: z.number().int().positive(),
  name: z.string().min(1, 'SKU name is required').max(200),
  productCost: z.number().min(0),
  shippingCost: z.number().min(0),
  customFeePercent: z.number().min(0).max(100).nullable().optional(),
  desiredMargin: z.number().min(0).max(100),
  quantity: z.number().int().positive().default(1),
  sortOrder: z.number().int().optional(),
});

const bulkReplaceSchema = z.array(skuItemSchema);

const updateSkuSchema = z.object({
  platformId: z.number().int().positive().optional(),
  name: z.string().min(1).max(200).optional(),
  productCost: z.number().min(0).optional(),
  shippingCost: z.number().min(0).optional(),
  customFeePercent: z.number().min(0).max(100).nullable().optional(),
  desiredMargin: z.number().min(0).max(100).optional(),
  quantity: z.number().int().positive().optional(),
  sortOrder: z.number().int().optional(),
});

function getParam(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? (val[0] ?? '') : (val ?? '');
}

function parseSessionId(req: Request, res: Response): number | null {
  const id = parseInt(getParam(req, 'sessionId'), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid session ID', code: 'INVALID_ID' });
    return null;
  }
  return id;
}

// PUT /api/sessions/:sessionId/skus — auto-save bulk replace
router.put('/', async (req: Request, res: Response) => {
  const sessionId = parseSessionId(req, res);
  if (sessionId === null) return;

  const items = bulkReplaceSchema.parse(req.body);
  const skus = await skusService.bulkReplaceSku(sessionId, items);
  res.status(200).json({ data: skus });
});

// PATCH /api/sessions/:sessionId/skus/:id — update single SKU
router.patch('/:id', async (req: Request, res: Response) => {
  const sessionId = parseSessionId(req, res);
  if (sessionId === null) return;

  const skuId = parseInt(getParam(req, 'id'), 10);
  if (isNaN(skuId)) {
    res.status(400).json({ error: 'Invalid SKU ID', code: 'INVALID_ID' });
    return;
  }

  const body = updateSkuSchema.parse(req.body);
  const sku = await skusService.updateSingleSku(sessionId, skuId, body);
  res.status(200).json({ data: sku });
});

export default router;
