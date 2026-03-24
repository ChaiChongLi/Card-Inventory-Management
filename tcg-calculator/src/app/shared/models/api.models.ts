export interface ApiUser {
  id: number;
  username: string;
  role: 'ADMIN' | 'WORKER';
  isActive: boolean;
  createdAt: string;
}

export interface ApiPlatform {
  id: number;
  slug: string;
  name: string;
  feePercent: number;
  isCustomizable: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface ApiPreset {
  id: number;
  name: string;
  sortOrder: number;
}

export interface ApiSession {
  id: number;
  name: string;
  description?: string;
  userId: number;
  user: { username: string };
  skuCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiSkuItem {
  id: number;
  sessionId: number;
  platformId: number;
  name: string;
  productCost: number;
  shippingCost: number;
  customFeePercent?: number;
  desiredMargin: number;
  quantity: number;
  sortOrder: number;
  platform: ApiPlatform;
}

export interface ApiSessionDetail extends ApiSession {
  skuItems: ApiSkuItem[];
}

export interface LoginResponse {
  accessToken: string;
  user: ApiUser;
}

// ── Partners ──────────────────────────────────────────────
export interface PartnerItem {
  id: number;
  displayName: string;
  isActive: boolean;
  userId: number;
  username: string;
  createdAt: string;
}

// ── Batches ───────────────────────────────────────────────
export type BatchStatus = 'OPEN' | 'CLOSED';

export interface BatchSummary {
  id: number;
  name: string;
  description: string | null;
  status: BatchStatus;
  itemCount: number;
  soldCount: number;
  totalCost: number;
  totalRevenue: number;
  grossProfit: number;
  deliveryFee: number;
  otherFees: number;
  hasDistribution: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Batch Items ────────────────────────────────────────────
export interface SaleRecord {
  id: number;
  batchItemId: number;
  quantity: number;
  unitSalePrice: number;
  platformId: number | null;
  platformName: string | null;
  platformSlug: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BatchItem {
  id: number;
  batchId: number;
  itemName: string;
  quantity: number;          // total purchased
  unitCost: number;
  soldQuantity: number;      // sum of sale records' quantities
  unsoldQuantity: number;
  totalCost: number;
  totalRevenue: number;
  profit: number;
  notes: string | null;
  saleRecords: SaleRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateItemPayload {
  itemName: string;
  quantity: number;
  unitCost: number;
  notes?: string;
}

export interface CreateSaleRecordPayload {
  quantity: number;
  unitSalePrice: number;
  platformId?: number | null;
  notes?: string;
}

export interface UpdateSaleRecordPayload {
  quantity?: number;
  unitSalePrice?: number;
  platformId?: number | null;
  notes?: string | null;
}

// ── Distribution ──────────────────────────────────────────
export type RetainedMode = 'FIXED_AMOUNT' | 'PERCENTAGE';

export interface DistributionShare {
  id: number;
  partnerId: number;
  partnerName: string;
  percentage: number;
  amount: number;
}

export interface DistributionDetail {
  id: number;
  batchId: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  retainedMode: RetainedMode;
  retainedValue: number;
  retainedAmount: number;
  distributedAmount: number;
  notes?: string;
  shares: DistributionShare[];
  createdAt: string;
  updatedAt: string;
}
