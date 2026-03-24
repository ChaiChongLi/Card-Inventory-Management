import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';

export interface SessionListItem {
  id: number;
  name: string;
  description: string | null;
  userId: number;
  creatorUsername: string;
  skuCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkuItemWithPlatform {
  id: number;
  sessionId: number;
  platformId: number;
  name: string;
  productCost: number;
  shippingCost: number;
  customFeePercent: number | null;
  desiredMargin: number;
  quantity: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  platform: {
    id: number;
    slug: string;
    name: string;
    feePercent: number;
    isCustomizable: boolean;
  };
}

export interface SessionDetail {
  id: number;
  name: string;
  description: string | null;
  userId: number;
  creatorUsername: string;
  createdAt: Date;
  updatedAt: Date;
  skuItems: SkuItemWithPlatform[];
}

function serializeDecimal(value: { toString(): string } | null): number | null {
  if (value === null) return null;
  return parseFloat(value.toString());
}

export async function listSessions(search?: string): Promise<SessionListItem[]> {
  const where = {
    isDeleted: false,
    ...(search ? { name: { contains: search } } : {}),
  };

  const sessions = await prisma.session.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { username: true } },
      _count: {
        select: { skuItems: { where: { isDeleted: false } } },
      },
    },
  });

  return sessions.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    userId: s.userId,
    creatorUsername: s.user.username,
    skuCount: s._count.skuItems,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
}

export async function createSession(
  userId: number,
  name: string,
  description?: string,
): Promise<SessionDetail> {
  const session = await prisma.session.create({
    data: { name, description, userId, isDeleted: false },
    include: {
      user: { select: { username: true } },
    },
  });

  return {
    id: session.id,
    name: session.name,
    description: session.description,
    userId: session.userId,
    creatorUsername: session.user.username,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    skuItems: [],
  };
}

export async function getSessionById(id: number): Promise<SessionDetail> {
  const session = await prisma.session.findFirst({
    where: { id, isDeleted: false },
    include: {
      user: { select: { username: true } },
      skuItems: {
        where: { isDeleted: false },
        orderBy: { sortOrder: 'asc' },
        include: {
          platform: {
            select: {
              id: true,
              slug: true,
              name: true,
              feePercent: true,
              isCustomizable: true,
            },
          },
        },
      },
    },
  });

  if (!session) {
    throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');
  }

  return {
    id: session.id,
    name: session.name,
    description: session.description,
    userId: session.userId,
    creatorUsername: session.user.username,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    skuItems: session.skuItems.map((sku) => ({
      id: sku.id,
      sessionId: sku.sessionId,
      platformId: sku.platformId,
      name: sku.name,
      productCost: parseFloat(sku.productCost.toString()),
      shippingCost: parseFloat(sku.shippingCost.toString()),
      customFeePercent: serializeDecimal(sku.customFeePercent),
      desiredMargin: parseFloat(sku.desiredMargin.toString()),
      quantity: sku.quantity,
      sortOrder: sku.sortOrder,
      createdAt: sku.createdAt,
      updatedAt: sku.updatedAt,
      platform: {
        id: sku.platform.id,
        slug: sku.platform.slug,
        name: sku.platform.name,
        feePercent: parseFloat(sku.platform.feePercent.toString()),
        isCustomizable: sku.platform.isCustomizable,
      },
    })),
  };
}

export async function updateSession(
  id: number,
  updates: { name?: string; description?: string },
): Promise<{ id: number; name: string; description: string | null; updatedAt: Date }> {
  const existing = await prisma.session.findFirst({
    where: { id, isDeleted: false },
  });

  if (!existing) {
    throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');
  }

  const session = await prisma.session.update({
    where: { id },
    data: updates,
    select: { id: true, name: true, description: true, updatedAt: true },
  });

  return session;
}

export async function deleteSession(id: number): Promise<void> {
  const existing = await prisma.session.findFirst({
    where: { id, isDeleted: false },
  });

  if (!existing) {
    throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');
  }

  // Soft-delete session and all its child SKUs in a single transaction
  await prisma.$transaction([
    prisma.skuItem.updateMany({
      where: { sessionId: id, isDeleted: false },
      data: { isDeleted: true },
    }),
    prisma.session.update({
      where: { id },
      data: { isDeleted: true },
    }),
  ]);
}
