import { Component, OnInit } from '@angular/core';

import { RouterLink } from '@angular/router';
import { FaqComponent } from '../../components/faq/faq.component';
import { ContentService } from '../../services/content.service';

@Component({
    selector: 'app-services',
    imports: [RouterLink, FaqComponent],
    templateUrl: './services.component.html',
    styleUrls: ['./services.component.scss']
})
export class ServicesComponent implements OnInit {
  content: any = {};
  site: any = {};
  loaded = false;

  constructor(private contentService: ContentService) {}

  async ngOnInit() {
    const [content, site] = await Promise.all([
      this.contentService.getContent('SERVICES'),
      this.contentService.getContent('SITE_INFO'),
    ]);
    this.content = content;
    this.site = site;
    this.loaded = true;
  }
}
