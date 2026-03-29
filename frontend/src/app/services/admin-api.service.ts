import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private apiUrl = environment.apiUrl;

  constructor(private auth: AuthService) {}

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.auth.getToken();
    return {
      'Content-Type': 'application/json',
      Authorization: token || '',
    };
  }

  async updateContent(type: string, data: any, sk = '_'): Promise<void> {
    const headers = await this.authHeaders();
    const res = await fetch(`${this.apiUrl}/admin/content/${type}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ data, sk }),
    });
    if (!res.ok) throw new Error('Failed to update content');
  }

  async getTrailers(): Promise<any[]> {
    const headers = await this.authHeaders();
    const res = await fetch(`${this.apiUrl}/admin/trailers`, { headers });
    if (!res.ok) throw new Error('Failed to fetch trailers');
    return res.json();
  }

  async createTrailer(data: any): Promise<{ slug: string }> {
    const headers = await this.authHeaders();
    const res = await fetch(`${this.apiUrl}/admin/trailers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ data }),
    });
    if (!res.ok) throw new Error('Failed to create trailer');
    return res.json();
  }

  async updateTrailer(slug: string, data: any): Promise<void> {
    const headers = await this.authHeaders();
    const res = await fetch(`${this.apiUrl}/admin/trailers/${slug}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ data }),
    });
    if (!res.ok) throw new Error('Failed to update trailer');
  }

  async reorderTrailers(orders: { slug: string; sortOrder: number }[]): Promise<void> {
    const headers = await this.authHeaders();
    const res = await fetch(`${this.apiUrl}/admin/trailers`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ orders }),
    });
    if (!res.ok) throw new Error('Failed to save order');
  }

  async deleteTrailer(slug: string): Promise<void> {
    const headers = await this.authHeaders();
    const res = await fetch(`${this.apiUrl}/admin/trailers/${slug}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error('Failed to delete trailer');
  }

  async getUploadUrl(fileName: string, contentType: string): Promise<{ uploadUrl: string; imageUrl: string }> {
    const headers = await this.authHeaders();
    const res = await fetch(`${this.apiUrl}/admin/upload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fileName, contentType }),
    });
    if (!res.ok) throw new Error('Failed to get upload URL');
    return res.json();
  }

  async uploadImage(file: File): Promise<string> {
    const { uploadUrl, imageUrl } = await this.getUploadUrl(file.name, file.type);
    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });
    return imageUrl;
  }
}
