import { Component, OnInit } from '@angular/core';

import { ActivatedRoute, RouterLink } from '@angular/router';
import { ContentService } from '../../services/content.service';
import { CompareService } from '../../services/compare.service';
import { FavoritesService } from '../../services/favorites.service';
import { TowCheckService } from '../../services/tow-check.service';
import { TowFitBarComponent } from '../../components/tow-fit-bar/tow-fit-bar.component';
import { TowFitBadgeComponent } from '../../components/tow-fit-badge/tow-fit-badge.component';
import { TrailerTitlePipe, trailerTitle } from '../../pipes/trailer-title.pipe';
import { SavingsBadgeComponent } from '../../components/savings-badge/savings-badge.component';
import { hasSavings } from '../../utils/pricing';

@Component({
    selector: 'app-inventory',
    imports: [RouterLink, TowFitBarComponent, TowFitBadgeComponent, TrailerTitlePipe, SavingsBadgeComponent],
    templateUrl: './inventory.component.html',
    styleUrls: ['./inventory.component.scss']
})
export class InventoryComponent implements OnInit {
  /** Template hook for the MSRP strikethrough — see utils/pricing. */
  readonly hasSavings = hasSavings;

  categories: any[] = ContentService.getContentSync<any[]>('CATEGORIES') ?? [];
  trailers: any[] = [];
  filteredTrailers: any[] = [];
  images: any = ContentService.getContentSync('IMAGES');
  activeCategory: string | null = null;
  activeCategoryData: any = null;
  searchQuery = '';
  loaded = false;

  /** "Only show trailers I can tow" — applied on top of category/search. */
  onlyTowable = false;
  /** Trailer count after category/search but before the tow-fit filter, for the bar's "X of Y" summary. */
  preTowFilterCount = 0;

  /** Price/GVWR range filters — each side independently optional (null = no bound). */
  priceMin: number | null = null;
  priceMax: number | null = null;
  gvwrMin: number | null = null;
  gvwrMax: number | null = null;

  /** Pagination over filteredTrailers. */
  pageSize = 12;
  currentPage = 1;

  constructor(
    private route: ActivatedRoute,
    private contentService: ContentService,
    public compare: CompareService,
    public favorites: FavoritesService,
    public towCheck: TowCheckService,
  ) {}

  toggleCompare(event: Event, trailer: any) {
    event.preventDefault();
    event.stopPropagation();
    this.compare.toggle(trailer.slug);
  }

  /** Selected trailers resolved to full objects for the floating tray. */
  compareItems(): any[] {
    const bySlug = new Map(this.trailers.map((t: any) => [t.slug, t]));
    return this.compare.slugs().map(slug => bySlug.get(slug)).filter(Boolean);
  }

  toggleFavorite(event: Event, trailer: any) {
    event.preventDefault();
    event.stopPropagation();
    this.favorites.toggle(trailer.slug);
  }

  async ngOnInit() {
    const [categories, images, trailers] = await Promise.all([
      this.contentService.getContent('CATEGORIES'),
      this.contentService.getContent('IMAGES'),
      this.contentService.getTrailers(),
    ]);
    this.categories = categories;
    this.images = images;
    this.trailers = trailers;

    this.route.paramMap.subscribe(params => {
      this.activeCategory = params.get('category');
      this.activeCategoryData = this.activeCategory
        ? this.categories.find((c: any) => c.slug === this.activeCategory) || null
        : null;
      this.applyFilters();
    });

    this.loaded = true;
  }

  onSearch(query: string) {
    this.searchQuery = query;
    this.applyFilters();
  }

  onTowFilterChange(value: boolean) {
    this.onlyTowable = value;
    this.applyFilters();
  }

  onPriceMinChange(value: string) {
    this.priceMin = value === '' ? null : Number(value);
    this.applyFilters();
  }

  onPriceMaxChange(value: string) {
    this.priceMax = value === '' ? null : Number(value);
    this.applyFilters();
  }

  onGvwrMinChange(value: string) {
    this.gvwrMin = value === '' ? null : Number(value);
    this.applyFilters();
  }

  onGvwrMaxChange(value: string) {
    this.gvwrMax = value === '' ? null : Number(value);
    this.applyFilters();
  }

  /** Unknown-GVWR trailers are always kept — we never want to hide a trailer we can't rate. */
  private isTowable(trailer: any): boolean {
    const check = this.towCheck.check(trailer?.gvwr);
    return !check || check.verdict !== 'over';
  }

  /** Range check that mirrors isTowable's stance: unknown/NaN values are always kept, never hidden. */
  private inRange(rawValue: any, min: number | null, max: number | null): boolean {
    const value = Number(rawValue);
    if (Number.isNaN(value)) return true;
    if (min !== null && value < min) return false;
    if (max !== null && value > max) return false;
    return true;
  }

  applyFilters() {
    let result = this.trailers;

    if (this.activeCategory) {
      result = result.filter((t: any) => t.category === this.activeCategory);
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter((t: any) =>
        trailerTitle(t).toLowerCase().includes(q) ||
        (t.make || '').toLowerCase().includes(q) ||
        (t.model || '').toLowerCase().includes(q)
      );
    }

    if (this.priceMin !== null || this.priceMax !== null) {
      result = result.filter((t: any) => this.inRange(t.price, this.priceMin, this.priceMax));
    }

    if (this.gvwrMin !== null || this.gvwrMax !== null) {
      result = result.filter((t: any) => this.inRange(t.gvwr, this.gvwrMin, this.gvwrMax));
    }

    result = result.sort((a: any, b: any) => {
      const aOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      // Default order mirrors the source site: newest published first.
      const aDate = a.publishedAt || '';
      const bDate = b.publishedAt || '';
      if (aDate !== bDate) return bDate.localeCompare(aDate);
      return trailerTitle(a).localeCompare(trailerTitle(b));
    });

    this.preTowFilterCount = result.length;

    if (this.onlyTowable && this.towCheck.vehicle()) {
      result = result.filter((t: any) => this.isTowable(t));
    }

    this.filteredTrailers = result;
    this.currentPage = 1;
  }

  /** Total pages for the current filtered set, always at least 1. */
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredTrailers.length / this.pageSize));
  }

  /** The slice of filteredTrailers to render for the current page. */
  get pagedTrailers(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredTrailers.slice(start, start + this.pageSize);
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
    }
  }
}
