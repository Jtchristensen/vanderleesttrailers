import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminApiService } from '../../services/admin-api.service';

@Component({
  selector: 'app-inventory-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './inventory-editor.component.html',
  styleUrls: ['./inventory-editor.component.scss'],
})
export class InventoryEditorComponent implements OnInit {
  trailers: any[] = [];
  filteredTrailers: any[] = [];
  searchQuery = '';
  categoryFilter = '';
  loading = true;
  toast = '';
  toastError = false;

  categories = [
    'aluminum-trailers', 'aluminum-enclosed-trailers', 'car-equipment-haulers',
    'dump-trailers', 'enclosed-trailers', 'gooseneck-trailers', 'steel-utility-trailers',
  ];

  constructor(private adminApi: AdminApiService) {}

  async ngOnInit() {
    await this.loadTrailers();
  }

  async loadTrailers() {
    this.loading = true;
    try {
      this.trailers = await this.adminApi.getTrailers();
      this.applyFilters();
    } catch (err) {
      this.showToast('Failed to load trailers', true);
    }
    this.loading = false;
  }

  applyFilters() {
    let result = [...this.trailers];
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(t =>
        t.name?.toLowerCase().includes(q) || t.brand?.toLowerCase().includes(q)
      );
    }
    if (this.categoryFilter) {
      result = result.filter(t => t.category === this.categoryFilter);
    }
    this.filteredTrailers = result;
  }

  async deleteTrailer(slug: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await this.adminApi.deleteTrailer(slug);
      this.trailers = this.trailers.filter(t => t.slug !== slug);
      this.applyFilters();
      this.showToast('Trailer deleted', false);
    } catch {
      this.showToast('Failed to delete trailer', true);
    }
  }

  private showToast(message: string, isError: boolean) {
    this.toast = message;
    this.toastError = isError;
    setTimeout(() => (this.toast = ''), 3000);
  }
}
