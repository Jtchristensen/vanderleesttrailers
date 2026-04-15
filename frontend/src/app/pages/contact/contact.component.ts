import { Component, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ContentService } from '../../services/content.service';

@Component({
    selector: 'app-contact',
    imports: [FormsModule],
    templateUrl: './contact.component.html',
    styleUrls: ['./contact.component.scss']
})
export class ContactComponent implements OnInit {
  content: any = ContentService.getContentSync('CONTACT');
  site: any = ContentService.getContentSync('SITE_INFO');
  loaded = false;

  formData = {
    name: '',
    phone: '',
    email: '',
    message: '',
  };

  isSubmitted = false;
  isSubmitting = false;

  constructor(private contentService: ContentService, private sanitizer: DomSanitizer) {}

  get mapUrl(): SafeResourceUrl | null {
    const coords = this.site?.mapCoords;
    if (!coords?.lat || !coords?.lng) return null;
    const url = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2856!2d${coords.lng}!3d${coords.lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDTCsDUzJzA5LjEiTiA4OMKwMDgnMTcuMCJX!5e0!3m2!1sen!2sus!4v1`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

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
