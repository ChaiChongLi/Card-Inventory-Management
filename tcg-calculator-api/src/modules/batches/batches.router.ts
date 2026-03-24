import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/admin.middleware';
import * as batchesService from './batches.service';

function getParam(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? (val[0] ?? '') : (val ?? '');
}

const router = Router();
router.use(authenticate, requireAdmin);

// ── Validation schemas ────────────────────────────────────────────────────────

const createBatchSchema = z.object({
  name: z.string().min(1, 'Batch name is required').max(200),
  description: z.string().max(2000).optional(),
});

const updateBatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  deliveryFee: z.number().nonnegative().optional(),
  otherFees: z.number().nonnegative().optional(),
});

const createItemSchema = z.object({
  itemName: z.string().min(1, 'Item name is required').max(200),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  unitCost: z.number().nonnegative('Unit cost must be non-negative'),
  notes: z.string().max(500).optional(),
});

const updateItemSchema = z.object({
  itemName: z.string().min(1).max(200).optional(),
  quantity: z.number().int().positive().optional(),
  unitCost: z.number().nonnegative().optional(),
  notes: z.string().max(500).nullable().optional(),
});

const createSaleRecordSchema = z.object({
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  unitSalePrice: z.number().nonnegative('Sale price must be non-negative'),
  platformId: z.number().int().positive().nullable().optional(),
  notes: z.string().max(500).optional(),
});

const updateSaleRecordSchema = z.object({
  quantity: z.number().int().positive().optional(),
  unitSalePrice: z.number().nonnegative().optional(),
  platformId: z.number().int().positive().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

const upsertDistributionSchema = z.object({
  retainedMode: z.enum(['FIXED_AMOUNT', 'PERCENTAGE']),
  retainedValue: z.number().nonnegative(),
  notes: z.string().max(2000).optional(),
  shares: z.array(z.object({
    partnerId: z.number().int().positive(),
    percentage: z.number().min(0).max(100),
  })).min(1, 'At least one share is required'),
});

// ── Batch CRUD ────────────────────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response) => {
  const batches = await batchesService.listBatches();
  res.status(200).json({ data: batches });
});

router.post('/', async (req: Request, res: Response) => {
  const body = createBatchSchema.parse(req.body);
  const batch = await batchesService.createBatch(body.name, body.description);
  res.status(201).json({ data: batch });
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, 'id'), 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid batch ID', code: 'INVALID_ID' }); return; }
  const batch = await batchesService.getBatch(id);
  res.status(200).json({ data: batch });
});

router.patch('/:id', async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, 'id'), 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid batch ID', code: 'INVALID_ID' }); return; }
  const body = updateBatchSchema.parse(req.body);
  const batch = await batchesService.updateBatch(id, body);
  res.status(200).json({ data: batch });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, 'id'), 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid batch ID', code: 'INVALID_ID' }); return; }
  await batchesService.deleteBatch(id);
  res.status(200).json({ message: 'Batch deleted' });
});

router.post('/:id/close', async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, 'id'), 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid batch ID', code: 'INVALID_ID' }); return; }
  const batch = await batchesService.closeBatch(id);
  res.status(200).json({ data: batch });
});

// ── Batch Items ───────────────────────────────────────────────────────────────

router.get('/:id/items', async (req: Request, res: Response) => {
  const batchId = parseInt(getParam(req, 'id'), 10);
  if (isNaN(batchId)) { res.status(400).json({ error: 'Invalid batch ID', code: 'INVALID_ID' }); return; }
  const items = await batchesService.listItems(batchId);
  res.status(200).json({ data: items });
});

router.post('/:id/items', async (req: Request, res: Response) => {
  const batchId = parseInt(getParam(req, 'id'), 10);
  if (isNaN(batchId)) { res.status(400).json({ error: 'Invalid batch ID', code: 'INVALID_ID' }); return; }
  const body = createItemSchema.parse(req.body);
  const item = await batchesService.createItem(batchId, body);
  res.status(201).json({ data: item });
});

