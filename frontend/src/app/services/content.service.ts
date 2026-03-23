import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import * as staticContent from '../data/site-content';

@Injectable({ providedIn: 'root' })
export class ContentService {
  private apiUrl = environment.apiUrl;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  /** Static fallback map — used when API is unreachable (local dev) */
  private static fallbackMap: Record<string, any> = {
    SITE_INFO: staticContent.SITE_INFO,
    PAGE_HOME: staticContent.HOME_CONTENT,
    PAGE_ABOUT: staticContent.ABOUT_CONTENT,
    SERVICES: staticContent.SERVICES_CONTENT,
    CUSTOM_TRAILERS: staticContent.CUSTOM_TRAILERS_CONTENT,
    FINANCING: staticContent.FINANCING_CONTENT,
    CONTACT: staticContent.CONTACT_CONTENT,
    FAQ: staticContent.FAQ_CONTENT,
    REVIEWS: staticContent.REVIEWS,
    BRANDS: staticContent.TRAILER_BRANDS,
    CATEGORIES: staticContent.TRAILER_CATEGORIES,
    IMAGES: staticContent.IMAGES,
  };

  async getContent<T = any>(type: string): Promise<T> {
    const cached = this.cache.get(type);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data as T;
    }

    try {
      const res = await fetch(`${this.apiUrl}/content/${type}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.cache.set(type, { data, timestamp: Date.now() });
      return data as T;
    } catch {
      // Fallback to static data
      const fallback = ContentService.fallbackMap[type];
      if (fallback) return fallback as T;
      throw new Error(`No data for content type: ${type}`);
    }
  }

  async getTrailers(): Promise<any[]> {
    try {
      const res = await fetch(`${this.apiUrl}/trailers`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch {
      return []; // No static trailer fallback
    }
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
