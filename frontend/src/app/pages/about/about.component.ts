import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FaqComponent } from '../../components/faq/faq.component';
import { ContentService } from '../../services/content.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterLink, FaqComponent],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
})
export class AboutComponent implements OnInit {
  content: any = {};
  brands: any[] = [];
  loaded = false;

  constructor(private contentService: ContentService) {}

  async ngOnInit() {
    const [content, brands] = await Promise.all([
      this.contentService.getContent('PAGE_ABOUT'),
      this.contentService.getContent('BRANDS'),
    ]);
    this.content = content;
    this.brands = brands;
    this.loaded = true;
  }
}
