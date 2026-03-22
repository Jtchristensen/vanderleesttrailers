import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FaqComponent } from '../../components/faq/faq.component';
import {
  HOME_CONTENT,
  TRAILER_CATEGORIES,
  TRAILER_BRANDS,
  SERVICES_CONTENT,
  REVIEWS,
  SITE_INFO,
  IMAGES,
} from '../../data/site-content';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FaqComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  content = HOME_CONTENT;
  categories = TRAILER_CATEGORIES;
  brands = TRAILER_BRANDS;
  services = SERVICES_CONTENT.services;
  reviews = REVIEWS;
  site = SITE_INFO;
  images = IMAGES;
}
