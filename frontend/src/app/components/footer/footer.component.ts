import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../services/content.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
})
export class FooterComponent implements OnInit {
  site: any = {};
  categories: any[] = [];
  currentYear = new Date().getFullYear();

  constructor(private contentService: ContentService) {}

  async ngOnInit() {
    const [site, categories] = await Promise.all([
      this.contentService.getContent('SITE_INFO'),
      this.contentService.getContent('CATEGORIES'),
    ]);
    this.site = site;
    this.categories = categories;
  }
}
