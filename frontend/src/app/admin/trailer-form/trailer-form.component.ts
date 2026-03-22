import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminApiService } from '../../services/admin-api.service';
import { ContentService } from '../../services/content.service';

@Component({
  selector: 'app-trailer-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './trailer-form.component.html',
  styleUrls: ['./trailer-form.component.scss'],
})
export class TrailerFormComponent implements OnInit {
  isEdit = false;
  slug = '';
  saving = false;
  loading = true;
  toast = '';
  toastError = false;

  trailer: any = {
    name: '',
    slug: '',
    category: '',
    brand: '',
    price: '',
    gvwr: '',
    description: '',
    features: '',
    images: [],
  };

  categories = [
    'aluminum-trailers', 'aluminum-enclosed-trailers', 'car-equipment-haulers',
    'dump-trailers', 'enclosed-trailers', 'gooseneck-trailers', 'steel-utility-trailers',
  ];

  brands = ['Black Rhino', 'Maxx-D', 'Gatormade', 'Retco', 'DuraBull', 'Rock Solid Cargo'];

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
