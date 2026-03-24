import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiUser } from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);

  async listUsers(): Promise<ApiUser[]> {
    const res = await firstValueFrom(
      this.http.get<{ data: ApiUser[]; total: number }>(`${environment.apiUrl}/users`)
    );
    return res.data;
  }

  async createUser(username: string, password: string): Promise<ApiUser> {
    const res = await firstValueFrom(
      this.http.post<{ data: ApiUser }>(`${environment.apiUrl}/users`, { username, password })
    );
    return res.data;
  }

  async updateUser(id: number, data: Partial<Pick<ApiUser, 'isActive' | 'username'>>): Promise<ApiUser> {
    const res = await firstValueFrom(
      this.http.patch<{ data: ApiUser }>(`${environment.apiUrl}/users/${id}`, data)
    );
    return res.data;
  }

  async deleteUser(id: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${environment.apiUrl}/users/${id}`)
    );
  }
}
