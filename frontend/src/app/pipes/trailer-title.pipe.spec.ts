import { TrailerTitlePipe, trailerTitle, categoryLabel, gvwrLabel, extractSize } from './trailer-title.pipe';

/**
 * Mirror of the case table in cdk/lambda/admin-api/__tests__/trailer-title.test.mjs.
 *
 * The backend composes the same title to build slugs and to feed the chat
 * assistant. If these two tables ever disagree, a customer's heading disagrees
 * with the URL it lives at — so the tables are kept identical on purpose.
 */
const TITLE_CASES = [
  {
    why: 'every part present',
    trailer: { year: 2025, make: 'Maxx-D', model: 'EHX', size: '83x22', category: 'car-equipment-haulers', gvwr: 14000 },
    expected: '2025 Maxx-D EHX 83x22 Car Equipment Hauler 14K GVWR',
  },
  {
    why: 'no year yet — the dealer has not filled it in',
    trailer: { make: 'Maxx-D', model: 'EHX', size: '83x22', category: 'dump-trailers', gvwr: 14000 },
    expected: 'Maxx-D EHX 83x22 Dump Trailer 14K GVWR',
  },
  {
    why: 'make with no model (Retco differentiates by size, not model code)',
    trailer: { year: '2024', make: 'Retco', size: '7x16', category: 'steel-utility-trailers', gvwr: 7000 },
    expected: '2024 Retco 7x16 Steel Utility Trailer 7K GVWR',
  },
  {
    why: 'non-round GVWR keeps its exact figure rather than rounding a towing number',
    trailer: { year: 2025, make: 'Rock Solid Cargo', size: '6x12', category: 'enclosed-trailers', gvwr: 2990 },
    expected: '2025 Rock Solid Cargo 6x12 Enclosed Trailer 2,990 lb GVWR',
  },
  {
    why: 'GVWR written with a comma, as the admin form allows',
    trailer: { make: 'Gatormade', model: 'Elite Tandem', category: 'gooseneck-trailers', gvwr: '14,000' },
    expected: 'Gatormade Elite Tandem Gooseneck Trailer 14K GVWR',
  },
  {
    why: 'single-word category still singularizes',
    trailer: { year: 2026, make: 'Black Rhino', model: 'EXS', size: '82x18', category: 'aluminum-trailers' },
    expected: '2026 Black Rhino EXS 82x18 Aluminum Trailer',
  },
  {
    why: 'whitespace around admin-entered values is trimmed, not preserved',
    trailer: { year: ' 2025 ', make: ' Maxx-D ', model: '  ', size: '83x22', category: '' },
    expected: '2025 Maxx-D 83x22',
  },
  {
    why: 'a record with no structured fields falls back to its legacy name',
    trailer: { name: 'MAXX-D 83x22 EHX Equipment Trailer 14K GVWR' },
    expected: 'MAXX-D 83x22 EHX Equipment Trailer 14K GVWR',
  },
  {
    why: 'zero and empty GVWR are dropped rather than rendered as "0K GVWR"',
    trailer: { make: 'DuraBull', model: 'Inline', gvwr: 0 },
    expected: 'DuraBull Inline',
  },
  {
    why: 'nothing at all yields an empty string, never "undefined"',
    trailer: {},
    expected: '',
  },
];

describe('trailerTitle', () => {
  for (const { why, trailer, expected } of TITLE_CASES) {
    it(why, () => {
      expect(trailerTitle(trailer)).toBe(expected);
    });
  }

  it('tolerates null and undefined input', () => {
    expect(trailerTitle(null)).toBe('');
    expect(trailerTitle(undefined)).toBe('');
  });

  it('never emits double spaces when middle parts are missing', () => {
    const title = trailerTitle({ year: 2025, size: '83x22' });
    expect(title).toBe('2025 83x22');
    expect(/ {2}/.test(title)).toBe(false);
  });
});

describe('categoryLabel', () => {
  it('singularizes and title-cases a slug', () => {
    expect(categoryLabel('aluminum-enclosed-trailers')).toBe('Aluminum Enclosed Trailer');
  });

  it('leaves short words ending in s alone', () => {
    expect(categoryLabel('gas-trailers')).toBe('Gas Trailer');
  });

  it('returns empty for missing input', () => {
    expect(categoryLabel('')).toBe('');
    expect(categoryLabel(undefined)).toBe('');
  });
});

describe('extractSize', () => {
  const cases: [string, string][] = [
    ['MAXX-D 83x22 EHX Equipment Trailer 14K GVWR', '83x22'],
    ['Retco 7x16 Tandem Utility', '7x16'],
    ['Gatormade 8.5x24 Enclosed', '8.5x24'],
    ['Black Rhino 7 X 14 Utility', '7x14'],
    ['Rock Solid Cargo 6X12 Cargo', '6x12'],
  ];
  for (const [name, expected] of cases) {
    it(`${name} -> ${expected}`, () => {
      expect(extractSize(name)).toBe(expected);
    });
  }

  it('returns empty rather than guessing when no size is present', () => {
    expect(extractSize('Gatormade Hydraulic Dovetail Deckover')).toBe('');
    expect(extractSize('')).toBe('');
    expect(extractSize(undefined)).toBe('');
  });
});

describe('gvwrLabel', () => {
  it('collapses round thousands', () => {
    expect(gvwrLabel(7000)).toBe('7K GVWR');
    expect(gvwrLabel('14000')).toBe('14K GVWR');
  });

  it('keeps exact non-round figures', () => {
    expect(gvwrLabel(2990)).toBe('2,990 lb GVWR');
  });

  it('drops unusable values', () => {
    for (const bad of ['', null, undefined, 0, 'n/a']) {
      expect(gvwrLabel(bad)).toBe('');
    }
  });
});

describe('TrailerTitlePipe', () => {
  it('delegates to trailerTitle', () => {
    const pipe = new TrailerTitlePipe();
    expect(pipe.transform({ year: 2025, make: 'Maxx-D', model: 'EHX' })).toBe('2025 Maxx-D EHX');
  });
});
