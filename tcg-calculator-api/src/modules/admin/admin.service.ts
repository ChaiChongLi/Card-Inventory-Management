import { prisma } from '../../config/database';

export interface DashboardStats {
  totalWorkers: number;
  activeSessions: number;
  totalSessions: number;
  recentSessions: Array<{
    id: number;
    name: string;
    description: string | null;
    creatorUsername: string;
    skuCount: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const RECENT_SESSION_LIMIT = 10;

  const [totalWorkers, activeSessions, totalSessions, recentSessions] = await Promise.all([
    // Count active, non-deleted workers
    prisma.user.count({
      where: { role: 'WORKER', isDeleted: false, isActive: true },
    }),

    // Sessions that have been accessed in the last 7 days (not deleted)
    prisma.session.count({
      where: {
        isDeleted: false,
        updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),

    // All non-deleted sessions ever
    prisma.session.count({
      where: { isDeleted: false },
    }),

    // Most recently updated sessions
    prisma.session.findMany({
      where: { isDeleted: false },
      orderBy: { updatedAt: 'desc' },
      take: RECENT_SESSION_LIMIT,
      include: {
        user: { select: { username: true } },
        _count: {
          select: { skuItems: { where: { isDeleted: false } } },
        },
      },
    }),
  ]);

  return {
    totalWorkers,
    activeSessions,
    totalSessions,
    recentSessions: recentSessions.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      creatorUsername: s.user.username,
      skuCount: s._count.skuItems,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
  };
}
