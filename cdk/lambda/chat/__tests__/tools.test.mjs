import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_SPECS, runTool } from '../tools.mjs';

describe('TOOL_SPECS', () => {
  it('exposes exactly the three expected tools', () => {
    const names = TOOL_SPECS.map(t => t.toolSpec.name).sort();
    assert.deepEqual(names, ['getSiteContent', 'searchTrailers', 'submitLead']);
  });

  it('each tool has a description and JSON schema', () => {
    for (const t of TOOL_SPECS) {
      assert.ok(t.toolSpec.description, `${t.toolSpec.name} missing description`);
      assert.ok(t.toolSpec.inputSchema?.json, `${t.toolSpec.name} missing inputSchema.json`);
    }
  });
});

describe('runTool dispatch', () => {
  it('throws for an unknown tool name', async () => {
    await assert.rejects(
      () => runTool({ name: 'nope', toolUseId: 'x', input: {} }, {}),
      /Unknown tool/
    );
  });
});

describe('searchTrailers', () => {
  const sampleTrailers = [
    { pk: 'TRAILER', sk: 'maxxd-d7x', data: { slug: 'maxxd-d7x', name: 'Maxx-D D7X 6x12 Dump', category: 'dump-trailers', brand: 'Maxx-D', price: 8495, description: 'Heavy duty dump' } },
    { pk: 'TRAILER', sk: 'retco-util', data: { slug: 'retco-util', name: 'Retco 7x14 Utility', category: 'utility-trailers', brand: 'Retco', price: 3200, description: 'Lightweight utility' } },
    { pk: 'TRAILER', sk: 'gator-gn', data: { slug: 'gator-gn', name: 'Gatormade 30ft Gooseneck', category: 'gooseneck', brand: 'Gatormade', price: 22000, description: 'Heavy hauler' } },
    { pk: 'TRAILER', sk: 'bullx-hauler', data: { slug: 'bullx-hauler', name: 'Black Rhino EXS Hauler', category: 'utility-trailers', brand: 'Black Rhino', price: 4100, description: 'Aluminum utility for landscaping' } },
  ];

  function mockCtx() {
    return {
      contentTable: 'fake',
      ddb: {
        send: async (cmd) => {
          return { Items: sampleTrailers };
        },
      },
    };
  }

  it('returns all trailers (capped at 10) when no filters given', async () => {
    const res = await runTool({ name: 'searchTrailers', toolUseId: 't1', input: {} }, mockCtx());
    assert.equal(res.count, 4);
    assert.equal(res.trailers.length, 4);
  });

  it('filters by category (case-insensitive)', async () => {
    const res = await runTool({ name: 'searchTrailers', toolUseId: 't2', input: { category: 'DUMP-TRAILERS' } }, mockCtx());
    assert.equal(res.count, 1);
    assert.equal(res.trailers[0].slug, 'maxxd-d7x');
  });

  it('filters by brand (case-insensitive)', async () => {
    const res = await runTool({ name: 'searchTrailers', toolUseId: 't3', input: { brand: 'retco' } }, mockCtx());
    assert.deepEqual(res.trailers.map(t => t.slug), ['retco-util']);
  });

  it('filters by maxPrice (inclusive)', async () => {
    const res = await runTool({ name: 'searchTrailers', toolUseId: 't4', input: { maxPrice: 5000 } }, mockCtx());
    const slugs = res.trailers.map(t => t.slug).sort();
    assert.deepEqual(slugs, ['bullx-hauler', 'retco-util']);
  });

  it('filters by query over name and description', async () => {
    const res = await runTool({ name: 'searchTrailers', toolUseId: 't5', input: { query: 'landscaping' } }, mockCtx());
    assert.deepEqual(res.trailers.map(t => t.slug), ['bullx-hauler']);
  });

  it('caps results at 10 items', async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      pk: 'TRAILER', sk: `t${i}`, data: { slug: `t${i}`, name: `Trailer ${i}`, category: 'utility-trailers', brand: 'X', price: 1000 + i },
    }));
    const ctx = { contentTable: 'fake', ddb: { send: async () => ({ Items: many }) } };
    const res = await runTool({ name: 'searchTrailers', toolUseId: 't6', input: {} }, ctx);
    assert.equal(res.trailers.length, 10);
    assert.equal(res.count, 25);
  });

  it('strips heavy fields from returned trailers (keeps name, slug, category, brand, price, gvwr, image)', async () => {
    const res = await runTool({ name: 'searchTrailers', toolUseId: 't7', input: { category: 'dump-trailers' } }, mockCtx());
    const t = res.trailers[0];
    assert.ok(t.slug && t.name && t.category && t.brand);
    assert.ok(!('description' in t), 'description should be stripped');
  });
});
