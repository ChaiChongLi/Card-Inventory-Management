import {
  Component, computed, signal, inject, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { PlatformService } from '../../core/services/platform.service';
import { PresetService } from '../../core/services/preset.service';

export interface Platform {
  id: string;
  name: string;
  fee: number;
  customizable: boolean;
}

export interface SkuItem {
  id: number;          // local frontend id (for signals tracking)
  backendId?: number;  // DB id from API (undefined for new unsaved items)
  name: string;
  productCost: number;
  shippingCost: number;
  platformId: string;  // platform slug (e.g. 'shopee')
  platformFee: number;
  desiredMargin: number;
  quantity: number;
}

export interface SkuResult {
  totalCost: number;
  sellingPrice: number;
  platformFeeAmount: number;
  profitPerUnit: number;
  actualMargin: number;
  breakEven: number;
  totalProfit: number;
  valid: boolean;
  warning: string | null;
}

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './calculator.component.html',
  styleUrl: './calculator.component.scss',
})
export class CalculatorComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly platformService = inject(PlatformService);
  readonly presetService = inject(PresetService);
  private router = inject(Router);

  private nextId = signal(1);

  skus = signal<SkuItem[]>([]);
  activeRow = signal<number | null>(null);
  showFormula = signal(false);

  fromBatchId = signal<number | null>(null);
  fromBatchName = signal<string>('');

  get platforms(): Platform[] {
    return this.platformService.platforms();
  }

  get productTypePresets(): string[] {
    return this.presetService.presets();
  }

  ngOnInit(): void {
    const historyState = history.state as { skus?: SkuItem[]; batchId?: number; batchName?: string };
    if (historyState?.skus && historyState.skus.length >= 0) {
      this.skus.set(historyState.skus);
    }
    if (historyState?.batchId) {
      this.fromBatchId.set(historyState.batchId);
      this.fromBatchName.set(historyState.batchName ?? 'Batch');
    }
  }

  private allocateId(): number {
    const id = this.nextId();
    this.nextId.set(id + 1);
    return id;
  }

  goBackToBatch(): void {
    const id = this.fromBatchId();
    if (id) this.router.navigate(['/admin/batches', id]);
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }

  // ── Formula ────────────────────────────────────────────────────────────────

  calculate(sku: SkuItem): SkuResult {
    const totalCost = sku.productCost + sku.shippingCost;
    const pFee = sku.platformFee / 100;
    const margin = sku.desiredMargin / 100;
    const divisor = 1 - pFee - margin;

    if (divisor <= 0) {
      return { totalCost, sellingPrice: 0, platformFeeAmount: 0, profitPerUnit: 0, actualMargin: 0, breakEven: 0, totalProfit: 0, valid: false, warning: 'Platform fee + desired margin ≥ 100%. Reduce one or both.' };
    }
    if (totalCost <= 0) {
      return { totalCost, sellingPrice: 0, platformFeeAmount: 0, profitPerUnit: 0, actualMargin: 0, breakEven: 0, totalProfit: 0, valid: false, warning: 'Enter product cost to calculate.' };
    }

    const sellingPrice      = totalCost / divisor;
    const platformFeeAmount = sellingPrice * pFee;
    const profitPerUnit     = sellingPrice - platformFeeAmount - totalCost;
    const actualMargin      = (profitPerUnit / sellingPrice) * 100;
    const breakEven         = 1 - pFee > 0 ? totalCost / (1 - pFee) : 0;
    const totalProfit       = profitPerUnit * sku.quantity;

    const warn = (sku.platformFee + sku.desiredMargin) > 60
      ? 'Combined fees exceed 60% — very thin headroom.'
      : null;

    return {
      totalCost:         round2(totalCost),
      sellingPrice:      round2(sellingPrice),
      platformFeeAmount: round2(platformFeeAmount),
      profitPerUnit:     round2(profitPerUnit),
      actualMargin:      round1(actualMargin),
      breakEven:         round2(breakEven),
      totalProfit:       round2(totalProfit),
      valid: true,
      warning: warn,
    };
  }

  // ── Computed summaries ─────────────────────────────────────────────────────

  summary = computed(() => {
    const list = this.skus();
    let totalRevenue = 0, totalProfit = 0, totalCost = 0;
    let validCount = 0;
    for (const sku of list) {
      const r = this.calculate(sku);
      if (r.valid) {
        totalRevenue += r.sellingPrice * sku.quantity;
        totalProfit  += r.totalProfit;
        totalCost    += r.totalCost * sku.quantity;
        validCount++;
      }
    }
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    return {
      totalRevenue: round2(totalRevenue),
      totalProfit:  round2(totalProfit),
      totalCost:    round2(totalCost),
      avgMargin:    round1(avgMargin),
      validCount,
      skuCount: list.length,
    };
  });

  // ── Actions ────────────────────────────────────────────────────────────────

  addSku(): void {
    const id = this.allocateId();
    const defaultPlatform = this.platforms[0];
    this.skus.update(list => [...list, {
      id,
      name: 'New Product',
      productCost: 0,
      shippingCost: 0,
      platformId: defaultPlatform?.id ?? 'shopee',
      platformFee: defaultPlatform?.fee ?? 3,
      desiredMargin: 20,
      quantity: 1,
    }]);
    this.activeRow.set(id);
  }

  removeSku(id: number): void {
    this.skus.update(list => list.filter(s => s.id !== id));
    if (this.activeRow() === id) this.activeRow.set(null);
  }

  updateSku(id: number, field: keyof SkuItem, value: unknown): void {
    this.skus.update(list => list.map(s => s.id === id ? { ...s, [field]: value } : s));
  }

  onPlatformChange(sku: SkuItem): void {
    const platform = this.platforms.find(p => p.id === sku.platformId);
    if (platform && !platform.customizable) {
      this.updateSku(sku.id, 'platformFee', platform.fee);
    }
  }

  duplicateSku(sku: SkuItem): void {
    const id = this.allocateId();
    this.skus.update(list => [...list, { ...sku, id, backendId: undefined, name: sku.name + ' (Copy)' }]);
  }

  setPreset(sku: SkuItem, name: string): void {
    this.updateSku(sku.id, 'name', name);
  }

  exportCsv(): void {
    const headers = [
      'SKU Name', 'Product Cost (RM)', 'Shipping (RM)', 'Qty',
      'Platform', 'Platform Fee (%)', 'Desired Margin (%)',
      'Selling Price (RM)', 'Platform Fee Amt (RM)', 'Profit/Unit (RM)',
      'Actual Margin (%)', 'Break-even (RM)', 'Total Profit (RM)',
    ];
    const rows = this.skus().map(sku => {
      const r = this.calculate(sku);
      const pName = this.platforms.find(p => p.id === sku.platformId)?.name ?? sku.platformId;
      return [
        `"${sku.name}"`, sku.productCost.toFixed(2), sku.shippingCost.toFixed(2), sku.quantity,
        `"${pName}"`, sku.platformFee.toFixed(1), sku.desiredMargin.toFixed(1),
        r.sellingPrice.toFixed(2), r.platformFeeAmount.toFixed(2), r.profitPerUnit.toFixed(2),
        r.actualMargin.toFixed(1), r.breakEven.toFixed(2), r.totalProfit.toFixed(2),
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'tcg-pricing.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  getPlatformName(id: string): string {
    return this.platforms.find(p => p.id === id)?.name ?? id;
  }

  isCustomPlatform(id: string): boolean {
    return this.platforms.find(p => p.id === id)?.customizable ?? false;
  }

  trackById(_: number, item: SkuItem): number { return item.id; }
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function round1(n: number): number { return Math.round(n * 10) / 10; }
