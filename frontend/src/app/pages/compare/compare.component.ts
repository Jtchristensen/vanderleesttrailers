import { Component, OnInit } from '@angular/core';

import { RouterLink } from '@angular/router';
import { ContentService } from '../../services/content.service';
import { CompareService, COMPARE_LIMIT } from '../../services/compare.service';
import { TowCheckService } from '../../services/tow-check.service';
import { TowFitBadgeComponent } from '../../components/tow-fit-badge/tow-fit-badge.component';

interface SpecRow {
  label: string;
  field: string;
  unit?: string;
  prefix?: string;
  /** Which direction wins the "Best" badge for numeric rows */
  best?: 'min' | 'max';
}

@Component({
    selector: 'app-compare',
    imports: [RouterLink, TowFitBadgeComponent],
    templateUrl: './compare.component.html',
    styleUrls: ['./compare.component.scss']
})
export class CompareComponent implements OnInit {
  site: any = ContentService.getContentSync('SITE_INFO');
  trailers: any[] = [];
  allFeatures: string[] = [];
  loaded = false;
  limit = COMPARE_LIMIT;

  specRows: SpecRow[] = [
    { label: 'Price', field: 'price', prefix: '$', best: 'min' },
    { label: 'GVWR', field: 'gvwr', unit: 'lbs', best: 'max' },
    { label: 'Empty Weight', field: 'emptyWeight', unit: 'lbs', best: 'min' },
    { label: 'Payload', field: 'payload', unit: 'lbs', best: 'max' },
    { label: 'Siding', field: 'siding' },
    { label: 'Brand', field: 'brand' },
    { label: 'Category', field: 'category' },
  ];

  private allTrailers: any[] = [];

  constructor(
    private contentService: ContentService,
    public compare: CompareService,
    public towCheck: TowCheckService,
  ) {}

  async ngOnInit() {
    const [trailers, site] = await Promise.all([
      this.contentService.getTrailers(),
      this.contentService.getContent('SITE_INFO'),
    ]);
    this.allTrailers = trailers;
    this.site = site;
    this.refresh();
    this.loaded = true;
  }

  remove(slug: string) {
    this.compare.remove(slug);
    this.refresh();
  }

  clearAll() {
    this.compare.clear();
    this.refresh();
  }

  hasFeature(trailer: any, feature: string): boolean {
    return (trailer.features || []).includes(feature) ||
           (trailer.upgradedFeatures || []).includes(feature);
  }

  anyHas(field: string): boolean {
    return this.trailers.some(t => t[field]);
  }

  /** True when this trailer wins the row (only among rows where 2+ trailers have values that differ). */
  isBest(trailer: any, row: SpecRow): boolean {
    if (!row.best) return false;
    const values = this.trailers
      .map(t => this.parseNum(t[row.field]))
      .filter((v): v is number => v !== null);
    if (values.length < 2) return false;
    const winner = row.best === 'min' ? Math.min(...values) : Math.max(...values);
    if (values.every(v => v === winner)) return false;
    return this.parseNum(trailer[row.field]) === winner;
  }

  private parseNum(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const digits = String(value).replace(/[^0-9.]/g, '');
    if (!digits) return null;
    const n = parseFloat(digits);
    return isNaN(n) ? null : n;
  }

  private refresh() {
    const bySlug = new Map(this.allTrailers.map((t: any) => [t.slug, t]));
    this.trailers = this.compare.slugs()
      .map(slug => bySlug.get(slug))
      .filter(Boolean);

    const seen = new Set<string>();
    for (const t of this.trailers) {
      for (const f of [...(t.features || []), ...(t.upgradedFeatures || [])]) {
        seen.add(f);
      }
    }
    this.allFeatures = [...seen];
  }
}
