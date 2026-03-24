import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/admin.middleware';
import * as presetsService from './presets.service';

function getParam(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? (val[0] ?? '') : (val ?? '');
}

const router = Router();

router.use(authenticate);

const createPresetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  sortOrder: z.number().int().optional(),
});

const updatePresetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sortOrder: z.number().int().optional(),
});

// GET /api/presets — all authenticated users
router.get('/', async (_req: Request, res: Response) => {
  const presets = await presetsService.listPresets();
  res.status(200).json({ data: presets });
});

// POST /api/presets — admin only
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  const body = createPresetSchema.parse(req.body);
  const preset = await presetsService.createPreset(body);
  res.status(201).json({ data: preset });
});

// PATCH /api/presets/:id — admin only
router.patch('/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, 'id'), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid preset ID', code: 'INVALID_ID' });
    return;
  }
  const body = updatePresetSchema.parse(req.body);
  const preset = await presetsService.updatePreset(id, body);
  res.status(200).json({ data: preset });
});

// DELETE /api/presets/:id — admin only
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, 'id'), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid preset ID', code: 'INVALID_ID' });
    return;
  }
  await presetsService.deletePreset(id);
  res.status(200).json({ message: 'Preset deleted successfully' });
});

export default router;
