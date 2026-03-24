import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PartnerItem } from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class PartnerService {
  private http = inject(HttpClient);

  async listPartners(): Promise<PartnerItem[]> {
    const res = await firstValueFrom(
      this.http.get<{ data: PartnerItem[] }>(`${environment.apiUrl}/partners`)
    );
    return res.data;
  }

  async createPartner(userId: number, displayName: string): Promise<PartnerItem> {
    const res = await firstValueFrom(
      this.http.post<{ data: PartnerItem }>(`${environment.apiUrl}/partners`, { userId, displayName })
    );
    return res.data;
  }

  async updatePartner(id: number, data: { displayName?: string; isActive?: boolean }): Promise<PartnerItem> {
    const res = await firstValueFrom(
      this.http.patch<{ data: PartnerItem }>(`${environment.apiUrl}/partners/${id}`, data)
    );
    return res.data;
  }

  async deletePartner(id: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${environment.apiUrl}/partners/${id}`)
    );
  }
}