router.patch('/:id/items/:itemId', async (req: Request, res: Response) => {
  const batchId = parseInt(getParam(req, 'id'), 10);
  const itemId = parseInt(getParam(req, 'itemId'), 10);
  if (isNaN(batchId) || isNaN(itemId)) { res.status(400).json({ error: 'Invalid ID', code: 'INVALID_ID' }); return; }
  const body = updateItemSchema.parse(req.body);
  const item = await batchesService.updateItem(batchId, itemId, body);
  res.status(200).json({ data: item });
});

router.delete('/:id/items/:itemId', async (req: Request, res: Response) => {
  const batchId = parseInt(getParam(req, 'id'), 10);
  const itemId = parseInt(getParam(req, 'itemId'), 10);
  if (isNaN(batchId) || isNaN(itemId)) { res.status(400).json({ error: 'Invalid ID', code: 'INVALID_ID' }); return; }
  await batchesService.deleteItem(batchId, itemId);
  res.status(200).json({ message: 'Item deleted' });
});

// ── Sale Records ──────────────────────────────────────────────────────────────

router.get('/:id/items/:itemId/sales', async (req: Request, res: Response) => {
  const batchId = parseInt(getParam(req, 'id'), 10);
  const itemId = parseInt(getParam(req, 'itemId'), 10);
  if (isNaN(batchId) || isNaN(itemId)) { res.status(400).json({ error: 'Invalid ID', code: 'INVALID_ID' }); return; }
  const sales = await batchesService.listSaleRecords(batchId, itemId);
  res.status(200).json({ data: sales });
});

router.post('/:id/items/:itemId/sales', async (req: Request, res: Response) => {
  const batchId = parseInt(getParam(req, 'id'), 10);
  const itemId = parseInt(getParam(req, 'itemId'), 10);
  if (isNaN(batchId) || isNaN(itemId)) { res.status(400).json({ error: 'Invalid ID', code: 'INVALID_ID' }); return; }
  const body = createSaleRecordSchema.parse(req.body);
  const item = await batchesService.createSaleRecord(batchId, itemId, body);
  res.status(201).json({ data: item });
});

router.patch('/:id/items/:itemId/sales/:saleId', async (req: Request, res: Response) => {
  const batchId = parseInt(getParam(req, 'id'), 10);
  const itemId = parseInt(getParam(req, 'itemId'), 10);
  const saleId = parseInt(getParam(req, 'saleId'), 10);
  if (isNaN(batchId) || isNaN(itemId) || isNaN(saleId)) { res.status(400).json({ error: 'Invalid ID', code: 'INVALID_ID' }); return; }
  const body = updateSaleRecordSchema.parse(req.body);
  const item = await batchesService.updateSaleRecord(batchId, itemId, saleId, body);
  res.status(200).json({ data: item });
});

router.delete('/:id/items/:itemId/sales/:saleId', async (req: Request, res: Response) => {
  const batchId = parseInt(getParam(req, 'id'), 10);
  const itemId = parseInt(getParam(req, 'itemId'), 10);
  const saleId = parseInt(getParam(req, 'saleId'), 10);
  if (isNaN(batchId) || isNaN(itemId) || isNaN(saleId)) { res.status(400).json({ error: 'Invalid ID', code: 'INVALID_ID' }); return; }
  const item = await batchesService.deleteSaleRecord(batchId, itemId, saleId);
  res.status(200).json({ data: item });
});

// ── Distribution ──────────────────────────────────────────────────────────────

router.get('/:id/distribution', async (req: Request, res: Response) => {
  const batchId = parseInt(getParam(req, 'id'), 10);
  if (isNaN(batchId)) { res.status(400).json({ error: 'Invalid batch ID', code: 'INVALID_ID' }); return; }
  const distribution = await batchesService.getDistribution(batchId);
  res.status(200).json({ data: distribution });
});

router.post('/:id/distribution', async (req: Request, res: Response) => {
  const batchId = parseInt(getParam(req, 'id'), 10);
  if (isNaN(batchId)) { res.status(400).json({ error: 'Invalid batch ID', code: 'INVALID_ID' }); return; }
  const body = upsertDistributionSchema.parse(req.body);
  const distribution = await batchesService.upsertDistribution(batchId, body);
  res.status(200).json({ data: distribution });
});

export default router;
