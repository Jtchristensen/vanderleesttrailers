import { Component, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ContentService } from '../../services/content.service';
import { AdminApiService } from '../../services/admin-api.service';

@Component({
    selector: 'app-content-editor',
    imports: [FormsModule, RouterLink],
    templateUrl: './content-editor.component.html',
    styleUrls: ['./content-editor.component.scss']
})
export class ContentEditorComponent implements OnInit {
  contentType = '';
  contentLabel = '';
  data: any = null;
  jsonText = '';
  loading = true;
  saving = false;
  toast = '';
  toastError = false;
  isArrayData = false;

  private labelMap: Record<string, string> = {
    SITE_INFO: 'Site Info',
    PAGE_HOME: 'Home Page',
    PAGE_ABOUT: 'About Page',
    SERVICES: 'Services',
    CUSTOM_TRAILERS: 'Custom Trailers',
    FINANCING: 'Financing',
    CONTACT: 'Contact',
    FAQ: 'FAQ',
    REVIEWS: 'Reviews',
    BRANDS: 'Brands',
    CATEGORIES: 'Categories',
    IMAGES: 'Images',
  };

  constructor(
    private route: ActivatedRoute,
    private content: ContentService,
    private adminApi: AdminApiService,
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(async (params) => {
      this.contentType = params.get('type') || '';
      this.contentLabel = this.labelMap[this.contentType] || this.contentType;
      await this.loadContent();
    });
  }

  async loadContent() {
    this.loading = true;
    try {
      this.data = await this.content.getContent(this.contentType);
      this.isArrayData = Array.isArray(this.data);
      this.jsonText = JSON.stringify(this.data, null, 2);
    } catch {
      this.data = {};
      this.jsonText = '{}';
    }
    this.loading = false;
  }

  // Get all leaf-level string/number fields for simple editing
  getFields(obj: any, prefix = ''): { path: string; label: string; value: any; type: string }[] {
    if (!obj || typeof obj !== 'object') return [];
    const fields: any[] = [];

    for (const [key, val] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof val === 'string' || typeof val === 'number') {
        fields.push({
          path,
          label: path,
          value: val,
          type: typeof val === 'number' ? 'number' : (val as string).length > 100 ? 'textarea' : 'text',
        });
      }
    }
    return fields;
  }

  getNestedSections(obj: any): { key: string; value: any }[] {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
    const sections: any[] = [];
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        sections.push({ key, value: val });
      }
    }
    return sections;
  }

  updateField(path: string, newValue: any) {
    const parts = path.split('.');
    let obj = this.data;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = newValue;
    this.jsonText = JSON.stringify(this.data, null, 2);
  }

  onJsonChange() {
    try {
      this.data = JSON.parse(this.jsonText);
    } catch {
      // invalid JSON — don't update
    }
  }

  async save() {
    this.saving = true;
    this.toast = '';
    try {
      // Re-parse from JSON in case user edited raw
      const dataToSave = JSON.parse(this.jsonText);
      await this.adminApi.updateContent(this.contentType, dataToSave);
      this.data = dataToSave;
      this.content.clearCache();
      this.showToast('Saved successfully!', false);
    } catch (err: any) {
      this.showToast(err.message || 'Failed to save', true);
    }
    this.saving = false;
  }

  // Array data helpers
  addArrayItem() {
    if (!Array.isArray(this.data)) return;
    // Clone last item as template or create empty
    const template = this.data.length > 0 ? { ...this.data[this.data.length - 1] } : {};
    this.data.push(template);
    this.jsonText = JSON.stringify(this.data, null, 2);
  }

  removeArrayItem(index: number) {
    if (!Array.isArray(this.data)) return;
    this.data.splice(index, 1);
    this.jsonText = JSON.stringify(this.data, null, 2);
  }

  private showToast(message: string, isError: boolean) {
    this.toast = message;
    this.toastError = isError;
    setTimeout(() => (this.toast = ''), 3000);
  }
}
