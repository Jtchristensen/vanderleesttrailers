import { Component, OnInit } from '@angular/core';

import { RouterLink } from '@angular/router';
import { ContentService } from '../../services/content.service';
import { FavoritesService } from '../../services/favorites.service';
import { TowCheckService } from '../../services/tow-check.service';
import { TowFitBadgeComponent } from '../../components/tow-fit-badge/tow-fit-badge.component';
import { TrailerTitlePipe } from '../../pipes/trailer-title.pipe';
import { SavingsBadgeComponent } from '../../components/savings-badge/savings-badge.component';
import { hasSavings } from '../../utils/pricing';

@Component({
    selector: 'app-favorites',
    imports: [RouterLink, TowFitBadgeComponent, TrailerTitlePipe, SavingsBadgeComponent],
    templateUrl: './favorites.component.html',
    styleUrls: ['./favorites.component.scss']
})
export class FavoritesComponent implements OnInit {
  /** Template hook for the MSRP strikethrough — see utils/pricing. */
  readonly hasSavings = hasSavings;

  site: any = ContentService.getContentSync('SITE_INFO');
  trailers: any[] = [];
  loaded = false;
  /** Slugs saved before some trailers were removed from inventory. */
  missingCount = 0;

  private allTrailers: any[] = [];

  constructor(
    private contentService: ContentService,
    public favorites: FavoritesService,
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

  remove(event: Event, slug: string) {
    event.preventDefault();
    event.stopPropagation();
    this.favorites.remove(slug);
    this.refresh();
  }

  clearAll() {
    this.favorites.clear();
    this.refresh();
  }

  private refresh() {
    const bySlug = new Map(this.allTrailers.map((t: any) => [t.slug, t]));
    const saved = this.favorites.slugs();
    this.trailers = saved.map(slug => bySlug.get(slug)).filter(Boolean);
    this.missingCount = saved.length - this.trailers.length;
  }
}
