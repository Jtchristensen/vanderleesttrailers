/** Price / MSRP display rules, shared by every view that renders a price.
 *
 * Trailer records carry `price` and the optional `msrp` as bare numeric strings
 * ('10311') on live data but as numbers (8495) in seed/test fixtures, so both
 * are parsed leniently here rather than at the edges. */

/** Dollar amount for a raw `price`/`msrp` field, or null when it's blank or
 * not a number. Tolerates the '$1,200' shape in case it's ever typed that way
 * into the admin form. */
export function dollars(value: any): number | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Dollars off list, or null when there's no discount to advertise — no selling
 * price, no MSRP, or an MSRP that isn't above the selling price. Callers use a
 * null to mean "render price exactly as it did before MSRP existed". */
export function savings(trailer: any): number | null {
  const price = dollars(trailer?.price);
  const msrp = dollars(trailer?.msrp);
  if (price === null || msrp === null || msrp <= price) return null;
  return msrp - price;
}

/** True when the struck-through MSRP and savings badge should render. */
export function hasSavings(trailer: any): boolean {
  return savings(trailer) !== null;
}
