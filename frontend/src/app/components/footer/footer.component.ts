import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SITE_INFO, NAV_LINKS, TRAILER_CATEGORIES } from '../../data/site-content';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
})
export class FooterComponent {
  site = SITE_INFO;
  navLinks = NAV_LINKS;
  categories = TRAILER_CATEGORIES;
  currentYear = new Date().getFullYear();
}
