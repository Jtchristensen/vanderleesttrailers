/**
 * Reads a model designation out of a free-text trailer name.
 *
 * Shared by the make/model migration and the WordPress inventory sync, which
 * both start from the dealer's hand-typed listing titles.
 *
 * Every rule is whitelist-based. A name that matches nothing yields an
 * empty model rather than a guess — a blank field an admin can fill is
 * strictly better than a wrong one shown to customers.
 */

/** Maxx-D uses a strict 3-character product code: DJX, H8X, GSX, LKX, ... */
const MAXXD_CODE = /\b([A-Z][0-9A-Z]X)\b/;

/** Black Rhino uses 2–3 letter deck codes. Whitelisted to avoid matching ALUMINUM/RHINO/etc. */
const BLACK_RHINO_CODES = ['EXS', 'EXT', 'LSS', 'LST', 'LPT', 'LPS', 'UTS', 'TS'];

/** Gatormade uses named product lines rather than codes. Longest match wins. */
const GATORMADE_LINES = [
  'Hydraulic Dovetail', 'Elite Tandem', 'Tilt Deck', 'Deckover',
  'Aardvark', 'Tri-Axle', 'GT-XT',
];

const DURABULL_LINES = ['Inline'];

export function extractModel(make, name) {
  if (!name) return '';
  const upper = name.toUpperCase();

  switch (make) {
    case 'Maxx-D': {
      const m = upper.match(MAXXD_CODE);
      return m ? m[1] : '';
    }
    case 'Black Rhino': {
      // Word-boundary match against the whitelist, longest code first so
      // "LST" is never shadowed by a shorter "TS".
      for (const code of [...BLACK_RHINO_CODES].sort((a, b) => b.length - a.length)) {
        if (new RegExp(`\\b${code}\\b`).test(upper)) return code;
      }
      return '';
    }
    case 'Gatormade': {
      for (const line of GATORMADE_LINES) {
        if (upper.includes(line.toUpperCase())) return line;
      }
      return '';
    }
    case 'DuraBull': {
      for (const line of DURABULL_LINES) {
        if (upper.includes(line.toUpperCase())) return line;
      }
      return '';
    }
    // Retco and Rock Solid Cargo differentiate by size/colour/package, not by
    // a model designation — nothing reliable to extract.
    default:
      return '';
  }
}
