import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';

const SALT_ROUNDS = 10;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

export interface UserListItem {
  id: number;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedUsers {
  data: UserListItem[];
  total: number;
  page: number;
  limit: number;
}

export async function listWorkers(
  page: number = DEFAULT_PAGE,
  limit: number = DEFAULT_LIMIT,
  search?: string,
): Promise<PaginatedUsers> {
  const skip = (page - 1) * limit;

  const where = {
    isDeleted: false,
    role: 'WORKER' as const,
    ...(search ? { username: { contains: search } } : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, username: true, role: true, isActive: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { data: users, total, page, limit };
}

export async function createWorker(
  username: string,
  password: string,
): Promise<UserListItem> {
  const existing = await prisma.user.findFirst({
    where: { username, isDeleted: false },
  });

  if (existing) {
    throw new AppError(409, 'USERNAME_TAKEN', 'Username is already taken');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: 'WORKER',
      isActive: true,
      isDeleted: false,
    },
    select: { id: true, username: true, role: true, isActive: true, createdAt: true, updatedAt: true },
  });

  return user;
}

export async function getUserById(id: number): Promise<UserListItem> {
  const user = await prisma.user.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, username: true, role: true, isActive: true, createdAt: true, updatedAt: true },
  });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  return user;
}

export async function updateUser(
  id: number,
  updates: { username?: string; password?: string; isActive?: boolean },
): Promise<UserListItem> {
  const existing = await prisma.user.findFirst({
    where: { id, isDeleted: false },
  });

  if (!existing) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  // Check username uniqueness if changing
  if (updates.username && updates.username !== existing.username) {
    const conflict = await prisma.user.findFirst({
      where: { username: updates.username, isDeleted: false },
    });
    if (conflict) {
      throw new AppError(409, 'USERNAME_TAKEN', 'Username is already taken');
    }
  }

  const data: Record<string, unknown> = {};
  if (updates.username !== undefined) data['username'] = updates.username;
  if (updates.isActive !== undefined) data['isActive'] = updates.isActive;
  if (updates.password !== undefined) {
    data['passwordHash'] = await bcrypt.hash(updates.password, SALT_ROUNDS);
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, username: true, role: true, isActive: true, createdAt: true, updatedAt: true },
  });

  return user;
}

export async function deleteUser(id: number): Promise<void> {
  const existing = await prisma.user.findFirst({
    where: { id, isDeleted: false },
  });

  if (!existing) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  if (existing.role === 'ADMIN') {
    throw new AppError(403, 'CANNOT_DELETE_ADMIN', 'Admin account cannot be deleted');
  }

  await prisma.user.update({
    where: { id },
    data: { isDeleted: true },
  });
}
