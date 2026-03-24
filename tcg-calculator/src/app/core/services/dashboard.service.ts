import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DashboardStats {
  openBatches: number;
  closedBatches: number;
  totalRevenue: number;
  shopPurchasesSpend: number;
  revenuePerDay: Array<{ date: string; revenue: number }>;
  revenueByPlatform: Array<{ platform: string; revenue: number }>;
  recentBatches: Array<{
    id: number;
    name: string;
    status: string;
    itemCount: number;
    revenue: number;
    createdAt: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  async getStats(period: '30d' | 'all'): Promise<DashboardStats> {
    const res = await firstValueFrom(
      this.http.get<{ data: DashboardStats }>(`${this.base}/dashboard?period=${period}`),
    );
    return res.data;
  }
}
