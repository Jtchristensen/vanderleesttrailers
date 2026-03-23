import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContentService } from '../../services/content.service';

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reviews.component.html',
  styleUrls: ['./reviews.component.scss'],
})
export class ReviewsComponent implements OnInit {
  reviews: any[] = [];
  images: any = {};
  site: any = {};
  loaded = false;

  constructor(private contentService: ContentService) {}

  async ngOnInit() {
    const [reviews, images, site] = await Promise.all([
      this.contentService.getContent('REVIEWS'),
      this.contentService.getContent('IMAGES'),
      this.contentService.getContent('SITE_INFO'),
    ]);
    this.reviews = reviews;
    this.images = images;
    this.site = site;
    this.loaded = true;
  }
}
