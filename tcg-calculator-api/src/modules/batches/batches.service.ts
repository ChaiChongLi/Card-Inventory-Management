import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';

export interface BatchSummary {
  id: number;
  name: string;
  description: string | null;
  status: string;
  itemCount: number;
  soldCount: number;       // items that have at least one sale record
  totalCost: number;       // cost of all items purchased + batch-level fees
  totalRevenue: number;    // revenue from all sale records
  grossProfit: number;
  deliveryFee: number;     // batch-level delivery/shipping overhead
  otherFees: number;       // batch-level other overhead fees
  hasDistribution: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaleRecord {
  id: number;
  batchItemId: number;
  quantity: number;
  unitSalePrice: number;
  platformId: number | null;
  platformName: string | null;
  platformSlug: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BatchItem {
  id: number;
  batchId: number;
  itemName: string;
  quantity: number;          // total purchased
  unitCost: number;
  soldQuantity: number;      // sum of sale records' quantities
  unsoldQuantity: number;    // quantity - soldQuantity
  totalCost: number;         // quantity * unitCost
  totalRevenue: number;      // sum of saleRecords (qty * price)
  profit: number;            // totalRevenue - totalCost
  notes: string | null;
  saleRecords: SaleRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DistributionDetail {
  id: number;
  batchId: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  retainedMode: string;
  retainedValue: number;
  retainedAmount: number;
  distributedAmount: number;
  notes: string | null;
  shares: Array<{
    id: number;
    partnerId: number;
    partnerName: string;
    percentage: number;
    amount: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

function toNum(value: { toString(): string }): number {
  return Number(value.toString());
}

function mapSaleRecord(sr: {
  id: number;
  batchItemId: number;
  quantity: number;
  unitSalePrice: { toString(): string };
  platformId: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  platform: { name: string; slug: string } | null;
}): SaleRecord {
  return {
    id: sr.id,
    batchItemId: sr.batchItemId,
    quantity: sr.quantity,
    unitSalePrice: toNum(sr.unitSalePrice),
    platformId: sr.platformId,
    platformName: sr.platform?.name ?? null,
    platformSlug: sr.platform?.slug ?? null,
    notes: sr.notes,
    createdAt: sr.createdAt,
    updatedAt: sr.updatedAt,
  };
}

const SALE_RECORD_INCLUDE = {
  platform: { select: { name: true, slug: true } },
} as const;

function mapBatchItem(item: {
  id: number;
  batchId: number;
  itemName: string;
  quantity: number;
  unitCost: { toString(): string };
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  saleRecords: Array<{
    id: number;
    batchItemId: number;
    quantity: number;
    unitSalePrice: { toString(): string };
    platformId: number | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    platform: { name: string; slug: string } | null;
  }>;
}): BatchItem {
  const unitCost = toNum(item.unitCost);
  const totalCost = item.quantity * unitCost;
  const soldQuantity = item.saleRecords.reduce((sum, sr) => sum + sr.quantity, 0);
  const totalRevenue = item.saleRecords.reduce((sum, sr) => sum + sr.quantity * toNum(sr.unitSalePrice), 0);

  return {
    id: item.id,
    batchId: item.batchId,
    itemName: item.itemName,
    quantity: item.quantity,
    unitCost,
    soldQuantity,
    unsoldQuantity: item.quantity - soldQuantity,
    totalCost,
    totalRevenue,
    profit: totalRevenue - totalCost,
    notes: item.notes,
    saleRecords: item.saleRecords.map(mapSaleRecord),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

const ITEM_INCLUDE = {
  saleRecords: {
    where: { isDeleted: false },
    orderBy: { createdAt: 'asc' as const },
    include: SALE_RECORD_INCLUDE,
  },
} as const;

function buildBatchSummary(batch: {
  id: number;
  name: string;
  description: string | null;
  status: string;
  deliveryFee: { toString(): string };
  otherFees: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
  batchItems: Array<{
    quantity: number;
    unitCost: { toString(): string };
    saleRecords: Array<{ quantity: number; unitSalePrice: { toString(): string } }>;
  }>;
  distribution: { id: number } | null;
}): BatchSummary {
  let itemsCost = 0;
  let totalRevenue = 0;
  let soldCount = 0;

  for (const item of batch.batchItems) {
    itemsCost += item.quantity * toNum(item.unitCost);
    const itemRevenue = item.saleRecords.reduce((sum, sr) => sum + sr.quantity * toNum(sr.unitSalePrice), 0);
    totalRevenue += itemRevenue;
    if (item.saleRecords.length > 0) soldCount++;
  }

  const deliveryFee = toNum(batch.deliveryFee);
  const otherFees = toNum(batch.otherFees);
  const totalCost = itemsCost + deliveryFee + otherFees;

  return {
    id: batch.id,
    name: batch.name,
    description: batch.description,
    status: batch.status,
    itemCount: batch.batchItems.length,
    soldCount,
    totalCost,
    totalRevenue,
    grossProfit: totalRevenue - totalCost,
    deliveryFee,
    otherFees,
    hasDistribution: batch.distribution !== null,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
  };
}

const BATCH_SUMMARY_INCLUDE = {
  batchItems: {
    where: { isDeleted: false },
    select: {
      quantity: true,
      unitCost: true,
      saleRecords: {
        where: { isDeleted: false },
        select: { quantity: true, unitSalePrice: true },
      },
    },
  },
  distribution: {
    where: { isDeleted: false },
    select: { id: true },
  },
} as const;

const DISTRIBUTION_INCLUDE = {
  shares: {
    where: { isDeleted: false },
    orderBy: { id: 'asc' as const },
    include: { partner: { select: { displayName: true } } },
  },
} as const;

function mapDistribution(dist: {
  id: number;
  batchId: number;
  totalRevenue: { toString(): string };
  totalCost: { toString(): string };
  grossProfit: { toString(): string };
  retainedMode: string;
  retainedValue: { toString(): string };
  retainedAmount: { toString(): string };
  distributedAmount: { toString(): string };
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  shares: Array<{
    id: number;
    partnerId: number;
    percentage: { toString(): string };
    amount: { toString(): string };
    partner: { displayName: string };
  }>;
}): DistributionDetail {
  return {
    id: dist.id,
    batchId: dist.batchId,
    totalRevenue: toNum(dist.totalRevenue),
    totalCost: toNum(dist.totalCost),
    grossProfit: toNum(dist.grossProfit),
    retainedMode: dist.retainedMode,
    retainedValue: toNum(dist.retainedValue),
    retainedAmount: toNum(dist.retainedAmount),
    distributedAmount: toNum(dist.distributedAmount),
    notes: dist.notes,
    shares: dist.shares.map((s) => ({
      id: s.id,
      partnerId: s.partnerId,
      partnerName: s.partner.displayName,
      percentage: toNum(s.percentage),
      amount: toNum(s.amount),
    })),
    createdAt: dist.createdAt,
    updatedAt: dist.updatedAt,
  };
}

// ── Batch CRUD ────────────────────────────────────────────────────────────────

export async function listBatches(): Promise<BatchSummary[]> {
  const batches = await prisma.batch.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: 'desc' },
    include: BATCH_SUMMARY_INCLUDE,
  });
  return batches.map(buildBatchSummary);
}

export async function getBatch(id: number): Promise<BatchSummary> {
  const batch = await prisma.batch.findFirst({
    where: { id, isDeleted: false },
    include: BATCH_SUMMARY_INCLUDE,
  });
  if (!batch) throw new AppError(404, 'BATCH_NOT_FOUND', 'Batch not found');
  return buildBatchSummary(batch);
}

export async function createBatch(name: string, description?: string): Promise<BatchSummary> {
  const batch = await prisma.batch.create({
    data: { name, description, status: 'OPEN', isDeleted: false },
    include: BATCH_SUMMARY_INCLUDE,
  });
  return buildBatchSummary(batch);
}

export async function updateBatch(id: number, updates: { name?: string; description?: string; deliveryFee?: number; otherFees?: number }): Promise<BatchSummary> {
  const existing = await prisma.batch.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw new AppError(404, 'BATCH_NOT_FOUND', 'Batch not found');
  if (existing.status === 'CLOSED') throw new AppError(400, 'BATCH_CLOSED', 'Cannot update a closed batch');
  const batch = await prisma.batch.update({ where: { id }, data: updates, include: BATCH_SUMMARY_INCLUDE });
  return buildBatchSummary(batch);
}

export async function deleteBatch(id: number): Promise<void> {
  const existing = await prisma.batch.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw new AppError(404, 'BATCH_NOT_FOUND', 'Batch not found');
  if (existing.status === 'CLOSED') throw new AppError(400, 'BATCH_CLOSED', 'Cannot delete a closed batch');
  await prisma.batch.update({ where: { id }, data: { isDeleted: true } });
}

export async function closeBatch(id: number): Promise<BatchSummary> {
  const existing = await prisma.batch.findFirst({
    where: { id, isDeleted: false },
    include: { distribution: { where: { isDeleted: false }, select: { id: true } } },
  });
  if (!existing) throw new AppError(404, 'BATCH_NOT_FOUND', 'Batch not found');
  if (existing.status === 'CLOSED') throw new AppError(400, 'BATCH_ALREADY_CLOSED', 'Batch is already closed');
  if (!existing.distribution) throw new AppError(400, 'DISTRIBUTION_REQUIRED', 'Save distribution before closing batch');
  const batch = await prisma.batch.update({
    where: { id },
    data: { status: 'CLOSED' },
    include: BATCH_SUMMARY_INCLUDE,
  });
  return buildBatchSummary(batch);
}

// ── Batch Items ───────────────────────────────────────────────────────────────

async function assertBatchOpenForMutation(batchId: number): Promise<void> {
  const batch = await prisma.batch.findFirst({
    where: { id: batchId, isDeleted: false },
    select: { id: true, status: true },
  });
  if (!batch) throw new AppError(404, 'BATCH_NOT_FOUND', 'Batch not found');
  if (batch.status === 'CLOSED') throw new AppError(400, 'BATCH_CLOSED', 'Cannot modify a closed batch');
}

export async function listItems(batchId: number): Promise<BatchItem[]> {
  const batch = await prisma.batch.findFirst({ where: { id: batchId, isDeleted: false }, select: { id: true } });
  if (!batch) throw new AppError(404, 'BATCH_NOT_FOUND', 'Batch not found');
  const items = await prisma.batchItem.findMany({
    where: { batchId, isDeleted: false },
    orderBy: { createdAt: 'asc' },
    include: ITEM_INCLUDE,
  });
  return items.map(mapBatchItem);
}

export async function createItem(
  batchId: number,
  data: { itemName: string; quantity: number; unitCost: number; notes?: string },
): Promise<BatchItem> {
  await assertBatchOpenForMutation(batchId);
  const item = await prisma.batchItem.create({
    data: {
      batchId,
      itemName: data.itemName,
      quantity: data.quantity,
      unitCost: data.unitCost,
      notes: data.notes ?? null,
      isDeleted: false,
    },
    include: ITEM_INCLUDE,
  });
  return mapBatchItem(item);
}

export async function updateItem(
  batchId: number,
  itemId: number,
  updates: { itemName?: string; quantity?: number; unitCost?: number; notes?: string | null },
): Promise<BatchItem> {
  await assertBatchOpenForMutation(batchId);
  const existing = await prisma.batchItem.findFirst({ where: { id: itemId, batchId, isDeleted: false } });
  if (!existing) throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found');
  const item = await prisma.batchItem.update({
    where: { id: itemId },
    data: updates,
    include: ITEM_INCLUDE,
  });
  return mapBatchItem(item);
}

export async function deleteItem(batchId: number, itemId: number): Promise<void> {
  await assertBatchOpenForMutation(batchId);
  const existing = await prisma.batchItem.findFirst({ where: { id: itemId, batchId, isDeleted: false } });
  if (!existing) throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found');
  await prisma.batchItem.update({ where: { id: itemId }, data: { isDeleted: true } });
}

// ── Sale Records ──────────────────────────────────────────────────────────────

async function assertItemBelongsToBatch(batchId: number, itemId: number): Promise<void> {
  const item = await prisma.batchItem.findFirst({
    where: { id: itemId, batchId, isDeleted: false },
    select: { id: true },
  });
  if (!item) throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found');
}

export async function listSaleRecords(batchId: number, itemId: number): Promise<SaleRecord[]> {
  await assertItemBelongsToBatch(batchId, itemId);
  const records = await prisma.saleRecord.findMany({
    where: { batchItemId: itemId, isDeleted: false },
    orderBy: { createdAt: 'asc' },
    include: SALE_RECORD_INCLUDE,
  });
  return records.map(mapSaleRecord);
}

export async function createSaleRecord(
  batchId: number,
  itemId: number,
  data: { quantity: number; unitSalePrice: number; platformId?: number | null; notes?: string },
): Promise<BatchItem> {
  await assertBatchOpenForMutation(batchId);
  await assertItemBelongsToBatch(batchId, itemId);

  // Validate that total sold quantity doesn't exceed purchased quantity
  const item = await prisma.batchItem.findFirstOrThrow({
    where: { id: itemId, isDeleted: false },
    include: {
      saleRecords: { where: { isDeleted: false }, select: { quantity: true } },
    },
  });
  const currentSold = item.saleRecords.reduce((sum, sr) => sum + sr.quantity, 0);
  if (currentSold + data.quantity > item.quantity) {
    throw new AppError(400, 'QUANTITY_EXCEEDED', `Cannot sell ${data.quantity} units — only ${item.quantity - currentSold} unsold remaining`);
  }

  await prisma.saleRecord.create({
    data: {
      batchItemId: itemId,
      quantity: data.quantity,
      unitSalePrice: data.unitSalePrice,
      platformId: data.platformId ?? null,
      notes: data.notes ?? null,
      isDeleted: false,
    },
  });

  const updatedItem = await prisma.batchItem.findFirstOrThrow({
    where: { id: itemId },
    include: ITEM_INCLUDE,
  });
  return mapBatchItem(updatedItem);
}

export async function updateSaleRecord(
  batchId: number,
  itemId: number,
  saleId: number,
  data: { quantity?: number; unitSalePrice?: number; platformId?: number | null; notes?: string | null },
): Promise<BatchItem> {
  await assertBatchOpenForMutation(batchId);
  await assertItemBelongsToBatch(batchId, itemId);

  const sale = await prisma.saleRecord.findFirst({ where: { id: saleId, batchItemId: itemId, isDeleted: false } });
  if (!sale) throw new AppError(404, 'SALE_NOT_FOUND', 'Sale record not found');

  if (data.quantity !== undefined) {
    const item = await prisma.batchItem.findFirstOrThrow({
      where: { id: itemId, isDeleted: false },
      include: { saleRecords: { where: { isDeleted: false }, select: { id: true, quantity: true } } },
    });
    const otherSold = item.saleRecords.filter(sr => sr.id !== saleId).reduce((sum, sr) => sum + sr.quantity, 0);
    if (otherSold + data.quantity > item.quantity) {
      throw new AppError(400, 'QUANTITY_EXCEEDED', `Cannot set quantity to ${data.quantity} — only ${item.quantity - otherSold} available`);
    }
  }

  await prisma.saleRecord.update({ where: { id: saleId }, data });

  const updatedItem = await prisma.batchItem.findFirstOrThrow({
    where: { id: itemId },
    include: ITEM_INCLUDE,
  });
  return mapBatchItem(updatedItem);
}

export async function deleteSaleRecord(batchId: number, itemId: number, saleId: number): Promise<BatchItem> {
  await assertBatchOpenForMutation(batchId);
  await assertItemBelongsToBatch(batchId, itemId);

  const sale = await prisma.saleRecord.findFirst({ where: { id: saleId, batchItemId: itemId, isDeleted: false } });
  if (!sale) throw new AppError(404, 'SALE_NOT_FOUND', 'Sale record not found');

  await prisma.saleRecord.update({ where: { id: saleId }, data: { isDeleted: true } });

  const updatedItem = await prisma.batchItem.findFirstOrThrow({
    where: { id: itemId },
    include: ITEM_INCLUDE,
  });
  return mapBatchItem(updatedItem);
}

// ── Distribution ──────────────────────────────────────────────────────────────

export async function getDistribution(batchId: number): Promise<DistributionDetail | null> {
  const distribution = await prisma.distribution.findFirst({
    where: { batchId, isDeleted: false },
    include: DISTRIBUTION_INCLUDE,
  });
  return distribution ? mapDistribution(distribution) : null;
}

export async function upsertDistribution(
  batchId: number,
  data: {
    retainedMode: 'FIXED_AMOUNT' | 'PERCENTAGE';
    retainedValue: number;
    notes?: string;
    shares: Array<{ partnerId: number; percentage: number }>;
  },
): Promise<DistributionDetail> {
  const batch = await prisma.batch.findFirst({
    where: { id: batchId, isDeleted: false },
    include: {
      batchItems: {
        where: { isDeleted: false },
        select: {
          quantity: true,
          unitCost: true,
          saleRecords: { where: { isDeleted: false }, select: { quantity: true, unitSalePrice: true } },
        },
      },
    },
  });

  if (!batch) throw new AppError(404, 'BATCH_NOT_FOUND', 'Batch not found');

  const totalPercentage = data.shares.reduce((sum, s) => sum + s.percentage, 0);
  if (Math.abs(totalPercentage - 100) > 0.01) {
    throw new AppError(400, 'INVALID_SHARES', 'Share percentages must sum to exactly 100');
  }

  let totalRevenue = 0;
  let totalCost = toNum(batch.deliveryFee) + toNum(batch.otherFees);
  for (const item of batch.batchItems) {
    totalCost += item.quantity * toNum(item.unitCost);
    totalRevenue += item.saleRecords.reduce((sum, sr) => sum + sr.quantity * toNum(sr.unitSalePrice), 0);
  }
  const grossProfit = totalRevenue - totalCost;

  const retainedAmount =
    data.retainedMode === 'FIXED_AMOUNT'
      ? data.retainedValue
      : grossProfit * (data.retainedValue / 100);

  const distributedAmount = grossProfit - retainedAmount;

  const shareData = data.shares.map((s) => ({
    partnerId: s.partnerId,
    percentage: s.percentage,
    amount: distributedAmount * (s.percentage / 100),
  }));

  const distribution = await prisma.$transaction(async (tx) => {
    const upserted = await tx.distribution.upsert({
      where: { batchId },
      create: {
        batchId, totalRevenue, totalCost, grossProfit,
        retainedMode: data.retainedMode, retainedValue: data.retainedValue,
        retainedAmount, distributedAmount, notes: data.notes ?? null, isDeleted: false,
      },
      update: {
        totalRevenue, totalCost, grossProfit,
        retainedMode: data.retainedMode, retainedValue: data.retainedValue,
        retainedAmount, distributedAmount, notes: data.notes ?? null, isDeleted: false,
      },
      select: { id: true },
    });

    await tx.distributionShare.deleteMany({ where: { distributionId: upserted.id } });

    await tx.distributionShare.createMany({
      data: shareData.map((s) => ({
        distributionId: upserted.id,
        partnerId: s.partnerId,
        percentage: s.percentage,
        amount: s.amount,
        isDeleted: false,
      })),
    });

    return tx.distribution.findUniqueOrThrow({
      where: { id: upserted.id },
      include: DISTRIBUTION_INCLUDE,
    });
  });

  return mapDistribution(distribution);
}
