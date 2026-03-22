import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FaqComponent } from '../../components/faq/faq.component';
import { ABOUT_CONTENT, TRAILER_BRANDS, REVIEWS } from '../../data/site-content';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterLink, FaqComponent],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
})
export class AboutComponent {
  content = ABOUT_CONTENT;
  brands = TRAILER_BRANDS;
  reviews = REVIEWS;
}
