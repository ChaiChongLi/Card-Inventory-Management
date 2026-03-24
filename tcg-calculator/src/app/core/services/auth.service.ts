import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiUser, LoginResponse } from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  currentUser = signal<ApiUser | null>(null);
  private _accessToken = signal<string | null>(null);

  readonly accessToken = this._accessToken.asReadonly();
  readonly isLoggedIn = computed(() => this._accessToken() !== null);
  readonly isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');

  async init(): Promise<void> {
    try {
      await this.refreshToken();
    } catch {
      // No valid refresh cookie — user is not logged in
    }
  }

  async login(username: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, { username, password }, { withCredentials: true })
    );
    this._accessToken.set(res.accessToken);
    this.currentUser.set(res.user);
  }

  async refreshToken(): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${environment.apiUrl}/auth/refresh`, {}, { withCredentials: true })
    );
    this._accessToken.set(res.accessToken);
    this.currentUser.set(res.user);
    return res.accessToken;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/auth/logout`, {}, { withCredentials: true })
      );
    } catch {
      // Ignore errors on logout
    } finally {
      this._accessToken.set(null);
      this.currentUser.set(null);
      this.router.navigate(['/login']);
    }
  }

  setAccessToken(token: string): void {
    this._accessToken.set(token);
  }
}
