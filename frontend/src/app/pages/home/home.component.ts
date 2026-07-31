import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { RouterLink } from '@angular/router';
import { FaqComponent } from '../../components/faq/faq.component';
import { ContentService } from '../../services/content.service';

@Component({
    selector: 'app-home',
    imports: [RouterLink, FaqComponent, DecimalPipe],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, AfterViewInit {
  @ViewChild('heroVideo') heroVideo!: ElementRef<HTMLVideoElement>;

  content: any = ContentService.getContentSync('PAGE_HOME');
  categories: any[] = ContentService.getContentSync<any[]>('CATEGORIES') ?? [];
  brands: any[] = ContentService.getContentSync<any[]>('BRANDS') ?? [];
  services: any[] = ContentService.getContentSync<any>('SERVICES')?.services ?? [];
  reviews: any[] = ContentService.getContentSync<any[]>('REVIEWS') ?? [];
  rating: number | null = 5;
  reviewCount: number | null = null;
  site: any = ContentService.getContentSync('SITE_INFO');
  images: any = ContentService.getContentSync('IMAGES');
  trailerCount: number | null = null;
  loaded = false;

  constructor(private contentService: ContentService) {}

  /** Filled stars for a rounded rating. */
  starsFor(rating: number): boolean[] {
    const rounded = Math.round(rating || 0);
    return [1, 2, 3, 4, 5].map((n) => n <= rounded);
  }

  ngAfterViewInit() {
    if (this.heroVideo?.nativeElement) {
      this.heroVideo.nativeElement.muted = true;
      this.heroVideo.nativeElement.volume = 0;
    }
  }

  async ngOnInit() {
    const [site, home, categories, brands, services, google, images] = await Promise.all([
      this.contentService.getContent('SITE_INFO'),
      this.contentService.getContent('PAGE_HOME'),
      this.contentService.getContent('CATEGORIES'),
      this.contentService.getContent('BRANDS'),
      this.contentService.getContent('SERVICES'),
      this.contentService.getGoogleReviews(),
      this.contentService.getContent('IMAGES'),
    ]);
    this.site = site;
    this.content = home;
    this.categories = categories;
    this.brands = brands;
    this.services = (services as any).services || [];
    this.reviews = google.reviews;
    this.rating = google.rating;
    this.reviewCount = google.userRatingCount;
    this.images = images;
    this.loaded = true;

    // Awaited after the above (rather than folded into that Promise.all) so
    // this slow/uncached call can't delay the rest of the page's cached
    // content from rendering.
    const trailers = await this.contentService.getTrailers();
    this.trailerCount = trailers.length || null;
  }
}
