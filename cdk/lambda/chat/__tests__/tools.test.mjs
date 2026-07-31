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
    { pk: 'TRAILER', sk: 'maxxd-d7x', data: { slug: 'maxxd-d7x', name: 'Maxx-D D7X 6x12 Dump', category: 'dump-trailers', make: 'Maxx-D', price: 8495, features: ['Heavy duty dump'] } },
    { pk: 'TRAILER', sk: 'retco-util', data: { slug: 'retco-util', name: 'Retco 7x14 Utility', category: 'utility-trailers', make: 'Retco', price: 3200, features: ['Lightweight utility'] } },
    { pk: 'TRAILER', sk: 'gator-gn', data: { slug: 'gator-gn', name: 'Gatormade 30ft Gooseneck', category: 'gooseneck', make: 'Gatormade', price: 22000, features: ['Heavy hauler'] } },
    { pk: 'TRAILER', sk: 'bullx-hauler', data: { slug: 'bullx-hauler', name: 'Black Rhino EXS Hauler', category: 'utility-trailers', make: 'Black Rhino', price: 4100, features: ['Aluminum utility for landscaping'] } },
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

  it('filters by make (case-insensitive)', async () => {
    const res = await runTool({ name: 'searchTrailers', toolUseId: 't3', input: { make: 'retco' } }, mockCtx());
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
      pk: 'TRAILER', sk: `t${i}`, data: { slug: `t${i}`, name: `Trailer ${i}`, category: 'utility-trailers', make: 'X', price: 1000 + i },
    }));
    const ctx = { contentTable: 'fake', ddb: { send: async () => ({ Items: many }) } };
    const res = await runTool({ name: 'searchTrailers', toolUseId: 't6', input: {} }, ctx);
    assert.equal(res.trailers.length, 10);
    assert.equal(res.count, 25);
  });

  it('strips heavy fields from returned trailers (keeps name, slug, category, make, model, price, gvwr, image)', async () => {
    const res = await runTool({ name: 'searchTrailers', toolUseId: 't7', input: { category: 'dump-trailers' } }, mockCtx());
    const t = res.trailers[0];
    assert.ok(t.slug && t.name && t.category && t.make);
    assert.ok(!('description' in t), 'description should be stripped');
  });
});

describe('getSiteContent', () => {
  function ctxWithItem(item) {
    return {
      contentTable: 'fake',
      ddb: {
        send: async () => ({ Item: item }),
      },
    };
  }

  it('returns the stored data for an allowed type', async () => {
    const ctx = ctxWithItem({ pk: 'SITE_INFO', sk: '_', data: { phone: '920-555-0100' } });
    const res = await runTool({ name: 'getSiteContent', toolUseId: 'g1', input: { type: 'SITE_INFO' } }, ctx);
    assert.deepEqual(res, { phone: '920-555-0100' });
  });

  it('rejects a type not on the whitelist', async () => {
    await assert.rejects(
      () => runTool({ name: 'getSiteContent', toolUseId: 'g2', input: { type: 'TRAILER' } }, ctxWithItem(null)),
      /not allowed/
    );
  });

  it('rejects a missing type', async () => {
    await assert.rejects(
      () => runTool({ name: 'getSiteContent', toolUseId: 'g3', input: {} }, ctxWithItem(null)),
      /type is required/
    );
  });

  it('returns empty object when item is absent in DynamoDB', async () => {
    const ctx = ctxWithItem(undefined);
    const res = await runTool({ name: 'getSiteContent', toolUseId: 'g4', input: { type: 'FAQ' } }, ctx);
    assert.deepEqual(res, {});
  });

  it('wraps array-shaped data (e.g. BRANDS) in { items: [...] } so Bedrock accepts it', async () => {
    const brands = [{ name: 'Black Rhino' }, { name: 'Maxx-D' }];
    const ctx = ctxWithItem({ pk: 'BRANDS', sk: '_', data: brands });
    const res = await runTool({ name: 'getSiteContent', toolUseId: 'g5', input: { type: 'BRANDS' } }, ctx);
    assert.deepEqual(res, { items: brands });
  });
});

