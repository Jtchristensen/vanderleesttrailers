import { Component, OnInit } from '@angular/core';

import { ActivatedRoute, RouterLink } from '@angular/router';
import { ContentService } from '../../services/content.service';

@Component({
    selector: 'app-inventory',
    imports: [RouterLink],
    templateUrl: './inventory.component.html',
    styleUrls: ['./inventory.component.scss']
})
export class InventoryComponent implements OnInit {
  categories: any[] = [];
  trailers: any[] = [];
  filteredTrailers: any[] = [];
  images: any = {};
  activeCategory: string | null = null;
  activeCategoryData: any = null;
  loaded = false;

  constructor(private route: ActivatedRoute, private contentService: ContentService) {}

  async ngOnInit() {
    const [categories, images, trailers] = await Promise.all([
      this.contentService.getContent('CATEGORIES'),
      this.contentService.getContent('IMAGES'),
      this.contentService.getTrailers(),
    ]);
    this.categories = categories;
    this.images = images;
    this.trailers = trailers;

    this.route.paramMap.subscribe(params => {
      this.activeCategory = params.get('category');
      if (this.activeCategory) {
        this.activeCategoryData = this.categories.find((c: any) => c.slug === this.activeCategory) || null;
        this.filteredTrailers = this.trailers.filter((t: any) => t.category === this.activeCategory);
      } else {
        this.activeCategoryData = null;
        this.filteredTrailers = [];
      }
    });

    this.loaded = true;
  }
}
