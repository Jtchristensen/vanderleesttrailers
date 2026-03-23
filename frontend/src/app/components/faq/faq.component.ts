import { Component, OnInit } from '@angular/core';

import { ContentService } from '../../services/content.service';

@Component({
    selector: 'app-faq',
    imports: [],
    templateUrl: './faq.component.html',
    styleUrls: ['./faq.component.scss']
})
export class FaqComponent implements OnInit {
  faqs: any[] = [];
  openIndex: number | null = null;

  constructor(private contentService: ContentService) {}

  async ngOnInit() {
    this.faqs = await this.contentService.getContent('FAQ');
  }

  toggle(index: number) {
    this.openIndex = this.openIndex === index ? null : index;
  }
}
