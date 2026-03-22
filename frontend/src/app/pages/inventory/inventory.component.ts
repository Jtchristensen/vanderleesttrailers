import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TRAILER_CATEGORIES, IMAGES } from '../../data/site-content';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss'],
})
export class InventoryComponent implements OnInit {
  categories = TRAILER_CATEGORIES;
  images = IMAGES;
  activeCategory: string | null = null;
  activeCategoryData: typeof TRAILER_CATEGORIES[0] | null = null;

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.activeCategory = params.get('category');
      if (this.activeCategory) {
        this.activeCategoryData = this.categories.find(c => c.slug === this.activeCategory) || null;
      } else {
        this.activeCategoryData = null;
      }
    });
  }
}
