import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class AdminDashboardComponent {
  sections = [
    { label: 'Site Info', description: 'Name, phone, address, hours, social links', route: '/admin/edit/SITE_INFO', icon: '&#9881;' },
    { label: 'Home Page', description: 'Hero text, intro, CTA buttons', route: '/admin/edit/PAGE_HOME', icon: '&#9750;' },
    { label: 'About Page', description: 'Company story, founder bio', route: '/admin/edit/PAGE_ABOUT', icon: '&#9998;' },
    { label: 'Services', description: 'Service cards and descriptions', route: '/admin/edit/SERVICES', icon: '&#9874;' },
    { label: 'Custom Trailers', description: 'Gallery items and descriptions', route: '/admin/edit/CUSTOM_TRAILERS', icon: '&#9733;' },
    { label: 'Financing', description: 'Financing partners and options', route: '/admin/edit/FINANCING', icon: '&#36;' },
    { label: 'Contact', description: 'Contact page settings', route: '/admin/edit/CONTACT', icon: '&#9993;' },
    { label: 'FAQ', description: 'Frequently asked questions', route: '/admin/edit/FAQ', icon: '&#63;' },
    { label: 'Reviews', description: 'Customer testimonials', route: '/admin/edit/REVIEWS', icon: '&#9734;' },
    { label: 'Brands', description: 'Trailer brand names', route: '/admin/edit/BRANDS', icon: '&#9670;' },
    { label: 'Categories', description: 'Inventory category names and images', route: '/admin/edit/CATEGORIES', icon: '&#9776;' },
  ];

  constructor(private auth: AuthService, private router: Router) {}

  logout() {
    this.auth.logout();
    this.router.navigate(['/admin/login']);
  }
}
