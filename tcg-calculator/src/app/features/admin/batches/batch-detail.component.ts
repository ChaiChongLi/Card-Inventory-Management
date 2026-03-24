import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { BatchService } from '../../../core/services/batch.service';
import { PartnerService } from '../../../core/services/partner.service';
import { PresetService } from '../../../core/services/preset.service';
import { environment } from '../../../../environments/environment';
import {
  BatchSummary,
  BatchItem,
  SaleRecord,
  DistributionDetail,
  DistributionShare,
  PartnerItem,
  ApiPlatform,
  CreateItemPayload,
  CreateSaleRecordPayload,
  UpdateSaleRecordPayload,
  RetainedMode,
} from '../../../shared/models/api.models';

interface PartnerShare {
  partnerId: number;
  partnerName: string;
  percentage: number;
}

interface ItemFormState {
  itemName: string;
  quantity: number;
  unitCost: number;
  notes: string;
}

interface SaleFormState {
  quantity: number;
  unitSalePrice: number;
  platformId: number | undefined;
  notes: string;
}

interface EditItemFormState {
  itemName: string;
  quantity: number;
  unitCost: number;
  notes: string;
}

function blankItemForm(): ItemFormState {
  return { itemName: '', quantity: 1, unitCost: 0, notes: '' };
}

function blankSaleForm(): SaleFormState {
  return { quantity: 1, unitSalePrice: 0, platformId: undefined, notes: '' };
}

function blankEditItemForm(): EditItemFormState {
  return { itemName: '', quantity: 1, unitCost: 0, notes: '' };
}

