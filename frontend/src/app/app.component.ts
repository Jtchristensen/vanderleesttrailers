import { Component, OnInit } from '@angular/core';

import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { ChatWidgetComponent } from './components/chat-widget/chat-widget.component';
import { HiringPopupComponent } from './components/hiring-popup/hiring-popup.component';
import { ContentService } from './services/content.service';
import { SeoService } from './services/seo.service';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, HeaderComponent, FooterComponent, ChatWidgetComponent, HiringPopupComponent],
    template: `
    <app-header />
    <main>
      <router-outlet />
    </main>
    <app-footer />
    <app-chat-widget />
    <app-hiring-popup />
  `,
    styles: [`
    main {
      min-height: 100vh;
      padding-top: var(--header-height);
    }
  `]
})
export class AppComponent implements OnInit {
  constructor(private contentService: ContentService, private seoService: SeoService) {}

  ngOnInit() {
    // Preload all content into cache so page navigation is instant
    const types = [
      'SITE_INFO', 'PAGE_HOME', 'PAGE_ABOUT', 'SERVICES',
      'CUSTOM_TRAILERS', 'FINANCING', 'CONTACT', 'FAQ',
      'REVIEWS', 'BRANDS', 'CATEGORIES', 'IMAGES', 'CAREERS',
    ];
    types.forEach(type => this.contentService.getContent(type));
    this.contentService.getTrailers();
  }
}
