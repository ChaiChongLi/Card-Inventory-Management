import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';

export interface SkuInput {
  id?: number; // present for existing SKUs, absent for new ones
  platformId: number;
  name: string;
  productCost: number;
  shippingCost: number;
  customFeePercent?: number | null;
  desiredMargin: number;
  quantity: number;
  sortOrder?: number;
}

export interface SkuItemResult {
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

function serializeSku(sku: {
  id: number;
  sessionId: number;
  platformId: number;
  name: string;
  productCost: { toString(): string };
  shippingCost: { toString(): string };
  customFeePercent: { toString(): string } | null;
  desiredMargin: { toString(): string };
  quantity: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  platform: {
    id: number;
    slug: string;
    name: string;
    feePercent: { toString(): string };
    isCustomizable: boolean;
  };
}): SkuItemResult {
  return {
    id: sku.id,
    sessionId: sku.sessionId,
    platformId: sku.platformId,
    name: sku.name,
    productCost: parseFloat(sku.productCost.toString()),
    shippingCost: parseFloat(sku.shippingCost.toString()),
    customFeePercent: sku.customFeePercent !== null ? parseFloat(sku.customFeePercent.toString()) : null,
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
  };
}

async function assertSessionExists(sessionId: number): Promise<void> {
  const session = await prisma.session.findFirst({
    where: { id: sessionId, isDeleted: false },
  });
  if (!session) {
    throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');
  }
}

const SKU_PLATFORM_SELECT = {
  id: true,
  slug: true,
  name: true,
  feePercent: true,
  isCustomizable: true,
} as const;

/**
 * Bulk replace: the authoritative auto-save endpoint.
 *
 * Strategy:
 *  1. Load all currently non-deleted SKUs for the session.
 *  2. Build a Set of incoming IDs (existing SKUs being kept).
 *  3. Soft-delete any existing SKU whose ID is NOT in the incoming set.
 *  4. Upsert each incoming item: update if it has an ID, create if it doesn't.
 *  5. Fetch and return the full updated list with platform data.
 *
 * All operations run inside a transaction.
 */
export async function bulkReplaceSku(
  sessionId: number,
  items: SkuInput[],
): Promise<SkuItemResult[]> {
  await assertSessionExists(sessionId);

  // Collect IDs of incoming items that already exist in DB
  const incomingIds = new Set(
    items.filter((item) => item.id !== undefined).map((item) => item.id as number),
  );

  await prisma.$transaction(async (tx) => {
    // Step 1: Fetch current non-deleted SKU IDs for this session
    const existingSkus = await tx.skuItem.findMany({
      where: { sessionId, isDeleted: false },
      select: { id: true },
    });

    // Step 2: Soft-delete SKUs not present in incoming array
    const idsToDelete = existingSkus
      .map((s) => s.id)
      .filter((id) => !incomingIds.has(id));

    if (idsToDelete.length > 0) {
      await tx.skuItem.updateMany({
        where: { id: { in: idsToDelete }, sessionId },
        data: { isDeleted: true },
      });
    }

    // Step 3: Upsert each incoming item
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const sortOrder = item.sortOrder !== undefined ? item.sortOrder : i;

      if (item.id !== undefined) {
        // Update existing
        await tx.skuItem.update({
          where: { id: item.id },
          data: {
            platformId: item.platformId,
            name: item.name,
            productCost: item.productCost,
            shippingCost: item.shippingCost,
            customFeePercent: item.customFeePercent ?? null,
            desiredMargin: item.desiredMargin,
            quantity: item.quantity,
            sortOrder,
          },
        });
      } else {
        // Insert new
        await tx.skuItem.create({
          data: {
            sessionId,
            platformId: item.platformId,
            name: item.name,
            productCost: item.productCost,
            shippingCost: item.shippingCost,
            customFeePercent: item.customFeePercent ?? null,
            desiredMargin: item.desiredMargin,
            quantity: item.quantity,
            sortOrder,
            isDeleted: false,
          },
        });
      }
    }
  });

  // Fetch the full updated list outside the transaction to include relations
  const updatedSkus = await prisma.skuItem.findMany({
    where: { sessionId, isDeleted: false },
    orderBy: { sortOrder: 'asc' },
    include: { platform: { select: SKU_PLATFORM_SELECT } },
  });

  return updatedSkus.map(serializeSku);
}

/**
 * Update a single SKU field-by-field (e.g. user edits one cell).
 */
export async function updateSingleSku(
  sessionId: number,
  skuId: number,
  updates: Partial<Omit<SkuInput, 'id'>>,
): Promise<SkuItemResult> {
  await assertSessionExists(sessionId);

  const existing = await prisma.skuItem.findFirst({
    where: { id: skuId, sessionId, isDeleted: false },
  });

  if (!existing) {
    throw new AppError(404, 'SKU_NOT_FOUND', 'SKU item not found');
  }

  const sku = await prisma.skuItem.update({
    where: { id: skuId },
    data: {
      ...(updates.platformId !== undefined && { platformId: updates.platformId }),
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.productCost !== undefined && { productCost: updates.productCost }),
      ...(updates.shippingCost !== undefined && { shippingCost: updates.shippingCost }),
      ...(updates.customFeePercent !== undefined && { customFeePercent: updates.customFeePercent }),
      ...(updates.desiredMargin !== undefined && { desiredMargin: updates.desiredMargin }),
      ...(updates.quantity !== undefined && { quantity: updates.quantity }),
      ...(updates.sortOrder !== undefined && { sortOrder: updates.sortOrder }),
    },
    include: { platform: { select: SKU_PLATFORM_SELECT } },
  });

  return serializeSku(sku);
}
