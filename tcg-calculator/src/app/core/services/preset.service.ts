import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiPreset } from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class PresetService {
  private http = inject(HttpClient);

  presets = signal<string[]>([]);

  async load(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ data: ApiPreset[] }>(`${environment.apiUrl}/presets`)
      );
      const sorted = [...res.data].sort((a, b) => a.sortOrder - b.sortOrder);
      this.presets.set(sorted.map(p => p.name));
    } catch {
      // Fall back to hardcoded defaults
      this.presets.set([
        'Booster Pack',
        'Booster Box',
        'Single Card (Common)',
        'Single Card (Rare)',
        'Single Card (SR/UR)',
        'Starter Deck',
        'Structure Deck',
        'Sealed Product',
        'Promo Card',
        'Accessory',
        'Custom',
      ]);
    }
  }
}
