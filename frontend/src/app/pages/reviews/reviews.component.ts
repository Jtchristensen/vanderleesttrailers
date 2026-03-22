import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { REVIEWS, IMAGES, SITE_INFO } from '../../data/site-content';

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reviews.component.html',
  styleUrls: ['./reviews.component.scss'],
})
export class ReviewsComponent {
  reviews = REVIEWS;
  images = IMAGES;
  site = SITE_INFO;
}
