import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ContentService } from '../../services/content.service';
import { NAV_LINKS } from '../../data/site-content';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
  site: any = {};
  navLinks = NAV_LINKS;
  isScrolled = false;
  isMobileMenuOpen = false;
  activeDropdown: string | null = null;

  constructor(private contentService: ContentService) {}

  async ngOnInit() {
    this.site = await this.contentService.getContent('SITE_INFO');
  }

  @HostListener('window:scroll')
  onScroll() {
    this.isScrolled = window.scrollY > 50;
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    document.body.style.overflow = this.isMobileMenuOpen ? 'hidden' : '';
  }

  closeMobileMenu() {
    this.isMobileMenuOpen = false;
    document.body.style.overflow = '';
  }

  toggleDropdown(label: string) {
    this.activeDropdown = this.activeDropdown === label ? null : label;
  }
}
