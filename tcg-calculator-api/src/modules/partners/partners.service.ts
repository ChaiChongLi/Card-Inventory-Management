import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';

export interface PartnerItem {
  id: number;
  displayName: string;
  isActive: boolean;
  userId: number;
  username: string;
  createdAt: Date;
}

export async function listPartners(): Promise<PartnerItem[]> {
  const partners = await prisma.partner.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { username: true } },
    },
  });

  return partners.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    isActive: p.isActive,
    userId: p.userId,
    username: p.user.username,
    createdAt: p.createdAt,
  }));
}

export async function createPartner(userId: number, displayName: string): Promise<PartnerItem> {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
    select: { id: true, username: true },
  });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const existing = await prisma.partner.findFirst({
    where: { userId, isDeleted: false },
  });

  if (existing) {
    throw new AppError(409, 'PARTNER_ALREADY_EXISTS', 'This user is already linked to a partner');
  }

  const partner = await prisma.partner.create({
    data: { userId, displayName, isActive: true, isDeleted: false },
    include: {
      user: { select: { username: true } },
    },
  });

  return {
    id: partner.id,
    displayName: partner.displayName,
    isActive: partner.isActive,
    userId: partner.userId,
    username: partner.user.username,
    createdAt: partner.createdAt,
  };
}

export async function updatePartner(
  id: number,
  updates: { displayName?: string; isActive?: boolean },
): Promise<PartnerItem> {
  const existing = await prisma.partner.findFirst({
    where: { id, isDeleted: false },
  });

  if (!existing) {
    throw new AppError(404, 'PARTNER_NOT_FOUND', 'Partner not found');
  }

  const partner = await prisma.partner.update({
    where: { id },
    data: updates,
    include: {
      user: { select: { username: true } },
    },
  });

  return {
    id: partner.id,
    displayName: partner.displayName,
    isActive: partner.isActive,
    userId: partner.userId,
    username: partner.user.username,
    createdAt: partner.createdAt,
  };
}

export async function deletePartner(id: number): Promise<void> {
  const existing = await prisma.partner.findFirst({
    where: { id, isDeleted: false },
  });

  if (!existing) {
    throw new AppError(404, 'PARTNER_NOT_FOUND', 'Partner not found');
  }

  await prisma.partner.update({
    where: { id },
    data: { isDeleted: true },
  });
}

export async function getAvailableUsers(): Promise<Array<{ id: number; username: string; role: string }>> {
  // Get all non-deleted active users who don't already have a partner
  const users = await prisma.user.findMany({
    where: {
      isDeleted: false,
      isActive: true,
      partner: null,  // no partner linked yet
    },
    select: { id: true, username: true, role: true },
    orderBy: { username: 'asc' },
  });
  return users;
}
