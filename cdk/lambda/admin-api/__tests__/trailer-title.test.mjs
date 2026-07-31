import { test, describe } from 'node:test';
import assert from 'node:assert';
import { composeTitle, categoryLabel, gvwrLabel, extractSize } from '../trailer-title.mjs';

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
    ['MAXX-D 83x22 EHX Equipment Trailer 14K GVWR', '83x22'],
    ['Retco 7x16 Tandem Utility', '7x16'],
    ['Gatormade 8.5x24 Enclosed', '8.5x24'],
    ['Black Rhino 7 X 14 Utility', '7x14'],
    ['Rock Solid Cargo 6X12 Cargo', '6x12'],
  ];
  for (const [name, expected] of cases) {
    test(`${name} -> ${expected}`, () => {
      assert.strictEqual(extractSize(name), expected);
    });
  }

  test('returns empty rather than guessing when no size is present', () => {
    assert.strictEqual(extractSize('Gatormade Hydraulic Dovetail Deckover'), '');
    assert.strictEqual(extractSize(''), '');
    assert.strictEqual(extractSize(undefined), '');
  });
});

describe('gvwrLabel', () => {
  test('collapses round thousands', () => {
    assert.strictEqual(gvwrLabel(7000), '7K GVWR');
    assert.strictEqual(gvwrLabel('14000'), '14K GVWR');
  });

  test('keeps exact non-round figures', () => {
    assert.strictEqual(gvwrLabel(2990), '2,990 lb GVWR');
  });

  test('drops unusable values', () => {
    for (const bad of ['', null, undefined, 0, 'n/a']) {
      assert.strictEqual(gvwrLabel(bad), '', `expected empty for ${JSON.stringify(bad)}`);
    }
  });
});
