import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BatchService } from '../../../core/services/batch.service';
import { BatchSummary } from '../../../shared/models/api.models';

@Component({
  selector: 'app-admin-batches',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-top">
        <div>
          <h2 class="page-title">Batches</h2>
          <p class="page-sub">Track sales and distribute profits across partners</p>
        </div>
        <button class="btn btn-primary btn-sm" (click)="toggleCreateForm()">
          {{ showCreateForm() ? '✕ Cancel' : '+ New Batch' }}
        </button>
      </div>

      <!-- Create form -->
      @if (showCreateForm()) {
        <div class="create-card">
          <h3 class="create-title">New Batch</h3>
          <div class="form-row">
            <div class="field-group">
              <label class="field-label">Batch Name <span class="required">*</span></label>
              <input
                class="form-control"
                type="text"
                [(ngModel)]="newName"
                placeholder="e.g. March Week 1"
                [disabled]="creating()"
              />
            </div>
            <div class="field-group">
              <label class="field-label">Description <span class="optional">(optional)</span></label>
              <input
                class="form-control"
                type="text"
                [(ngModel)]="newDescription"
                placeholder="e.g. Shopee + TikTok sales"
                [disabled]="creating()"
              />
            </div>
          </div>
          @if (createError()) {
            <div class="error-msg">{{ createError() }}</div>
          }
          <div class="create-footer">
            <button
              class="btn btn-primary btn-sm"
              (click)="createBatch()"
              [disabled]="creating() || !newName.trim()"
            >
              {{ creating() ? 'Creating...' : 'Create Batch' }}
            </button>
          </div>
        </div>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="state-row">
          <div class="spinner-ring"></div>
          <span>Loading batches...</span>
        </div>
      } @else if (loadError()) {
        <div class="state-row error">
          <span>{{ loadError() }}</span>
          <button class="btn btn-secondary btn-sm" (click)="load()">Retry</button>
        </div>
      } @else if (batches().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <p class="empty-title">No batches yet</p>
          <p class="empty-sub">Create your first batch to start recording sales</p>
        </div>
      } @else {
        <div class="batch-grid">
          @for (batch of batches(); track batch.id) {
            <div class="batch-card" (click)="openBatch(batch)">
              <div class="batch-card-header">
                <div class="batch-card-title-row">
                  <h3 class="batch-name">{{ batch.name }}</h3>
                  <span class="status-badge" [class.open]="batch.status === 'OPEN'" [class.closed]="batch.status === 'CLOSED'">
                    {{ batch.status }}
                  </span>
                </div>
                @if (batch.description) {
                  <p class="batch-desc">{{ batch.description }}</p>
                }
              </div>

              <div class="batch-financials">
                <div class="fin-item">
                  <span class="fin-label">Revenue</span>
                  <span class="fin-value">{{ formatRM(batch.totalRevenue) }}</span>
                </div>
                <div class="fin-divider"></div>
                <div class="fin-item">
                  <span class="fin-label">Cost</span>
                  <span class="fin-value">{{ formatRM(batch.totalCost) }}</span>
                </div>
                <div class="fin-divider"></div>
                <div class="fin-item">
                  <span class="fin-label">Profit</span>
                  <span class="fin-value" [class.profit-pos]="batch.grossProfit > 0" [class.profit-neg]="batch.grossProfit < 0">
                    {{ formatRM(batch.grossProfit) }}
                  </span>
                </div>
              </div>

              <div class="batch-meta">
                <div class="meta-chips">
                  <span class="meta-chip">
                    <span class="chip-icon">📦</span>
                    {{ batch.itemCount }} {{ batch.itemCount === 1 ? 'item' : 'items' }} ({{ batch.soldCount }} sold)
                  </span>
                  <span class="meta-chip" [class.chip-saved]="batch.hasDistribution" [class.chip-pending]="!batch.hasDistribution">
                    <span class="chip-icon">{{ batch.hasDistribution ? '✓' : '○' }}</span>
                    {{ batch.hasDistribution ? 'Distribution saved' : 'Distribution pending' }}
                  </span>
                </div>
                <div class="meta-right">
                  <span class="meta-date">{{ formatDate(batch.createdAt) }}</span>
                  @if (batch.status === 'OPEN') {
                    <button
                      class="btn btn-danger btn-sm"
                      (click)="confirmDelete(batch, $event)"
                      [disabled]="deleting() === batch.id"
                      title="Delete batch"
                    >
                      {{ deleting() === batch.id ? '...' : 'Delete' }}
                    </button>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Delete confirm dialog -->
      @if (deleteTarget()) {
        <div class="dialog-backdrop" (click)="cancelDelete()">
          <div class="dialog-card" (click)="$event.stopPropagation()">
            <h2 class="dialog-title">Delete Batch?</h2>
            <p class="dialog-body">
              Are you sure you want to delete <strong>{{ deleteTarget()!.name }}</strong>?
              All sales in this batch will also be permanently removed.
            </p>
            @if (deleteError()) {
              <div class="error-msg" style="margin-bottom: 12px;">{{ deleteError() }}</div>
            }
            <div class="dialog-actions">
              <button class="btn btn-ghost" (click)="cancelDelete()">Cancel</button>
              <button class="btn btn-danger-solid" (click)="executeDelete()" [disabled]="confirmDeleting()">
                {{ confirmDeleting() ? 'Deleting...' : 'Delete Batch' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { }

    .page-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .page-title {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 4px;
    }

    .page-sub { font-size: 13px; color: var(--text-muted); }

    /* Create card */
    .create-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
      margin-bottom: 24px;
    }

    .create-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 16px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }

    .field-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .field-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
    }

    .required { color: var(--danger); }
    .optional { color: var(--text-muted); font-weight: 400; text-transform: none; letter-spacing: 0; }

    .error-msg {
      font-size: 12px;
      color: var(--danger);
      margin-bottom: 12px;
    }

    .create-footer { display: flex; justify-content: flex-end; }

    /* Empty state */
    .empty-state {
      padding: 60px 24px;
      text-align: center;
    }

    .empty-icon { font-size: 40px; margin-bottom: 12px; }
    .empty-title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
    .empty-sub { font-size: 13px; color: var(--text-muted); }

    /* State rows */
    .state-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 24px 0;
      color: var(--text-secondary);
      font-size: 13px;

      &.error { color: var(--danger); }
    }

    .spinner-ring {
      width: 24px; height: 24px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* Batch grid */
    .batch-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 16px;
    }

    .batch-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 18px;
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s;
      display: flex;
      flex-direction: column;
      gap: 14px;

      &:hover {
        border-color: var(--border-hover);
        box-shadow: var(--shadow);
      }
    }

    .batch-card-header { }

    .batch-card-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 4px;
    }

    .batch-name {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .batch-desc {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .status-badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 3px 8px;
      border-radius: 99px;
      flex-shrink: 0;

      &.open { background: var(--profit-bg); color: var(--profit); }
      &.closed { background: var(--accent-glow); color: var(--accent); }
    }

    /* Financials row */
    .batch-financials {
      display: flex;
      align-items: center;
      gap: 0;
      background: var(--bg-elevated);
      border-radius: var(--radius);
      padding: 12px 16px;
    }

    .fin-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .fin-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
    }

    .fin-value {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary);

      &.profit-pos { color: var(--profit); }
      &.profit-neg { color: var(--danger); }
    }

    .fin-divider {
      width: 1px;
      height: 32px;
      background: var(--border);
      margin: 0 16px;
      flex-shrink: 0;
    }

    /* Meta row */
    .batch-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .meta-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .meta-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 500;
      padding: 3px 8px;
      border-radius: 99px;
      background: var(--bg-elevated);
      color: var(--text-secondary);
      border: 1px solid var(--border);

      .chip-icon { font-size: 10px; }

      &.chip-saved { background: var(--profit-bg); color: var(--profit); border-color: transparent; }
      &.chip-pending { background: var(--bg-elevated); color: var(--text-muted); }
    }

    .meta-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .meta-date {
      font-size: 11px;
      color: var(--text-muted);
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 600;
      font-family: var(--font-sans);
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s;
      outline: none;
      white-space: nowrap;

      &.btn-primary { background: var(--accent); color: var(--text-inverse); border-color: var(--accent); &:hover:not(:disabled) { background: var(--accent-dark); } }
      &.btn-secondary { background: transparent; color: var(--text-primary); border-color: var(--border); &:hover:not(:disabled) { background: var(--bg-elevated); } }
      &.btn-ghost { background: transparent; color: var(--text-secondary); &:hover:not(:disabled) { background: var(--bg-elevated); color: var(--text-primary); } }
      &.btn-danger { background: transparent; color: var(--danger); border-color: var(--danger); &:hover:not(:disabled) { background: var(--danger-bg); } }
      &.btn-danger-solid { background: var(--danger); color: #fff; border-color: var(--danger); &:hover:not(:disabled) { opacity: 0.9; } }
      &.btn-sm { padding: 5px 10px; font-size: 12px; }
      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }

    .form-control {
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-family: var(--font-sans);
      font-size: 13px;
      padding: 7px 10px;
      width: 100%;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;

      &:focus { border-color: var(--border-focus); box-shadow: 0 0 0 3px var(--accent-glow); }
      &::placeholder { color: var(--text-muted); }
      &:disabled { opacity: 0.5; }
    }

    /* Dialog */
    .dialog-backdrop {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px);
      z-index: 200;
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
    }

    .dialog-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 28px;
      width: 100%; max-width: 420px;
      box-shadow: var(--shadow-lg);
    }

    .dialog-title { font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px; }
    .dialog-body { font-size: 14px; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.6; strong { color: var(--text-primary); } }
    .dialog-actions { display: flex; gap: 10px; justify-content: flex-end; }

    @media (max-width: 600px) {
      .form-row { grid-template-columns: 1fr; }
      .batch-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class BatchesComponent implements OnInit {
  private batchService = inject(BatchService);
  private router = inject(Router);

  batches = signal<BatchSummary[]>([]);
  loading = signal(false);
  loadError = signal<string | null>(null);

  showCreateForm = signal(false);
  newName = '';
  newDescription = '';
  createError = signal<string | null>(null);
  creating = signal(false);

  deleting = signal<number | null>(null);
  deleteTarget = signal<BatchSummary | null>(null);
  deleteError = signal<string | null>(null);
  confirmDeleting = signal(false);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const list = await this.batchService.listBatches();
      // Most recent first
      this.batches.set([...list].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch {
      this.loadError.set('Failed to load batches.');
    } finally {
      this.loading.set(false);
    }
  }

  toggleCreateForm(): void {
    this.showCreateForm.update(v => !v);
    this.newName = '';
    this.newDescription = '';
    this.createError.set(null);
  }

  async createBatch(): Promise<void> {
    if (!this.newName.trim()) return;
    this.creating.set(true);
    this.createError.set(null);
    try {
      const batch = await this.batchService.createBatch(
        this.newName.trim(),
        this.newDescription.trim() || undefined
      );
      this.batches.update(list => [batch, ...list]);
      this.showCreateForm.set(false);
      this.newName = '';
      this.newDescription = '';
      // Navigate directly to the new batch
      await this.router.navigate(['/admin/batches', batch.id]);
    } catch {
      this.createError.set('Failed to create batch. Please try again.');
    } finally {
      this.creating.set(false);
    }
  }

  openBatch(batch: BatchSummary): void {
    this.router.navigate(['/admin/batches', batch.id]);
  }

  confirmDelete(batch: BatchSummary, event: Event): void {
    event.stopPropagation();
    this.deleteTarget.set(batch);
    this.deleteError.set(null);
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
    this.deleteError.set(null);
  }

  async executeDelete(): Promise<void> {
    const target = this.deleteTarget();
    if (!target) return;
    this.confirmDeleting.set(true);
    this.deleteError.set(null);
    try {
      await this.batchService.deleteBatch(target.id);
      this.batches.update(list => list.filter(b => b.id !== target.id));
      this.deleteTarget.set(null);
    } catch {
      this.deleteError.set('Failed to delete batch. Please try again.');
    } finally {
      this.confirmDeleting.set(false);
    }
  }

  formatRM(value: number): string {
    return 'RM ' + value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
