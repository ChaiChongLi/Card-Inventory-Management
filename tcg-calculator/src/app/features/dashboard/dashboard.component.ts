import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgApexchartsModule } from 'ng-apexcharts';
import type {
  ApexChart,
  ApexAxisChartSeries,
  ApexXAxis,
  ApexStroke,
  ApexFill,
  ApexTooltip,
  ApexDataLabels,
  ApexGrid,
  ApexNonAxisChartSeries,
  ApexLegend,
  ApexPlotOptions,
  ApexYAxis,
} from 'ng-apexcharts';

import { AuthService } from '../../core/services/auth.service';
import { DashboardService, DashboardStats } from '../../core/services/dashboard.service';

type Period = '30d' | 'all';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DecimalPipe, RouterLink, NgApexchartsModule],
  template: `
    <div class="dash-shell">

      <!-- ── Top nav ───────────────────────────────────────────── -->
      <header class="top-nav">
        <a class="nav-brand" routerLink="/dashboard">TCG Pricing</a>
        <nav class="nav-links">
          <a class="nav-link active" routerLink="/dashboard">Dashboard</a>
          @if (authService.currentUser()?.role === 'ADMIN') {
            <a class="nav-link" routerLink="/admin">Admin</a>
          }
        </nav>
        <div class="nav-right">
          <span class="nav-user">{{ authService.currentUser()?.username }}</span>
          <button class="btn btn-ghost btn-sm" (click)="authService.logout()">Logout</button>
        </div>
      </header>

      <main class="dash-main">

        <!-- ── Header row ───────────────────────────────────────── -->
        <div class="dash-header">
          <h1 class="dash-title">Dashboard</h1>
          <div class="header-actions">
            <!-- Period toggle -->
            <div class="period-toggle">
              <button
                class="period-btn"
                [class.active]="period() === '30d'"
                (click)="setPeriod('30d')"
              >Last 30 Days</button>
              <button
                class="period-btn"
                [class.active]="period() === 'all'"
                (click)="setPeriod('all')"
              >All Time</button>
            </div>
            <button class="btn btn-ghost btn-sm" (click)="load()" [disabled]="loading()">
              ↻ Refresh
            </button>
          </div>
        </div>

        <!-- ── Error ─────────────────────────────────────────────── -->
        @if (error()) {
          <div class="alert-error">{{ error() }}</div>
        }

        @if (stats()) {
          <!-- ── Stat cards ───────────────────────────────────────── -->
          <div class="stat-grid">
            <div class="stat-card">
              <div class="stat-icon stat-icon--amber">📦</div>
              <div class="stat-body">
                <div class="stat-value">{{ stats()!.openBatches }}</div>
                <div class="stat-label">Open Batches</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-icon--green">✅</div>
              <div class="stat-body">
                <div class="stat-value">{{ stats()!.closedBatches }}</div>
                <div class="stat-label">Closed Batches</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-icon--blue">💰</div>
              <div class="stat-body">
                <div class="stat-value">RM {{ stats()!.totalRevenue | number:'1.0-0' }}</div>
                <div class="stat-label">Total Revenue{{ period() === '30d' ? ' (30d)' : '' }}</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-icon--purple">🛒</div>
              <div class="stat-body">
                <div class="stat-value">RM {{ stats()!.shopPurchasesSpend | number:'1.0-0' }}</div>
                <div class="stat-label">Shop Purchases{{ period() === '30d' ? ' (30d)' : '' }}</div>
              </div>
            </div>
          </div>

          <!-- ── Charts row ───────────────────────────────────────── -->
          <div class="chart-row">

            <!-- Revenue trend -->
            <div class="chart-card chart-card--wide">
              <h2 class="chart-title">
                {{ period() === '30d' ? 'Revenue — Last 30 Days' : 'Revenue — Last 12 Months' }}
              </h2>
              @if (trendSeries[0]?.data?.length === 0) {
                <div class="chart-empty">No sales recorded yet</div>
              } @else {
                <apx-chart
                  [series]="trendSeries"
                  [chart]="trendChart"
                  [xaxis]="trendXAxis"
                  [yaxis]="trendYAxis"
                  [stroke]="trendStroke"
                  [fill]="trendFill"
                  [dataLabels]="dataLabels"
                  [grid]="chartGrid"
                  [tooltip]="chartTooltip"
                  [colors]="['#f59e0b']"
                />
              }
            </div>

            <!-- Revenue by platform donut -->
            <div class="chart-card">
              <h2 class="chart-title">Revenue by Platform</h2>
              @if (stats()!.revenueByPlatform.length === 0) {
                <div class="chart-empty">No sales recorded yet</div>
              } @else {
                <apx-chart
                  [series]="donutSeries"
                  [chart]="donutChart"
                  [labels]="donutLabels"
                  [legend]="donutLegend"
                  [plotOptions]="donutPlotOptions"
                  [dataLabels]="donutDataLabels"
                  [tooltip]="donutTooltip"
                  [colors]="donutColors"
                />
              }
            </div>
          </div>

          <!-- ── Recent Batches ────────────────────────────────────── -->
          <div class="recent-card">
            <div class="recent-header">
              <h2 class="chart-title" style="margin:0">Recent Batches</h2>
              @if (authService.currentUser()?.role === 'ADMIN') {
                <a class="btn btn-ghost btn-sm" routerLink="/admin/batches">View All →</a>
              }
            </div>
            @if (stats()!.recentBatches.length === 0) {
              <div class="empty-state">No batches yet. Go to Admin → Batches to create one.</div>
            } @else {
              <table class="recent-table">
                <thead>
                  <tr>
                    <th>Batch Name</th>
                    <th>Status</th>
                    <th class="text-right">Items</th>
                    <th class="text-right">Revenue</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  @for (b of stats()!.recentBatches; track b.id) {
                    <tr>
                      <td class="batch-name">{{ b.name }}</td>
                      <td>
                        <span class="status-badge" [class.status-open]="b.status === 'OPEN'" [class.status-closed]="b.status === 'CLOSED'">
                          {{ b.status }}
                        </span>
                      </td>
                      <td class="text-right">{{ b.itemCount }}</td>
                      <td class="text-right batch-revenue">RM {{ b.revenue | number:'1.2-2' }}</td>
                      <td class="batch-date">{{ formatDate(b.createdAt) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        }

        <!-- ── Loading ───────────────────────────────────────────── -->
        @if (loading()) {
          <div class="loading-overlay">
            <div class="spinner-ring"></div>
          </div>
        }

      </main>
    </div>
  `,
  styles: [`
    .dash-shell {
      min-height: 100vh;
      background: var(--bg-base);
      display: flex;
      flex-direction: column;
    }

    /* ── Nav ── */
    .top-nav {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      padding: 0 1.5rem;
      height: 56px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .nav-brand {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1rem;
      color: var(--accent);
      white-space: nowrap;
      text-decoration: none;
    }
    .nav-links { display: flex; gap: 0.25rem; flex: 1; }
    .nav-link {
      padding: 0.35rem 0.75rem;
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.875rem;
      transition: color 0.15s, background 0.15s;
      &:hover { color: var(--text-primary); background: var(--bg-card); }
      &.active { color: var(--accent); background: var(--accent-glow); }
    }
    .nav-right { display: flex; align-items: center; gap: 0.75rem; }
    .nav-user { font-size: 0.8125rem; color: var(--text-secondary); }

    /* ── Main ── */
    .dash-main {
      flex: 1;
      padding: 1.5rem;
      max-width: 1400px;
      width: 100%;
      margin: 0 auto;
    }

    /* ── Header ── */
    .dash-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
      gap: 12px;
      flex-wrap: wrap;
    }
    .dash-title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .header-actions { display: flex; align-items: center; gap: 10px; }

    /* ── Period toggle ── */
    .period-toggle {
      display: flex;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }
    .period-btn {
      padding: 5px 14px;
      font-size: 12px;
      font-weight: 600;
      font-family: var(--font-sans);
      cursor: pointer;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      transition: background 0.15s, color 0.15s;
      &:hover { color: var(--text-primary); }
      &.active { background: var(--accent); color: #000; }
    }

    .alert-error {
      background: var(--danger-bg);
      border: 1px solid var(--danger);
      color: var(--danger);
      padding: 0.75rem 1rem;
      border-radius: var(--radius);
      margin-bottom: 1.25rem;
      font-size: 0.875rem;
    }

    /* ── Stat cards ── */
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.375rem;
      flex-shrink: 0;
    }
    .stat-icon--amber  { background: var(--accent-glow); }
    .stat-icon--green  { background: var(--profit-bg); }
    .stat-icon--blue   { background: var(--info-bg); }
    .stat-icon--purple { background: rgba(139, 92, 246, 0.12); }
    .stat-value {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1;
    }
    .stat-label { font-size: 0.8125rem; color: var(--text-secondary); margin-top: 0.25rem; }

    /* ── Charts ── */
    .chart-row {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .chart-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
    }
    .chart-title {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 1rem;
    }
    .chart-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: var(--text-muted);
      font-size: 0.875rem;
    }

    /* ── Recent batches ── */
    .recent-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
    }
    .recent-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }
    .recent-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    .recent-table th {
      text-align: left;
      padding: 0.5rem 0.75rem;
      color: var(--text-muted);
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--border);
    }
    .recent-table td {
      padding: 0.65rem 0.75rem;
      border-bottom: 1px solid rgba(42, 58, 82, 0.5);
    }
    .recent-table tr:last-child td { border-bottom: none; }
    .recent-table tr:hover td { background: var(--bg-elevated); }

    .text-right { text-align: right; }
    .batch-name { color: var(--text-primary); font-weight: 500; }
    .batch-revenue { color: var(--accent); font-weight: 600; }
    .batch-date { color: var(--text-muted); font-size: 0.8125rem; }

    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .status-open   { background: var(--accent-glow); color: var(--accent); }
    .status-closed { background: var(--profit-bg); color: var(--profit); }

    .empty-state {
      padding: 2rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.875rem;
    }

    /* ── Loading ── */
    .loading-overlay { display: flex; justify-content: center; padding: 4rem; }

    /* ── Responsive ── */
    @media (max-width: 1024px) {
      .stat-grid { grid-template-columns: repeat(2, 1fr); }
      .chart-row { grid-template-columns: 1fr; }
    }
    @media (max-width: 600px) {
      .stat-grid { grid-template-columns: 1fr 1fr; }
      .dash-main { padding: 1rem; }
      .dash-header { flex-direction: column; align-items: flex-start; }
    }

    .btn { display:inline-flex; align-items:center; gap:.375rem; border:none; border-radius:var(--radius-sm); cursor:pointer; font-size:.8125rem; font-weight:500; padding:.4rem .8rem; text-decoration:none; transition:background .15s,color .15s; font-family:var(--font-sans); }
    .btn-ghost { background:transparent; color:var(--text-secondary); &:hover{background:var(--bg-elevated);color:var(--text-primary);} }
    .btn-sm { padding:.3rem .65rem; font-size:.8125rem; }
    .btn:disabled { opacity:.5; cursor:not-allowed; }
    .spinner-ring { width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class DashboardComponent implements OnInit {
  readonly authService = inject(AuthService);
  private dashboardService = inject(DashboardService);

  period = signal<Period>('30d');
  stats = signal<DashboardStats | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  // ── Area chart ───────────────────────────────────────────────────────────
  trendSeries: ApexAxisChartSeries = [];
  trendChart: ApexChart = {
    type: 'area',
    height: 220,
    background: 'transparent',
    foreColor: '#8fa3c0',
    toolbar: { show: false },
  };
  trendXAxis: ApexXAxis = {
    categories: [],
    labels: { style: { colors: '#8fa3c0', fontSize: '11px' }, rotate: -30 },
    axisBorder: { show: false },
    axisTicks: { show: false },
  };
  trendYAxis: ApexYAxis = {
    labels: {
      style: { colors: '#8fa3c0', fontSize: '11px' },
      formatter: (v: number) => `RM ${v.toFixed(0)}`,
    },
  };
  trendStroke: ApexStroke = { curve: 'smooth', width: 2 };
  trendFill: ApexFill = {
    type: 'gradient',
    gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] },
  };
  dataLabels: ApexDataLabels = { enabled: false };
  chartGrid: ApexGrid = {
    borderColor: '#2a3a52',
    strokeDashArray: 4,
    xaxis: { lines: { show: false } },
  };
  chartTooltip: ApexTooltip = {
    theme: 'dark',
    y: { formatter: (v: number) => `RM ${v.toFixed(2)}` },
  };

  // ── Donut chart ──────────────────────────────────────────────────────────
  donutSeries: ApexNonAxisChartSeries = [];
  donutLabels: string[] = [];
  donutChart: ApexChart = {
    type: 'donut',
    height: 260,
    background: 'transparent',
    foreColor: '#8fa3c0',
    toolbar: { show: false },
  };
  donutLegend: ApexLegend = {
    position: 'bottom',
    labels: { colors: '#8fa3c0' },
    fontSize: '12px',
  };
  donutPlotOptions: ApexPlotOptions = { pie: { donut: { size: '65%' } } };
  donutDataLabels: ApexDataLabels = {
    enabled: true,
    style: { fontSize: '11px', colors: ['#f0f4ff'] },
  };
  donutTooltip: ApexTooltip = {
    theme: 'dark',
    y: { formatter: (v: number) => `RM ${v.toFixed(2)}` },
  };
  donutColors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];

  ngOnInit(): void {
    this.load();
  }

  async setPeriod(p: Period): Promise<void> {
    if (this.period() === p) return;
    this.period.set(p);
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await this.dashboardService.getStats(this.period());
      this.stats.set(data);
      this.buildCharts(data);
    } catch {
      this.error.set('Failed to load dashboard data. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  private buildCharts(data: DashboardStats): void {
    // Area chart — revenue over time
    this.trendSeries = [{ name: 'Revenue (RM)', data: data.revenuePerDay.map(d => d.revenue) }];

    const labels = data.revenuePerDay.map(d => {
      if (d.date.length === 7) {
        // Monthly: YYYY-MM → "Jan 25"
        const [y, m] = d.date.split('-');
        const month = new Date(+y, +m - 1, 1).toLocaleString('en', { month: 'short' });
        return `${month} ${y.slice(2)}`;
      }
      // Daily: YYYY-MM-DD → "3/15"
      const [, mo, day] = d.date.split('-');
      return `${+mo}/${+day}`;
    });

    this.trendXAxis = { ...this.trendXAxis, categories: labels };

    // Donut chart — revenue by platform
    this.donutSeries = data.revenueByPlatform.map(p => p.revenue);
    this.donutLabels = data.revenueByPlatform.map(p => p.platform);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-MY', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
