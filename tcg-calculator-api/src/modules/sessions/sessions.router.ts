import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import * as sessionsService from './sessions.service';

function getParam(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? (val[0] ?? '') : (val ?? '');
}

const router = Router();

// All session routes require authentication
router.use(authenticate);

const createSessionSchema = z.object({
  name: z.string().min(1, 'Session name is required').max(200),
  description: z.string().max(2000).optional(),
});

const updateSessionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
});

const listQuerySchema = z.object({
  search: z.string().optional(),
});

// GET /api/sessions
router.get('/', async (req: Request, res: Response) => {
  const { search } = listQuerySchema.parse(req.query);
  const sessions = await sessionsService.listSessions(search);
  res.status(200).json({ data: sessions, total: sessions.length });
});

// POST /api/sessions
router.post('/', async (req: Request, res: Response) => {
  const body = createSessionSchema.parse(req.body);
  const session = await sessionsService.createSession(req.user!.userId, body.name, body.description);
  res.status(201).json({ data: session });
});

// GET /api/sessions/:id
router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, 'id'), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid session ID', code: 'INVALID_ID' });
    return;
  }
  const session = await sessionsService.getSessionById(id);
  res.status(200).json({ data: session });
});

// PATCH /api/sessions/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, 'id'), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid session ID', code: 'INVALID_ID' });
    return;
  }
  const body = updateSessionSchema.parse(req.body);
  const session = await sessionsService.updateSession(id, body);
  res.status(200).json({ data: session });
});

// DELETE /api/sessions/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, 'id'), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid session ID', code: 'INVALID_ID' });
    return;
  }
  await sessionsService.deleteSession(id);
  res.status(200).json({ message: 'Session deleted successfully' });
});

export default router;
