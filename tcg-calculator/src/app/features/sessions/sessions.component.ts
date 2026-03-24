import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { CalculatorComponent } from '../calculator/calculator.component';
import { ApiSession } from '../../shared/models/api.models';

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="sessions-shell">

      <header class="page-header">
        <div class="header-left">
          <a class="btn btn-ghost btn-sm" routerLink="/dashboard">← Back</a>
          <div>
            <h1 class="page-title">Sessions</h1>
            <p class="page-sub">Load or manage your saved pricing sessions</p>
          </div>
        </div>
        <button class="btn btn-primary" (click)="openCreate()">+ New Session</button>
      </header>

      <!-- Create session form -->
      @if (showCreateForm()) {
        <div class="create-banner">
          <input
            class="form-control create-input"
            type="text"
            [(ngModel)]="createName"
            placeholder="Session name (e.g. March Shopee Batch)"
            (keydown.enter)="submitCreate()"
            autofocus
          />
          @if (createError()) {
            <span class="create-error">{{ createError() }}</span>
          }
          <div class="create-actions">
            <button class="btn btn-ghost btn-sm" (click)="cancelCreate()">Cancel</button>
            <button class="btn btn-primary btn-sm" (click)="submitCreate()" [disabled]="creating()">
              {{ creating() ? 'Creating...' : 'Create' }}
            </button>
          </div>
        </div>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="state-center">
          <div class="spinner-ring"></div>
          <p>Loading sessions...</p>
        </div>
      } @else if (loadError()) {
        <div class="state-center error">
          <p>{{ loadError() }}</p>
          <button class="btn btn-secondary btn-sm" (click)="load()">Retry</button>
        </div>
      } @else if (sessions().length === 0) {
        <div class="state-center">
          <div class="empty-icon">📁</div>
          <h3>No sessions yet</h3>
          <p>Create a session to save and sync your SKUs</p>
          <button class="btn btn-primary" (click)="openCreate()">+ New Session</button>
        </div>
      } @else {
        <div class="session-grid">
          @for (session of sessions(); track session.id) {
            <div class="session-card" [class.active-session]="activeSessionId() === session.id">
              <div class="card-top">
                <div class="card-icon">📁</div>
                <div class="card-meta">
                  <span class="card-name">{{ session.name }}</span>
                  <span class="card-owner">by {{ session.user.username }}</span>
                </div>
              </div>
              <div class="card-stats">
                <div class="stat">
                  <span class="stat-label">SKUs</span>
                  <span class="stat-val">{{ session.skuCount ?? 0 }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Updated</span>
                  <span class="stat-val">{{ formatDate(session.updatedAt) }}</span>
                </div>
              </div>
              <div class="card-actions">
                <button class="btn btn-primary btn-sm" (click)="openSession(session)" [disabled]="opening() === session.id">
                  {{ opening() === session.id ? 'Loading...' : 'Open' }}
                </button>
                <button class="btn btn-danger btn-sm" (click)="confirmDelete(session)" [disabled]="deleting() === session.id">
                  {{ deleting() === session.id ? 'Deleting...' : 'Delete' }}
                </button>
              </div>
            </div>
          }
        </div>
      }

      <!-- Delete confirm dialog -->
      @if (deleteTarget()) {
        <div class="dialog-backdrop" (click)="cancelDelete()">
          <div class="dialog-card" (click)="$event.stopPropagation()">
            <h2 class="dialog-title">Delete Session?</h2>
            <p class="dialog-body">
              Are you sure you want to delete <strong>{{ deleteTarget()!.name }}</strong>?
              This cannot be undone.
            </p>
            <div class="dialog-actions">
              <button class="btn btn-ghost" (click)="cancelDelete()">Cancel</button>
              <button class="btn btn-danger" (click)="executeDelete()" [disabled]="deleting() !== null">Delete</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .sessions-shell {
      min-height: 100vh;
      background: var(--bg-base);
      padding: 0;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 20px 28px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 10;
      flex-wrap: wrap;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .page-title {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-primary);
      background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .page-sub {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    /* Create banner */
    .create-banner {
      margin: 20px 28px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .create-input {
      flex: 1;
      min-width: 200px;
    }

    .create-error {
      font-size: 12px;
      color: var(--danger);
      width: 100%;
    }

    .create-actions {
      display: flex;
      gap: 8px;
    }

    /* States */
    .state-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 80px 24px;
      text-align: center;
      color: var(--text-secondary);

      &.error { color: var(--danger); }

      .empty-icon { font-size: 48px; opacity: 0.5; }
      h3 { font-size: 18px; color: var(--text-primary); }
      p  { font-size: 13px; }
    }

    .spinner-ring {
      width: 32px;
      height: 32px;
      border: 3px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* Session grid */
    .session-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
      padding: 24px 28px;
    }

    .session-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      transition: border-color 0.15s, box-shadow 0.15s;

      &:hover {
        border-color: var(--border-hover);
        box-shadow: var(--shadow);
      }

      &.active-session {
        border-color: var(--accent);
        box-shadow: 0 0 0 2px var(--accent-glow);
      }
    }

    .card-top {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: var(--bg-elevated);
      border-bottom: 1px solid var(--border);
    }

    .card-icon {
      font-size: 24px;
    }

    .card-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden;
    }

    .card-name {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-owner {
      font-size: 11px;
      color: var(--text-muted);
    }

    .card-stats {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--border);
    }

    .stat {
      flex: 1;
      padding: 10px 16px;
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 2px;

      &:last-child { border-right: none; }
    }

    .stat-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
    }

    .stat-val {
      font-family: var(--font-display);
      font-size: 15px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .card-actions {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      justify-content: flex-end;
    }

    /* Delete dialog */
    .dialog-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px);
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .dialog-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 28px;
      width: 100%;
      max-width: 400px;
      box-shadow: var(--shadow-lg);
    }

    .dialog-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 10px;
    }

    .dialog-body {
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: 20px;
      line-height: 1.6;

      strong { color: var(--text-primary); }
    }

    .dialog-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
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

      &:focus {
        border-color: var(--border-focus);
        box-shadow: 0 0 0 3px var(--accent-glow);
      }

      &::placeholder { color: var(--text-muted); }
    }

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
      transition: all 0.15s ease;
      white-space: nowrap;
      outline: none;
      text-decoration: none;

      &.btn-primary { background: var(--accent); color: var(--text-inverse); border-color: var(--accent); &:hover:not(:disabled) { background: var(--accent-dark); } }
      &.btn-secondary { background: transparent; color: var(--text-primary); border-color: var(--border); &:hover:not(:disabled) { background: var(--bg-elevated); } }
      &.btn-ghost { background: transparent; color: var(--text-secondary); &:hover:not(:disabled) { background: var(--bg-elevated); color: var(--text-primary); } }
      &.btn-danger { background: transparent; color: var(--danger); border-color: var(--danger); &:hover:not(:disabled) { background: var(--danger-bg); } }
      &.btn-sm { padding: 5px 10px; font-size: 12px; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
  `],
})
export class SessionsComponent implements OnInit {
  private sessionService = inject(SessionService);
  private router = inject(Router);

  sessions = this.sessionService.sessions;
  activeSessionId = signal<number | null>(this.sessionService.currentSession()?.id ?? null);

  loading = signal(false);
  loadError = signal<string | null>(null);

  showCreateForm = signal(false);
  createName = '';
  createError = signal<string | null>(null);
  creating = signal(false);

  opening = signal<number | null>(null);
  deleting = signal<number | null>(null);
  deleteTarget = signal<ApiSession | null>(null);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      await this.sessionService.loadSessions();
    } catch {
      this.loadError.set('Failed to load sessions. Check your connection.');
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    this.createName = '';
    this.createError.set(null);
    this.showCreateForm.set(true);
  }

  cancelCreate(): void {
    this.showCreateForm.set(false);
  }

  async submitCreate(): Promise<void> {
    const name = this.createName.trim();
    if (!name) {
      this.createError.set('Session name is required.');
      return;
    }
    this.creating.set(true);
    this.createError.set(null);
    try {
      await this.sessionService.createSession(name);
      this.showCreateForm.set(false);
      this.router.navigate(['/calculator']);
    } catch {
      this.createError.set('Failed to create session.');
    } finally {
      this.creating.set(false);
    }
  }

  async openSession(session: ApiSession): Promise<void> {
    this.opening.set(session.id);
    try {
      const { skus } = await this.sessionService.loadSession(session.id);
      this.activeSessionId.set(session.id);
      this.router.navigate(['/calculator'], { state: { skus } });
    } catch {
      // Navigation stays on sessions page, opening clears
    } finally {
      this.opening.set(null);
    }
  }

  confirmDelete(session: ApiSession): void {
    this.deleteTarget.set(session);
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  async executeDelete(): Promise<void> {
    const target = this.deleteTarget();
    if (!target) return;
    this.deleting.set(target.id);
    try {
      await this.sessionService.deleteSession(target.id);
      this.deleteTarget.set(null);
    } catch {
      // Keep dialog open so user can retry
    } finally {
      this.deleting.set(null);
    }
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
