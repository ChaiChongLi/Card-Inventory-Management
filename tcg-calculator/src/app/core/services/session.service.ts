import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSession, ApiSessionDetail, ApiSkuItem } from '../../shared/models/api.models';
import { SkuItem } from '../../features/calculator/calculator.component';
import { PlatformService } from './platform.service';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private http = inject(HttpClient);
  private platformService = inject(PlatformService);

  currentSession = signal<ApiSession | null>(null);
  sessions = signal<ApiSession[]>([]);
  saveStatus = signal<SaveStatus>('idle');

  private nextLocalId = 1;
  private static STORAGE_KEY = 'tcg_current_session_id';

  getSavedSessionId(): number | null {
    const v = sessionStorage.getItem(SessionService.STORAGE_KEY);
    const n = v ? parseInt(v, 10) : NaN;
    return isNaN(n) ? null : n;
  }

  async loadSessions(): Promise<void> {
    const list = await firstValueFrom(
      this.http.get<ApiSession[]>(`${environment.apiUrl}/sessions`)
    );
    this.sessions.set(list);
  }

  async createSession(name: string): Promise<ApiSession> {
    const session = await firstValueFrom(
      this.http.post<ApiSession>(`${environment.apiUrl}/sessions`, { name })
    );
    this.currentSession.set(session);
    this.sessions.update(list => [session, ...list]);
    sessionStorage.setItem(SessionService.STORAGE_KEY, String(session.id));
    return session;
  }

  async loadSession(id: number): Promise<{ session: ApiSession; skus: SkuItem[] }> {
    const detail = await firstValueFrom(
      this.http.get<ApiSessionDetail>(`${environment.apiUrl}/sessions/${id}`)
    );
    const skus = this.mapApiSkusToFrontend(detail.skuItems);
    this.currentSession.set(detail);
    sessionStorage.setItem(SessionService.STORAGE_KEY, String(detail.id));
    return { session: detail, skus };
  }

  async updateSession(id: number, name: string): Promise<ApiSession> {
    const session = await firstValueFrom(
      this.http.patch<ApiSession>(`${environment.apiUrl}/sessions/${id}`, { name })
    );
    this.currentSession.update(s => s?.id === id ? session : s);
    this.sessions.update(list => list.map(s => s.id === id ? session : s));
    return session;
  }

  async deleteSession(id: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${environment.apiUrl}/sessions/${id}`)
    );
    this.sessions.update(list => list.filter(s => s.id !== id));
    if (this.currentSession()?.id === id) {
      this.currentSession.set(null);
      sessionStorage.removeItem(SessionService.STORAGE_KEY);
    }
  }

  async autoSave(sessionId: number, skus: SkuItem[]): Promise<SkuItem[]> {
    this.saveStatus.set('saving');
    try {
      const payload = skus.map((sku, index) => {
        const platformNumericId = this.platformService.getNumericId(sku.platformId);
        const item: Record<string, unknown> = {
          platformId: platformNumericId ?? 1,
          name: sku.name,
          productCost: sku.productCost,
          shippingCost: sku.shippingCost,
          desiredMargin: sku.desiredMargin,
          quantity: sku.quantity,
          sortOrder: index,
        };
        if (sku.backendId !== undefined) {
          item['id'] = sku.backendId;
        }
        if (sku.platformFee !== undefined) {
          const platform = this.platformService.platforms().find(p => p.id === sku.platformId);
          if (platform?.customizable) {
            item['customFeePercent'] = sku.platformFee;
          }
        }
        return item;
      });

      const updatedApiSkus = await firstValueFrom(
        this.http.put<ApiSkuItem[]>(`${environment.apiUrl}/sessions/${sessionId}/skus`, payload)
      );

      this.saveStatus.set('saved');
      setTimeout(() => this.saveStatus.set('idle'), 2000);

      return this.mapApiSkusToFrontend(updatedApiSkus);
    } catch {
      this.saveStatus.set('error');
      throw new Error('Auto-save failed');
    }
  }

  clearCurrentSession(): void {
    this.currentSession.set(null);
    this.saveStatus.set('idle');
    sessionStorage.removeItem(SessionService.STORAGE_KEY);
  }

  private mapApiSkusToFrontend(apiSkus: ApiSkuItem[]): SkuItem[] {
    return apiSkus.map(item => {
      const platform = item.platform;
      return {
        id: this.nextLocalId++,
        backendId: item.id,
        name: item.name,
        productCost: item.productCost,
        shippingCost: item.shippingCost,
        platformId: platform.slug,
        platformFee: item.customFeePercent !== undefined ? item.customFeePercent : platform.feePercent,
        desiredMargin: item.desiredMargin,
        quantity: item.quantity,
      };
    });
  }
}
