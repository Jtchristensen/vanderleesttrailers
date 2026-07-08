import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'vlt-compare';

/** Maximum number of trailers that can be compared side-by-side. */
export const COMPARE_LIMIT = 3;

@Injectable({ providedIn: 'root' })
export class CompareService {
  private slugsSignal = signal<string[]>(this.load());

  /** Slugs of trailers currently selected for comparison, in selection order. */
  readonly slugs = this.slugsSignal.asReadonly();
  readonly count = computed(() => this.slugsSignal().length);
  readonly isFull = computed(() => this.slugsSignal().length >= COMPARE_LIMIT);

  isSelected(slug: string): boolean {
    return this.slugsSignal().includes(slug);
  }

  /**
   * Add or remove a trailer from the comparison set.
   * Returns false when the set is full and the trailer could not be added.
   */
  toggle(slug: string): boolean {
    const current = this.slugsSignal();
    if (current.includes(slug)) {
      this.update(current.filter(s => s !== slug));
      return true;
    }
    if (current.length >= COMPARE_LIMIT) return false;
    this.update([...current, slug]);
    return true;
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
      // Storage unavailable (private mode / quota) — selection still works in-memory
    }
  }

  private load(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === 'string').slice(0, COMPARE_LIMIT)
        : [];
    } catch {
      return [];
    }
  }
}
