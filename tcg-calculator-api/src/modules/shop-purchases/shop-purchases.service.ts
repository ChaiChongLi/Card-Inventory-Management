import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';

export interface ShopPurchaseDto {
  buyerName: string;
  itemName: string;
  quantity: number;
  unitCost: number;
  purchaseDate: string; // YYYY-MM-DD
  category?: string;
  notes?: string;
}

function toRow(r: {
  id: number;
  buyerName: string;
  itemName: string;
  quantity: number;
  unitCost: unknown;
  purchaseDate: Date;
  category: string | null;
  notes: string | null;
  createdAt: Date;
}) {
  const unitCost = Number(r.unitCost);
  return {
    id: r.id,
    buyerName: r.buyerName,
    itemName: r.itemName,
    quantity: r.quantity,
    unitCost,
    totalCost: r.quantity * unitCost,
    purchaseDate: r.purchaseDate.toISOString().split('T')[0],
    category: r.category,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  };
}

export const shopPurchasesService = {
  async list() {
    const records = await prisma.shopPurchase.findMany({
      where: { isDeleted: false },
      orderBy: [{ purchaseDate: 'desc' }, { createdAt: 'desc' }],
    });
    return records.map(toRow);
  },

  async create(dto: ShopPurchaseDto) {
    const record = await prisma.shopPurchase.create({
      data: {
        buyerName: dto.buyerName,
        itemName: dto.itemName,
        quantity: dto.quantity,
        unitCost: dto.unitCost,
        purchaseDate: new Date(dto.purchaseDate),
        category: dto.category ?? null,
        notes: dto.notes ?? null,
        isDeleted: false,
      },
    });
    return toRow(record);
  },

  async update(id: number, dto: Partial<ShopPurchaseDto>) {
    const existing = await prisma.shopPurchase.findFirst({ where: { id, isDeleted: false } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Purchase record not found');

    const data: Record<string, unknown> = {};
    if (dto.buyerName !== undefined) data['buyerName'] = dto.buyerName;
    if (dto.itemName !== undefined) data['itemName'] = dto.itemName;
    if (dto.quantity !== undefined) data['quantity'] = dto.quantity;
    if (dto.unitCost !== undefined) data['unitCost'] = dto.unitCost;
    if (dto.purchaseDate !== undefined) data['purchaseDate'] = new Date(dto.purchaseDate);
    if (dto.category !== undefined) data['category'] = dto.category || null;
    if (dto.notes !== undefined) data['notes'] = dto.notes || null;

    const record = await prisma.shopPurchase.update({ where: { id }, data });
    return toRow(record);
  },

  async remove(id: number) {
    const existing = await prisma.shopPurchase.findFirst({ where: { id, isDeleted: false } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Purchase record not found');
    await prisma.shopPurchase.update({
      where: { id },
      data: { isDeleted: true },
    });
  },
};
