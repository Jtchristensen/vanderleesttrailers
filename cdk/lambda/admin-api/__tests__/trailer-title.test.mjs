import { test, describe } from 'node:test';
import assert from 'node:assert';
import { composeTitle, categoryLabel, gvwrLabel, extractSize, extractVariant } from '../trailer-title.mjs';

/**
 * Shared case table.
 *
 * The frontend keeps a TypeScript twin of composeTitle at
 * frontend/src/app/pipes/trailer-title.pipe.ts, and its spec asserts this exact
 * table. When a case changes here it must change there too, or the heading a
 * customer sees will disagree with the slug and the chat assistant.
 */
export const TITLE_CASES = [
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

describe('composeTitle', () => {
  for (const { why, trailer, expected } of TITLE_CASES) {
    test(why, () => {
      assert.strictEqual(composeTitle(trailer), expected);
    });
  }

  test('tolerates null and undefined input', () => {
    assert.strictEqual(composeTitle(null), '');
    assert.strictEqual(composeTitle(undefined), '');
  });

  test('never emits double spaces when middle parts are missing', () => {
    const title = composeTitle({ year: 2025, size: '83x22' });
    assert.strictEqual(title, '2025 83x22');
    assert.ok(!/ {2}/.test(title));
  });
});

describe('categoryLabel', () => {
  test('singularizes and title-cases a slug', () => {
    assert.strictEqual(categoryLabel('aluminum-enclosed-trailers'), 'Aluminum Enclosed Trailer');
  });

  test('leaves short words ending in s alone', () => {
    // "gas" would become "ga" under a naive rule; the length guard prevents it.
    assert.strictEqual(categoryLabel('gas-trailers'), 'Gas Trailer');
  });

  test('returns empty for missing input', () => {
    assert.strictEqual(categoryLabel(''), '');
    assert.strictEqual(categoryLabel(undefined), '');
  });
});

describe('extractSize', () => {
  const cases = [
    // Plain width-by-length, in each separator the dealer types.
    ['MAXX-D 83x22 EHX Equipment Trailer 14K GVWR', '83x22'],
    ['Retco 7x16 Tandem Utility', '7x16'],
    ['Gatormade 8.5x24 Enclosed', '8.5x24'],
    ['Black Rhino 7 X 14 Utility', '7x14'],
    ['Rock Solid Cargo 6X12 Cargo', '6x12'],
    // Typographic inch and foot marks — the dominant form in live inventory.
    ['82″x22′ RETCO 7K GVWR CAR HAULER TRAILER', '82x22'],
    ['81”x14’ BLACK RHINO ALUMINUM LOW-PRO UTILITY TRAILER', '81x14'],
    ['MAXX-D 102″x32′ LDX Low Profile Gooseneck', '102x32'],
    // Feet-and-inches width collapses to plain inches: 6'10" is 82".
    ['6’10”x14 GATORMADE TANDEM AXLE 7K', '82x14'],
    ['6’4”x12′ GATORMADE SINGLE AXLE UTILITY', '76x12'],
    // Deck plus dovetail, and length on its own.
    ['20’ + 5’ Gatormade Elite Tandem 16K GVWR Gooseneck', '20+5'],
    ['MAXX-D DJX 16′ GOOSENECK DUMP TRAILER', '16ft'],
    ['MAXX-D DKX 14ft Dump Trailer | 14K', '14ft'],
    ['DURABULL 23′ INLINE ALUMINUM TRAILER', '23ft'],
  ];
  for (const [name, expected] of cases) {
    test(`${name} -> ${expected}`, () => {
      assert.strictEqual(extractSize(name), expected);
    });
  }

  test('does not read a dimension out of a model code', () => {
    // "G6X 83″X20′" must yield the deck, not the 6 buried in the model.
    assert.strictEqual(extractSize('MAXX-D G6X 83″X20′ EQUIPMENT GRAVITY TILT TRAILER'), '83x20');
  });

  test('returns empty rather than guessing when no size is present', () => {
    assert.strictEqual(extractSize('Gatormade Hydraulic Dovetail Deckover'), '');
    assert.strictEqual(extractSize(''), '');
    assert.strictEqual(extractSize(undefined), '');
  });
});

describe('extractVariant', () => {
  const cases = [
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
    // "Gooseneck" is the differentiator on a dump trailer, so it survives —
    // only the record's own category words are dropped.
    [
      'MAXX-D DJX 16′ GOOSENECK DUMP TRAILER | 15K | 83” I-BEAM DUMP / 2′ SIDES',
      { make: 'Maxx-D', model: 'DJX', category: 'dump-trailers' },
      'Gooseneck I-Beam 2ft Sides',
    ],
  ];
  for (const [name, trailer, expected] of cases) {
    test(`${name.slice(0, 44)}… -> ${expected}`, () => {
      assert.strictEqual(extractVariant(name, trailer), expected);
    });
  }

  test('yields empty when nothing distinguishing is left over', () => {
    assert.strictEqual(extractVariant('7×16 RETCO 7K TANDEM UTILITY TRAILER', { make: 'Retco', category: 'steel-utility-trailers' }), '');
    assert.strictEqual(extractVariant('', {}), '');
    assert.strictEqual(extractVariant(undefined, undefined), '');
  });
});

describe('gvwrLabel', () => {
  test('collapses round thousands', () => {
    assert.strictEqual(gvwrLabel(7000), '7K GVWR');
    assert.strictEqual(gvwrLabel('14000'), '14K GVWR');
  });

  test('uses one decimal for the round hundreds the dealer writes as K', () => {
    assert.strictEqual(gvwrLabel(17500), '17.5K GVWR');
    assert.strictEqual(gvwrLabel(24900), '24.9K GVWR');
    assert.strictEqual(gvwrLabel(10400), '10.4K GVWR');
  });

  test('keeps exact figures that are not round hundreds', () => {
    assert.strictEqual(gvwrLabel(2990), '2,990 lb GVWR');
    assert.strictEqual(gvwrLabel(25990), '25,990 lb GVWR');
  });

  test('drops unusable values', () => {
    for (const bad of ['', null, undefined, 0, 'n/a']) {
      assert.strictEqual(gvwrLabel(bad), '', `expected empty for ${JSON.stringify(bad)}`);
    }
  });
});
