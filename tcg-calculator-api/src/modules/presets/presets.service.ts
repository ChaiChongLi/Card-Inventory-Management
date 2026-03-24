import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';

export interface PresetItem {
  id: number;
  name: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function listPresets(): Promise<PresetItem[]> {
  return prisma.productPreset.findMany({
    where: { isDeleted: false },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, sortOrder: true, createdAt: true, updatedAt: true },
  });
}

export async function createPreset(data: { name: string; sortOrder?: number }): Promise<PresetItem> {
  const existing = await prisma.productPreset.findFirst({
    where: { name: data.name, isDeleted: false },
  });

  if (existing) {
    throw new AppError(409, 'PRESET_EXISTS', 'A preset with this name already exists');
  }

  return prisma.productPreset.create({
    data: {
      name: data.name,
      sortOrder: data.sortOrder ?? 0,
      isDeleted: false,
    },
    select: { id: true, name: true, sortOrder: true, createdAt: true, updatedAt: true },
  });
}

export async function updatePreset(
  id: number,
  updates: { name?: string; sortOrder?: number },
): Promise<PresetItem> {
  const existing = await prisma.productPreset.findFirst({
    where: { id, isDeleted: false },
  });

  if (!existing) {
    throw new AppError(404, 'PRESET_NOT_FOUND', 'Preset not found');
  }

  // If renaming, check for name uniqueness
  if (updates.name && updates.name !== existing.name) {
    const conflict = await prisma.productPreset.findFirst({
      where: { name: updates.name, isDeleted: false },
    });
    if (conflict) {
      throw new AppError(409, 'PRESET_EXISTS', 'A preset with this name already exists');
    }
  }

  return prisma.productPreset.update({
    where: { id },
    data: updates,
    select: { id: true, name: true, sortOrder: true, createdAt: true, updatedAt: true },
  });
}

export async function deletePreset(id: number): Promise<void> {
  const existing = await prisma.productPreset.findFirst({
    where: { id, isDeleted: false },
  });

  if (!existing) {
    throw new AppError(404, 'PRESET_NOT_FOUND', 'Preset not found');
  }

  await prisma.productPreset.update({
    where: { id },
    data: { isDeleted: true },
  });
}
