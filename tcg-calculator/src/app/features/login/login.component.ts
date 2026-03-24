import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PlatformService } from '../../core/services/platform.service';
import { PresetService } from '../../core/services/preset.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-shell">
      <div class="login-card">
        <div class="login-brand">
          <span class="brand-icon">🃏</span>
          <div>
            <h1 class="brand-title">TCG Pricing Calculator</h1>
            <p class="brand-sub">Malaysian Marketplace Optimizer</p>
          </div>
        </div>

        <form class="login-form" (ngSubmit)="onSubmit()">
          <div class="field-group">
            <label class="field-label" for="username">Username</label>
            <input
              id="username"
              class="field-input"
              type="text"
              [(ngModel)]="username"
              name="username"
              placeholder="Enter your username"
              autocomplete="username"
              [disabled]="loading()"
            />
          </div>

          <div class="field-group">
            <label class="field-label" for="password">Password</label>
            <input
              id="password"
              class="field-input"
              type="password"
              [(ngModel)]="password"
              name="password"
              placeholder="Enter your password"
              autocomplete="current-password"
              [disabled]="loading()"
            />
          </div>

          @if (errorMessage()) {
            <div class="error-banner">
              {{ errorMessage() }}
            </div>
          }

          <button class="login-btn" type="submit" [disabled]="loading() || !username || !password">
            @if (loading()) {
              <span class="spinner"></span> Signing in...
            } @else {
              Sign In
            }
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-shell {
      min-height: 100vh;
      background: var(--bg-base);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .login-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 36px 32px;
      width: 100%;
      max-width: 400px;
      box-shadow: var(--shadow-lg);
    }

    .login-brand {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 32px;
    }

    .brand-icon {
      font-size: 36px;
      filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.5));
    }

    .brand-title {
      font-size: 17px;
      font-weight: 700;
      background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1.2;
    }

    .brand-sub {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
      letter-spacing: 0.4px;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .field-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .field-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .field-input {
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-family: var(--font-sans);
      font-size: 14px;
      padding: 10px 12px;
      width: 100%;
      transition: border-color 0.15s, box-shadow 0.15s;
      outline: none;

      &:focus {
        border-color: var(--border-focus);
        box-shadow: 0 0 0 3px var(--accent-glow);
      }

      &::placeholder { color: var(--text-muted); }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .error-banner {
      background: var(--danger-bg);
      border: 1px solid var(--danger);
      border-radius: var(--radius-sm);
      color: var(--danger);
      font-size: 13px;
      padding: 10px 14px;
    }

    .login-btn {
      background: var(--accent);
      color: var(--text-inverse);
      border: none;
      border-radius: var(--radius-sm);
      font-family: var(--font-sans);
      font-size: 14px;
      font-weight: 700;
      padding: 12px;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 4px;

      &:hover:not(:disabled) { background: var(--accent-dark); }
      &:active:not(:disabled) { transform: scale(0.99); }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(0,0,0,0.2);
      border-top-color: var(--text-inverse);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      display: inline-block;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class LoginComponent {
  private authService = inject(AuthService);
  private platformService = inject(PlatformService);
  private presetService = inject(PresetService);
  private router = inject(Router);

  username = '';
  password = '';
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  async onSubmit(): Promise<void> {
    if (!this.username || !this.password || this.loading()) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      await this.authService.login(this.username, this.password);
      await Promise.all([this.platformService.load(), this.presetService.load()]);
      await this.router.navigate(['/dashboard']);
    } catch (err: unknown) {
      const httpErr = err as { status?: number };
      if (httpErr?.status === 401) {
        this.errorMessage.set('Invalid username or password.');
      } else {
        this.errorMessage.set('Unable to connect. Please check your connection and try again.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
