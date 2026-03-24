import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PartnerService } from '../../../core/services/partner.service';
import { PartnerItem } from '../../../shared/models/api.models';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-partners',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-top">
        <div>
          <h2 class="page-title">Partners</h2>
          <p class="page-sub">Manage profit-sharing partners for batch distributions</p>
        </div>
        <button class="btn btn-primary btn-sm" (click)="toggleCreateForm()">
          {{ showCreateForm() ? '✕ Cancel' : '+ Add Partner' }}
        </button>
      </div>

      <!-- Create form -->
      @if (showCreateForm()) {
        <div class="create-card">
          <h3 class="create-title">New Partner</h3>
          <div class="form-row">
            <div class="field-group">
              <label class="field-label">Display Name</label>
              <input
                class="form-control"
                type="text"
                [(ngModel)]="newDisplayName"
                placeholder="e.g. Ahmad"
                [disabled]="creating()"
              />
            </div>
            <div class="field-group">
              <label class="field-label">Select User</label>
              @if (loadingUsers()) {
                <div class="field-hint">Loading users...</div>
              } @else if (availableUsers().length === 0) {
                <div class="field-hint">No available users. All users are already partners or none exist.</div>
              } @else {
                <select class="form-control" [(ngModel)]="selectedUserId" [disabled]="creating()">
                  <option [ngValue]="null">— Select a user —</option>
                  @for (u of availableUsers(); track u.id) {
                    <option [ngValue]="u.id">{{ u.username }} ({{ u.role }})</option>
                  }
                </select>
              }
            </div>
          </div>
          @if (createError()) {
            <div class="error-msg">{{ createError() }}</div>
          }
          <div class="create-footer">
            <button
              class="btn btn-primary btn-sm"
              (click)="createPartner()"
              [disabled]="creating() || !newDisplayName.trim() || !selectedUserId"
            >
              {{ creating() ? 'Adding...' : 'Add Partner' }}
            </button>
          </div>
        </div>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="state-row">
          <div class="spinner-ring"></div>
          <span>Loading partners...</span>
        </div>
      } @else if (loadError()) {
        <div class="state-row error">
          <span>{{ loadError() }}</span>
          <button class="btn btn-secondary btn-sm" (click)="load()">Retry</button>
        </div>
      } @else if (partners().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">🤝</div>
          <p class="empty-title">No partners yet</p>
          <p class="empty-sub">Add a partner to enable profit distribution on batches</p>
        </div>
      } @else {
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Display Name</th>
                <th>Linked Account</th>
                <th>Status</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (partner of partners(); track partner.id) {
                <tr>
                  <td class="td-name">
                    <span class="avatar">{{ partner.displayName[0].toUpperCase() }}</span>
                    {{ partner.displayName }}
                  </td>
                  <td class="td-username">
                    <span class="username-badge">{{ partner.username }}</span>
                    <span class="user-id">#{{ partner.userId }}</span>
                  </td>
                  <td>
                    <span class="status-dot" [class.active]="partner.isActive" [class.inactive]="!partner.isActive">
                      {{ partner.isActive ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td class="td-date">{{ formatDate(partner.createdAt) }}</td>
                  <td>
                    <div class="action-row">
                      <button
                        class="btn btn-sm"
                        [class.btn-secondary]="partner.isActive"
                        [class.btn-ghost-green]="!partner.isActive"
                        (click)="toggleActive(partner)"
                        [disabled]="toggling() === partner.id"
                      >
                        {{ toggling() === partner.id ? '...' : (partner.isActive ? 'Deactivate' : 'Activate') }}
                      </button>
                      <button
                        class="btn btn-danger btn-sm"
                        (click)="confirmDelete(partner)"
                        [disabled]="toggling() === partner.id"
                        title="Delete partner"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Delete confirm dialog -->
      @if (deleteTarget()) {
        <div class="dialog-backdrop" (click)="cancelDelete()">
          <div class="dialog-card" (click)="$event.stopPropagation()">
            <h2 class="dialog-title">Remove Partner?</h2>
            <p class="dialog-body">
              Are you sure you want to remove <strong>{{ deleteTarget()!.displayName }}</strong>?
              This will not affect existing distributions that have already been saved.
            </p>
            @if (deleteError()) {
              <div class="error-msg" style="margin-bottom: 12px;">{{ deleteError() }}</div>
            }
            <div class="dialog-actions">
              <button class="btn btn-ghost" (click)="cancelDelete()">Cancel</button>
              <button class="btn btn-danger-solid" (click)="executeDelete()" [disabled]="deleting()">
                {{ deleting() ? 'Removing...' : 'Remove' }}
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

    .field-hint {
      font-size: 11px;
      color: var(--text-muted);
    }

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

    /* Table */
    .table-wrap {
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;

      thead tr {
        background: var(--bg-elevated);
        border-bottom: 1px solid var(--border);
      }

      th {
        padding: 10px 14px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--text-muted);
        text-align: left;
      }

      tbody tr {
        border-bottom: 1px solid var(--border);
        background: var(--bg-card);
        transition: background 0.1s;

        &:hover { background: var(--bg-elevated); }
        &:last-child { border-bottom: none; }
      }

      td { padding: 12px 14px; font-size: 13px; color: var(--text-primary); }
    }

    .td-name {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
    }

    .avatar {
      width: 28px; height: 28px;
      background: var(--accent-glow);
      color: var(--accent);
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .td-username {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .username-badge {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .user-id {
      font-size: 11px;
      color: var(--text-muted);
    }

    .status-dot {
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;

      &::before {
        content: '';
        width: 7px; height: 7px;
        border-radius: 50%;
        display: inline-block;
      }

      &.active { color: var(--profit); &::before { background: var(--profit); } }
      &.inactive { color: var(--text-muted); &::before { background: var(--text-muted); } }
    }

    .td-date { color: var(--text-secondary); font-size: 12px; }

    .action-row { display: flex; gap: 6px; }

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
      &.btn-ghost-green { background: transparent; color: var(--profit); border-color: var(--profit); &:hover:not(:disabled) { background: var(--profit-bg); } }
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
      width: 100%; max-width: 400px;
      box-shadow: var(--shadow-lg);
    }

    .dialog-title { font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px; }
    .dialog-body { font-size: 14px; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.6; strong { color: var(--text-primary); } }
    .dialog-actions { display: flex; gap: 10px; justify-content: flex-end; }

    @media (max-width: 600px) {
      .form-row { grid-template-columns: 1fr; }
    }
  `],
})
export class PartnersComponent implements OnInit {
  private partnerService = inject(PartnerService);
  private http = inject(HttpClient);

  partners = signal<PartnerItem[]>([]);
  loading = signal(false);
  loadError = signal<string | null>(null);

  showCreateForm = signal(false);
  newDisplayName = '';
  selectedUserId: number | null = null;
  availableUsers = signal<Array<{ id: number; username: string; role: string }>>([]);
  loadingUsers = signal(false);
  createError = signal<string | null>(null);
  creating = signal(false);

  toggling = signal<number | null>(null);
  deleteTarget = signal<PartnerItem | null>(null);
  deleteError = signal<string | null>(null);
  deleting = signal(false);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async loadAvailableUsers(): Promise<void> {
    this.loadingUsers.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<{ data: Array<{ id: number; username: string; role: string }> }>(
          `${environment.apiUrl}/partners/available-users`
        )
      );
      this.availableUsers.set(res.data);
    } catch {
      this.availableUsers.set([]);
    } finally {
      this.loadingUsers.set(false);
    }
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const list = await this.partnerService.listPartners();
      this.partners.set(list);
    } catch {
      this.loadError.set('Failed to load partners.');
    } finally {
      this.loading.set(false);
    }
  }

  toggleCreateForm(): void {
    this.showCreateForm.update(v => !v);
    this.newDisplayName = '';
    this.selectedUserId = null;
    this.createError.set(null);
    if (!this.showCreateForm()) return;
    this.loadAvailableUsers();
  }

  async createPartner(): Promise<void> {
    if (!this.newDisplayName.trim() || !this.selectedUserId) return;
    this.creating.set(true);
    this.createError.set(null);
    try {
      const partner = await this.partnerService.createPartner(this.selectedUserId, this.newDisplayName.trim());
      this.partners.update(list => [...list, partner]);
      this.showCreateForm.set(false);
      this.newDisplayName = '';
      this.selectedUserId = null;
    } catch (err: unknown) {
      const httpErr = err as { status?: number };
      if (httpErr?.status === 409) {
        this.createError.set('This user is already linked to a partner.');
      } else if (httpErr?.status === 404) {
        this.createError.set('User ID not found. Please check and try again.');
      } else {
        this.createError.set('Failed to add partner. Please try again.');
      }
    } finally {
      this.creating.set(false);
    }
  }

  async toggleActive(partner: PartnerItem): Promise<void> {
    this.toggling.set(partner.id);
    try {
      const updated = await this.partnerService.updatePartner(partner.id, { isActive: !partner.isActive });
      this.partners.update(list => list.map(p => p.id === partner.id ? updated : p));
    } catch {
      // No state change on error
    } finally {
      this.toggling.set(null);
    }
  }

  confirmDelete(partner: PartnerItem): void {
    this.deleteTarget.set(partner);
    this.deleteError.set(null);
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
    this.deleteError.set(null);
  }

  async executeDelete(): Promise<void> {
    const target = this.deleteTarget();
    if (!target) return;
    this.deleting.set(true);
    this.deleteError.set(null);
    try {
      await this.partnerService.deletePartner(target.id);
      this.partners.update(list => list.filter(p => p.id !== target.id));
      this.deleteTarget.set(null);
    } catch {
      this.deleteError.set('Failed to remove partner. They may have distributions linked to them.');
    } finally {
      this.deleting.set(false);
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
