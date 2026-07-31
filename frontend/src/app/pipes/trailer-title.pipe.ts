import { Pipe, PipeTransform } from '@angular/core';

/**
 * Composes a trailer's display title from its structured fields.
 *
 * Trailers have no hand-typed name — the title is always derived, so a unit's
 * heading, its slug, and what the chat assistant says about it can never drift
 * apart:
 *
 *   2025 Maxx-D EHX 83x22 Army Green Equipment Trailer 14K GVWR
 *   └yr  └make └mdl └size └variant  └── category ──┘ └─ gvwr ─┘
 *
 * Every part is optional. Missing parts collapse without leaving double spaces,
 * so a half-filled record still reads sensibly ("Maxx-D 83x22 Dump Trailer").
 *
 * `variant` carries the colour / package / option words no other field holds
 * ("Charcoal PolyCore Blackout", "Bi-Fold Ramp", "Army Green"). Much of the
 * inventory is otherwise identical unit-for-unit — nine 8.5x24 Rock Solid Cargo
 * enclosed trailers share a make, model, size, category and GVWR and differ
 * only by colour — so without it those listings collapse into one heading, one
 * slug, and one indistinguishable row in the compare table.
 *
 * Twin of cdk/lambda/admin-api/trailer-title.mjs, which the admin API uses to
 * persist the same string for slug generation and the chat assistant. The two
 * are verified against a shared case table — change both together.
 */

/** Inch and foot marks, straight and typographic. The dealer uses all of them. */
const IN = `["”″]`;
const FT = `['’′]`;
/** A deck dimension: up to three digits, optionally one decimal ("8.5", "102"). */
const NUM = `\\d{1,3}(?:\\.\\d)?`;

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
 * Dealer shorthand: a rating landing on a round hundred collapses to "17.5K
 * GVWR"; anything else keeps its exact figure ("2,990 lb GVWR") rather than
 * rounding a number buyers tow by.
 */
export function gvwrLabel(gvwr: unknown): string {
  if (gvwr === null || gvwr === undefined || gvwr === '') return '';
  const digits = String(gvwr).replace(/[^0-9.]/g, '');
  if (!digits) return '';
  const n = parseFloat(digits);
  if (isNaN(n) || n <= 0) return '';
  // 7000 -> 7K and 17500 -> 17.5K; 2,990 and 25,990 keep their exact figure.
  if (n % 100 === 0) return `${n / 1000}K GVWR`;
  return `${n.toLocaleString('en-US')} lb GVWR`;
}

/**
 * Pulls a size out of a legacy free-text name.
 *
 * The dealer writes sizes four ways, and all four appear in live inventory:
 *
 *   6’10”x14   feet-and-inches width  -> 82x14   (converted to plain inches)
 *   82″x22′    width by length        -> 82x22
 *   20’ + 5’   deck plus dovetail     -> 20+5
 *   14ft       length only            -> 14ft
 *
 * Yields an empty string rather than a guess when none of those match: a blank
 * field the dealer fills in beats a wrong size in a title customers shop by.
 */
export function extractSize(name: unknown): string {
  const s = String(name || '');
  let m = s.match(new RegExp(`\\b(\\d)\\s*${FT}\\s*(\\d{1,2})\\s*${IN}?\\s*[xX×]\\s*(${NUM})`));
  if (m) return `${Number(m[1]) * 12 + Number(m[2])}x${m[3]}`;
  m = s.match(new RegExp(`\\b(${NUM})\\s*(?:${IN}|${FT})?\\s*[xX×]\\s*(${NUM})\\b`));
  if (m) return `${m[1]}x${m[2]}`;
  m = s.match(new RegExp(`\\b(\\d{1,3})\\s*${FT}?\\s*\\+\\s*(\\d{1,3})\\s*${FT}`));
  if (m) return `${m[1]}+${m[2]}`;
  m = s.match(new RegExp(`\\b(${NUM})\\s*(?:${FT}|ft\\b)`, 'i'));
  if (m) return `${m[1]}ft`;
  return '';
}

/**
 * Words describing something a structured field already holds, or carrying no
 * distinguishing information. Category words are dropped separately, per record,
 * from that record's own category slug — a blanket list would strip "Gooseneck"
 * from a dump trailer, where it is the differentiator rather than the category.
 */
const STOP = new Set(
  `trailer trailers gvwr lb lbs ft with w and the of for a tandem single axle axles utility`
    .split(/\s+/)
    .filter(Boolean),
);

