import { Injectable } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

/** Fallback title/description — mirrors the static tags in src/index.html. */
export const DEFAULT_TITLE = "VanderLeest Trailer Sales | Northeastern Wisconsin's Trailer Dealer";
export const DEFAULT_DESCRIPTION =
  "VanderLeest Trailer Sales - Northeastern Wisconsin's premier trailer dealer. Aluminum, enclosed, dump, gooseneck, and utility trailers from top brands.";

export interface RouteSeoData {
  title?: string;
  description?: string;
}

/**
 * Keeps the document <title> and meta description in sync with the
 * currently activated route's `data.title` / `data.description`.
 *
 * Instantiate once (e.g. by injecting it into AppComponent's constructor)
 * so its navigation subscription starts as soon as the app boots.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  constructor(
    private router: Router,
    private title: Title,
    private meta: Meta,
  ) {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.updateMetaTags(this.getDeepestRouteData()));
  }

  /** Walks the activated route snapshot tree down to its deepest child and
   * merges `data` along the way, so lazy-loaded leaf routes (loadComponent)
   * are reached the same as any other route. */
  private getDeepestRouteData(): RouteSeoData {
    let snapshot: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let data: RouteSeoData = { ...snapshot.data };

    while (snapshot?.firstChild) {
      snapshot = snapshot.firstChild;
      data = { ...data, ...snapshot.data };
    }

    return data;
  }

  private updateMetaTags(data: RouteSeoData): void {
    this.title.setTitle(data.title ?? DEFAULT_TITLE);
    this.meta.updateTag({ name: 'description', content: data.description ?? DEFAULT_DESCRIPTION });
  }
}
