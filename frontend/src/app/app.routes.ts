import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  // Public routes
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent),
  },
  {
    path: 'inventory',
    loadComponent: () => import('./pages/inventory/inventory.component').then(m => m.InventoryComponent),
  },
  {
    path: 'inventory/:category',
    loadComponent: () => import('./pages/inventory/inventory.component').then(m => m.InventoryComponent),
  },
  {
    path: 'services',
    loadComponent: () => import('./pages/services/services.component').then(m => m.ServicesComponent),
  },
  {
    path: 'custom-trailers',
    loadComponent: () => import('./pages/custom-trailers/custom-trailers.component').then(m => m.CustomTrailersComponent),
  },
  {
    path: 'financing',
    loadComponent: () => import('./pages/financing/financing.component').then(m => m.FinancingComponent),
  },
  {
    path: 'reviews',
    loadComponent: () => import('./pages/reviews/reviews.component').then(m => m.ReviewsComponent),
  },
  {
    path: 'contact',
    loadComponent: () => import('./pages/contact/contact.component').then(m => m.ContactComponent),
  },

  // Admin routes
  {
    path: 'admin/login',
    loadComponent: () => import('./admin/login/login.component').then(m => m.AdminLoginComponent),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin/dashboard/dashboard.component').then(m => m.AdminDashboardComponent),
  },
  {
    path: 'admin/edit/:type',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin/content-editor/content-editor.component').then(m => m.ContentEditorComponent),
  },
  {
    path: 'admin/inventory',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin/inventory-editor/inventory-editor.component').then(m => m.InventoryEditorComponent),
  },
  {
    path: 'admin/inventory/new',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin/trailer-form/trailer-form.component').then(m => m.TrailerFormComponent),
  },
  {
    path: 'admin/inventory/edit/:slug',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin/trailer-form/trailer-form.component').then(m => m.TrailerFormComponent),
  },

  // Fallback
  {
    path: '**',
    redirectTo: '',
  },
];
