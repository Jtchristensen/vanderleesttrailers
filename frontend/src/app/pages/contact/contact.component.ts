import { Component, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ContentService } from '../../services/content.service';

@Component({
    selector: 'app-contact',
    imports: [FormsModule],
    templateUrl: './contact.component.html',
    styleUrls: ['./contact.component.scss']
})
export class ContactComponent implements OnInit {
  content: any = {};
  site: any = {};
  loaded = false;

  formData = {
    name: '',
    phone: '',
    email: '',
    message: '',
  };

  isSubmitted = false;
  isSubmitting = false;

  constructor(private contentService: ContentService) {}

  async ngOnInit() {
    const [content, site] = await Promise.all([
      this.contentService.getContent('CONTACT'),
      this.contentService.getContent('SITE_INFO'),
    ]);
    this.content = content;
    this.site = site;
    this.loaded = true;
  }

  onSubmit() {
    this.isSubmitting = true;
    setTimeout(() => {
      this.isSubmitting = false;
      this.isSubmitted = true;
      this.formData = { name: '', phone: '', email: '', message: '' };
    }, 1000);
  }
}