describe('searchTrailers — input sanitization', () => {
  const sample = [
    { pk: 'TRAILER', sk: 'a', data: { slug: 'a', name: 'Maxx-D Dump', category: 'dump-trailers', make: 'Maxx-D', price: 8000, features: ['dump'] } },
    { pk: 'TRAILER', sk: 'b', data: { slug: 'b', name: 'Retco Utility', category: 'utility-trailers', make: 'Retco', price: 3000, features: ['utility'] } },
  ];
  function ctx() {
    return { contentTable: 'fake', ddb: { send: async () => ({ Items: sample }) } };
  }

  it('treats maxPrice <= 0 as "no filter"', async () => {
    const res = await runTool({ name: 'searchTrailers', toolUseId: 's1', input: { maxPrice: 0 } }, ctx());
    assert.equal(res.count, 2);
  });

  it('treats single-character category as "no filter"', async () => {
    const res = await runTool({ name: 'searchTrailers', toolUseId: 's2', input: { category: '.' } }, ctx());
    assert.equal(res.count, 2);
  });

  it('treats single-character make as "no filter"', async () => {
    const res = await runTool({ name: 'searchTrailers', toolUseId: 's3', input: { make: '.' } }, ctx());
    assert.equal(res.count, 2);
  });

  it('ignores all four placeholder-style fields together', async () => {
    const res = await runTool(
      { name: 'searchTrailers', toolUseId: 's4', input: { category: '.', make: '.', maxPrice: 0, query: '' } },
      ctx(),
    );
    assert.equal(res.count, 2);
  });
});

describe('submitLead', () => {
  function captureCtx() {
    const writes = [];
    return {
      writes,
      ctx: {
        leadsTable: 'VanderLeestLeads',
        sessionId: 'session-abc',
        ddb: {
          send: async (cmd) => {
            writes.push(cmd);
            return {};
          },
        },
      },
    };
  }

  it('rejects when name is missing', async () => {
    const { ctx } = captureCtx();
    await assert.rejects(
      () => runTool({ name: 'submitLead', toolUseId: 'l1', input: { phone: '555' } }, ctx),
      /name and phone are required/
    );
  });

  it('rejects when phone is missing', async () => {
    const { ctx } = captureCtx();
    await assert.rejects(
      () => runTool({ name: 'submitLead', toolUseId: 'l2', input: { name: 'John' } }, ctx),
      /name and phone are required/
    );
  });

  it('writes a lead record with required fields and returns ok + leadId', async () => {
    const { writes, ctx } = captureCtx();
    const res = await runTool(
      { name: 'submitLead', toolUseId: 'l3', input: { name: 'John Doe', phone: '920-555-0134' } },
      ctx,
    );
    assert.equal(res.ok, true);
    assert.ok(res.leadId);
    assert.equal(writes.length, 1);
    const item = writes[0].input.Item;
    assert.equal(item.pk, 'LEAD');
    // sk = <iso timestamp>#<sessionId>#<leadId> — the leadId suffix keeps it
    // unique when two submitLead calls land in the same turn/millisecond.
    assert.match(item.sk, /^\d{4}-\d{2}-\d{2}T.+#session-abc#.+$/);
    assert.ok(item.sk.endsWith(`#${res.leadId}`), `sk should end with leadId: ${item.sk}`);
    assert.equal(item.name, 'John Doe');
    assert.equal(item.phone, '920-555-0134');
    assert.equal(item.sessionId, 'session-abc');
  });

  it('includes optional email and message when provided', async () => {
    const { writes, ctx } = captureCtx();
    await runTool(
      { name: 'submitLead', toolUseId: 'l4', input: { name: 'A', phone: '1', email: 'a@b.co', message: 'hi' } },
      ctx,
    );
    const item = writes[0].input.Item;
    assert.equal(item.email, 'a@b.co');
    assert.equal(item.message, 'hi');
  });
});
