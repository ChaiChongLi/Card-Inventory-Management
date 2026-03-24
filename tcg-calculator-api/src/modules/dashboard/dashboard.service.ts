import { prisma } from '../../config/database';

export interface DashboardStats {
  openBatches: number;
  closedBatches: number;
  totalRevenue: number;
  shopPurchasesSpend: number;
  revenuePerDay: Array<{ date: string; revenue: number }>;
  revenueByPlatform: Array<{ platform: string; revenue: number }>;
  recentBatches: Array<{
    id: number;
    name: string;
    status: string;
    itemCount: number;
    revenue: number;
    createdAt: string;
  }>;
}

export async function getDashboardStats(period: '30d' | 'all'): Promise<DashboardStats> {
  const now = new Date();

  // Date filter for totals (30d = last 30 days, all = no filter)
  const totalSince =
    period === '30d' ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) : null;

  // Date range for chart (30d = 30 days daily, all = 12 months monthly)
  const chartSince =
    period === '30d'
      ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      : new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const saleWhere = {
    isDeleted: false,
    ...(totalSince ? { createdAt: { gte: totalSince } } : {}),
  };

  const shopWhere = {
    isDeleted: false,
    ...(totalSince ? { createdAt: { gte: totalSince } } : {}),
  };

  const [
    openBatches,
    closedBatches,
    saleRecords,
    shopPurchases,
    recentBatchesRaw,
    chartSaleRecords,
  ] = await Promise.all([
    prisma.batch.count({ where: { isDeleted: false, status: 'OPEN' } }),
    prisma.batch.count({ where: { isDeleted: false, status: 'CLOSED' } }),
    prisma.saleRecord.findMany({
      where: saleWhere,
      select: {
        quantity: true,
        unitSalePrice: true,
        platform: { select: { name: true } },
      },
    }),
    prisma.shopPurchase.findMany({
      where: shopWhere,
      select: { quantity: true, unitCost: true },
    }),
    prisma.batch.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        _count: { select: { batchItems: { where: { isDeleted: false } } } },
        batchItems: {
          where: { isDeleted: false },
          include: {
            saleRecords: {
              where: { isDeleted: false },
              select: { quantity: true, unitSalePrice: true },
            },
          },
        },
      },
    }),
    prisma.saleRecord.findMany({
      where: { isDeleted: false, createdAt: { gte: chartSince } },
      select: { quantity: true, unitSalePrice: true, createdAt: true },
    }),
  ]);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalRevenue = saleRecords.reduce(
    (sum, r) => sum + r.quantity * Number(r.unitSalePrice),
    0,
  );

  const shopPurchasesSpend = shopPurchases.reduce(
    (sum, p) => sum + p.quantity * Number(p.unitCost),
    0,
  );

  // ── Revenue by platform ────────────────────────────────────────────────────
  const platformMap = new Map<string, number>();
  for (const r of saleRecords) {
    const name = r.platform?.name ?? 'Other';
    platformMap.set(name, (platformMap.get(name) ?? 0) + r.quantity * Number(r.unitSalePrice));
  }
  const revenueByPlatform = [...platformMap.entries()]
    .map(([platform, revenue]) => ({ platform, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  // ── Revenue per day / month (chart) ────────────────────────────────────────
  let revenuePerDay: Array<{ date: string; revenue: number }>;

  if (period === '30d') {
    const dayMap = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(chartSince.getTime() + i * 24 * 60 * 60 * 1000);
      dayMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const r of chartSaleRecords) {
      const key = r.createdAt.toISOString().slice(0, 10);
      if (dayMap.has(key))
        dayMap.set(key, (dayMap.get(key) ?? 0) + r.quantity * Number(r.unitSalePrice));
    }
    revenuePerDay = [...dayMap.entries()].map(([date, revenue]) => ({ date, revenue }));
  } else {
    // Monthly buckets: last 12 months
    const monthMap = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, 0);
    }
    for (const r of chartSaleRecords) {
      const d = r.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthMap.has(key))
        monthMap.set(key, (monthMap.get(key) ?? 0) + r.quantity * Number(r.unitSalePrice));
    }
    revenuePerDay = [...monthMap.entries()].map(([date, revenue]) => ({ date, revenue }));
  }

  // ── Recent batches ─────────────────────────────────────────────────────────
  const recentBatches = recentBatchesRaw.map((b) => {
    const revenue = b.batchItems.reduce(
      (sum, item) =>
        sum +
        item.saleRecords.reduce((s, r) => s + r.quantity * Number(r.unitSalePrice), 0),
      0,
    );
    return {
      id: b.id,
      name: b.name,
      status: b.status,
      itemCount: b._count.batchItems,
      revenue,
      createdAt: b.createdAt.toISOString(),
    };
  });

  return {
    openBatches,
    closedBatches,
    totalRevenue,
    shopPurchasesSpend,
    revenuePerDay,
    revenueByPlatform,
    recentBatches,
  };
}
