import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';

export interface PlatformItem {
  id: number;
  slug: string;
  name: string;
  feePercent: number;
  isCustomizable: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// Prisma returns Decimal as a string-like object; convert to number for JSON
function serializePlatform(p: {
  id: number;
  slug: string;
  name: string;
  feePercent: { toString(): string };
  isCustomizable: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): PlatformItem {
  return {
    ...p,
    feePercent: parseFloat(p.feePercent.toString()),
  };
}

export async function listPlatforms(): Promise<PlatformItem[]> {
  const platforms = await prisma.platform.findMany({
    where: { isDeleted: false, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  return platforms.map(serializePlatform);
}

export async function createPlatform(data: {
  slug: string;
  name: string;
  feePercent: number;
  isCustomizable?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<PlatformItem> {
  const existing = await prisma.platform.findFirst({
    where: { slug: data.slug, isDeleted: false },
  });

  if (existing) {
    throw new AppError(409, 'SLUG_TAKEN', 'A platform with this slug already exists');
  }

  const platform = await prisma.platform.create({
    data: {
      slug: data.slug,
      name: data.name,
      feePercent: data.feePercent,
      isCustomizable: data.isCustomizable ?? false,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
      isDeleted: false,
    },
  });

  return serializePlatform(platform);
}

export async function updatePlatform(
  id: number,
  updates: {
    name?: string;
    feePercent?: number;
    isCustomizable?: boolean;
    isActive?: boolean;
    sortOrder?: number;
  },
): Promise<PlatformItem> {
  const existing = await prisma.platform.findFirst({
    where: { id, isDeleted: false },
  });

  if (!existing) {
    throw new AppError(404, 'PLATFORM_NOT_FOUND', 'Platform not found');
  }

  const platform = await prisma.platform.update({
    where: { id },
    data: updates,
  });

  return serializePlatform(platform);
}

export async function deletePlatform(id: number): Promise<void> {
  const existing = await prisma.platform.findFirst({
    where: { id, isDeleted: false },
  });

  if (!existing) {
    throw new AppError(404, 'PLATFORM_NOT_FOUND', 'Platform not found');
  }

  await prisma.platform.update({
    where: { id },
    data: { isDeleted: true },
  });
}

export async function reorderPlatforms(
  items: Array<{ id: number; sortOrder: number }>,
): Promise<void> {
  // Run all updates in a transaction to ensure atomicity
  await prisma.$transaction(
    items.map((item) =>
      prisma.platform.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      }),
    ),
  );
}
