import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="admin-shell">

      <header class="admin-header">
        <div class="header-brand">
          <span class="brand-icon">🃏</span>
          <div>
            <a class="brand-title" routerLink="/dashboard">TCG Admin</a>
            <p class="brand-sub">System Management</p>
          </div>
        </div>
        <a class="btn btn-ghost btn-sm" routerLink="/dashboard">← Dashboard</a>
      </header>

      <div class="admin-layout">
        <nav class="admin-sidebar">
          <div class="nav-section">
            <span class="nav-heading">Management</span>
            <a class="nav-item" routerLink="/admin/users" routerLinkActive="active">
              <span class="nav-icon">👥</span>
              Users
            </a>
            <a class="nav-item" routerLink="/admin/platforms" routerLinkActive="active">
              <span class="nav-icon">🏪</span>
              Platforms
            </a>
            <a class="nav-item" routerLink="/admin/partners" routerLinkActive="active">
              <span class="nav-icon">🤝</span>
              Partners
            </a>
            <a class="nav-item" routerLink="/admin/batches" routerLinkActive="active">
              <span class="nav-icon">📦</span>
              Batches
            </a>
            <a class="nav-item" routerLink="/admin/shop-purchases" routerLinkActive="active">
              <span class="nav-icon">🛒</span>
              Shop Purchases
            </a>
          </div>
        </nav>

        <main class="admin-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .admin-shell {
      min-height: 100vh;
      background: var(--bg-base);
      display: flex;
      flex-direction: column;
    }

    .admin-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 24px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 50;
    }

    .header-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon { font-size: 24px; }

    .brand-title {
      font-size: 16px;
      font-weight: 700;
      background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-decoration: none;
    }

    .brand-sub {
      font-size: 11px;
      color: var(--text-muted);
    }

    .admin-layout {
      display: flex;
      flex: 1;
    }

    .admin-sidebar {
      width: 220px;
      background: var(--bg-surface);
      border-right: 1px solid var(--border);
      padding: 20px 0;
      flex-shrink: 0;
    }

    .nav-section {
      padding: 0 12px;
    }

    .nav-heading {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-muted);
      padding: 0 10px;
      display: block;
      margin-bottom: 6px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      text-decoration: none;
      transition: background 0.1s, color 0.1s;
      margin-bottom: 2px;

      &:hover { background: var(--bg-elevated); color: var(--text-primary); }

      &.active {
        background: var(--accent-glow);
        color: var(--accent);
        font-weight: 600;
      }
    }

    .nav-icon { font-size: 16px; }

    .admin-content {
      flex: 1;
      padding: 24px;
      overflow: auto;
    }

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

      &.btn-ghost { background: transparent; color: var(--text-secondary); &:hover { background: var(--bg-elevated); color: var(--text-primary); } }
      &.btn-sm { padding: 5px 10px; font-size: 12px; }
    }

    @media (max-width: 768px) {
      .admin-layout { flex-direction: column; }
      .admin-sidebar { width: 100%; border-right: none; border-bottom: 1px solid var(--border); padding: 12px; }
      .nav-section { display: flex; gap: 8px; align-items: center; }
      .nav-heading { display: none; }
    }
  `],
})
export class AdminShellComponent {}
