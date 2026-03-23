import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../services/content.service';

@Component({
  selector: 'app-custom-trailers',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './custom-trailers.component.html',
  styleUrls: ['./custom-trailers.component.scss'],
})
export class CustomTrailersComponent implements OnInit {
  content: any = {};
  site: any = {};
  loaded = false;

  constructor(private contentService: ContentService) {}

  async ngOnInit() {
    const [content, site] = await Promise.all([
      this.contentService.getContent('CUSTOM_TRAILERS'),
      this.contentService.getContent('SITE_INFO'),
    ]);
    this.content = content;
    this.site = site;
    this.loaded = true;
  }
}
