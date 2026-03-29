import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';

import { RouterLink } from '@angular/router';
import { FaqComponent } from '../../components/faq/faq.component';
import { ContentService } from '../../services/content.service';

@Component({
    selector: 'app-home',
    imports: [RouterLink, FaqComponent],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, AfterViewInit {
  @ViewChild('heroVideo') heroVideo!: ElementRef<HTMLVideoElement>;

  content: any = {};
  categories: any[] = [];
  brands: any[] = [];
  services: any[] = [];
  reviews: any[] = [];
  site: any = {};
  images: any = {};
  loaded = false;

  constructor(private contentService: ContentService) {}

  ngAfterViewInit() {
    if (this.heroVideo?.nativeElement) {
      this.heroVideo.nativeElement.muted = true;
      this.heroVideo.nativeElement.volume = 0;
    }
  }

  async ngOnInit() {
    const [site, home, categories, brands, services, reviews, images] = await Promise.all([
      this.contentService.getContent('SITE_INFO'),
      this.contentService.getContent('PAGE_HOME'),
      this.contentService.getContent('CATEGORIES'),
      this.contentService.getContent('BRANDS'),
      this.contentService.getContent('SERVICES'),
      this.contentService.getContent('REVIEWS'),
      this.contentService.getContent('IMAGES'),
    ]);
    this.site = site;
    this.content = home;
    this.categories = categories;
    this.brands = brands;
    this.services = (services as any).services || [];
    this.reviews = reviews;
    this.images = images;
    this.loaded = true;
  }
}
