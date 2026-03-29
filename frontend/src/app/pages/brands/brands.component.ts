import { Component, OnInit } from '@angular/core';
import { ContentService } from '../../services/content.service';

@Component({
    selector: 'app-brands',
    imports: [],
    templateUrl: './brands.component.html',
    styleUrls: ['./brands.component.scss']
})
export class BrandsComponent implements OnInit {
  brands: any[] = [];
  loaded = false;

  constructor(private contentService: ContentService) {}

  async ngOnInit() {
    this.brands = await this.contentService.getContent('BRANDS');
    this.loaded = true;
  }
}
