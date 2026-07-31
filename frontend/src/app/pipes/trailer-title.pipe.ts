import { Pipe, PipeTransform } from '@angular/core';

/**
 * Composes a trailer's display title from its structured fields.
 *
 * Trailers have no hand-typed name — the title is always derived, so a unit's
 * heading, its slug, and what the chat assistant says about it can never drift
 * apart:
 *
 *   2025 Maxx-D EHX 83x22 Equipment Trailer 14K GVWR
 *   └yr  └make └mdl └size └── category ──┘ └─ gvwr ─┘
 *
 * Every part is optional. Missing parts collapse without leaving double spaces,
 * so a half-filled record still reads sensibly ("Maxx-D 83x22 Dump Trailer").
 *
 * Twin of cdk/lambda/admin-api/trailer-title.mjs, which the admin API uses to
 * persist the same string for slug generation and the chat assistant. The two
 * are verified against a shared case table — change both together.
 */

/** Trailing plural is dropped so a category reads as one unit: "Dump Trailers" -> "Dump Trailer". */
export function categoryLabel(category: unknown): string {
  if (!category) return '';
  return String(category)
    .split('-')
    .filter(Boolean)
    .map(word => {
      const singular = word.endsWith('s') && word.length > 3 ? word.slice(0, -1) : word;
      return singular.charAt(0).toUpperCase() + singular.slice(1);
    })
    .join(' ');
}

/**
 * Dealer shorthand: round thousands collapse to "14K GVWR"; anything else keeps
 * its exact figure ("2,990 lb GVWR") rather than rounding a rating that buyers
 * use to make towing decisions.
 */
export function gvwrLabel(gvwr: unknown): string {
  if (gvwr === null || gvwr === undefined || gvwr === '') return '';
  const digits = String(gvwr).replace(/[^0-9.]/g, '');
  if (!digits) return '';
  const n = parseFloat(digits);
  if (isNaN(n) || n <= 0) return '';
  if (n % 1000 === 0) return `${n / 1000}K GVWR`;
  return `${n.toLocaleString('en-US')} lb GVWR`;
}

/**
 * Pulls a size out of a legacy free-text name — "MAXX-D 83x22 EHX ..." -> "83x22".
 *
 * Deck sizes are written as width-by-length with the width first, in inches or
 * feet ("83x22", "8.5x24", "7 X 16"). Anything that does not match that shape
 * yields an empty string rather than a guess: a blank field the dealer fills in
 * beats a wrong size in a title customers use to shop.
 */
export function extractSize(name: unknown): string {
  if (!name) return '';
  const m = String(name).match(/\b(\d{1,3}(?:\.\d)?)\s*[xX×]\s*(\d{1,3}(?:\.\d)?)\b/);
  return m ? `${m[1]}x${m[2]}` : '';
}

/** Builds the display title. Falls back to a legacy `name` only when nothing composes. */
export function trailerTitle(trailer: any): string {
  const t = trailer || {};
  const parts = [
    t.year,
    t.make,
    t.model,
    t.size,
    categoryLabel(t.category),
    gvwrLabel(t.gvwr),
  ];

  const title = parts
    .map(p => (p === null || p === undefined ? '' : String(p).trim()))
    .filter(Boolean)
    .join(' ');

  // A record with no structured fields at all (mid-migration, or a bad import)
  // is better represented by its old free-text name than by an empty heading.
  return title || String(t.name || '').trim();
}

@Pipe({ name: 'trailerTitle' })
export class TrailerTitlePipe implements PipeTransform {
  transform(trailer: any): string {
    return trailerTitle(trailer);
  }
}