@Component({
  selector: 'app-batch-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- ── PRINT DOCUMENT (hidden on screen, visible on print) ─────────────── -->
    @if (distribution() && batch()) {
      <div class="print-doc">
        <div class="print-header">
          <h1 class="print-title">{{ batch()!.name }}</h1>
          @if (batch()!.description) {
            <p class="print-sub">{{ batch()!.description }}</p>
          }
          <p class="print-meta">Status: {{ batch()!.status }} &nbsp;|&nbsp; Printed: {{ printDate() }}</p>
        </div>

        <div class="print-section">
          <h2 class="print-section-title">Stock Items</h2>
          <table class="print-table">
            <thead>
              <tr>
                <th>Item</th><th>Qty</th><th>Unit Cost</th>
                <th>Sold Qty</th><th>Revenue</th><th>Cost</th><th>Profit</th>
              </tr>
            </thead>
            <tbody>
              @for (item of items(); track item.id) {
                <tr>
                  <td>{{ item.itemName }}</td>
                  <td>{{ item.quantity }}</td>
                  <td>{{ formatRM(item.unitCost) }}</td>
                  <td>{{ item.soldQuantity }}/{{ item.quantity }}</td>
                  <td>{{ item.totalRevenue > 0 ? formatRM(item.totalRevenue) : '—' }}</td>
                  <td>{{ formatRM(item.totalCost) }}</td>
                  <td>{{ item.totalRevenue > 0 ? formatRM(item.profit) : '—' }}</td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4"><strong>Totals</strong></td>
                <td><strong>{{ formatRM(distribution()!.totalRevenue) }}</strong></td>
                <td><strong>{{ formatRM(distribution()!.totalCost) }}</strong></td>
                <td><strong>{{ formatRM(distribution()!.grossProfit) }}</strong></td>
              </tr>
            </tfoot>
          </table>
          @if ((batch()!.deliveryFee) > 0 || (batch()!.otherFees) > 0) {
            <p class="print-fee-note">
              Total cost includes batch fees:
              Delivery: {{ formatRM(batch()!.deliveryFee) }},
              Other: {{ formatRM(batch()!.otherFees) }}
            </p>
          }
        </div>

        @if (platformBreakdown().length > 0) {
          <div class="print-section">
            <h2 class="print-section-title">Revenue by Platform</h2>
            <table class="print-table">
              <thead>
                <tr><th>Platform</th><th>Revenue</th><th>% of Total</th></tr>
              </thead>
              <tbody>
                @for (pb of platformBreakdown(); track pb.name) {
                  <tr>
                    <td>{{ pb.name }}</td>
                    <td>{{ formatRM(pb.revenue) }}</td>
                    <td>{{ distribution()!.totalRevenue > 0 ? (pb.revenue / distribution()!.totalRevenue * 100).toFixed(1) + '%' : '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <div class="print-section">
          <h2 class="print-section-title">Distribution</h2>
          <div class="print-dist-meta">
            <p>Gross Profit: <strong>{{ formatRM(distribution()!.grossProfit) }}</strong></p>
            <p>Retained ({{ distribution()!.retainedMode === 'FIXED_AMOUNT' ? 'fixed' : distribution()!.retainedValue + '%' }}):
              <strong>{{ formatRM(distribution()!.retainedAmount) }}</strong></p>
            <p>Distributed: <strong>{{ formatRM(distribution()!.distributedAmount) }}</strong></p>
          </div>
          <table class="print-table">
            <thead>
              <tr><th>Partner</th><th>Percentage</th><th>Amount (RM)</th></tr>
            </thead>
            <tbody>
              @for (share of distribution()!.shares; track share.id) {
                <tr>
                  <td>{{ share.partnerName }}</td>
                  <td>{{ share.percentage }}%</td>
                  <td>{{ formatRM(share.amount) }}</td>
                </tr>
              }
            </tbody>
          </table>
          @if (distribution()!.notes) {
            <div class="print-notes"><strong>Notes:</strong> {{ distribution()!.notes }}</div>
          }
        </div>

        <div class="print-footer">Generated by TCG Pricing Calculator — {{ printDate() }}</div>
      </div>
    }

    <!-- ── SCREEN CONTENT ──────────────────────────────────────────────────── -->
    <div class="page screen-only">

      @if (pageLoading()) {
        <div class="state-row">
          <div class="spinner-ring"></div>
          <span>Loading batch...</span>
        </div>
      } @else if (pageError()) {
        <div class="state-row error">
          <span>{{ pageError() }}</span>
          <button class="btn btn-secondary btn-sm" (click)="loadAll()">Retry</button>
        </div>
      } @else if (batch()) {

        <!-- ── Header ──────────────────────────────────────────────────────── -->
        <div class="page-header">
          <div class="header-left">
            <button class="btn btn-ghost btn-sm back-btn" (click)="goBack()">← Batches</button>
            <div class="header-title-row">
              <h2 class="page-title">{{ batch()!.name }}</h2>
              <span class="status-badge" [class.open]="batch()!.status === 'OPEN'" [class.closed]="batch()!.status === 'CLOSED'">
                {{ batch()!.status }}
              </span>
            </div>
            @if (batch()!.description) {
              <p class="page-sub">{{ batch()!.description }}</p>
            }
          </div>
          <div class="header-actions">
            @if (distribution()) {
              <button class="btn btn-secondary btn-sm" (click)="printBatch()">🖨 Print / Save PDF</button>
            }
            @if (batch()!.status === 'OPEN') {
              <button
                class="btn btn-primary btn-sm"
                (click)="confirmCloseBatch()"
                [disabled]="!distribution() || closing()"
                [title]="!distribution() ? 'Save distribution first before closing the batch' : 'Close this batch'"
              >
                {{ closing() ? 'Closing...' : 'Close Batch' }}
              </button>
            }
          </div>
        </div>

        <!-- ── Tabs ────────────────────────────────────────────────────────── -->
        <div class="tabs">
          <button class="tab" [class.active]="activeTab() === 'items'" (click)="activeTab.set('items')">
            Stock Items
            @if (items().length > 0) {
              <span class="tab-count">{{ items().length }}</span>
            }
          </button>
          <button class="tab" [class.active]="activeTab() === 'distribution'" (click)="activeTab.set('distribution')">
            Distribution
            @if (distribution()) { <span class="tab-saved">✓</span> }
          </button>
        </div>

        <!-- ════════════════ STOCK ITEMS TAB ════════════════════════════════ -->
        @if (activeTab() === 'items') {
          <div class="tab-content">

            <!-- Summary bar -->
            @if (items().length > 0) {
              <div class="summary-bar">
                <div class="summary-item">
                  <span class="summary-label">Items</span>
                  <span class="summary-value">{{ batch()!.itemCount }} total · {{ batch()!.soldCount }} sold</span>
                </div>
                <div class="summary-divider"></div>
                <div class="summary-item">
                  <span class="summary-label">Total Cost (incl. fees)</span>
                  <span class="summary-value">{{ formatRM(batch()!.totalCost) }}</span>
                </div>
                <div class="summary-divider"></div>
                <div class="summary-item">
                  <span class="summary-label">Revenue</span>
                  <span class="summary-value">{{ formatRM(batch()!.totalRevenue) }}</span>
                </div>
                <div class="summary-divider"></div>
                <div class="summary-item">
                  <span class="summary-label">Gross Profit</span>
                  <span class="summary-value" [class.profit-pos]="batch()!.grossProfit > 0" [class.profit-neg]="batch()!.grossProfit < 0">
                    {{ formatRM(batch()!.grossProfit) }}
                  </span>
                </div>
                @if (items().length > 0) {
                  <div class="summary-divider"></div>
                  <div class="summary-item summary-item-action">
                    <button class="btn btn-secondary btn-sm" (click)="openInCalculator()">Open in Calculator</button>
                  </div>
                }
              </div>
            }

            <!-- Batch overhead fees (when OPEN) -->
            @if (batch()!.status === 'OPEN') {
              <div class="fees-card">
                <span class="fees-card-title">Batch Overhead Fees</span>
                <div class="fees-inputs">
                  <div class="fee-field">
                    <label class="field-label">Delivery / Shipping (RM)</label>
                    <input class="form-control fc-fee" type="number" min="0" step="0.01" placeholder="0.00"
                      [ngModel]="deliveryFeeInput()" (ngModelChange)="deliveryFeeInput.set(+$event)"
                      [disabled]="savingFees()" />
                  </div>
                  <div class="fee-field">
                    <label class="field-label">Other Fees (RM)</label>
                    <input class="form-control fc-fee" type="number" min="0" step="0.01" placeholder="0.00"
                      [ngModel]="otherFeesInput()" (ngModelChange)="otherFeesInput.set(+$event)"
                      [disabled]="savingFees()" />
                  </div>
                  <button class="btn btn-secondary btn-sm fees-save-btn" (click)="saveFees()" [disabled]="savingFees()">
                    {{ savingFees() ? 'Saving...' : 'Save Fees' }}
                  </button>
                </div>
                @if ((batch()!.deliveryFee) > 0 || (batch()!.otherFees) > 0) {
                  <p class="fees-total-note">
                    Total overhead: {{ formatRM((batch()!.deliveryFee) + (batch()!.otherFees)) }}
                    — included in total cost and distribution
                  </p>
                }
              </div>
            } @else if ((batch()!.deliveryFee) > 0 || (batch()!.otherFees) > 0) {
              <div class="fees-card fees-card-readonly">
                <span class="fees-card-title">Batch Overhead Fees</span>
                <div class="fees-readonly-row">
                  @if ((batch()!.deliveryFee) > 0) {
                    <span>Delivery: <strong>{{ formatRM(batch()!.deliveryFee) }}</strong></span>
                  }
                  @if ((batch()!.otherFees) > 0) {
                    <span>Other: <strong>{{ formatRM(batch()!.otherFees) }}</strong></span>
                  }
                </div>
              </div>
            }

            <!-- Add item -->
            @if (batch()!.status === 'OPEN') {
              @if (!showAddItem()) {
                <div class="section-action-row">
                  <button class="btn btn-primary btn-sm" (click)="showAddItem.set(true)">+ Add Item</button>
                </div>
              } @else {
                <div class="add-form-card">
                  <h3 class="form-card-title">New Stock Item</h3>
                  <div class="form-grid-3">
                    <div class="field-group col-span-2">
                      <label class="field-label">Item Name <span class="req">*</span></label>
                      <input class="form-control" type="text" [(ngModel)]="addForm.itemName"
                        list="preset-list" placeholder="Select or type item name" [disabled]="addingItem()" />
                      <datalist id="preset-list">
                        @for (p of presetService.presets(); track p) {
                          <option [value]="p"></option>
                        }
                      </datalist>
                    </div>
                    <div class="field-group">
                      <label class="field-label">Quantity <span class="req">*</span></label>
                      <input class="form-control" type="number" [(ngModel)]="addForm.quantity"
                        min="1" step="1" [disabled]="addingItem()" />
                    </div>
                    <div class="field-group col-span-2">
                      <label class="field-label">Unit Cost (RM) <span class="req">*</span></label>
                      <input class="form-control" type="number" [(ngModel)]="addForm.unitCost"
                        min="0" step="0.01" placeholder="0.00" [disabled]="addingItem()" />
                    </div>
                    <div class="field-group col-span-3">
                      <label class="field-label">Notes <span class="opt">(optional)</span></label>
                      <input class="form-control" type="text" [(ngModel)]="addForm.notes"
                        placeholder="Any additional notes" [disabled]="addingItem()" />
                    </div>
                  </div>
                  @if (addItemError()) {
                    <div class="error-msg">{{ addItemError() }}</div>
                  }
                  <div class="form-card-footer">
                    <button class="btn btn-ghost btn-sm" (click)="cancelAddItem()" [disabled]="addingItem()">Cancel</button>
                    <button class="btn btn-primary btn-sm" (click)="submitAddItem()"
                      [disabled]="addingItem() || !canSubmitAddItem()">
                      {{ addingItem() ? 'Saving...' : 'Save Item' }}
                    </button>
                  </div>
                </div>
              }
            }

            <!-- Items table -->
            @if (itemsLoading()) {
              <div class="state-row">
                <div class="spinner-ring"></div>
                <span>Loading items...</span>
              </div>
            } @else if (items().length === 0) {
              <div class="empty-state">
                <div class="empty-icon">📦</div>
                <p class="empty-title">No items recorded yet</p>
                <p class="empty-sub">Add stock items to start tracking this batch</p>
              </div>
            } @else {
              <div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th class="th-expand"></th>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Unit Cost</th>
                      <th>Sold</th>
                      <th>Revenue</th>
                      <th>Profit</th>
                      @if (batch()!.status === 'OPEN') { <th>Actions</th> }
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of items(); track item.id) {
                      @if (editingItemId() === item.id) {
                        <!-- Inline edit row -->
                        <tr class="edit-row">
                          <td></td>
                          <td>
                            <input class="form-control fc-sm" type="text" [(ngModel)]="editItemForm.itemName" list="preset-list-edit" />
                            <datalist id="preset-list-edit">
                              @for (p of presetService.presets(); track p) {
                                <option [value]="p"></option>
                              }
                            </datalist>
                          </td>
                          <td>
                            <input class="form-control fc-sm fc-narrow" type="number" [(ngModel)]="editItemForm.quantity" min="1" />
                          </td>
                          <td>
                            <input class="form-control fc-sm fc-narrow" type="number" [(ngModel)]="editItemForm.unitCost" min="0" step="0.01" />
                          </td>
                          <td colspan="3" class="calc-cell">
                            <span class="calc-preview">editing item details</span>
                          </td>
                          <td>
                            <div class="action-row">
                              <button class="btn btn-ghost-green btn-sm" (click)="submitEditItem(item.id)" [disabled]="savingItemEdit()">
                                {{ savingItemEdit() ? '...' : 'Save' }}
                              </button>
                              <button class="btn btn-ghost btn-sm" (click)="cancelEditItem()" [disabled]="savingItemEdit()">Cancel</button>
                            </div>
                          </td>
                        </tr>
                      } @else {
                        <!-- Main item row -->
                        <tr class="item-row" [class.item-expanded]="isExpanded(item.id)" (click)="toggleItemExpand(item.id)">
                          <td class="expand-cell">
                            <span class="expand-icon">{{ isExpanded(item.id) ? '▼' : '▶' }}</span>
                          </td>
                          <td class="td-item">
                            {{ item.itemName }}
                            @if (item.saleRecords.length > 0) {
                              <span class="sales-count-badge">{{ item.saleRecords.length }} sale{{ item.saleRecords.length !== 1 ? 's' : '' }}</span>
                            }
                          </td>
                          <td>{{ item.quantity }}</td>
                          <td>{{ formatRM(item.unitCost) }}</td>
                          <td>
                            @if (item.soldQuantity > 0) {
                              <span class="status-chip sold">{{ item.soldQuantity }}/{{ item.quantity }}</span>
                            } @else {
                              <span class="status-chip pending">0/{{ item.quantity }}</span>
                            }
                          </td>
                          <td>{{ item.totalRevenue > 0 ? formatRM(item.totalRevenue) : '—' }}</td>
                          <td [class.profit-pos]="item.profit > 0" [class.profit-neg]="item.profit < 0">
                            {{ item.totalRevenue > 0 ? formatRM(item.profit) : '—' }}
                          </td>
                          @if (batch()!.status === 'OPEN') {
                            <td (click)="$event.stopPropagation()">
                              <div class="action-row">
                                <button class="btn btn-secondary btn-sm" (click)="startEditItem(item)">Edit</button>
                                <button class="btn btn-primary btn-sm" (click)="openRecordSaleDialog(item)">+ Sale</button>
                                <button class="btn btn-danger btn-sm"
                                  (click)="deleteItem(item.id)"
                                  [disabled]="deletingItemId() === item.id">
                                  {{ deletingItemId() === item.id ? '...' : 'Delete' }}
                                </button>
                              </div>
                            </td>
                          }
                        </tr>

                        <!-- Expanded sale records sub-section -->
                        @if (isExpanded(item.id)) {
                          <tr class="sale-records-row">
                            <td [attr.colspan]="batch()!.status === 'OPEN' ? 8 : 7" class="sale-records-cell">
                              @if (item.saleRecords.length === 0) {
                                <p class="no-sales-msg">
                                  No sales recorded yet.
                                  @if (batch()!.status === 'OPEN') {
                                    Click <strong>+ Sale</strong> to add a sale transaction.
                                  }
                                </p>
                              } @else {
                                <table class="sale-records-table">
                                  <thead>
                                    <tr>
                                      <th>#</th>
                                      <th>Qty Sold</th>
                                      <th>Sale Price (RM)</th>
                                      <th>Platform</th>
                                      <th>Notes</th>
                                      @if (batch()!.status === 'OPEN') { <th></th> }
                                    </tr>
                                  </thead>
                                  <tbody>
                                    @for (sale of item.saleRecords; track sale.id; let idx = $index) {
                                      <tr>
                                        <td class="sale-idx">{{ idx + 1 }}</td>
                                        <td>{{ sale.quantity }}</td>
                                        <td>{{ formatRM(sale.unitSalePrice) }}</td>
                                        <td>{{ sale.platformName ?? '—' }}</td>
                                        <td class="sale-notes">{{ sale.notes ?? '—' }}</td>
                                        @if (batch()!.status === 'OPEN') {
                                          <td>
                                            <div class="action-row">
                                              <button class="btn btn-ghost btn-sm"
                                                (click)="openEditSaleDialog(item, sale)">Edit</button>
                                              <button class="btn btn-danger btn-sm"
                                                (click)="deleteSaleRecord(item, sale)"
                                                [disabled]="deletingSaleId() === sale.id">
                                                {{ deletingSaleId() === sale.id ? '...' : 'Delete' }}
                                              </button>
                                            </div>
                                          </td>
                                        }
                                      </tr>
                                    }
                                  </tbody>
                                </table>
                              }
                            </td>
                          </tr>
                        }
                      }
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }

        <!-- ════════════════ DISTRIBUTION TAB ════════════════════════════════ -->
        @if (activeTab() === 'distribution') {
          <div class="tab-content">

            @if (items().length === 0) {
              <div class="empty-state">
                <div class="empty-icon">📊</div>
                <p class="empty-title">No items to distribute</p>
                <p class="empty-sub">Add stock items first to calculate distribution</p>
              </div>

            } @else if (batch()!.soldCount === 0) {
              <div class="empty-state">
                <div class="empty-icon">⏳</div>
                <p class="empty-title">No items sold yet</p>
                <p class="empty-sub">Record sales first before setting up distribution</p>
              </div>

            } @else if (distribution() && !editingDistribution()) {
              <!-- ── Saved read-only view ─────────────────────────────── -->
              <div class="dist-saved-view">
                <div class="dist-saved-header">
                  <div>
                    <h3 class="dist-saved-title">Distribution Saved</h3>
                    <p class="dist-saved-sub">Last updated {{ formatDate(distribution()!.updatedAt) }}</p>
                  </div>
                  @if (batch()!.status === 'OPEN') {
                    <button class="btn btn-secondary btn-sm" (click)="editingDistribution.set(true)">Edit</button>
                  }
                </div>

                <div class="dist-summary-cards">
                  <div class="dist-card">
                    <span class="dist-card-label">Total Revenue</span>
                    <span class="dist-card-value">{{ formatRM(distribution()!.totalRevenue) }}</span>
                  </div>
                  <div class="dist-card">
                    <span class="dist-card-label">Total Cost</span>
                    <span class="dist-card-value">{{ formatRM(distribution()!.totalCost) }}</span>
                  </div>
                  <div class="dist-card">
                    <span class="dist-card-label">Gross Profit</span>
                    <span class="dist-card-value accent">{{ formatRM(distribution()!.grossProfit) }}</span>
                    <span class="dist-card-sub">{{ batch()!.soldCount }} of {{ batch()!.itemCount }} items sold</span>
                  </div>
                  <div class="dist-card">
                    <span class="dist-card-label">Retained</span>
                    <span class="dist-card-value">{{ formatRM(distribution()!.retainedAmount) }}</span>
                    <span class="dist-card-sub">
                      {{ distribution()!.retainedMode === 'FIXED_AMOUNT' ? 'Fixed amount' : distribution()!.retainedValue + '%' }}
                    </span>
                  </div>
                  <div class="dist-card">
                    <span class="dist-card-label">Distributed</span>
                    <span class="dist-card-value profit">{{ formatRM(distribution()!.distributedAmount) }}</span>
                  </div>
                </div>

                @if (batch()!.soldCount < batch()!.itemCount) {
                  <div class="dist-unsold-notice">
                    {{ batch()!.itemCount - batch()!.soldCount }} item(s) not yet sold — contributing to cost but not revenue.
                  </div>
                }

                <!-- Platform revenue breakdown (Fix #3) -->
                @if (platformBreakdown().length > 1) {
                  <div class="dist-section">
                    <h3 class="dist-section-title">Revenue by Platform</h3>
                    <div class="platform-breakdown">
                      @for (pb of platformBreakdown(); track pb.name) {
                        <div class="platform-row">
                          <span class="platform-name">{{ pb.name }}</span>
                          <span class="platform-revenue">{{ formatRM(pb.revenue) }}</span>
                          <span class="platform-pct">
                            {{ distribution()!.totalRevenue > 0 ? (pb.revenue / distribution()!.totalRevenue * 100).toFixed(1) + '%' : '—' }}
                          </span>
                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- Partner shares with income slip buttons (Fix #4) -->
                <div class="dist-shares-table-wrap">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Partner</th>
                        <th>Percentage</th>
                        <th>Amount</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (share of distribution()!.shares; track share.id) {
                        <tr>
                          <td>{{ share.partnerName }}</td>
                          <td>{{ share.percentage }}%</td>
                          <td class="profit-pos">{{ formatRM(share.amount) }}</td>
                          <td>
                            <button class="btn btn-ghost btn-sm" (click)="printIncomeSlip(share)"
                              title="Print income slip for {{ share.partnerName }}">
                              🖨 Income Slip
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                @if (distribution()!.notes) {
                  <div class="dist-notes-view">
                    <span class="field-label">Notes</span>
                    <p>{{ distribution()!.notes }}</p>
                  </div>
                }
              </div>

            } @else {
              <!-- ── Distribution form ────────────────────────────────── -->
              <div class="dist-form">

                <!-- Profit hero -->
                <div class="dist-profit-hero">
                  <div class="profit-hero-main">
                    <span class="profit-hero-label">Gross Profit (Revenue − Total Cost)</span>
                    <span class="profit-hero-value">{{ formatRM(batch()!.grossProfit) }}</span>
                  </div>
                  <div class="profit-hero-sub">
                    <span>Revenue: {{ formatRM(batch()!.totalRevenue) }}</span>
                    <span class="profit-hero-sep">|</span>
                    <span>Total Cost: {{ formatRM(batch()!.totalCost) }}</span>
                  </div>
                  @if (batch()!.soldCount < batch()!.itemCount) {
                    <div class="profit-hero-notice">
                      {{ batch()!.soldCount }} of {{ batch()!.itemCount }} items sold. Unsold items contribute to cost.
                    </div>
                  }
                </div>

                <!-- Retained section -->
                <div class="dist-section">
                  <h3 class="dist-section-title">Retained in Business</h3>
                  <div class="retained-row">
                    <div class="mode-toggle">
                      <button class="mode-btn" [class.active]="retainedMode() === 'FIXED_AMOUNT'" (click)="retainedMode.set('FIXED_AMOUNT')">Fixed Amount</button>
                      <button class="mode-btn" [class.active]="retainedMode() === 'PERCENTAGE'" (click)="retainedMode.set('PERCENTAGE')">Percentage</button>
                    </div>
                    <div class="retained-input-wrap">
                      @if (retainedMode() === 'FIXED_AMOUNT') {
                        <div class="input-prefix-wrap">
                          <span class="input-affix">RM</span>
                          <input class="form-control affixed-input" type="number" min="0" step="0.01"
                            [ngModel]="retainedValue()" (ngModelChange)="retainedValue.set(+$event)" placeholder="0.00" />
                        </div>
                      } @else {
                        <div class="input-suffix-wrap">
                          <input class="form-control affixed-input" type="number" min="0" max="100" step="0.5"
                            [ngModel]="retainedValue()" (ngModelChange)="retainedValue.set(+$event)" placeholder="0" />
                          <span class="input-affix">%</span>
                        </div>
                      }
                    </div>
                  </div>
                  <div class="retained-preview">
                    <span>Retained: <strong>{{ formatRM(computedRetainedAmount()) }}</strong></span>
                    <span class="preview-sep">→</span>
                    <span>Available for distribution: <strong class="distributable-val">{{ formatRM(computedDistributableAmount()) }}</strong></span>
                  </div>
                </div>

                <!-- Partner distribution section -->
                <div class="dist-section">
                  <div class="dist-section-header">
                    <h3 class="dist-section-title" style="margin-bottom:0">Partner Distribution</h3>
                    @if (activePartners().length > 1) {
                      <button class="btn btn-ghost btn-sm" (click)="equalSplit()">Equal Split</button>
                    }
                  </div>

                  @if (activePartners().length === 0) {
                    <div class="empty-partners">
                      <p>No active partners. <span class="link" (click)="goToPartners()">Add partners</span> to enable distribution.</p>
                    </div>
                  } @else {
                    <div class="partner-list">
                      @for (share of partnerShares(); track share.partnerId) {
                        <div class="partner-row">
                          <div class="partner-info">
                            <span class="partner-avatar">{{ share.partnerName[0].toUpperCase() }}</span>
                            <span class="partner-name">{{ share.partnerName }}</span>
                          </div>
                          <div class="partner-controls">
                            <input type="range" class="pct-slider" min="0" max="100" step="0.5"
                              [ngModel]="share.percentage"
                              (ngModelChange)="updateSharePct(share.partnerId, $event)" />
                            <div class="pct-number-wrap">
                              <input class="form-control pct-number-input" type="number" min="0" max="100" step="0.5"
                                [ngModel]="share.percentage"
                                (ngModelChange)="updateSharePct(share.partnerId, $event)" />
                              <span class="pct-sfx">%</span>
                            </div>
                          </div>
                          <div class="partner-payout">{{ formatRM(computedPayout(share.percentage)) }}</div>
                        </div>
                      }
                    </div>

                    <div class="pct-total-row" [class.pct-ok]="totalPct() === 100" [class.pct-err]="totalPct() !== 100">
                      <span class="pct-total-label">Total allocation:</span>
                      <span class="pct-total-val">{{ totalPct() }}%</span>
                      @if (totalPct() !== 100) {
                        <span class="pct-total-hint">(must equal 100%)</span>
                      }
                    </div>
                  }
                </div>

                <!-- Notes -->
                <div class="dist-section">
                  <h3 class="dist-section-title">Notes <span class="opt">(optional)</span></h3>
                  <textarea class="form-control" rows="3" [(ngModel)]="distNotes"
                    placeholder="Any notes about this distribution..."></textarea>
                </div>

                <!-- Save -->
                @if (distSaveError()) {
                  <div class="error-msg">{{ distSaveError() }}</div>
                }
                <div class="dist-form-footer">
                  @if (editingDistribution()) {
                    <button class="btn btn-ghost btn-sm" (click)="cancelEditDistribution()">Cancel</button>
                  }
                  <button class="btn btn-primary" (click)="saveDistribution()"
                    [disabled]="totalPct() !== 100 || savingDistribution() || activePartners().length === 0"
                    [title]="totalPct() !== 100 ? 'Partner percentages must total 100%' : ''">
                    {{ savingDistribution() ? 'Saving...' : 'Save Distribution' }}
                  </button>
                </div>
              </div>
            }
          </div>
        }

      }
    </div>

    <!-- ── Record Sale Dialog ─────────────────────────────────────────────── -->
    @if (recordSaleTarget()) {
      <div class="dialog-backdrop" (click)="closeRecordSaleDialog()">
        <div class="dialog-card dialog-card-md" (click)="$event.stopPropagation()">
          <h2 class="dialog-title">Record Sale — {{ recordSaleTarget()!.itemName }}</h2>
          <p class="dialog-hint">
            Available: {{ recordSaleTarget()!.unsoldQuantity }} unsold of {{ recordSaleTarget()!.quantity }} total
          </p>
          <div class="dialog-form">
            <div class="field-group">
              <label class="field-label">Quantity <span class="req">*</span></label>
              <input class="form-control" type="number" min="1" step="1"
                [(ngModel)]="recordSaleForm.quantity" [disabled]="recordingSale()" />
            </div>
            <div class="field-group">
              <label class="field-label">Unit Sale Price (RM) <span class="req">*</span></label>
              <input class="form-control" type="number" min="0" step="0.01" placeholder="0.00"
                [(ngModel)]="recordSaleForm.unitSalePrice" [disabled]="recordingSale()" />
            </div>
            <div class="field-group">
              <label class="field-label">Platform</label>
              <select class="form-control" [(ngModel)]="recordSaleForm.platformId" [disabled]="recordingSale()">
                <option [ngValue]="undefined">— None —</option>
                @for (p of platforms(); track p.id) {
                  <option [ngValue]="p.id">{{ p.name }}</option>
                }
              </select>
            </div>
            <div class="field-group">
              <label class="field-label">Notes <span class="opt">(optional)</span></label>
              <input class="form-control" type="text" placeholder="e.g. Sold at pasar malam"
                [(ngModel)]="recordSaleForm.notes" [disabled]="recordingSale()" />
            </div>
          </div>
          @if (recordSaleError()) {
            <div class="error-msg" style="margin-top: 12px;">{{ recordSaleError() }}</div>
          }
          <div class="dialog-actions">
            <button class="btn btn-ghost" (click)="closeRecordSaleDialog()" [disabled]="recordingSale()">Cancel</button>
            <button class="btn btn-primary" (click)="submitRecordSale()"
              [disabled]="recordingSale() || recordSaleForm.unitSalePrice <= 0 || recordSaleForm.quantity < 1">
              {{ recordingSale() ? 'Saving...' : 'Save Sale' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Edit Sale Dialog ───────────────────────────────────────────────── -->
    @if (editSaleTarget()) {
      <div class="dialog-backdrop" (click)="closeEditSaleDialog()">
        <div class="dialog-card dialog-card-md" (click)="$event.stopPropagation()">
          <h2 class="dialog-title">Edit Sale — {{ editSaleTarget()!.item.itemName }}</h2>
          <div class="dialog-form">
            <div class="field-group">
              <label class="field-label">Quantity <span class="req">*</span></label>
              <input class="form-control" type="number" min="1" step="1"
                [(ngModel)]="editSaleForm.quantity" [disabled]="editingSale()" />
            </div>
            <div class="field-group">
              <label class="field-label">Unit Sale Price (RM) <span class="req">*</span></label>
              <input class="form-control" type="number" min="0" step="0.01" placeholder="0.00"
                [(ngModel)]="editSaleForm.unitSalePrice" [disabled]="editingSale()" />
            </div>
            <div class="field-group">
              <label class="field-label">Platform</label>
              <select class="form-control" [(ngModel)]="editSaleForm.platformId" [disabled]="editingSale()">
                <option [ngValue]="undefined">— None —</option>
                @for (p of platforms(); track p.id) {
                  <option [ngValue]="p.id">{{ p.name }}</option>
                }
              </select>
            </div>
            <div class="field-group">
              <label class="field-label">Notes <span class="opt">(optional)</span></label>
              <input class="form-control" type="text" placeholder="e.g. Sold at pasar malam"
                [(ngModel)]="editSaleForm.notes" [disabled]="editingSale()" />
            </div>
          </div>
          @if (editSaleError()) {
            <div class="error-msg" style="margin-top: 12px;">{{ editSaleError() }}</div>
          }
          <div class="dialog-actions">
            <button class="btn btn-ghost" (click)="closeEditSaleDialog()" [disabled]="editingSale()">Cancel</button>
            <button class="btn btn-primary" (click)="submitEditSale()"
              [disabled]="editingSale() || editSaleForm.unitSalePrice <= 0 || editSaleForm.quantity < 1">
              {{ editingSale() ? 'Saving...' : 'Update Sale' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Close batch confirm dialog ────────────────────────────────────── -->
    @if (showCloseConfirm()) {
      <div class="dialog-backdrop" (click)="showCloseConfirm.set(false)">
        <div class="dialog-card" (click)="$event.stopPropagation()">
          <h2 class="dialog-title">Close Batch?</h2>
          <p class="dialog-body">
            Closing <strong>{{ batch()?.name }}</strong> is permanent. No further items can be added
            and the distribution cannot be edited after closing.
          </p>
          @if (closeError()) {
            <div class="error-msg" style="margin-bottom:12px">{{ closeError() }}</div>
          }
          <div class="dialog-actions">
            <button class="btn btn-ghost" (click)="showCloseConfirm.set(false)">Cancel</button>
            <button class="btn btn-primary" (click)="executeClosure()" [disabled]="closing()">
              {{ closing() ? 'Closing...' : 'Close Batch' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* ── Print ─────────────────────────────────────────────────────────────── */
    .print-doc { display: none; }

    @media print {
      .screen-only { display: none !important; }
      .print-doc {
        display: block !important;
        padding: 32px;
        color: #000;
        font-family: 'Inter', sans-serif;
        font-size: 12px;
      }

      .print-header { margin-bottom: 24px; border-bottom: 2px solid #000; padding-bottom: 12px; }
      .print-title { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
      .print-sub { font-size: 13px; color: #555; margin-bottom: 4px; }
      .print-meta { font-size: 11px; color: #777; }

      .print-section { margin-bottom: 28px; }
      .print-section-title {
        font-size: 15px; font-weight: 700; margin-bottom: 10px;
        border-bottom: 1px solid #ccc; padding-bottom: 4px;
      }

      .print-table { width: 100%; border-collapse: collapse; font-size: 11px; }
      .print-table th { background: #f0f0f0; padding: 6px 8px; text-align: left; font-weight: 700; border: 1px solid #ccc; }
      .print-table td { padding: 5px 8px; border: 1px solid #ccc; }
      .print-table tfoot td { font-weight: 700; background: #f8f8f8; }

      .print-fee-note { font-size: 11px; color: #666; margin-top: 6px; font-style: italic; }
      .print-dist-meta { margin-bottom: 12px; }
      .print-dist-meta p { margin-bottom: 4px; }
      .print-notes { margin-top: 10px; border-top: 1px solid #eee; padding-top: 8px; font-size: 12px; }
      .print-footer { margin-top: 32px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 10px; color: #999; text-align: center; }
    }

    /* ── Screen ─────────────────────────────────────────────────────────────── */
    .page { }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .header-left { display: flex; flex-direction: column; gap: 4px; }
    .back-btn { align-self: flex-start; margin-bottom: 4px; }

    .header-title-row { display: flex; align-items: center; gap: 10px; }

    .page-title { font-size: 20px; font-weight: 700; color: var(--text-primary); }
    .page-sub { font-size: 13px; color: var(--text-muted); }

    .header-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

    .status-badge {
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
      padding: 3px 8px; border-radius: 99px; flex-shrink: 0;
      &.open { background: var(--profit-bg); color: var(--profit); }
      &.closed { background: var(--accent-glow); color: var(--accent); }
    }

    /* Tabs */
    .tabs {
      display: flex; gap: 2px;
      background: var(--bg-elevated); border-radius: var(--radius);
      padding: 4px; margin-bottom: 24px; width: fit-content;
    }

    .tab {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 20px; border-radius: calc(var(--radius) - 2px);
      font-size: 13px; font-weight: 600; color: var(--text-muted);
      background: transparent; border: none; cursor: pointer; transition: all 0.15s;
      font-family: var(--font-sans);
      &:hover { color: var(--text-primary); }
      &.active { background: var(--bg-card); color: var(--text-primary); box-shadow: var(--shadow-sm); }
    }

    .tab-count {
      font-size: 10px; font-weight: 700; padding: 1px 6px;
      border-radius: 99px; background: var(--bg-elevated); color: var(--text-muted);
    }

    .tab-saved { font-size: 11px; font-weight: 700; color: var(--profit); }
    .tab-content { }

    /* Summary bar */
    .summary-bar {
      display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius-lg); padding: 16px 20px; margin-bottom: 16px;
    }

    .summary-item { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 120px; }
    .summary-item-action { flex: 0 0 auto; min-width: auto; }
    .summary-label {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--text-muted);
    }
    .summary-value { font-size: 15px; font-weight: 700; color: var(--text-primary); }
    .summary-divider { width: 1px; height: 36px; background: var(--border); margin: 0 12px; flex-shrink: 0; }

    .profit-pos { color: var(--profit) !important; }
    .profit-neg { color: var(--danger) !important; }

    /* Batch fees card */
    .fees-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius-lg); padding: 14px 16px; margin-bottom: 16px;
    }
    .fees-card-title {
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
      color: var(--text-muted); display: block; margin-bottom: 10px;
    }
    .fees-inputs {
      display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap;
    }
    .fee-field { display: flex; flex-direction: column; gap: 4px; }
    .fc-fee { width: 140px !important; }
    .fees-save-btn { align-self: flex-end; }
    .fees-total-note { font-size: 12px; color: var(--text-muted); margin-top: 8px; margin-bottom: 0; }
    .fees-card-readonly { }
    .fees-readonly-row { display: flex; gap: 16px; font-size: 13px; color: var(--text-secondary); }

    /* Add section */
    .section-action-row { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; }

    .add-form-card {
      background: var(--bg-card); border: 1px solid var(--border-focus);
      border-radius: var(--radius-lg); padding: 20px; margin-bottom: 20px;
    }

    .form-card-title { font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 16px; }

    .form-grid-3 {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: 12px; margin-bottom: 16px;
    }

    .col-span-2 { grid-column: span 2; }
    .col-span-3 { grid-column: span 3; }

    .field-group { display: flex; flex-direction: column; gap: 5px; }
    .field-label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--text-muted);
    }
    .req { color: var(--danger); }
    .opt { color: var(--text-muted); font-weight: 400; text-transform: none; letter-spacing: 0; }

    .form-card-footer { display: flex; justify-content: flex-end; gap: 8px; }

    /* Status chips */
    .status-chip {
      display: inline-flex; align-items: center;
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;
      padding: 2px 8px; border-radius: 99px;
      &.sold { background: var(--profit-bg); color: var(--profit); }
      &.pending { background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--border); }
    }

    /* Table */
    .table-wrap {
      border: 1px solid var(--border); border-radius: var(--radius-lg);
      overflow: hidden; overflow-x: auto;
    }

    .data-table {
      width: 100%; border-collapse: collapse; min-width: 700px;

      thead tr { background: var(--bg-elevated); border-bottom: 1px solid var(--border); }
      th {
        padding: 10px 12px; font-size: 10px; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted);
        text-align: left; white-space: nowrap;
      }
      tbody tr {
        border-bottom: 1px solid var(--border); background: var(--bg-card); transition: background 0.1s;
        &:last-child { border-bottom: none; }
        &.edit-row { background: var(--bg-elevated); }
      }
      td { padding: 10px 12px; font-size: 13px; color: var(--text-primary); }
    }

    .th-expand { width: 32px; padding: 0 !important; }
    .expand-cell { width: 32px; text-align: center; padding: 0 8px !important; }
    .expand-icon { font-size: 10px; color: var(--text-muted); }

    .item-row { cursor: pointer; }
    .item-row:hover { background: var(--bg-elevated) !important; }
    .item-row.item-expanded { background: var(--bg-elevated) !important; }

    .td-item { font-weight: 600; min-width: 140px; }
    .sales-count-badge {
      margin-left: 6px; font-size: 10px; font-weight: 700; padding: 1px 6px;
      border-radius: 99px; background: var(--accent-glow); color: var(--accent);
      vertical-align: middle;
    }

    .calc-cell { font-size: 12px; }
    .calc-preview { color: var(--text-secondary); white-space: nowrap; font-size: 12px; font-style: italic; }

    .action-row { display: flex; gap: 6px; flex-wrap: nowrap; }

    .fc-sm { padding: 5px 7px !important; font-size: 12px !important; }
    .fc-narrow { width: 80px; }

    /* Sale records sub-section */
    .sale-records-row { background: var(--bg-elevated) !important; }
    .sale-records-row:hover { background: var(--bg-elevated) !important; }
    .sale-records-cell { padding: 0 !important; border-top: 1px solid var(--border); }

    .sale-records-table {
      width: 100%; border-collapse: collapse; background: var(--bg-elevated);

      th {
        padding: 7px 12px 7px 24px; font-size: 10px; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-muted);
        text-align: left; background: var(--bg-elevated);
      }
      td {
        padding: 8px 12px 8px 24px; font-size: 12px; color: var(--text-secondary);
        border-top: 1px solid var(--border);
      }
      tr:first-child td { border-top: none; }
    }

    .sale-idx { color: var(--text-muted); font-size: 11px; width: 24px; }
    .sale-notes { max-width: 200px; color: var(--text-muted); font-style: italic; }

    .no-sales-msg {
      padding: 14px 24px; font-size: 13px; color: var(--text-muted); margin: 0;
    }

    /* Empty / Loading */
    .empty-state { padding: 60px 24px; text-align: center; }
    .empty-icon { font-size: 40px; margin-bottom: 12px; }
    .empty-title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
    .empty-sub { font-size: 13px; color: var(--text-muted); }

    .state-row {
      display: flex; align-items: center; gap: 12px;
      padding: 24px 0; color: var(--text-secondary); font-size: 13px;
      &.error { color: var(--danger); }
    }

    .spinner-ring {
      width: 24px; height: 24px;
      border: 2px solid var(--border); border-top-color: var(--accent);
      border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .error-msg { font-size: 12px; color: var(--danger); margin-bottom: 12px; }

    /* ── Distribution saved view ──────────────────────────────────────────── */
    .dist-saved-view { display: flex; flex-direction: column; gap: 20px; }
    .dist-saved-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .dist-saved-title { font-size: 16px; font-weight: 700; color: var(--text-primary); }
    .dist-saved-sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

    .dist-summary-cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
    .dist-card {
      background: var(--bg-elevated); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 14px; display: flex; flex-direction: column; gap: 4px;
    }
    .dist-card-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); }
    .dist-card-value { font-size: 17px; font-weight: 700; color: var(--text-primary); &.accent { color: var(--accent); } &.profit { color: var(--profit); } }
    .dist-card-sub { font-size: 11px; color: var(--text-muted); }

    .dist-unsold-notice {
      font-size: 12px; color: var(--text-muted);
      background: var(--bg-elevated); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 10px 14px;
    }

    /* Platform breakdown */
    .dist-section {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius-lg); padding: 18px 20px;
    }
    .dist-section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 12px; }

    .platform-breakdown { display: flex; flex-direction: column; gap: 8px; }
    .platform-row {
      display: flex; align-items: center; gap: 12px;
      padding: 8px 12px; background: var(--bg-elevated);
      border: 1px solid var(--border); border-radius: var(--radius);
    }
    .platform-name { flex: 1; font-size: 13px; font-weight: 600; color: var(--text-primary); }
    .platform-revenue { font-size: 13px; font-weight: 700; color: var(--profit); width: 100px; text-align: right; }
    .platform-pct { font-size: 12px; color: var(--text-muted); width: 48px; text-align: right; }

    .dist-shares-table-wrap { border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }

    .dist-notes-view {
      background: var(--bg-elevated); border-radius: var(--radius);
      padding: 14px; display: flex; flex-direction: column; gap: 6px;
      font-size: 13px; color: var(--text-secondary);
    }

    /* ── Distribution form ───────────────────────────────────────────────── */
    .dist-form { display: flex; flex-direction: column; gap: 20px; }

    .dist-profit-hero {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius-lg); padding: 24px; text-align: center;
    }
    .profit-hero-main { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
    .profit-hero-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); }
    .profit-hero-value { font-size: 32px; font-weight: 700; color: var(--accent); font-family: var(--font-display); }
    .profit-hero-sub { display: flex; justify-content: center; gap: 8px; font-size: 12px; color: var(--text-muted); }
    .profit-hero-sep { color: var(--border); }
    .profit-hero-notice { margin-top: 12px; font-size: 12px; color: var(--text-muted); }

    .dist-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }

    /* Retained */
    .retained-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; }

    .mode-toggle {
      display: flex; background: var(--bg-elevated); border-radius: var(--radius-sm); padding: 3px; gap: 2px;
    }
    .mode-btn {
      padding: 5px 12px; border-radius: calc(var(--radius-sm) - 1px);
      font-size: 12px; font-weight: 600; color: var(--text-muted);
      background: transparent; border: none; cursor: pointer; transition: all 0.15s; font-family: var(--font-sans);
      &.active { background: var(--bg-card); color: var(--text-primary); box-shadow: var(--shadow-sm); }
      &:hover:not(.active) { color: var(--text-secondary); }
    }

    .retained-input-wrap { width: 180px; }

    .input-prefix-wrap, .input-suffix-wrap {
      display: flex; align-items: center;
      background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-sm);
      overflow: hidden; transition: border-color 0.15s, box-shadow 0.15s;
      &:focus-within { border-color: var(--border-focus); box-shadow: 0 0 0 3px var(--accent-glow); }
    }

    .input-affix {
      padding: 7px 10px; font-size: 12px; font-weight: 600;
      color: var(--text-muted); background: var(--bg-elevated); border: none; flex-shrink: 0;
    }

    .affixed-input {
      flex: 1; background: transparent; border: none;
      padding: 7px 10px; color: var(--text-primary);
      font-family: var(--font-sans); font-size: 13px; outline: none; width: 0;
    }

    .retained-preview {
      display: flex; align-items: center; gap: 10px; font-size: 13px; flex-wrap: wrap;
      color: var(--text-secondary);
    }
    .preview-sep { color: var(--text-muted); }
    .distributable-val { color: var(--profit); font-size: 14px; }

    /* Partners */
    .empty-partners { font-size: 13px; color: var(--text-muted); padding-top: 8px; }
    .link { color: var(--accent); cursor: pointer; text-decoration: underline; }

    .partner-list { display: flex; flex-direction: column; gap: 12px; padding-top: 4px; }
    .partner-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .partner-info { display: flex; align-items: center; gap: 8px; width: 150px; flex-shrink: 0; }
    .partner-avatar {
      width: 28px; height: 28px; background: var(--accent-glow); color: var(--accent);
      border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; flex-shrink: 0;
    }
    .partner-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
    .partner-controls { flex: 1; display: flex; align-items: center; gap: 10px; min-width: 200px; }

    .pct-slider {
      flex: 1; appearance: none; height: 4px;
      background: var(--border); border-radius: 99px; outline: none; cursor: pointer;
      &::-webkit-slider-thumb {
        appearance: none; width: 16px; height: 16px; border-radius: 50%;
        background: var(--accent); cursor: pointer; border: 2px solid var(--bg-card);
        box-shadow: 0 0 0 2px var(--accent-glow);
      }
      &::-moz-range-thumb {
        width: 14px; height: 14px; border-radius: 50%;
        background: var(--accent); cursor: pointer; border: 2px solid var(--bg-card);
      }
    }

    .pct-number-wrap {
      display: flex; align-items: center;
      background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-sm);
      overflow: hidden; width: 76px; flex-shrink: 0;
      &:focus-within { border-color: var(--border-focus); box-shadow: 0 0 0 3px var(--accent-glow); }
    }
    .pct-number-input {
      width: 44px; background: transparent; border: none;
      padding: 6px 4px 6px 8px; color: var(--text-primary);
      font-family: var(--font-sans); font-size: 13px; outline: none;
    }
    .pct-sfx { padding: 6px 8px 6px 2px; font-size: 12px; color: var(--text-muted); }

    .partner-payout { font-size: 14px; font-weight: 700; color: var(--profit); width: 100px; text-align: right; flex-shrink: 0; }

    .pct-total-row {
      display: flex; align-items: center; gap: 8px;
      margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border);
      font-size: 13px; font-weight: 700;
      &.pct-ok { color: var(--profit); }
      &.pct-err { color: var(--danger); }
    }
    .pct-total-label { color: var(--text-muted); font-weight: 600; }
    .pct-total-hint { font-size: 11px; font-weight: 400; }

    .dist-form-footer { display: flex; justify-content: flex-end; gap: 10px; }

    /* Buttons */
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; border-radius: var(--radius-sm);
      font-size: 13px; font-weight: 600; font-family: var(--font-sans);
      cursor: pointer; border: 1px solid transparent; transition: all 0.15s; outline: none; white-space: nowrap;

      &.btn-primary { background: var(--accent); color: var(--text-inverse); border-color: var(--accent); &:hover:not(:disabled) { background: var(--accent-dark); } }
      &.btn-secondary { background: transparent; color: var(--text-primary); border-color: var(--border); &:hover:not(:disabled) { background: var(--bg-elevated); } }
      &.btn-ghost { background: transparent; color: var(--text-secondary); &:hover:not(:disabled) { background: var(--bg-elevated); color: var(--text-primary); } }
      &.btn-ghost-green { background: transparent; color: var(--profit); border-color: var(--profit); &:hover:not(:disabled) { background: var(--profit-bg); } }
      &.btn-danger { background: transparent; color: var(--danger); border-color: var(--danger); &:hover:not(:disabled) { background: var(--danger-bg); } }
      &.btn-sm { padding: 5px 10px; font-size: 12px; }
      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }

    .form-control {
      background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-sm);
      color: var(--text-primary); font-family: var(--font-sans); font-size: 13px;
      padding: 7px 10px; width: 100%; outline: none; transition: border-color 0.15s, box-shadow 0.15s;
      &:focus { border-color: var(--border-focus); box-shadow: 0 0 0 3px var(--accent-glow); }
      &::placeholder { color: var(--text-muted); }
      &:disabled { opacity: 0.5; }
      option { background: var(--bg-surface); color: var(--text-primary); }
    }

    /* Dialog */
    .dialog-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
      z-index: 200; display: flex; align-items: center; justify-content: center; padding: 24px;
    }
    .dialog-card {
      background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
      padding: 28px; width: 100%; max-width: 420px; box-shadow: var(--shadow-lg);
    }
    .dialog-card-md { max-width: 480px; }
    .dialog-title { font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
    .dialog-hint { font-size: 12px; color: var(--text-muted); margin-bottom: 16px; }
    .dialog-body { font-size: 14px; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.6; strong { color: var(--text-primary); } }
    .dialog-form { display: flex; flex-direction: column; gap: 14px; }
    .dialog-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }

    @media (max-width: 900px) {
      .dist-summary-cards { grid-template-columns: repeat(3, 1fr); }
    }

    @media (max-width: 768px) {
      .form-grid-3 { grid-template-columns: 1fr 1fr; }
      .col-span-3 { grid-column: span 2; }
      .dist-summary-cards { grid-template-columns: 1fr 1fr; }
      .partner-info { width: 100%; }
    }

    @media (max-width: 480px) {
      .form-grid-3 { grid-template-columns: 1fr; }
      .col-span-2, .col-span-3 { grid-column: span 1; }
      .summary-bar { flex-direction: column; align-items: flex-start; }
      .summary-divider { width: 100%; height: 1px; margin: 4px 0; }
      .dist-summary-cards { grid-template-columns: 1fr; }
    }
  `],
})
export class BatchDetailComponent implements OnInit {
  private batchService = inject(BatchService);
  private partnerService = inject(PartnerService);
  readonly presetService = inject(PresetService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  // ── Page state ─────────────────────────────────────────────────────────────
  batch = signal<BatchSummary | null>(null);
  items = signal<BatchItem[]>([]);
  distribution = signal<DistributionDetail | null>(null);
  platforms = signal<ApiPlatform[]>([]);
  allPartners = signal<PartnerItem[]>([]);

  pageLoading = signal(true);
  pageError = signal<string | null>(null);
  itemsLoading = signal(false);

  activeTab = signal<'items' | 'distribution'>('items');
  activePartners = computed(() => this.allPartners().filter(p => p.isActive));

  // ── Platform revenue breakdown (Fix #3) ────────────────────────────────────
  platformBreakdown = computed(() => {
    const platformMap = new Map<string, { name: string; revenue: number }>();
    for (const item of this.items()) {
      for (const sr of item.saleRecords) {
        const key = sr.platformName ?? 'No Platform';
        const existing = platformMap.get(key) ?? { name: key, revenue: 0 };
        existing.revenue += sr.quantity * sr.unitSalePrice;
        platformMap.set(key, existing);
      }
    }
    return Array.from(platformMap.values()).sort((a, b) => b.revenue - a.revenue);
  });

  // ── Batch fees (Fix #2) ─────────────────────────────────────────────────────
  deliveryFeeInput = signal<number>(0);
  otherFeesInput = signal<number>(0);
  savingFees = signal(false);

  // ── Add item form ──────────────────────────────────────────────────────────
  showAddItem = signal(false);
  addForm: ItemFormState = blankItemForm();
  addingItem = signal(false);
  addItemError = signal<string | null>(null);

  // ── Edit item (inline) ─────────────────────────────────────────────────────
  editingItemId = signal<number | null>(null);
  editItemForm: EditItemFormState = blankEditItemForm();
  savingItemEdit = signal(false);

  // ── Item expand/collapse (Fix #1) ──────────────────────────────────────────
  expandedItemIds = signal<number[]>([]);

  // ── Record sale dialog ─────────────────────────────────────────────────────
  recordSaleTarget = signal<BatchItem | null>(null);
  recordSaleForm: SaleFormState = blankSaleForm();
  recordingSale = signal(false);
  recordSaleError = signal<string | null>(null);

  // ── Edit sale dialog (Fix #1) ──────────────────────────────────────────────
  editSaleTarget = signal<{ item: BatchItem; sale: SaleRecord } | null>(null);
  editSaleForm: SaleFormState = blankSaleForm();
  editingSale = signal(false);
  editSaleError = signal<string | null>(null);

  // ── Item / sale delete state ───────────────────────────────────────────────
  deletingItemId = signal<number | null>(null);
  deletingSaleId = signal<number | null>(null);

  // ── Distribution form ──────────────────────────────────────────────────────
  editingDistribution = signal(false);
  retainedMode = signal<RetainedMode>('FIXED_AMOUNT');
  retainedValue = signal<number>(0);
  partnerShares = signal<PartnerShare[]>([]);
  distNotes = '';
  savingDistribution = signal(false);
  distSaveError = signal<string | null>(null);

  computedRetainedAmount = computed(() => {
    const profit = this.batch()?.grossProfit ?? 0;
    if (this.retainedMode() === 'FIXED_AMOUNT') {
      return Math.min(this.retainedValue() || 0, profit);
    }
    return profit * ((this.retainedValue() || 0) / 100);
  });

  computedDistributableAmount = computed(() => {
    const profit = this.batch()?.grossProfit ?? 0;
    return Math.max(0, profit - this.computedRetainedAmount());
  });

  totalPct = computed(() =>
    Math.round(this.partnerShares().reduce((sum, s) => sum + (s.percentage || 0), 0) * 10) / 10
  );

  computedPayout(pct: number): number {
    return this.computedDistributableAmount() * (pct / 100);
  }

  // ── Close batch ────────────────────────────────────────────────────────────
  showCloseConfirm = signal(false);
  closing = signal(false);
  closeError = signal<string | null>(null);

  // ── Init ───────────────────────────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    await this.loadAll();
  }

  async loadAll(): Promise<void> {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      this.pageError.set('Invalid batch ID.');
      this.pageLoading.set(false);
      return;
    }
    const batchId = parseInt(idParam, 10);
    this.pageLoading.set(true);
    this.pageError.set(null);

    try {
      const [batch, items, distribution, partners, platformsRaw] = await Promise.all([
        this.batchService.getBatch(batchId),
        this.batchService.listItems(batchId),
        this.batchService.getDistribution(batchId),
        this.partnerService.listPartners(),
        firstValueFrom(
          this.http.get<{ data?: ApiPlatform[] } | ApiPlatform[]>(`${environment.apiUrl}/platforms`)
        ),
      ]);

      this.batch.set(batch);
      this.items.set(items);
      this.distribution.set(distribution);
      this.allPartners.set(partners);

      // Initialise fee inputs from loaded batch
      this.deliveryFeeInput.set(batch.deliveryFee);
      this.otherFeesInput.set(batch.otherFees);

      const apiPlatforms: ApiPlatform[] = Array.isArray(platformsRaw)
        ? platformsRaw
        : ((platformsRaw as { data?: ApiPlatform[] }).data ?? []);
      this.platforms.set(apiPlatforms.filter((p: ApiPlatform) => p.isActive));

      this.initDistributionForm(distribution, partners.filter(p => p.isActive));
    } catch {
      this.pageError.set('Failed to load batch. Please try again.');
    } finally {
      this.pageLoading.set(false);
    }
  }

  private initDistributionForm(dist: DistributionDetail | null, activePartners: PartnerItem[]): void {
    if (dist) {
      this.retainedMode.set(dist.retainedMode);
      this.retainedValue.set(dist.retainedValue);
      this.distNotes = dist.notes ?? '';
      const savedMap = new Map(dist.shares.map(s => [s.partnerId, s.percentage]));
      this.partnerShares.set(activePartners.map(p => ({
        partnerId: p.id,
        partnerName: p.displayName,
        percentage: savedMap.get(p.id) ?? 0,
      })));
    } else {
      this.retainedMode.set('FIXED_AMOUNT');
      this.retainedValue.set(0);
      this.distNotes = '';
      this.partnerShares.set(activePartners.map(p => ({
        partnerId: p.id,
        partnerName: p.displayName,
        percentage: 0,
      })));
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  goBack(): void { this.router.navigate(['/admin/batches']); }
  goToPartners(): void { this.router.navigate(['/admin/partners']); }

  openInCalculator(): void {
    const platformList = this.platforms();
    const skus = this.items().map((item, idx) => {
      const firstSalePlatformId = item.saleRecords[0]?.platformId ?? null;
      const platform = firstSalePlatformId
        ? platformList.find(p => p.id === firstSalePlatformId)
        : undefined;
      return {
        id: idx + 1,
        name: item.itemName,
        productCost: item.unitCost,
        shippingCost: 0,
        platformId: platform?.slug ?? platformList[0]?.slug ?? 'shopee',
        platformFee: platform ? Number(platform.feePercent) : 0,
        desiredMargin: 20,
        quantity: item.quantity,
      };
    });
    this.router.navigate(['/calculator'], { state: { skus, batchId: this.batch()!.id, batchName: this.batch()!.name } });
  }

  // ── Batch fees (Fix #2) ─────────────────────────────────────────────────────
  async saveFees(): Promise<void> {
    const batchId = this.batch()!.id;
    this.savingFees.set(true);
    try {
      const updated = await this.batchService.updateBatch(batchId, {
        deliveryFee: this.deliveryFeeInput(),
        otherFees: this.otherFeesInput(),
      });
      this.batch.set(updated);
    } catch {
      // silently keep existing values
    } finally {
      this.savingFees.set(false);
    }
  }

  // ── Item expand/collapse (Fix #1) ──────────────────────────────────────────
  isExpanded(itemId: number): boolean {
    return this.expandedItemIds().includes(itemId);
  }

  toggleItemExpand(itemId: number): void {
    this.expandedItemIds.update(ids =>
      ids.includes(itemId) ? ids.filter(id => id !== itemId) : [...ids, itemId]
    );
  }

  // ── Add item ───────────────────────────────────────────────────────────────
  canSubmitAddItem(): boolean {
    return !!(this.addForm.itemName?.trim()
      && this.addForm.quantity > 0
      && this.addForm.unitCost >= 0);
  }

  cancelAddItem(): void {
    this.showAddItem.set(false);
    this.addForm = blankItemForm();
    this.addItemError.set(null);
  }

  async submitAddItem(): Promise<void> {
    if (!this.canSubmitAddItem()) return;
    const batchId = this.batch()!.id;
    this.addingItem.set(true);
    this.addItemError.set(null);
    try {
      const payload: CreateItemPayload = {
        itemName: this.addForm.itemName.trim(),
        quantity: this.addForm.quantity,
        unitCost: this.addForm.unitCost,
        notes: this.addForm.notes?.trim() || undefined,
      };
      const item = await this.batchService.createItem(batchId, payload);
      this.items.update(list => [...list, item]);
      await this.refreshBatch();
      this.addForm = blankItemForm();
      this.showAddItem.set(false);
    } catch {
      this.addItemError.set('Failed to save item. Please try again.');
    } finally {
      this.addingItem.set(false);
    }
  }

  // ── Edit item (inline) ─────────────────────────────────────────────────────
  startEditItem(item: BatchItem): void {
    this.editingItemId.set(item.id);
    this.editItemForm = {
      itemName: item.itemName,
      quantity: item.quantity,
      unitCost: item.unitCost,
      notes: item.notes ?? '',
    };
  }

  cancelEditItem(): void { this.editingItemId.set(null); }

  async submitEditItem(itemId: number): Promise<void> {
    const batchId = this.batch()!.id;
    this.savingItemEdit.set(true);
    try {
      const payload = {
        itemName: this.editItemForm.itemName.trim(),
        quantity: this.editItemForm.quantity,
        unitCost: this.editItemForm.unitCost,
        notes: this.editItemForm.notes?.trim() || undefined,
      };
      const updated = await this.batchService.updateItem(batchId, itemId, payload);
      this.items.update(list => list.map(i => i.id === itemId ? updated : i));
      await this.refreshBatch();
      this.editingItemId.set(null);
    } catch {
      // Leave row open on error
    } finally {
      this.savingItemEdit.set(false);
    }
  }

  // ── Delete item ────────────────────────────────────────────────────────────
  async deleteItem(itemId: number): Promise<void> {
    const batchId = this.batch()!.id;
    this.deletingItemId.set(itemId);
    try {
      await this.batchService.deleteItem(batchId, itemId);
      this.items.update(list => list.filter(i => i.id !== itemId));
      this.expandedItemIds.update(ids => ids.filter(id => id !== itemId));
      await this.refreshBatch();
    } catch {
      // No state change
    } finally {
      this.deletingItemId.set(null);
    }
  }

  // ── Record sale dialog ─────────────────────────────────────────────────────
  openRecordSaleDialog(item: BatchItem): void {
    this.recordSaleTarget.set(item);
    this.recordSaleForm = blankSaleForm();
    this.recordSaleError.set(null);
  }

  closeRecordSaleDialog(): void {
    this.recordSaleTarget.set(null);
    this.recordSaleError.set(null);
  }

  async submitRecordSale(): Promise<void> {
    const target = this.recordSaleTarget();
    if (!target) return;
    const batchId = this.batch()!.id;
    this.recordingSale.set(true);
    this.recordSaleError.set(null);
    try {
      const payload: CreateSaleRecordPayload = {
        quantity: this.recordSaleForm.quantity,
        unitSalePrice: this.recordSaleForm.unitSalePrice,
        platformId: this.recordSaleForm.platformId ?? null,
        notes: this.recordSaleForm.notes?.trim() || undefined,
      };
      const updated = await this.batchService.createSaleRecord(batchId, target.id, payload);
      this.items.update(list => list.map(i => i.id === target.id ? updated : i));
      // Auto-expand the item to show the new sale record
      if (!this.isExpanded(target.id)) {
        this.expandedItemIds.update(ids => [...ids, target.id]);
      }
      await this.refreshBatch();
      this.recordSaleTarget.set(null);
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message;
      this.recordSaleError.set(msg ?? 'Failed to record sale. Please try again.');
    } finally {
      this.recordingSale.set(false);
    }
  }

  // ── Edit sale dialog (Fix #1) ──────────────────────────────────────────────
  openEditSaleDialog(item: BatchItem, sale: SaleRecord): void {
    this.editSaleTarget.set({ item, sale });
    this.editSaleForm = {
      quantity: sale.quantity,
      unitSalePrice: sale.unitSalePrice,
      platformId: sale.platformId ?? undefined,
      notes: sale.notes ?? '',
    };
    this.editSaleError.set(null);
  }

  closeEditSaleDialog(): void {
    this.editSaleTarget.set(null);
    this.editSaleError.set(null);
  }

  async submitEditSale(): Promise<void> {
    const target = this.editSaleTarget();
    if (!target) return;
    const batchId = this.batch()!.id;
    this.editingSale.set(true);
    this.editSaleError.set(null);
    try {
      const payload: UpdateSaleRecordPayload = {
        quantity: this.editSaleForm.quantity,
        unitSalePrice: this.editSaleForm.unitSalePrice,
        platformId: this.editSaleForm.platformId ?? null,
        notes: this.editSaleForm.notes?.trim() || null,
      };
      const updated = await this.batchService.updateSaleRecord(batchId, target.item.id, target.sale.id, payload);
      this.items.update(list => list.map(i => i.id === target.item.id ? updated : i));
      await this.refreshBatch();
      this.editSaleTarget.set(null);
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message;
      this.editSaleError.set(msg ?? 'Failed to update sale. Please try again.');
    } finally {
      this.editingSale.set(false);
    }
  }

  // ── Delete individual sale record (Fix #1) ─────────────────────────────────
  async deleteSaleRecord(item: BatchItem, sale: SaleRecord): Promise<void> {
    const batchId = this.batch()!.id;
    this.deletingSaleId.set(sale.id);
    try {
      const updated = await this.batchService.deleteSaleRecord(batchId, item.id, sale.id);
      this.items.update(list => list.map(i => i.id === item.id ? updated : i));
      await this.refreshBatch();
    } catch {
      // No state change
    } finally {
      this.deletingSaleId.set(null);
    }
  }

  private async refreshBatch(): Promise<void> {
    try {
      const updated = await this.batchService.getBatch(this.batch()!.id);
      this.batch.set(updated);
    } catch { /* non-critical */ }
  }

  // ── Distribution ───────────────────────────────────────────────────────────
  updateSharePct(partnerId: number, value: number | string): void {
    const pct = Math.max(0, Math.min(100, parseFloat(String(value)) || 0));
    this.partnerShares.update(shares =>
      shares.map(s => s.partnerId === partnerId ? { ...s, percentage: pct } : s)
    );
  }

  equalSplit(): void {
    const count = this.activePartners().length;
    if (count === 0) return;
    const base = Math.floor((100 / count) * 2) / 2;
    const last = Math.round((100 - base * (count - 1)) * 10) / 10;
    this.partnerShares.update(shares => shares.map((s, i) => ({
      ...s,
      percentage: i === shares.length - 1 ? last : base,
    })));
  }

  cancelEditDistribution(): void {
    this.editingDistribution.set(false);
    this.initDistributionForm(this.distribution(), this.activePartners());
  }

  async saveDistribution(): Promise<void> {
    if (this.totalPct() !== 100 || this.activePartners().length === 0) return;
    const batchId = this.batch()!.id;
    this.savingDistribution.set(true);
    this.distSaveError.set(null);
    try {
      const saved = await this.batchService.saveDistribution(batchId, {
        retainedMode: this.retainedMode(),
        retainedValue: this.retainedValue() || 0,
        notes: this.distNotes.trim() || undefined,
        shares: this.partnerShares().map(s => ({ partnerId: s.partnerId, percentage: s.percentage })),
      });
      this.distribution.set(saved);
      this.editingDistribution.set(false);
      await this.refreshBatch();
    } catch {
      this.distSaveError.set('Failed to save distribution. Please try again.');
    } finally {
      this.savingDistribution.set(false);
    }
  }

  // ── Close batch ────────────────────────────────────────────────────────────
  confirmCloseBatch(): void {
    this.showCloseConfirm.set(true);
    this.closeError.set(null);
  }

  async executeClosure(): Promise<void> {
    const batchId = this.batch()!.id;
    this.closing.set(true);
    this.closeError.set(null);
    try {
      const updated = await this.batchService.closeBatch(batchId);
      this.batch.set(updated);
      this.showCloseConfirm.set(false);
    } catch {
      this.closeError.set('Failed to close batch. Please try again.');
    } finally {
      this.closing.set(false);
    }
  }

  // ── Print batch summary ────────────────────────────────────────────────────
  printBatch(): void { window.print(); }

  // ── Print per-partner income slip (Fix #4) ─────────────────────────────────
  printIncomeSlip(share: DistributionShare): void {
    const batch = this.batch()!;
    const dist = this.distribution()!;
    const date = new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' });
    const fmt = (v: number) => 'RM ' + v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const platformRows = this.platformBreakdown()
      .map(pb => `<div class="row"><span class="label">${pb.name}</span><span class="val">${fmt(pb.revenue)}</span></div>`)
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Income Statement — ${share.partnerName}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 48px; color: #000; max-width: 520px; margin: 0 auto; font-size: 14px; }
  h1 { font-size: 24px; font-weight: 700; margin: 0 0 4px; }
  .meta { font-size: 13px; color: #666; margin: 0 0 20px; }
  hr { border: none; border-top: 2px solid #000; margin: 14px 0; }
  hr.light { border-top: 1px solid #ddd; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #999; margin: 14px 0 6px; }
  .row { display: flex; justify-content: space-between; padding: 5px 0; }
  .label { color: #555; }
  .val { font-weight: 600; }
  .highlight { font-size: 20px; font-weight: 700; color: #000; }
  .footer { margin-top: 32px; font-size: 11px; color: #999; border-top: 1px solid #ccc; padding-top: 10px; }
  @media print { @page { margin: 20mm; } }
</style></head><body>
<h1>Income Statement</h1>
<p class="meta">Batch: <strong>${batch.name}</strong> &nbsp;|&nbsp; Date: ${date}</p>
<hr>
<p class="section-title">Batch Financials</p>
<div class="row"><span class="label">Total Revenue</span><span class="val">${fmt(dist.totalRevenue)}</span></div>
<div class="row"><span class="label">Total Cost</span><span class="val">${fmt(dist.totalCost)}</span></div>
<div class="row"><span class="label">Gross Profit</span><span class="val">${fmt(dist.grossProfit)}</span></div>
${platformRows.length ? `<hr class="light"><p class="section-title">Revenue by Platform</p>${platformRows}<hr class="light">` : '<hr class="light">'}
<div class="row"><span class="label">Retained in Business</span><span class="val">${fmt(dist.retainedAmount)}</span></div>
<div class="row"><span class="label">Distributable Profit</span><span class="val">${fmt(dist.distributedAmount)}</span></div>
<hr>
<p class="section-title">Your Share</p>
<div class="row"><span class="label">Partner</span><span class="val">${share.partnerName}</span></div>
<div class="row"><span class="label">Share Percentage</span><span class="val">${share.percentage}%</span></div>
<div class="row" style="margin-top:8px"><span class="label highlight">Your Payout</span><span class="val highlight">${fmt(share.amount)}</span></div>
<div class="footer">Generated by TCG Pricing Calculator — ${date}</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`;

    const w = window.open('', '_blank', 'width=700,height=650');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  // ── Print / format helpers ─────────────────────────────────────────────────
  printDate(): string {
    return new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  formatRM(value: number | null | undefined): string {
    return 'RM ' + (value ?? 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
