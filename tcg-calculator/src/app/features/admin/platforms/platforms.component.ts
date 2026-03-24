import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiPlatform } from '../../../shared/models/api.models';
import { PlatformService } from '../../../core/services/platform.service';

@Component({
  selector: 'app-admin-platforms',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-top">
        <div>
          <h2 class="page-title">Platforms</h2>
          <p class="page-sub">Edit platform fee percentages and active status</p>
        </div>
      </div>

      @if (loading()) {
        <div class="state-row">
          <div class="spinner-ring"></div>
          <span>Loading platforms...</span>
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
                <th>Platform</th>
                <th>Slug</th>
                <th>Fee %</th>
                <th>Customizable</th>
                <th>Status</th>
                <th>Order</th>
              </tr>
            </thead>
            <tbody>
              @for (platform of platforms(); track platform.id) {
                <tr>
                  <td class="td-name">{{ platform.name }}</td>
                  <td class="td-slug"><code>{{ platform.slug }}</code></td>
                  <td class="td-fee">
                    <div class="inline-edit">
                      <input
                        class="fee-input"
                        type="number"
                        min="0"
                        max="50"
                        step="0.1"
                        [value]="platform.feePercent"
                        (blur)="onFeeBlur(platform, $any($event.target).value)"
                        [disabled]="saving() === platform.id"
                      />
                      <span class="pct-label">%</span>
                      @if (saving() === platform.id) {
                        <span class="saving-dot">...</span>
                      }
                      @if (savedId() === platform.id) {
                        <span class="saved-dot">✓</span>
                      }
                    </div>
                  </td>
                  <td>
                    <span class="badge" [class.badge-yes]="platform.isCustomizable" [class.badge-no]="!platform.isCustomizable">
                      {{ platform.isCustomizable ? 'Yes' : 'No' }}
                    </span>
                  </td>
                  <td>
                    <button
                      class="btn btn-sm"
                      [class.btn-active]="platform.isActive"
                      [class.btn-inactive]="!platform.isActive"
                      (click)="toggleActive(platform)"
                      [disabled]="toggling() === platform.id"
                    >
                      {{ toggling() === platform.id ? '...' : (platform.isActive ? 'Active' : 'Inactive') }}
                    </button>
                  </td>
                  <td class="td-order">{{ platform.sortOrder }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (saveError()) {
          <div class="error-toast">{{ saveError() }}</div>
        }
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
    }

    .page-title { font-size: 20px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .page-sub { font-size: 13px; color: var(--text-muted); }

    .state-row {
      display: flex; align-items: center; gap: 12px;
      padding: 24px 0; color: var(--text-secondary); font-size: 13px;
      &.error { color: var(--danger); }
    }

    .spinner-ring {
      width: 24px; height: 24px;
      border: 2px solid var(--border); border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .table-wrap {
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;

      thead tr { background: var(--bg-elevated); border-bottom: 1px solid var(--border); }

      th {
        padding: 10px 14px;
        font-size: 10px; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.8px;
        color: var(--text-muted); text-align: left;
      }

      tbody tr {
        border-bottom: 1px solid var(--border);
        background: var(--bg-card);
        transition: background 0.1s;

        &:hover { background: var(--bg-elevated); }
        &:last-child { border-bottom: none; }
      }

      td { padding: 12px 14px; font-size: 13px; color: var(--text-primary); vertical-align: middle; }
    }

    .td-name { font-weight: 600; }
    .td-slug code { font-size: 11px; background: var(--bg-input); padding: 2px 6px; border-radius: 4px; color: var(--text-secondary); }
    .td-order { color: var(--text-muted); }

    .inline-edit {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .fee-input {
      width: 70px;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-family: var(--font-sans);
      font-size: 13px;
      padding: 5px 8px;
      outline: none;
      transition: border-color 0.15s;

      &:focus { border-color: var(--border-focus); }
      &:disabled { opacity: 0.5; }
    }

    .pct-label { font-size: 12px; color: var(--text-muted); }
    .saving-dot { font-size: 12px; color: var(--text-muted); }
    .saved-dot { font-size: 13px; color: var(--profit); }

    .badge {
      font-size: 11px; font-weight: 600;
      padding: 2px 8px; border-radius: 99px;
      &.badge-yes { background: var(--profit-bg); color: var(--profit); }
      &.badge-no  { background: rgba(255,255,255,0.04); color: var(--text-muted); }
    }

    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 14px; border-radius: var(--radius-sm);
      font-size: 12px; font-weight: 600; font-family: var(--font-sans);
      cursor: pointer; border: 1px solid transparent; transition: all 0.15s; outline: none;

      &.btn-active  { background: var(--profit-bg); color: var(--profit); border-color: var(--profit); &:hover:not(:disabled) { background: rgba(16,185,129,0.2); } }
      &.btn-inactive { background: transparent; color: var(--text-muted); border-color: var(--border); &:hover:not(:disabled) { background: var(--bg-elevated); color: var(--text-primary); } }
      &.btn-secondary { background: transparent; color: var(--text-primary); border-color: var(--border); &:hover:not(:disabled) { background: var(--bg-elevated); } }
      &.btn-sm { padding: 4px 10px; font-size: 11px; }
      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }

    .error-toast {
      margin-top: 12px;
      background: var(--danger-bg);
      border: 1px solid var(--danger);
      border-radius: var(--radius-sm);
      color: var(--danger);
      font-size: 12px;
      padding: 8px 12px;
    }
  `],
})
export class PlatformsComponent implements OnInit {
  private http = inject(HttpClient);
  private platformService = inject(PlatformService);

  platforms = signal<ApiPlatform[]>([]);
  loading = signal(false);
  loadError = signal<string | null>(null);
  saving = signal<number | null>(null);
  savedId = signal<number | null>(null);
  toggling = signal<number | null>(null);
  saveError = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<{ data: ApiPlatform[] }>(`${environment.apiUrl}/platforms?includeInactive=true`)
      );
      this.platforms.set(res.data.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch {
      this.loadError.set('Failed to load platforms.');
    } finally {
      this.loading.set(false);
    }
  }

  async onFeeBlur(platform: ApiPlatform, rawValue: string): Promise<void> {
    const fee = parseFloat(rawValue);
    if (isNaN(fee) || fee === platform.feePercent) return;
    if (fee < 0 || fee > 50) {
      this.saveError.set('Fee must be between 0 and 50.');
      return;
    }

    this.saving.set(platform.id);
    this.saveError.set(null);
    try {
      const res = await firstValueFrom(
        this.http.patch<{ data: ApiPlatform }>(`${environment.apiUrl}/platforms/${platform.id}`, { feePercent: fee })
      );
      const updated = res.data;
      this.platforms.update(list => list.map(p => p.id === platform.id ? updated : p));
      this.savedId.set(platform.id);
      setTimeout(() => this.savedId.set(null), 2000);
      // Refresh the PlatformService so calculator picks up the new fee
      await this.platformService.load();
    } catch {
      this.saveError.set('Failed to save fee. Please try again.');
    } finally {
      this.saving.set(null);
    }
  }

  async toggleActive(platform: ApiPlatform): Promise<void> {
    this.toggling.set(platform.id);
    this.saveError.set(null);
    try {
      const res = await firstValueFrom(
        this.http.patch<{ data: ApiPlatform }>(`${environment.apiUrl}/platforms/${platform.id}`, { isActive: !platform.isActive })
      );
      const updated = res.data;
      this.platforms.update(list => list.map(p => p.id === platform.id ? updated : p));
      await this.platformService.load();
    } catch {
      this.saveError.set('Failed to update platform status.');
    } finally {
      this.toggling.set(null);
    }
  }
}
