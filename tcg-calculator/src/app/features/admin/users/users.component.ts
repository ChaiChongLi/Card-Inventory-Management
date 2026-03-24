import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../core/services/user.service';
import { ApiUser } from '../../../shared/models/api.models';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-top">
        <div>
          <h2 class="page-title">Workers</h2>
          <p class="page-sub">Manage calculator access for your team members</p>
        </div>
        <button class="btn btn-primary btn-sm" (click)="toggleCreateForm()">
          {{ showCreateForm() ? '✕ Cancel' : '+ Create Worker' }}
        </button>
      </div>

      <!-- Create form -->
      @if (showCreateForm()) {
        <div class="create-card">
          <h3 class="create-title">New Worker Account</h3>
          <div class="form-row">
            <div class="field-group">
              <label class="field-label">Username</label>
              <input class="form-control" type="text" [(ngModel)]="newUsername" placeholder="e.g. john_doe" [disabled]="creating()" />
            </div>
            <div class="field-group">
              <label class="field-label">Password</label>
              <input class="form-control" type="password" [(ngModel)]="newPassword" placeholder="Min 8 characters" [disabled]="creating()" />
            </div>
          </div>
          @if (createError()) {
            <div class="error-msg">{{ createError() }}</div>
          }
          <div class="create-footer">
            <button class="btn btn-primary btn-sm" (click)="createUser()" [disabled]="creating() || !newUsername || !newPassword">
              {{ creating() ? 'Creating...' : 'Create Account' }}
            </button>
          </div>
        </div>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="state-row">
          <div class="spinner-ring"></div>
          <span>Loading users...</span>
        </div>
      } @else if (loadError()) {
        <div class="state-row error">
          <span>{{ loadError() }}</span>
          <button class="btn btn-secondary btn-sm" (click)="load()">Retry</button>
        </div>
      } @else {
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (user of users(); track user.id) {
                <tr>
                  <td class="td-user">
                    <span class="avatar">{{ user.username[0].toUpperCase() }}</span>
                    {{ user.username }}
                  </td>
                  <td>
                    <span class="badge" [class.badge-admin]="user.role === 'ADMIN'" [class.badge-worker]="user.role === 'WORKER'">
                      {{ user.role }}
                    </span>
                  </td>
                  <td>
                    <span class="status-dot" [class.active]="user.isActive" [class.inactive]="!user.isActive">
                      {{ user.isActive ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td class="td-date">{{ formatDate(user.createdAt) }}</td>
                  <td>
                    <div class="action-row">
                      <button
                        class="btn btn-sm"
                        [class.btn-secondary]="user.isActive"
                        [class.btn-ghost-green]="!user.isActive"
                        (click)="toggleActive(user)"
                        [disabled]="toggling() === user.id"
                      >
                        {{ toggling() === user.id ? '...' : (user.isActive ? 'Deactivate' : 'Activate') }}
                      </button>
                      <button
                        class="btn btn-danger btn-sm"
                        (click)="confirmDelete(user)"
                        [disabled]="user.role === 'ADMIN'"
                        [title]="user.role === 'ADMIN' ? 'Cannot delete admin accounts' : 'Delete user'"
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
            <h2 class="dialog-title">Delete User?</h2>
            <p class="dialog-body">
              Are you sure you want to delete <strong>{{ deleteTarget()!.username }}</strong>?
              All their sessions will be unaffected but they will lose access.
            </p>
            <div class="dialog-actions">
              <button class="btn btn-ghost" (click)="cancelDelete()">Cancel</button>
              <button class="btn btn-danger" (click)="executeDelete()" [disabled]="deleting()">
                {{ deleting() ? 'Deleting...' : 'Delete' }}
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

    .error-msg {
      font-size: 12px;
      color: var(--danger);
      margin-bottom: 12px;
    }

    .create-footer { display: flex; justify-content: flex-end; }

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

    .td-user {
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

    .badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 2px 8px;
      border-radius: 99px;

      &.badge-admin { background: var(--accent-glow); color: var(--accent); }
      &.badge-worker { background: var(--info-bg); color: var(--info); }
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
export class UsersComponent implements OnInit {
  private userService = inject(UserService);

  users = signal<ApiUser[]>([]);
  loading = signal(false);
  loadError = signal<string | null>(null);

  showCreateForm = signal(false);
  newUsername = '';
  newPassword = '';
  createError = signal<string | null>(null);
  creating = signal(false);

  toggling = signal<number | null>(null);
  deleteTarget = signal<ApiUser | null>(null);
  deleting = signal(false);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const list = await this.userService.listUsers();
      this.users.set(list);
    } catch {
      this.loadError.set('Failed to load users.');
    } finally {
      this.loading.set(false);
    }
  }

  toggleCreateForm(): void {
    this.showCreateForm.update(v => !v);
    this.newUsername = '';
    this.newPassword = '';
    this.createError.set(null);
  }

  async createUser(): Promise<void> {
    if (!this.newUsername || !this.newPassword) return;
    this.creating.set(true);
    this.createError.set(null);
    try {
      const user = await this.userService.createUser(this.newUsername.trim(), this.newPassword);
      this.users.update(list => [...list, user]);
      this.showCreateForm.set(false);
      this.newUsername = '';
      this.newPassword = '';
    } catch (err: unknown) {
      const httpErr = err as { status?: number };
      if (httpErr?.status === 409) {
        this.createError.set('Username already exists.');
      } else {
        this.createError.set('Failed to create user. Please try again.');
      }
    } finally {
      this.creating.set(false);
    }
  }

  async toggleActive(user: ApiUser): Promise<void> {
    this.toggling.set(user.id);
    try {
      const updated = await this.userService.updateUser(user.id, { isActive: !user.isActive });
      this.users.update(list => list.map(u => u.id === user.id ? updated : u));
    } catch {
      // Error — no state change
    } finally {
      this.toggling.set(null);
    }
  }

  confirmDelete(user: ApiUser): void {
    this.deleteTarget.set(user);
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  async executeDelete(): Promise<void> {
    const target = this.deleteTarget();
    if (!target) return;
    this.deleting.set(true);
    try {
      await this.userService.deleteUser(target.id);
      this.users.update(list => list.filter(u => u.id !== target.id));
      this.deleteTarget.set(null);
    } catch {
      // Keep dialog open
    } finally {
      this.deleting.set(false);
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
