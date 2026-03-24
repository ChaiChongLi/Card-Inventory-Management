import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BatchSummary,
  BatchItem,
  SaleRecord,
  CreateItemPayload,
  CreateSaleRecordPayload,
  UpdateSaleRecordPayload,
  DistributionDetail,
} from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class BatchService {
  private http = inject(HttpClient);

  // ── Batches ────────────────────────────────────────────────────────────────

  async listBatches(): Promise<BatchSummary[]> {
    const res = await firstValueFrom(
      this.http.get<{ data: BatchSummary[] }>(`${environment.apiUrl}/batches`)
    );
    return res.data;
  }

  async getBatch(id: number): Promise<BatchSummary> {
    const res = await firstValueFrom(
      this.http.get<{ data: BatchSummary }>(`${environment.apiUrl}/batches/${id}`)
    );
    return res.data;
  }

  async createBatch(name: string, description?: string): Promise<BatchSummary> {
    const body: { name: string; description?: string } = { name };
    if (description) body.description = description;
    const res = await firstValueFrom(
      this.http.post<{ data: BatchSummary }>(`${environment.apiUrl}/batches`, body)
    );
    return res.data;
  }

  async updateBatch(id: number, data: { name?: string; description?: string; deliveryFee?: number; otherFees?: number }): Promise<BatchSummary> {
    const res = await firstValueFrom(
      this.http.patch<{ data: BatchSummary }>(`${environment.apiUrl}/batches/${id}`, data)
    );
    return res.data;
  }

  async deleteBatch(id: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${environment.apiUrl}/batches/${id}`)
    );
  }

  async closeBatch(id: number): Promise<BatchSummary> {
    const res = await firstValueFrom(
      this.http.post<{ data: BatchSummary }>(`${environment.apiUrl}/batches/${id}/close`, {})
    );
    return res.data;
  }

  // ── Items ──────────────────────────────────────────────────────────────────

  async listItems(batchId: number): Promise<BatchItem[]> {
    const res = await firstValueFrom(
      this.http.get<{ data: BatchItem[] }>(`${environment.apiUrl}/batches/${batchId}/items`)
    );
    return res.data;
  }

  async createItem(batchId: number, payload: CreateItemPayload): Promise<BatchItem> {
    const res = await firstValueFrom(
      this.http.post<{ data: BatchItem }>(`${environment.apiUrl}/batches/${batchId}/items`, payload)
    );
    return res.data;
  }

  async updateItem(batchId: number, itemId: number, payload: Partial<CreateItemPayload>): Promise<BatchItem> {
    const res = await firstValueFrom(
      this.http.patch<{ data: BatchItem }>(`${environment.apiUrl}/batches/${batchId}/items/${itemId}`, payload)
    );
    return res.data;
  }

  async deleteItem(batchId: number, itemId: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${environment.apiUrl}/batches/${batchId}/items/${itemId}`)
    );
  }

  // ── Sale Records ───────────────────────────────────────────────────────────

  async createSaleRecord(batchId: number, itemId: number, payload: CreateSaleRecordPayload): Promise<BatchItem> {
    const res = await firstValueFrom(
      this.http.post<{ data: BatchItem }>(`${environment.apiUrl}/batches/${batchId}/items/${itemId}/sales`, payload)
    );
    return res.data;
  }

  async updateSaleRecord(batchId: number, itemId: number, saleId: number, payload: UpdateSaleRecordPayload): Promise<BatchItem> {
    const res = await firstValueFrom(
      this.http.patch<{ data: BatchItem }>(`${environment.apiUrl}/batches/${batchId}/items/${itemId}/sales/${saleId}`, payload)
    );
    return res.data;
  }

  async deleteSaleRecord(batchId: number, itemId: number, saleId: number): Promise<BatchItem> {
    const res = await firstValueFrom(
      this.http.delete<{ data: BatchItem }>(`${environment.apiUrl}/batches/${batchId}/items/${itemId}/sales/${saleId}`)
    );
    return res.data;
  }

  // ── Distribution ───────────────────────────────────────────────────────────

  async getDistribution(batchId: number): Promise<DistributionDetail | null> {
    const res = await firstValueFrom(
      this.http.get<{ data: DistributionDetail | null }>(`${environment.apiUrl}/batches/${batchId}/distribution`)
    );
    return res.data;
  }

  async saveDistribution(
    batchId: number,
    payload: {
      retainedMode: 'FIXED_AMOUNT' | 'PERCENTAGE';
      retainedValue: number;
      notes?: string;
      shares: { partnerId: number; percentage: number }[];
    }
  ): Promise<DistributionDetail> {
    const res = await firstValueFrom(
      this.http.post<{ data: DistributionDetail }>(`${environment.apiUrl}/batches/${batchId}/distribution`, payload)
    );
    return res.data;
  }
}
