import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/admin.middleware';
import * as usersService from './users.service';

function getParam(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? (val[0] ?? '') : (val ?? '');
}

const router = Router();

// All user routes require authentication + admin role
router.use(authenticate, requireAdmin);

const createUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(100)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, underscores, dots, and hyphens'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

const updateUserSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[a-zA-Z0-9_.-]+$/)
    .optional(),
  password: z.string().min(6).max(128).optional(),
  isActive: z.boolean().optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

// GET /api/users
router.get('/', async (req: Request, res: Response) => {
  const { page, limit, search } = listQuerySchema.parse(req.query);
  const result = await usersService.listWorkers(page, limit, search);
  res.status(200).json(result);
});

// POST /api/users
router.post('/', async (req: Request, res: Response) => {
  const body = createUserSchema.parse(req.body);
  const user = await usersService.createWorker(body.username, body.password);
  res.status(201).json({ data: user });
});

// GET /api/users/:id
router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, 'id'), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid user ID', code: 'INVALID_ID' });
    return;
  }
  const user = await usersService.getUserById(id);
  res.status(200).json({ data: user });
});

// PATCH /api/users/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, 'id'), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid user ID', code: 'INVALID_ID' });
    return;
  }
  const body = updateUserSchema.parse(req.body);
  const user = await usersService.updateUser(id, body);
  res.status(200).json({ data: user });
});

// DELETE /api/users/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(getParam(req, 'id'), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid user ID', code: 'INVALID_ID' });
    return;
  }
  await usersService.deleteUser(id);
  res.status(200).json({ message: 'User deleted successfully' });
});

export default router;
