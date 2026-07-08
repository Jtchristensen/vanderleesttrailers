import { Component, OnInit } from '@angular/core';

import { ActivatedRoute, RouterLink } from '@angular/router';
import { ContentService } from '../../services/content.service';
import { CompareService } from '../../services/compare.service';

@Component({
    selector: 'app-inventory',
    imports: [RouterLink],
    templateUrl: './inventory.component.html',
    styleUrls: ['./inventory.component.scss']
})
export class InventoryComponent implements OnInit {
  categories: any[] = ContentService.getContentSync<any[]>('CATEGORIES') ?? [];
  trailers: any[] = [];
  filteredTrailers: any[] = [];
  images: any = ContentService.getContentSync('IMAGES');
  activeCategory: string | null = null;
  activeCategoryData: any = null;
  searchQuery = '';
  loaded = false;

  constructor(
    private route: ActivatedRoute,
    private contentService: ContentService,
    public compare: CompareService,
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

  applyFilters() {
    let result = this.trailers;

    if (this.activeCategory) {
      result = result.filter((t: any) => t.category === this.activeCategory);
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter((t: any) =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.brand || '').toLowerCase().includes(q)
      );
    }

    this.filteredTrailers = result.sort((a: any, b: any) => {
      const aOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.name || '').localeCompare(b.name || '');
    });
  }
}
