import { Component, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminApiService } from '../../services/admin-api.service';
import { ContentService } from '../../services/content.service';
import { trailerTitle, extractSize, extractVariant } from '../../pipes/trailer-title.pipe';

@Component({
    selector: 'app-trailer-form',
    imports: [FormsModule, RouterLink],
    templateUrl: './trailer-form.component.html',
    styleUrls: ['./trailer-form.component.scss']
})
export class TrailerFormComponent implements OnInit {
  isEdit = false;
  slug = '';
  saving = false;
  loading = true;
  toast = '';
  toastError = false;

  trailer: any = {
    slug: '',
    category: '',
    year: '',
    make: '',
    model: '',
    size: '',
    variant: '',
    price: '',
    /** Optional manufacturer list price; shows struck through next to price when higher. */
    msrp: '',
    gvwr: '',
    features: '',
    images: [],
  };

  /** Live preview of the heading customers will see — the title is derived, never typed. */
  get title(): string {
    return trailerTitle(this.trailer);
  }

  categories = [
    'aluminum-trailers', 'aluminum-enclosed-trailers', 'car-equipment-haulers',
    'dump-trailers', 'enclosed-trailers', 'gooseneck-trailers', 'steel-utility-trailers',
  ];

  makes = [
    'Black Rhino', 'Maxx-D', 'Gatormade', 'Retco', 'DuraBull', 'Rock Solid Cargo',
    'Southern Utility',
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private adminApi: AdminApiService,
    private content: ContentService,
  ) {}

  async ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (slug) {
      this.isEdit = true;
      this.slug = slug;
      try {
        const data = await this.content.getTrailer(slug);
        this.trailer = { ...this.trailer, ...data };
        // Records written before the make/model split still carry `brand` and a
        // `description` that only echoed the feature list. Fold them forward so
        // saving this trailer drops the legacy fields.
        if (!this.trailer.make && this.trailer.brand) {
          this.trailer.make = this.trailer.brand;
        }
        delete this.trailer.brand;
        delete this.trailer.description;
        // The title is composed from year/make/model/size/variant/category/GVWR
        // now. Keep the legacy free-text name only long enough for the parsers
        // below to read it; it is stripped before save so the record stops
        // carrying it. Both are seeded rather than left blank so the dealer edits
        // a filled-in field instead of retyping what the old name already said.
        if (!this.trailer.size && this.trailer.name) {
          this.trailer.size = extractSize(this.trailer.name);
        }
        if (!this.trailer.variant && this.trailer.name) {
          this.trailer.variant = extractVariant(this.trailer.name, this.trailer);
        }
        delete this.trailer.name;
        delete this.trailer.title;
        if (typeof this.trailer.features === 'object') {
          this.trailer.features = (this.trailer.features as string[]).join('\n');
        }
      } catch {
        this.showToast('Failed to load trailer', true);
      }
    }
    this.loading = false;
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    for (const file of Array.from(input.files)) {
      try {
        const imageUrl = await this.adminApi.uploadImage(file);
        this.trailer.images = [...(this.trailer.images || []), imageUrl];
      } catch {
        this.showToast('Failed to upload image', true);
      }
    }
  }

  removeImage(index: number) {
    this.trailer.images.splice(index, 1);
  }

  async save() {
    // An empty title means an empty heading on the site and an empty slug in the
    // URL, so refuse the save rather than publish a broken listing.
    if (!this.title) {
      this.showToast('Add at least a make, model, size or variant — the title is built from those', true);
      return;
    }

    this.saving = true;
    try {
      const data = {
        ...this.trailer,
        features: this.trailer.features
          ? this.trailer.features.split('\n').filter((f: string) => f.trim())
          : [],
      };

      if (this.isEdit) {
        await this.adminApi.updateTrailer(this.slug, data);
      } else {
        const result = await this.adminApi.createTrailer(data);
        this.slug = result.slug;
        this.isEdit = true;
      }
      this.content.clearCache();
      this.showToast('Trailer saved!', false);
    } catch (err: any) {
      this.showToast(err.message || 'Failed to save', true);
    }
    this.saving = false;
  }

  private showToast(message: string, isError: boolean) {
    this.toast = message;
    this.toastError = isError;
    setTimeout(() => (this.toast = ''), 3000);
  }
}
