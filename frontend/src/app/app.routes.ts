import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  // Public routes
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
    data: {
      title: "VanderLeest Trailer Sales | Northeastern Wisconsin's Trailer Dealer",
      description: "VanderLeest Trailer Sales - Northeastern Wisconsin's premier trailer dealer. Aluminum, enclosed, dump, gooseneck, and utility trailers from top brands.",
    },
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent),
    data: {
      title: 'About Us | VanderLeest Trailer Sales',
      description: 'VanderLeest Trailer Sales was established in 2018 and has grown into a leading Northeastern Wisconsin trailer dealer by prioritizing relationships over transactional sales.',
    },
  },
  {
    path: 'inventory',
    loadComponent: () => import('./pages/inventory/inventory.component').then(m => m.InventoryComponent),
    data: {
      title: 'Trailer Inventory | VanderLeest Trailer Sales',
      description: 'Browse our full inventory of aluminum, enclosed, dump, gooseneck, and steel utility trailers from top manufacturers like Black Rhino, Maxx-D, and Gatormade.',
    },
  },
  {
    path: 'inventory/:category',
    loadComponent: () => import('./pages/inventory/inventory.component').then(m => m.InventoryComponent),
    data: {
      title: 'Shop by Category | VanderLeest Trailer Sales',
      description: 'Browse VanderLeest Trailer Sales inventory by category, including aluminum, enclosed, dump, gooseneck, and steel utility trailers.',
    },
  },
  {
    path: 'trailer/:slug',
    loadComponent: () => import('./pages/trailer-detail/trailer-detail.component').then(m => m.TrailerDetailComponent),
    data: {
      title: 'Trailer Details | VanderLeest Trailer Sales',
      description: 'View detailed specs, photos, and pricing for this trailer at VanderLeest Trailer Sales in Oconto Falls, WI.',
    },
  },
  {
    path: 'compare',
    loadComponent: () => import('./pages/compare/compare.component').then(m => m.CompareComponent),
    data: {
      title: 'Compare Trailers | VanderLeest Trailer Sales',
      description: 'Compare specs, features, and pricing side-by-side for trailers in our inventory to find the right fit for your hauling needs.',
    },
  },
  {
    path: 'brands',
    loadComponent: () => import('./pages/brands/brands.component').then(m => m.BrandsComponent),
    data: {
      title: 'Trailer Brands | VanderLeest Trailer Sales',
      description: 'We stock trailers from top manufacturers including Black Rhino, Maxx-D, Gatormade, Retco, DuraBull, and Rock Solid Cargo.',
    },
  },
  {
    path: 'trailer-finder',
    loadComponent: () => import('./pages/trailer-finder/trailer-finder.component').then(m => m.TrailerFinderComponent),
    data: {
      title: 'Trailer Finder | VanderLeest Trailer Sales',
      description: 'Answer a few quick questions and let our trailer finder tool match you with the right trailer for your hauling needs.',
    },
  },
  {
    path: 'services',
    loadComponent: () => import('./pages/services/services.component').then(m => m.ServicesComponent),
    data: {
      title: 'Trailer Service & Repair | VanderLeest Trailer Sales',
      description: "VanderLeest offers welding, painting, electrical, bearing and brake service, and custom trailer work. We'll fix it even if we didn't sell it to you.",
    },
  },
  {
    path: 'custom-trailers',
    loadComponent: () => import('./pages/custom-trailers/custom-trailers.component').then(m => m.CustomTrailersComponent),
    data: {
      title: 'Custom Trailers | VanderLeest Trailer Sales',
      description: 'VanderLeest builds custom trailer solutions to fit your specific requirements, from generator boxes to food trailers and more.',
    },
  },
  {
    path: 'financing',
    loadComponent: () => import('./pages/financing/financing.component').then(m => m.FinancingComponent),
    data: {
      title: 'Financing Options | VanderLeest Trailer Sales',
      description: 'We work with multiple financing partners, including Marine Credit Union, Trailer Solutions Financial, and ClickLease, to offer flexible options for every credit level.',
    },
  },
  {
    path: 'reviews',
    loadComponent: () => import('./pages/reviews/reviews.component').then(m => m.ReviewsComponent),
    data: {
      title: 'Customer Reviews | VanderLeest Trailer Sales',
      description: 'See what our customers are saying about their experience buying and servicing trailers at VanderLeest Trailer Sales.',
    },
  },
  {
    path: 'favorites',
    loadComponent: () => import('./pages/favorites/favorites.component').then(m => m.FavoritesComponent),
    data: {
      title: 'Favorites | VanderLeest Trailer Sales',
      description: "View and manage the trailers you've saved as favorites at VanderLeest Trailer Sales.",
    },
  },
  {
    path: 'contact',
    loadComponent: () => import('./pages/contact/contact.component').then(m => m.ContactComponent),
    data: {
      title: 'Contact Us | VanderLeest Trailer Sales',
      description: "Get in touch with VanderLeest Trailer Sales in Oconto Falls, WI. We'll respond within 1 to 2 business days.",
    },
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