/**
 * Derives the colour / package / option phrase from a legacy free-text name by
 * removing everything the structured fields already hold and keeping the rest —
 * "8.5×24 Rock Solid Cargo Charcoal PolyCore Blackout Package 10K GVWR" yields
 * "Charcoal Polycore Blackout Package".
 *
 * A migration aid, not a parser to depend on. It is deliberately greedy about
 * dropping words and capped at six, so the result is a starting point the dealer
 * edits in the admin portal rather than a finished phrase.
 */
export function extractVariant(name: unknown, trailer?: any): string {
  const { make = '', model = '', category = '' } = trailer || {};
  let s = ` ${String(name || '')} `;

  // Sizes, in each of the forms extractSize understands.
  s = s.replace(
    new RegExp(
      `\\b${NUM}\\s*(?:${IN}|${FT})?\\s*(?:${FT}\\s*\\d{1,2}\\s*${IN}?\\s*)?[xX×]\\s*${NUM}\\s*(?:${IN}|${FT})?`,
      'g',
    ),
    ' ',
  );
  s = s.replace(new RegExp(`\\b\\d{1,3}\\s*${FT}?\\s*\\+\\s*\\d{1,3}\\s*${FT}`, 'g'), ' ');

  // "4' SIDES" is a dump-body spec rather than a deck dimension. Lift it out
  // before the length strip below eats it, and add it back as a finished phrase.
  let sides = '';
  s = s.replace(new RegExp(`\\b(\\d{1,2})\\s*${FT}?\\s*SIDES?\\b`, 'gi'), (_, n) => {
    sides = `${n}ft Sides`;
    return ' ';
  });

  s = s.replace(new RegExp(`\\b${NUM}\\s*(?:${IN}|${FT})`, 'g'), ' ');
  s = s.replace(new RegExp(`\\b${NUM}\\s*ft\\b`, 'gi'), ' ');

  // Weight ratings: 14K, 17.5K, 24-9K, 25,990, 3,500 LB.
  s = s.replace(/\b\d{1,3}(?:[.,-]\d{1,3})?\s*K\b/gi, ' ');
  s = s.replace(/\b\d{1,3},\d{3}\b/g, ' ');
  s = s.replace(/\bGVWR\b/gi, ' ');

  for (const field of [make, model]) {
    if (!field) continue;
    s = s.replace(new RegExp(`\\b${String(field).replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}\\b`, 'gi'), ' ');
  }
  // The make is spelled "MAXX-D", "MAXX D" and "Maxx-D" across the inventory.
  s = s.replace(/\bMAXX\s*-?\s*D\b/gi, ' ');

  s = s.replace(new RegExp(`[|/()\\[\\]+${IN.slice(1, -1)}${FT.slice(1, -1)}]`, 'g'), ' ');
  // Separator dashes go; the hyphen inside "BI-FOLD" and "LOW-PRO" stays.
  s = s.replace(/[–—]+/g, ' ').replace(/\s-+\s|\s-+|-+\s/g, ' ');

  const catWords = new Set(
    String(category)
      .split('-')
      .filter(Boolean)
      .map((w: string) => w.replace(/s$/, '')),
  );

  const words: string[] = [];
  const seen = new Set<string>();
  for (const raw of s.split(/\s+/).filter(Boolean)) {
    // "TRAILER-BLACK" is a separator the dealer typed without spaces.
    const pieces = raw.split('-');
    for (const word of pieces.length > 1 && pieces.some(p => STOP.has(p.toLowerCase())) ? pieces : [raw]) {
      const bare = word.toLowerCase().replace(/[.,]+$/, '');
      if (!bare || STOP.has(bare) || catWords.has(bare.replace(/s$/, '')) || seen.has(bare)) continue;
      seen.add(bare);
      // Codes keep their shape ("12V", "8.5"); ordinary words are title-cased.
      words.push(
        /\d/.test(word) ? word : word.replace(/[A-Za-z]+/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()),
      );
    }
  }
  if (sides) words.push(sides);

  return words.slice(0, 6).join(' ').replace(/[\s,.]+$/, '');
}

/** Builds the display title. Falls back to a legacy `name` only when nothing composes. */
export function trailerTitle(trailer: any): string {
  const t = trailer || {};
  const parts = [
    t.year,
    t.make,
    t.model,
    t.size,
    t.variant,
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
