import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ContentService {
  private apiUrl = environment.apiUrl;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  async getContent<T = any>(type: string): Promise<T> {
    const cached = this.cache.get(type);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data as T;
    }

    const res = await fetch(`${this.apiUrl}/content/${type}`);
    if (!res.ok) throw new Error(`Failed to fetch content: ${type}`);
    const data = await res.json();
    this.cache.set(type, { data, timestamp: Date.now() });
    return data as T;
  }

  async getTrailers(): Promise<any[]> {
    const res = await fetch(`${this.apiUrl}/trailers`);
    if (!res.ok) throw new Error('Failed to fetch trailers');
    return res.json();
  }

  async getTrailer(slug: string): Promise<any> {
    const res = await fetch(`${this.apiUrl}/trailers/${slug}`);
    if (!res.ok) throw new Error(`Failed to fetch trailer: ${slug}`);
    return res.json();
  }

  clearCache() {
    this.cache.clear();
  }
}
