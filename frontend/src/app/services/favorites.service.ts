import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'vlt-favorites';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private slugsSignal = signal<string[]>(this.load());

  /** Slugs of saved trailers, oldest first. */
  readonly slugs = this.slugsSignal.asReadonly();
  readonly count = computed(() => this.slugsSignal().length);

  isFavorite(slug: string): boolean {
    return this.slugsSignal().includes(slug);
  }

  toggle(slug: string) {
    const current = this.slugsSignal();
    this.update(
      current.includes(slug)
        ? current.filter(s => s !== slug)
        : [...current, slug],
    );
  }

  remove(slug: string) {
    this.update(this.slugsSignal().filter(s => s !== slug));
  }

  clear() {
    this.update([]);
  }

  private update(slugs: string[]) {
    this.slugsSignal.set(slugs);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
    } catch {
      // Storage unavailable (private mode / quota) — favorites still work in-memory
    }
  }

  private load(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === 'string')
        : [];
    } catch {
      return [];
    }
  }
}
