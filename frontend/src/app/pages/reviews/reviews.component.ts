import { Component, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { ContentService } from '../../services/content.service';

@Component({
    selector: 'app-reviews',
    imports: [DecimalPipe],
    templateUrl: './reviews.component.html',
    styleUrls: ['./reviews.component.scss']
})
export class ReviewsComponent implements OnInit {
  reviews: any[] = ContentService.getContentSync<any[]>('REVIEWS') ?? [];
  images: any = ContentService.getContentSync('IMAGES');
  site: any = ContentService.getContentSync('SITE_INFO');
  rating: number | null = 5;
  reviewCount: number | null = null;
  googleMapsUri = '';
  loaded = false;

  constructor(private contentService: ContentService) {}

  async ngOnInit() {
    const [google, images, site] = await Promise.all([
      this.contentService.getGoogleReviews(),
      this.contentService.getContent('IMAGES'),
      this.contentService.getContent('SITE_INFO'),
    ]);
    this.reviews = google.reviews;
    this.rating = google.rating;
    this.reviewCount = google.userRatingCount;
    this.googleMapsUri = google.googleMapsUri;
    this.images = images;
    this.site = site;
    this.loaded = true;
  }

  /** Filled stars for a rounded rating (used per review card). */
  starsFor(rating: number): boolean[] {
    const rounded = Math.round(rating || 0);
    return [1, 2, 3, 4, 5].map((n) => n <= rounded);
  }
}
