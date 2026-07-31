import { TrailerTitlePipe, trailerTitle, categoryLabel, gvwrLabel, extractSize, extractVariant } from './trailer-title.pipe';

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
    why: 'variant sits between the size and the category',
    trailer: { year: 2025, make: 'Maxx-D', model: 'DKX', size: '83x14', variant: 'Army Green', category: 'dump-trailers', gvwr: 14000 },
    expected: '2025 Maxx-D DKX 83x14 Army Green Dump Trailer 14K GVWR',
  },
  {
    why: 'variant is what separates two otherwise identical units',
    trailer: { make: 'Rock Solid Cargo', size: '8.5x24', variant: 'Charcoal Polycore Blackout Package', category: 'enclosed-trailers', gvwr: 10000 },
    expected: 'Rock Solid Cargo 8.5x24 Charcoal Polycore Blackout Package Enclosed Trailer 10K GVWR',
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
    why: 'a rating on a round hundred uses the dealer shorthand the old names did',
    trailer: { make: 'Maxx-D', model: 'DJX', size: '16ft', category: 'dump-trailers', gvwr: 17500 },
    expected: 'Maxx-D DJX 16ft Dump Trailer 17.5K GVWR',
  },
  {
    why: 'an odd GVWR keeps its exact figure rather than rounding a towing number',
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
    trailer: { year: ' 2025 ', make: ' Maxx-D ', model: '  ', size: '83x22', variant: '  ', category: '' },
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
    ['82″x22′ RETCO 7K GVWR CAR HAULER TRAILER', '82x22'],
    ['81”x14’ BLACK RHINO ALUMINUM LOW-PRO UTILITY TRAILER', '81x14'],
    ['MAXX-D 102″x32′ LDX Low Profile Gooseneck', '102x32'],
    ['6’10”x14 GATORMADE TANDEM AXLE 7K', '82x14'],
    ['6’4”x12′ GATORMADE SINGLE AXLE UTILITY', '76x12'],
    ['20’ + 5’ Gatormade Elite Tandem 16K GVWR Gooseneck', '20+5'],
    ['MAXX-D DJX 16′ GOOSENECK DUMP TRAILER', '16ft'],
    ['MAXX-D DKX 14ft Dump Trailer | 14K', '14ft'],
    ['DURABULL 23′ INLINE ALUMINUM TRAILER', '23ft'],
  ];
  for (const [name, expected] of cases) {
    it(`${name} -> ${expected}`, () => {
      expect(extractSize(name)).toBe(expected);
    });
  }

  it('does not read a dimension out of a model code', () => {
    expect(extractSize('MAXX-D G6X 83″X20′ EQUIPMENT GRAVITY TILT TRAILER')).toBe('83x20');
  });

  it('returns empty rather than guessing when no size is present', () => {
    expect(extractSize('Gatormade Hydraulic Dovetail Deckover')).toBe('');
    expect(extractSize('')).toBe('');
    expect(extractSize(undefined)).toBe('');
  });
});

describe('extractVariant', () => {
  const cases: [string, any, string][] = [
    [
      '8.5×24 Rock Solid Cargo Charcoal PolyCore Blackout Package 10K GVWR',
      { make: 'Rock Solid Cargo', category: 'enclosed-trailers' },
      'Charcoal Polycore Blackout Package',
    ],
    [
      '7×14 BLACK RHINO ALUMINUM LSS UTILITY TRAILER 5K AXLE -BIFOLD',
      { make: 'Black Rhino', model: 'LSS', category: 'aluminum-trailers' },
      'Bifold',
    ],
    [
      '7×12 BLACK RHINO ALUMINUM UTS UTILITY TRAILER W/BI-FOLD RAMP',
      { make: 'Black Rhino', model: 'UTS', category: 'aluminum-trailers' },
      'Bi-Fold Ramp',
    ],
    [
      'MAXX-D DKX 14ft Dump Trailer | 14K 83″ I-BEAM DUMP– ARMY GREEN',
      { make: 'Maxx-D', model: 'DKX', category: 'dump-trailers' },
      'I-Beam Army Green',
    ],
    [
      'MAXX-D DJX 16′ GOOSENECK DUMP TRAILER | 15K | 83” I-BEAM DUMP / 2′ SIDES',
      { make: 'Maxx-D', model: 'DJX', category: 'dump-trailers' },
      'Gooseneck I-Beam 2ft Sides',
    ],
  ];
  for (const [name, trailer, expected] of cases) {
    it(`${name.slice(0, 44)}… -> ${expected}`, () => {
      expect(extractVariant(name, trailer)).toBe(expected);
    });
  }

  it('yields empty when nothing distinguishing is left over', () => {
    expect(extractVariant('7×16 RETCO 7K TANDEM UTILITY TRAILER', { make: 'Retco', category: 'steel-utility-trailers' })).toBe('');
    expect(extractVariant('', {})).toBe('');
    expect(extractVariant(undefined, undefined)).toBe('');
  });
});

describe('gvwrLabel', () => {
  it('collapses round thousands', () => {
    expect(gvwrLabel(7000)).toBe('7K GVWR');
    expect(gvwrLabel('14000')).toBe('14K GVWR');
  });

  it('uses one decimal for the round hundreds the dealer writes as K', () => {
    expect(gvwrLabel(17500)).toBe('17.5K GVWR');
    expect(gvwrLabel(24900)).toBe('24.9K GVWR');
    expect(gvwrLabel(10400)).toBe('10.4K GVWR');
  });

  it('keeps exact figures that are not round hundreds', () => {
    expect(gvwrLabel(2990)).toBe('2,990 lb GVWR');
    expect(gvwrLabel(25990)).toBe('25,990 lb GVWR');
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
