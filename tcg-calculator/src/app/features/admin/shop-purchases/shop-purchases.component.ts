import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

interface ShopPurchase {
  id: number;
  buyerName: string;
  itemName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  purchaseDate: string;
  category: string | null;
  notes: string | null;
  createdAt: string;
}

interface PurchaseForm {
  buyerName: string;
  itemName: string;
  quantity: number | null;
  unitCost: number | null;
  purchaseDate: string;
  category: string;
  notes: string;
}

function emptyForm(): PurchaseForm {
  return {
    buyerName: '',
    itemName: '',
    quantity: null,
    unitCost: null,
    purchaseDate: new Date().toISOString().split('T')[0],
    category: '',
    notes: '',
  };
}

@Component({
  selector: 'app-shop-purchases',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Shop Purchases</h1>
          <p class="page-sub">Track who bought items for the shop</p>
        </div>
        <button class="btn btn-primary" (click)="openAdd()">+ Add Purchase</button>
      </div>

      <!-- Summary bar -->
      @if (purchases().length > 0) {
        <div class="summary-bar">
          <div class="summary-item">
            <span class="summary-label">Total Records</span>
            <span class="summary-value">{{ purchases().length }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Total Spend</span>
            <span class="summary-value accent">RM {{ totalSpend() | number:'1.2-2' }}</span>
          </div>
          @if (uniqueBuyers().length > 0) {
            <div class="summary-item">
              <span class="summary-label">Buyers</span>
              <span class="summary-value">{{ uniqueBuyers().join(', ') }}</span>
            </div>
          }
        </div>
      }

      <!-- Filter -->
      @if (purchases().length > 0) {
        <div class="filter-bar">
          <input
            class="input filter-input"
            type="text"
            placeholder="Filter by buyer or item..."
            [ngModel]="filterText()"
            (ngModelChange)="filterText.set($event)"
          />
        </div>
      }

      @if (loading()) {
        <div class="empty-state">Loading...</div>
      } @else if (error()) {
        <div class="alert alert-error">{{ error() }}</div>
      } @else if (purchases().length === 0) {
        <div class="empty-state">
          <p>No purchases recorded yet.</p>
          <button class="btn btn-primary" (click)="openAdd()">Add First Purchase</button>
        </div>
      } @else if (filtered().length === 0) {
        <div class="empty-state">No records match "{{ filterText() }}".</div>
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Buyer</th>
                <th>Item</th>
                <th>Category</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Unit Cost</th>
                <th class="text-right">Total</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (p of filtered(); track p.id) {
                <tr>
                  <td class="date-cell">{{ p.purchaseDate }}</td>
                  <td class="buyer-cell">{{ p.buyerName }}</td>
                  <td>{{ p.itemName }}</td>
                  <td>
                    @if (p.category) {
                      <span class="badge">{{ p.category }}</span>
                    } @else {
                      <span class="text-muted">—</span>
                    }
                  </td>
                  <td class="text-right">{{ p.quantity }}</td>
                  <td class="text-right">RM {{ p.unitCost | number:'1.2-2' }}</td>
                  <td class="text-right total-cell">RM {{ p.totalCost | number:'1.2-2' }}</td>
                  <td class="notes-cell">{{ p.notes ?? '—' }}</td>
                  <td class="actions-cell">
                    <button class="btn btn-ghost btn-sm" (click)="openEdit(p)">Edit</button>
                    <button
                      class="btn btn-danger btn-sm"
                      [disabled]="deletingId() === p.id"
                      (click)="delete(p)"
                    >{{ deletingId() === p.id ? '...' : 'Delete' }}</button>
                  </td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td colspan="6" class="text-right foot-label">Filtered Total</td>
                <td class="text-right total-cell">RM {{ filteredTotal() | number:'1.2-2' }}</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      }
    </div>

    <!-- Add / Edit Dialog -->
    @if (showDialog()) {
      <div class="overlay" (click)="closeDialog()">
        <div class="dialog" (click)="$event.stopPropagation()">
          <div class="dialog-header">
            <h2 class="dialog-title">{{ editingId() ? 'Edit Purchase' : 'Add Purchase' }}</h2>
            <button class="btn btn-ghost btn-sm" (click)="closeDialog()">✕</button>
          </div>

          @if (formError()) {
            <div class="alert alert-error">{{ formError() }}</div>
          }

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Buyer Name *</label>
              <input class="input" type="text" [(ngModel)]="form.buyerName" placeholder="Who bought it?" />
            </div>

            <div class="form-group">
              <label class="form-label">Purchase Date *</label>
              <input class="input" type="date" [(ngModel)]="form.purchaseDate" />
            </div>

            <div class="form-group full-width">
              <label class="form-label">Item Name *</label>
              <input class="input" type="text" [(ngModel)]="form.itemName" placeholder="What was bought?" />
            </div>

            <div class="form-group">
              <label class="form-label">Quantity *</label>
              <input class="input" type="number" min="1" step="1" [(ngModel)]="form.quantity" placeholder="0" />
            </div>

            <div class="form-group">
              <label class="form-label">Unit Cost (RM) *</label>
              <input class="input" type="number" min="0" step="0.01" [(ngModel)]="form.unitCost" placeholder="0.00" />
            </div>

            <div class="form-group">
              <label class="form-label">Category</label>
              <input class="input" type="text" [(ngModel)]="form.category" placeholder="e.g. Stock, Supplies, Equipment" />
            </div>

            <div class="form-group full-width">
              <label class="form-label">Notes</label>
              <textarea class="input textarea" [(ngModel)]="form.notes" rows="2" placeholder="Optional notes"></textarea>
            </div>
          </div>

          <div class="dialog-footer">
            <button class="btn btn-ghost" (click)="closeDialog()">Cancel</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="submit()">
              {{ saving() ? 'Saving...' : (editingId() ? 'Save Changes' : 'Add Purchase') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page { max-width: 1100px; }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 20px;
      gap: 12px;
    }

    .page-title { font-size: 22px; font-weight: 700; color: var(--text-primary); margin: 0 0 4px; }
    .page-sub { font-size: 13px; color: var(--text-muted); margin: 0; }

    .summary-bar {
      display: flex;
      gap: 24px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 14px 20px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .summary-item { display: flex; flex-direction: column; gap: 2px; }
    .summary-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); }
    .summary-value { font-size: 15px; font-weight: 600; color: var(--text-primary); }
    .summary-value.accent { color: var(--accent); }

    .filter-bar { margin-bottom: 16px; }
    .filter-input { max-width: 340px; }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      font-size: 14px;
    }

    .alert { padding: 10px 14px; border-radius: var(--radius-sm); font-size: 13px; margin-bottom: 16px; }
    .alert-error { background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }

    .table-wrap { overflow-x: auto; }

    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .table th, .table td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }

    .table th {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      background: var(--bg-surface);
    }

    .table tbody tr:hover { background: var(--bg-elevated); }

    .table tfoot td {
      font-weight: 600;
      color: var(--text-primary);
      background: var(--bg-surface);
      border-top: 2px solid var(--border);
    }

    .text-right { text-align: right; }
    .text-muted { color: var(--text-muted); }
    .foot-label { color: var(--text-muted); font-size: 12px; }

    .date-cell { white-space: nowrap; color: var(--text-muted); font-size: 12px; }
    .buyer-cell { font-weight: 600; color: var(--text-primary); }
    .total-cell { font-weight: 600; color: var(--accent); }
    .notes-cell { color: var(--text-muted); font-size: 12px; max-width: 160px; }
    .actions-cell { white-space: nowrap; text-align: right; }

    .badge {
      display: inline-block;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 2px 8px;
      font-size: 11px;
      color: var(--text-secondary);
    }

    /* Dialog */
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 20px;
    }

    .dialog {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      width: 100%;
      max-width: 540px;
      padding: 24px;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .dialog-title { font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0; }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 20px;
    }

    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group.full-width { grid-column: 1 / -1; }
    .form-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }

    .dialog-footer {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }

    .input {
      background: var(--bg-base);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      padding: 8px 10px;
      font-size: 13px;
      font-family: var(--font-sans);
      width: 100%;
      box-sizing: border-box;
      &:focus { outline: none; border-color: var(--accent); }
    }

    .textarea { resize: vertical; min-height: 60px; }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 600;
      font-family: var(--font-sans);
      cursor: pointer;
      border: 1px solid transparent;
      text-decoration: none;
      transition: all 0.15s;

      &:disabled { opacity: 0.5; cursor: not-allowed; }
      &.btn-primary { background: var(--accent); color: #000; border-color: var(--accent); &:hover:not(:disabled) { opacity: 0.85; } }
      &.btn-ghost { background: transparent; color: var(--text-secondary); &:hover:not(:disabled) { background: var(--bg-elevated); color: var(--text-primary); } }
      &.btn-danger { background: transparent; color: #f87171; border-color: rgba(239,68,68,0.3); &:hover:not(:disabled) { background: rgba(239,68,68,0.1); } }
      &.btn-sm { padding: 5px 10px; font-size: 12px; }
    }
  `],
})
export class ShopPurchasesComponent implements OnInit {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/shop-purchases`;

  purchases = signal<ShopPurchase[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  filterText = signal('');
  deletingId = signal<number | null>(null);

  showDialog = signal(false);
  editingId = signal<number | null>(null);
  form: PurchaseForm = emptyForm();
  saving = signal(false);
  formError = signal<string | null>(null);

  filtered = computed(() => {
    const q = this.filterText().toLowerCase().trim();
    if (!q) return this.purchases();
    return this.purchases().filter(
      p => p.buyerName.toLowerCase().includes(q) || p.itemName.toLowerCase().includes(q),
    );
  });

  totalSpend = computed(() =>
    this.purchases().reduce((sum, p) => sum + p.totalCost, 0),
  );

  filteredTotal = computed(() =>
    this.filtered().reduce((sum, p) => sum + p.totalCost, 0),
  );

  uniqueBuyers = computed(() =>
    [...new Set(this.purchases().map(p => p.buyerName))].sort(),
  );

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<{ data: ShopPurchase[] }>(this.apiUrl),
      );
      this.purchases.set(res.data);
    } catch {
      this.error.set('Failed to load purchases. Please refresh.');
    } finally {
      this.loading.set(false);
    }
  }

  openAdd() {
    this.editingId.set(null);
    this.form = emptyForm();
    this.formError.set(null);
    this.showDialog.set(true);
  }

  openEdit(p: ShopPurchase) {
    this.editingId.set(p.id);
    this.form = {
      buyerName: p.buyerName,
      itemName: p.itemName,
      quantity: p.quantity,
      unitCost: p.unitCost,
      purchaseDate: p.purchaseDate,
      category: p.category ?? '',
      notes: p.notes ?? '',
    };
    this.formError.set(null);
    this.showDialog.set(true);
  }

  closeDialog() {
    this.showDialog.set(false);
  }

  async submit() {
    const f = this.form;
    if (!f.buyerName.trim()) { this.formError.set('Buyer name is required.'); return; }
    if (!f.itemName.trim()) { this.formError.set('Item name is required.'); return; }
    if (!f.quantity || f.quantity < 1) { this.formError.set('Quantity must be at least 1.'); return; }
    if (f.unitCost === null || f.unitCost < 0) { this.formError.set('Unit cost must be 0 or more.'); return; }
    if (!f.purchaseDate) { this.formError.set('Purchase date is required.'); return; }

    this.saving.set(true);
    this.formError.set(null);

    const body = {
      buyerName: f.buyerName.trim(),
      itemName: f.itemName.trim(),
      quantity: f.quantity,
      unitCost: f.unitCost,
      purchaseDate: f.purchaseDate,
      category: f.category.trim() || undefined,
      notes: f.notes.trim() || undefined,
    };

    try {
      const id = this.editingId();
      if (id) {
        const res = await firstValueFrom(
          this.http.patch<{ data: ShopPurchase }>(`${this.apiUrl}/${id}`, body),
        );
        this.purchases.update(list =>
          list.map(p => (p.id === id ? res.data : p)),
        );
      } else {
        const res = await firstValueFrom(
          this.http.post<{ data: ShopPurchase }>(this.apiUrl, body),
        );
        this.purchases.update(list => [res.data, ...list]);
      }
      this.showDialog.set(false);
    } catch {
      this.formError.set('Failed to save. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  async delete(p: ShopPurchase) {
    if (!confirm(`Delete purchase: "${p.itemName}" by ${p.buyerName}?`)) return;
    this.deletingId.set(p.id);
    try {
      await firstValueFrom(this.http.delete(`${this.apiUrl}/${p.id}`));
      this.purchases.update(list => list.filter(x => x.id !== p.id));
    } catch {
      alert('Failed to delete. Please try again.');
    } finally {
      this.deletingId.set(null);
    }
  }
}
