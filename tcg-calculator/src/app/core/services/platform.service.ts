import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiPlatform } from '../../shared/models/api.models';
import { Platform } from '../../features/calculator/calculator.component';

@Injectable({ providedIn: 'root' })
export class PlatformService {
  private http = inject(HttpClient);

  private _apiPlatforms = signal<ApiPlatform[]>([]);
  platforms = signal<Platform[]>([]);

  async load(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ data: ApiPlatform[] }>(`${environment.apiUrl}/platforms`)
      );
      const apiPlatforms = res.data;
      this._apiPlatforms.set(apiPlatforms);
      this.platforms.set(this.mapToFrontend(apiPlatforms));
    } catch {
      // Fall back to defaults so calculator still works offline
      this.platforms.set(this.defaults());
    }
  }

  getNumericId(slug: string): number | null {
    const found = this._apiPlatforms().find(p => p.slug === slug);
    return found ? found.id : null;
  }

  getByNumericId(id: number): ApiPlatform | null {
    return this._apiPlatforms().find(p => p.id === id) ?? null;
  }

  private mapToFrontend(apiPlatforms: ApiPlatform[]): Platform[] {
    return apiPlatforms
      .filter(p => p.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(p => ({
        id: p.slug,
        name: p.name,
        fee: p.feePercent,
        customizable: p.isCustomizable,
      }));
  }

  private defaults(): Platform[] {
    return [
      { id: 'shopee',    name: 'Shopee',              fee: 3,  customizable: false },
      { id: 'lazada',    name: 'Lazada',               fee: 2,  customizable: false },
      { id: 'tiktok',    name: 'TikTok Shop',          fee: 5,  customizable: false },
      { id: 'facebook',  name: 'Facebook Marketplace', fee: 0,  customizable: false },
      { id: 'carousell', name: 'Carousell',            fee: 0,  customizable: false },
      { id: 'direct',    name: 'Direct / Walk-in',     fee: 0,  customizable: false },
      { id: 'custom',    name: 'Custom',               fee: 0,  customizable: true  },
    ];
  }
}
