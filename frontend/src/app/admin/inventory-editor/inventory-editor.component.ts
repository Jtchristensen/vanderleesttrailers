import { Component, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminApiService } from '../../services/admin-api.service';

@Component({
    selector: 'app-inventory-editor',
    imports: [FormsModule, RouterLink],
    templateUrl: './inventory-editor.component.html',
    styleUrls: ['./inventory-editor.component.scss']
})
export class InventoryEditorComponent implements OnInit {
  trailers: any[] = [];
  filteredTrailers: any[] = [];
  searchQuery = '';
  categoryFilter = '';
  loading = true;
  toast = '';
  toastError = false;

  dragIndex: number | null = null;
  dropIndex: number | null = null;
  orderChanged = false;
  savingOrder = false;

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

  get canReorder(): boolean {
    return !!this.categoryFilter && !this.searchQuery;
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
    result.sort((a, b) => {
      const aOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.name || '').localeCompare(b.name || '');
    });
    this.filteredTrailers = result;
    this.orderChanged = false;
  }

  onDragStart(index: number) {
    this.dragIndex = index;
  }

  onDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    this.dropIndex = index;
  }

  onDrop(index: number) {
    if (this.dragIndex === null || this.dragIndex === index) {
      this.dragIndex = null;
      this.dropIndex = null;
      return;
    }
    const item = this.filteredTrailers.splice(this.dragIndex, 1)[0];
    this.filteredTrailers.splice(index, 0, item);
    this.dragIndex = null;
    this.dropIndex = null;
    this.orderChanged = true;
  }

  onDragEnd() {
    this.dragIndex = null;
    this.dropIndex = null;
  }

  async saveOrder() {
    this.savingOrder = true;
    try {
      const orders = this.filteredTrailers.map((t, i) => ({
        slug: t.slug,
        sortOrder: i,
      }));
      await this.adminApi.reorderTrailers(orders);
      for (const o of orders) {
        const t = this.trailers.find(tr => tr.slug === o.slug);
        if (t) t.sortOrder = o.sortOrder;
      }
      this.orderChanged = false;
      this.showToast('Order saved!', false);
    } catch {
      this.showToast('Failed to save order', true);
    }
    this.savingOrder = false;
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
