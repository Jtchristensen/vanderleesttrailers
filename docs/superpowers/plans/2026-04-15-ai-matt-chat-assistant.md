# AI Matt Chat Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public-site chat widget ("Talk to AI Matt") that answers visitor questions using Bedrock Nova Micro with tool use over live DynamoDB content and captures leads via a new `Leads` table.

**Architecture:** Single Node 20 Lambda behind API Gateway (`POST /api/chat`). Uses Bedrock **Converse API** tool-use loop with three tools: `searchTrailers`, `getSiteContent`, `submitLead`. Frontend is a single standalone Angular component mounted in `AppComponent`, with state persisted to `localStorage`. Conversation state lives client-side; Lambda is stateless. Pattern mirrors the existing `recommend` Lambda.

**Tech Stack:** Angular 21 (standalone components, RxJS), Jasmine + Karma, AWS Lambda (Node 20 ESM), DynamoDB, Amazon Bedrock (`amazon.nova-micro-v1:0`), AWS CDK v2 (TypeScript), Node's built-in test runner (`node --test`) for Lambda unit tests.

**Spec:** `docs/superpowers/specs/2026-04-15-ai-matt-chat-assistant-design.md`

---

## File Structure

### New files

- `cdk/lambda/chat/index.mjs` — Lambda handler, Bedrock Converse loop, request/response shaping.
- `cdk/lambda/chat/tools.mjs` — Tool spec definitions + `runTool(toolUse, ctx)` dispatcher with `searchTrailers`, `getSiteContent`, `submitLead`.
- `cdk/lambda/chat/system-prompt.mjs` — Exports `SYSTEM_PROMPT` string. Isolated so it's trivial to promote to a CMS field later.
- `cdk/lambda/chat/package.json` — Empty package with `"type": "module"` so Node treats `.mjs` imports correctly under `node --test`.
- `cdk/lambda/chat/__tests__/tools.test.mjs` — Unit tests for tool dispatch, search filters, lead validation.
- `cdk/lambda/chat/__tests__/handler.test.mjs` — Handler-level tests (request shape, history truncation, 400/500 paths) with a mocked Bedrock client.
- `frontend/src/app/services/chat.service.ts` — In-memory + localStorage state: `sessionId`, messages, open/closed, 20-turn trim helper.
- `frontend/src/app/services/chat.service.spec.ts`
- `frontend/src/app/services/chat-api.service.ts` — HTTP client: `sendMessage(sessionId, messages)`.
- `frontend/src/app/services/chat-api.service.spec.ts`
- `frontend/src/app/components/chat-widget/chat-widget.component.ts` — Standalone component, both closed and open states in one template.
- `frontend/src/app/components/chat-widget/chat-widget.component.scss`
- `frontend/src/app/components/chat-widget/chat-widget.component.spec.ts`
- `frontend/src/assets/matcartoon.png` — Cartoon Matt avatar. Copied from repo root.

### Modified files

- `cdk/lib/vanderleest-stack.ts` — Adds `leadsTable`, `chatLambda`, IAM permissions, `POST /api/chat` route with throttle override.
- `frontend/src/app/app.component.ts` — Imports and renders `<app-chat-widget />` at the end of the shell template.
- `.github/workflows/pr-check.yml` — Adds a step to run `node --test` against `cdk/lambda/chat/__tests__/*.test.mjs`.

### One-line rule per file

| File | Responsibility |
|---|---|
| `index.mjs` | Translates API Gateway events → Bedrock Converse loop → reply text. No tool logic inside. |
| `tools.mjs` | Owns `TOOL_SPECS` array and `runTool()`. No knowledge of Bedrock. Pure inputs → outputs + DDB side effects. |
| `system-prompt.mjs` | String constant only. |
| `chat.service.ts` | Source of truth for widget state. No HTTP. |
| `chat-api.service.ts` | Single `sendMessage()` method. No state. |
| `chat-widget.component.ts` | Render + events. Delegates to the two services. |

---

## Task 1: Add `VanderLeestLeads` DynamoDB table

**Files:**
- Modify: `cdk/lib/vanderleest-stack.ts` (add after the existing `contentTable` definition, ~line 55)

- [ ] **Step 1: Add the new table resource**

In `cdk/lib/vanderleest-stack.ts`, after the `contentTable` declaration (line ~55, before the `COGNITO` section comment block), insert:

```ts
    const leadsTable = new dynamodb.Table(this, "LeadsTable", {
      tableName: "VanderLeestLeads",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
```

- [ ] **Step 2: Verify CDK synth succeeds**

Run:
```bash
cd cdk && npx cdk synth --quiet
```
Expected: command exits 0. No new errors. Stack template now contains a `VanderLeestLeads` table.

- [ ] **Step 3: Confirm the table appears in the synth output**

Run:
```bash
cd cdk && npx cdk synth --quiet 2>/dev/null | grep -c "VanderLeestLeads"
```
Expected: output is `1` or higher.

- [ ] **Step 4: Commit**

```bash
git add cdk/lib/vanderleest-stack.ts
git commit -m "Add VanderLeestLeads DynamoDB table for chat-captured leads"
```

---

## Task 2: Create Lambda folder with system prompt

**Files:**
- Create: `cdk/lambda/chat/system-prompt.mjs`
- Create: `cdk/lambda/chat/package.json`

- [ ] **Step 1: Create the package.json**

Write `cdk/lambda/chat/package.json`:

```json
{
  "name": "chat-lambda",
  "version": "1.0.0",
  "type": "module",
  "private": true
}
```

- [ ] **Step 2: Create the system prompt module**

Write `cdk/lambda/chat/system-prompt.mjs`:

```js
export const SYSTEM_PROMPT = `You are AI Matt, a friendly assistant for VanderLeest Trailer Sales in Northeastern Wisconsin. You help visitors find trailers, understand services (welding, painting, custom work), and answer questions about financing, hours, and location. You are warm, plainspoken, and helpful — never pushy.

Rules:
- Only discuss VanderLeest, trailers, and adjacent topics (towing, hauling, financing). Politely redirect off-topic questions.
- Use searchTrailers before claiming anything about current stock or prices. Never invent inventory.
- Use getSiteContent for hours, address, phone, financing partners, services, and FAQs.
- When a visitor shows buying intent, offer to take their contact info and pass it to Matt. Call submitLead only after you have at minimum a name and phone number.
- You are an AI, not the real Matt. If asked directly, say so and offer to connect them with the real Matt.
- Never quote firm prices as final — say "listed at $X, final pricing subject to confirmation."`;
```

- [ ] **Step 3: Commit**

```bash
git add cdk/lambda/chat/package.json cdk/lambda/chat/system-prompt.mjs
git commit -m "Scaffold chat Lambda folder with system prompt"
```

---

## Task 3: Tool specs + empty dispatcher (TDD)

**Files:**
- Create: `cdk/lambda/chat/tools.mjs`
- Create: `cdk/lambda/chat/__tests__/tools.test.mjs`

- [ ] **Step 1: Write the failing test for tool dispatch**

Write `cdk/lambda/chat/__tests__/tools.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd cdk && node --test lambda/chat/__tests__/tools.test.mjs
```
Expected: FAIL — `Cannot find module '../tools.mjs'`.

- [ ] **Step 3: Create minimal `tools.mjs` to make the tests pass**

Write `cdk/lambda/chat/tools.mjs`:

```js
export const TOOL_SPECS = [
  {
    toolSpec: {
      name: 'searchTrailers',
      description: 'Search the VanderLeest live inventory. Filter by optional category slug, brand, maxPrice, or free-text query over name and description. Returns up to 10 matching trailers.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Category slug, e.g. "dump-trailers"' },
            brand:    { type: 'string', description: 'Brand name, e.g. "Maxx-D"' },
            maxPrice: { type: 'number', description: 'Max price in USD' },
            query:    { type: 'string', description: 'Free-text search over name and description' },
          },
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'getSiteContent',
      description: 'Fetch a section of static site content. Allowed types: SITE_INFO, SERVICES, FINANCING, CONTACT, FAQ, BRANDS, CATEGORIES.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Content type key' },
          },
          required: ['type'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'submitLead',
      description: 'Submit a lead for Matt to follow up. Requires at minimum a name and phone. Email and message are optional.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            name:    { type: 'string' },
            phone:   { type: 'string' },
            email:   { type: 'string' },
            message: { type: 'string' },
          },
          required: ['name', 'phone'],
        },
      },
    },
  },
];

export async function runTool(toolUse, ctx) {
  switch (toolUse.name) {
    default:
      throw new Error(`Unknown tool: ${toolUse.name}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd cdk && node --test lambda/chat/__tests__/tools.test.mjs
```
Expected: 3/3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add cdk/lambda/chat/tools.mjs cdk/lambda/chat/__tests__/tools.test.mjs
git commit -m "Add chat tool specs and dispatcher skeleton with tests"
```

---

## Task 4: Implement `searchTrailers` tool (TDD)

**Files:**
- Modify: `cdk/lambda/chat/tools.mjs`
- Modify: `cdk/lambda/chat/__tests__/tools.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `cdk/lambda/chat/__tests__/tools.test.mjs` (before the final line):

```js
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
          // Support QueryCommand for pk=TRAILER
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
    assert.equal(res.trailers.map(t => t.slug), ['retco-util']);
  });

  it('filters by maxPrice (inclusive)', async () => {
    const res = await runTool({ name: 'searchTrailers', toolUseId: 't4', input: { maxPrice: 5000 } }, mockCtx());
    const slugs = res.trailers.map(t => t.slug).sort();
    assert.deepEqual(slugs, ['bullx-hauler', 'retco-util']);
  });

  it('filters by query over name and description', async () => {
    const res = await runTool({ name: 'searchTrailers', toolUseId: 't5', input: { query: 'landscaping' } }, mockCtx());
    assert.equal(res.trailers.map(t => t.slug), ['bullx-hauler']);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd cdk && node --test lambda/chat/__tests__/tools.test.mjs
```
Expected: 7 new tests fail with "Unknown tool: searchTrailers".

- [ ] **Step 3: Implement `searchTrailers`**

Replace `cdk/lambda/chat/tools.mjs` entirely with:

```js
import { QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

export const TOOL_SPECS = [
  {
    toolSpec: {
      name: 'searchTrailers',
      description: 'Search the VanderLeest live inventory. Filter by optional category slug, brand, maxPrice, or free-text query over name and description. Returns up to 10 matching trailers.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Category slug, e.g. "dump-trailers"' },
            brand:    { type: 'string', description: 'Brand name, e.g. "Maxx-D"' },
            maxPrice: { type: 'number', description: 'Max price in USD' },
            query:    { type: 'string', description: 'Free-text search over name and description' },
          },
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'getSiteContent',
      description: 'Fetch a section of static site content. Allowed types: SITE_INFO, SERVICES, FINANCING, CONTACT, FAQ, BRANDS, CATEGORIES.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Content type key' },
          },
          required: ['type'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'submitLead',
      description: 'Submit a lead for Matt to follow up. Requires at minimum a name and phone. Email and message are optional.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            name:    { type: 'string' },
            phone:   { type: 'string' },
            email:   { type: 'string' },
            message: { type: 'string' },
          },
          required: ['name', 'phone'],
        },
      },
    },
  },
];

const MAX_SEARCH_RESULTS = 10;

function slim(trailer) {
  const d = trailer.data || trailer;
  return {
    slug:     d.slug,
    name:     d.name,
    category: d.category,
    brand:    d.brand,
    price:    d.price,
    gvwr:     d.gvwr,
    image:    d.images?.[0] || d.image || '',
  };
}

async function searchTrailers(input, ctx) {
  const { category, brand, maxPrice, query } = input || {};
  const result = await ctx.ddb.send(new QueryCommand({
    TableName: ctx.contentTable,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': 'TRAILER' },
  }));
  const all = (result.Items || []).map(i => i.data || i);

  const cat = category?.toLowerCase();
  const br  = brand?.toLowerCase();
  const q   = query?.toLowerCase();

  const filtered = all.filter(t => {
    if (cat && (t.category || '').toLowerCase() !== cat) return false;
    if (br  && (t.brand || '').toLowerCase() !== br) return false;
    if (typeof maxPrice === 'number' && Number(t.price) > maxPrice) return false;
    if (q) {
      const hay = `${t.name || ''} ${t.description || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return {
    count: filtered.length,
    trailers: filtered.slice(0, MAX_SEARCH_RESULTS).map(slim),
  };
}

export async function runTool(toolUse, ctx) {
  switch (toolUse.name) {
    case 'searchTrailers':
      return searchTrailers(toolUse.input, ctx);
    default:
      throw new Error(`Unknown tool: ${toolUse.name}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd cdk && node --test lambda/chat/__tests__/tools.test.mjs
```
Expected: all 10 tests pass. (If `@aws-sdk/lib-dynamodb` is unresolved in the test runner, the test mock doesn't actually need the real `QueryCommand` class — but the import must succeed. Proceed to Step 5.)

- [ ] **Step 5: Install AWS SDK dev deps at the CDK package level so the Lambda tests can resolve imports**

The Lambda is shipped with AWS SDK provided by the Node 20 runtime, but `node --test` needs the packages locally. Install them as CDK devDependencies:

```bash
cd cdk && npm install --save-dev @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-bedrock-runtime
```

- [ ] **Step 6: Re-run tests**

Run:
```bash
cd cdk && node --test lambda/chat/__tests__/tools.test.mjs
```
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add cdk/lambda/chat/tools.mjs cdk/lambda/chat/__tests__/tools.test.mjs cdk/package.json cdk/package-lock.json
git commit -m "Implement searchTrailers chat tool with filter and cap tests"
```

---

## Task 5: Implement `getSiteContent` tool (TDD)

**Files:**
- Modify: `cdk/lambda/chat/tools.mjs`
- Modify: `cdk/lambda/chat/__tests__/tools.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `cdk/lambda/chat/__tests__/tools.test.mjs`:

```js
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd cdk && node --test lambda/chat/__tests__/tools.test.mjs
```
Expected: 4 new tests fail.

- [ ] **Step 3: Add import and implementation**

At the top of `cdk/lambda/chat/tools.mjs`, update the import:

```js
import { QueryCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
```

Add below `searchTrailers`:

```js
const ALLOWED_CONTENT_TYPES = new Set([
  'SITE_INFO', 'SERVICES', 'FINANCING', 'CONTACT', 'FAQ', 'BRANDS', 'CATEGORIES',
]);

async function getSiteContent(input, ctx) {
  if (!input?.type) throw new Error('getSiteContent: type is required');
  if (!ALLOWED_CONTENT_TYPES.has(input.type)) {
    throw new Error(`getSiteContent: type "${input.type}" is not allowed`);
  }
  const res = await ctx.ddb.send(new GetCommand({
    TableName: ctx.contentTable,
    Key: { pk: input.type, sk: '_' },
  }));
  return res.Item?.data ?? {};
}
```

Update `runTool` switch to add the case:

```js
    case 'getSiteContent':
      return getSiteContent(toolUse.input, ctx);
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd cdk && node --test lambda/chat/__tests__/tools.test.mjs
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add cdk/lambda/chat/tools.mjs cdk/lambda/chat/__tests__/tools.test.mjs
git commit -m "Implement getSiteContent chat tool with whitelist"
```

---

## Task 6: Implement `submitLead` tool (TDD)

**Files:**
- Modify: `cdk/lambda/chat/tools.mjs`
- Modify: `cdk/lambda/chat/__tests__/tools.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `cdk/lambda/chat/__tests__/tools.test.mjs`:

```js
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
    assert.match(item.sk, /^\d{4}-\d{2}-\d{2}T.+#session-abc$/);
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd cdk && node --test lambda/chat/__tests__/tools.test.mjs
```
Expected: 4 new tests fail.

- [ ] **Step 3: Implement `submitLead`**

Add to `cdk/lambda/chat/tools.mjs` below `getSiteContent`:

```js
function randomId() {
  // Short enough for logs, random enough for uniqueness within a session.
  return Math.random().toString(36).slice(2, 10);
}

async function submitLead(input, ctx) {
  const { name, phone, email, message } = input || {};
  if (!name || !phone) {
    throw new Error('submitLead: name and phone are required');
  }
  const now = new Date().toISOString();
  const leadId = randomId();
  const item = {
    pk: 'LEAD',
    sk: `${now}#${ctx.sessionId}`,
    leadId,
    name,
    phone,
    sessionId: ctx.sessionId,
    createdAt: now,
  };
  if (email)   item.email = email;
  if (message) item.message = message;

  await ctx.ddb.send(new PutCommand({
    TableName: ctx.leadsTable,
    Item: item,
  }));
  return { ok: true, leadId };
}
```

Add the case to `runTool`:

```js
    case 'submitLead':
      return submitLead(toolUse.input, ctx);
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd cdk && node --test lambda/chat/__tests__/tools.test.mjs
```
Expected: all tests pass (16 total so far).

- [ ] **Step 5: Commit**

```bash
git add cdk/lambda/chat/tools.mjs cdk/lambda/chat/__tests__/tools.test.mjs
git commit -m "Implement submitLead chat tool with validation"
```

---

## Task 7: Handler — request parsing + history truncation (TDD)

**Files:**
- Create: `cdk/lambda/chat/index.mjs`
- Create: `cdk/lambda/chat/__tests__/handler.test.mjs`

- [ ] **Step 1: Write the failing tests**

Write `cdk/lambda/chat/__tests__/handler.test.mjs`:

```js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { handler, __setBedrockClient, __setDdbClient, truncateHistory } from '../index.mjs';

function apiEvent(body, method = 'POST') {
  return { httpMethod: method, body: JSON.stringify(body) };
}

describe('truncateHistory', () => {
  it('returns the array unchanged when <= 20 entries', () => {
    const arr = Array.from({ length: 5 }, (_, i) => ({ role: 'user', content: `${i}` }));
    assert.equal(truncateHistory(arr).length, 5);
  });

  it('keeps only the last 20 entries', () => {
    const arr = Array.from({ length: 30 }, (_, i) => ({ role: 'user', content: `${i}` }));
    const out = truncateHistory(arr);
    assert.equal(out.length, 20);
    assert.equal(out[0].content, '10');
    assert.equal(out[19].content, '29');
  });
});

describe('handler — request validation', () => {
  it('handles OPTIONS preflight with 200', async () => {
    const res = await handler(apiEvent({}, 'OPTIONS'));
    assert.equal(res.statusCode, 200);
  });

  it('returns 400 when body is missing', async () => {
    const res = await handler({ httpMethod: 'POST' });
    assert.equal(res.statusCode, 400);
  });

  it('returns 400 when messages array is missing or empty', async () => {
    const res = await handler(apiEvent({ sessionId: 'x', messages: [] }));
    assert.equal(res.statusCode, 400);
  });

  it('returns 400 when sessionId is missing', async () => {
    const res = await handler(apiEvent({ messages: [{ role: 'user', content: 'hi' }] }));
    assert.equal(res.statusCode, 400);
  });
});

describe('handler — happy path with mocked Bedrock', () => {
  beforeEach(() => {
    __setDdbClient({ send: async () => ({ Items: [] }) });
  });

  it('returns the model reply when Bedrock stops without tool use', async () => {
    __setBedrockClient({
      send: async () => ({
        stopReason: 'end_turn',
        output: { message: { role: 'assistant', content: [{ text: 'Hello there!' }] } },
      }),
    });
    const res = await handler(apiEvent({
      sessionId: 'abc',
      messages: [{ role: 'user', content: 'hi' }],
    }));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.reply, 'Hello there!');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd cdk && node --test lambda/chat/__tests__/handler.test.mjs
```
Expected: FAIL — `Cannot find module '../index.mjs'`.

- [ ] **Step 3: Write `index.mjs` with handler + truncation**

Write `cdk/lambda/chat/index.mjs`:

```js
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { SYSTEM_PROMPT } from './system-prompt.mjs';
import { TOOL_SPECS, runTool } from './tools.mjs';

const MODEL_ID     = process.env.MODEL_ID     || 'amazon.nova-micro-v1:0';
const CONTENT_TBL  = process.env.TABLE_NAME   || '';
const LEADS_TBL    = process.env.LEADS_TABLE  || '';
const MAX_TOKENS   = 500;
const MAX_HISTORY  = 20;
const MAX_TOOL_HOPS = 3;

let ddbClient   = DynamoDBDocumentClient.from(new DynamoDBClient({}));
let bedrock     = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

export function __setDdbClient(client)     { ddbClient = client; }
export function __setBedrockClient(client) { bedrock = client; }

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

export function truncateHistory(messages) {
  return messages.length <= MAX_HISTORY ? messages : messages.slice(-MAX_HISTORY);
}

function toBedrockMessages(messages) {
  return messages.map(m => ({
    role: m.role,
    content: Array.isArray(m.content) ? m.content : [{ text: String(m.content) }],
  }));
}

function extractText(res) {
  const parts = res.output?.message?.content || [];
  return parts.map(p => p.text).filter(Boolean).join('\n').trim();
}

function findToolUse(message) {
  return message?.content?.find(p => p.toolUse)?.toolUse;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid_json' }) };
  }

  const { sessionId, messages } = payload || {};
  if (!sessionId || !Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid_request' }) };
  }

  const ctx = {
    sessionId,
    contentTable: CONTENT_TBL,
    leadsTable:   LEADS_TBL,
    ddb: ddbClient,
  };

  let convo = toBedrockMessages(truncateHistory(messages));

  try {
    for (let hop = 0; hop <= MAX_TOOL_HOPS; hop++) {
      const res = await bedrock.send(new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: SYSTEM_PROMPT }],
        messages: convo,
        toolConfig: { tools: TOOL_SPECS },
        inferenceConfig: { maxTokens: MAX_TOKENS, temperature: 0.4 },
      }));

      if (res.stopReason !== 'tool_use') {
        const reply = extractText(res) || "Sorry — I didn't catch that. Could you try again?";
        return { statusCode: 200, headers, body: JSON.stringify({ reply }) };
      }

      if (hop === MAX_TOOL_HOPS) {
        // Ran out of tool hops — return whatever text the model has produced.
        const reply = extractText(res) || "I'm having trouble digging that up right now — give me another try?";
        return { statusCode: 200, headers, body: JSON.stringify({ reply }) };
      }

      const toolUse = findToolUse(res.output?.message);
      let toolResult;
      try {
        toolResult = await runTool(toolUse, ctx);
      } catch (err) {
        console.error(`[CHAT] Tool "${toolUse?.name}" failed:`, err.message);
        toolResult = { error: err.message };
      }

      convo = [
        ...convo,
        res.output.message,
        {
          role: 'user',
          content: [{
            toolResult: {
              toolUseId: toolUse.toolUseId,
              content: [{ json: toolResult }],
            },
          }],
        },
      ];
    }
  } catch (err) {
    console.error('[CHAT] Fatal error:', err.name, err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'internal' }),
    };
  }
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd cdk && node --test lambda/chat/__tests__/handler.test.mjs
```
Expected: all 7 handler tests pass.

- [ ] **Step 5: Commit**

```bash
git add cdk/lambda/chat/index.mjs cdk/lambda/chat/__tests__/handler.test.mjs
git commit -m "Add chat Lambda handler with Converse loop and history truncation"
```

---

## Task 8: Handler — tool-use loop integration test (TDD)

**Files:**
- Modify: `cdk/lambda/chat/__tests__/handler.test.mjs`

- [ ] **Step 1: Write the failing test**

Append to `cdk/lambda/chat/__tests__/handler.test.mjs`:

```js
describe('handler — tool-use loop', () => {
  it('invokes a tool, feeds the result back, and returns final text', async () => {
    // DDB stub returns an empty item list — good enough for searchTrailers to run.
    __setDdbClient({ send: async () => ({ Items: [] }) });

    const bedrockCalls = [];
    let call = 0;
    __setBedrockClient({
      send: async (cmd) => {
        bedrockCalls.push(cmd);
        call += 1;
        if (call === 1) {
          return {
            stopReason: 'tool_use',
            output: {
              message: {
                role: 'assistant',
                content: [{ toolUse: { toolUseId: 'u1', name: 'searchTrailers', input: {} } }],
              },
            },
          };
        }
        return {
          stopReason: 'end_turn',
          output: { message: { role: 'assistant', content: [{ text: 'Nothing in stock.' }] } },
        };
      },
    });

    const res = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({
        sessionId: 'abc',
        messages: [{ role: 'user', content: 'any dump trailers?' }],
      }),
    });

    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).reply, 'Nothing in stock.');
    assert.equal(bedrockCalls.length, 2);

    // Second call should include the toolResult message
    const secondMessages = bedrockCalls[1].input.messages;
    const lastMsg = secondMessages[secondMessages.length - 1];
    assert.equal(lastMsg.role, 'user');
    assert.ok(lastMsg.content[0].toolResult);
    assert.equal(lastMsg.content[0].toolResult.toolUseId, 'u1');
  });

  it('stops at MAX_TOOL_HOPS to bound cost', async () => {
    __setDdbClient({ send: async () => ({ Items: [] }) });
    let call = 0;
    __setBedrockClient({
      send: async () => {
        call += 1;
        return {
          stopReason: 'tool_use',
          output: {
            message: {
              role: 'assistant',
              content: [
                { text: `thinking ${call}` },
                { toolUse: { toolUseId: `u${call}`, name: 'searchTrailers', input: {} } },
              ],
            },
          },
        };
      },
    });

    const res = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({
        sessionId: 'abc',
        messages: [{ role: 'user', content: 'loop forever' }],
      }),
    });

    assert.equal(res.statusCode, 200);
    // Handler enters the loop with hop=0..3 inclusive: up to 4 calls total before bailing.
    assert.ok(call <= 4, `expected <=4 Bedrock calls, got ${call}`);
  });
});
```

- [ ] **Step 2: Run tests to verify the loop test passes**

```bash
cd cdk && node --test lambda/chat/__tests__/handler.test.mjs
```
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add cdk/lambda/chat/__tests__/handler.test.mjs
git commit -m "Test chat handler tool-use loop and hop cap"
```

---

## Task 9: Wire chat Lambda into CDK stack

**Files:**
- Modify: `cdk/lib/vanderleest-stack.ts`

- [ ] **Step 1: Add the chat Lambda definition**

In `cdk/lib/vanderleest-stack.ts`, after the `recommendLambda` block (ends ~line 155, after its `addToRolePolicy(...)` call), insert:

```ts
    // Chat Lambda (Bedrock + tool use)
    const chatLambda = new lambda.Function(this, "ChatApi", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../lambda/chat")
      ),
      environment: {
        TABLE_NAME:  contentTable.tableName,
        LEADS_TABLE: leadsTable.tableName,
        MODEL_ID:    "amazon.nova-micro-v1:0",
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });
    contentTable.grantReadData(chatLambda);
    leadsTable.grantWriteData(chatLambda);
    chatLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["arn:aws:bedrock:*::foundation-model/amazon.nova-micro-v1:0"],
      })
    );
```

- [ ] **Step 2: Add the throttle override for the new route**

In the same file, inside the existing `deployOptions.methodOptions` block (~line 180), add a second entry so it reads:

```ts
      deployOptions: {
        throttlingRateLimit: 50,
        throttlingBurstLimit: 100,
        methodOptions: {
          "/api/recommend/POST": {
            throttlingRateLimit: 5,
            throttlingBurstLimit: 10,
          },
          "/api/chat/POST": {
            throttlingRateLimit: 5,
            throttlingBurstLimit: 10,
          },
        },
      },
```

- [ ] **Step 3: Add the API Gateway route**

After the `recommendResource.addMethod("POST", recommendIntegration);` line (~line 219), insert:

```ts
    // Chat route (public)
    const chatIntegration = new apigateway.LambdaIntegration(chatLambda);
    const chatResource = apiResource.addResource("chat");
    chatResource.addMethod("POST", chatIntegration);
```

- [ ] **Step 4: Run CDK synth to verify**

```bash
cd cdk && npx cdk synth --quiet
```
Expected: exits 0.

- [ ] **Step 5: Confirm the chat resources are in the template**

```bash
cd cdk && npx cdk synth --quiet 2>/dev/null | grep -E "ChatApi|/api/chat" | head
```
Expected: at least one match per pattern.

- [ ] **Step 6: Commit**

```bash
git add cdk/lib/vanderleest-stack.ts
git commit -m "Wire chat Lambda into CDK stack with throttled /api/chat route"
```

---

## Task 10: Frontend `ChatService` — state + localStorage (TDD)

**Files:**
- Create: `frontend/src/app/services/chat.service.ts`
- Create: `frontend/src/app/services/chat.service.spec.ts`

- [ ] **Step 1: Write the failing test file**

Write `frontend/src/app/services/chat.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { ChatService, ChatMessage } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(() => {
    localStorage.removeItem('vl_chat_v1');
    TestBed.configureTestingModule({ providers: [ChatService] });
    service = TestBed.inject(ChatService);
  });

  afterEach(() => {
    localStorage.removeItem('vl_chat_v1');
  });

  it('generates a session id on first access', () => {
    const id = service.sessionId;
    expect(id).toMatch(/^[0-9a-f-]{8,}$/);
  });

  it('persists the same session id across instances', () => {
    const id1 = service.sessionId;
    const service2 = TestBed.inject(ChatService);
    expect(service2.sessionId).toBe(id1);
  });

  it('starts closed', () => {
    expect(service.isOpen()).toBeFalse();
  });

  it('toggles open/closed', () => {
    service.toggle();
    expect(service.isOpen()).toBeTrue();
    service.toggle();
    expect(service.isOpen()).toBeFalse();
  });

  it('appends messages and exposes them in order', () => {
    service.appendMessage({ role: 'user', content: 'hi' });
    service.appendMessage({ role: 'assistant', content: 'hello' });
    const msgs = service.messages();
    expect(msgs.length).toBe(2);
    expect(msgs[0].role).toBe('user');
    expect(msgs[1].role).toBe('assistant');
  });

  it('persists messages to localStorage', () => {
    service.appendMessage({ role: 'user', content: 'hi' });
    const raw = localStorage.getItem('vl_chat_v1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.messages.length).toBe(1);
    expect(parsed.sessionId).toBe(service.sessionId);
  });

  it('rehydrates messages on construction', () => {
    localStorage.setItem('vl_chat_v1', JSON.stringify({
      sessionId: 'rehydrated-session',
      messages: [{ role: 'user', content: 'earlier' }],
    }));
    // Re-create the service by resetting the TestBed module
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ChatService] });
    const s = TestBed.inject(ChatService);
    expect(s.sessionId).toBe('rehydrated-session');
    expect(s.messages()[0].content).toBe('earlier');
  });

  it('trims history to the last 20 turns when sending', () => {
    const many: ChatMessage[] = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 ? 'assistant' : 'user',
      content: String(i),
    }));
    many.forEach(m => service.appendMessage(m));
    const forSend = service.messagesForSend();
    expect(forSend.length).toBe(20);
    expect(forSend[0].content).toBe('5');
    expect(forSend[19].content).toBe('24');
  });

  it('resets state and clears localStorage', () => {
    service.appendMessage({ role: 'user', content: 'hi' });
    service.reset();
    expect(service.messages().length).toBe(0);
    expect(localStorage.getItem('vl_chat_v1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessCI --include='**/chat.service.spec.ts'
```
Expected: fails — `ChatService` not found.

- [ ] **Step 3: Implement the service**

Write `frontend/src/app/services/chat.service.ts`:

```ts
import { Injectable, signal } from '@angular/core';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Persisted {
  sessionId: string;
  messages: ChatMessage[];
}

const STORAGE_KEY = 'vl_chat_v1';
const MAX_SEND = 20;

function randomSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  readonly sessionId: string;
  private readonly _messages = signal<ChatMessage[]>([]);
  private readonly _open = signal(false);

  constructor() {
    const restored = this.loadFromStorage();
    this.sessionId = restored?.sessionId ?? randomSessionId();
    if (restored?.messages?.length) {
      this._messages.set(restored.messages);
    }
  }

  messages(): ChatMessage[]      { return this._messages(); }
  isOpen(): boolean              { return this._open(); }
  open()                          { this._open.set(true); }
  close()                         { this._open.set(false); }
  toggle()                        { this._open.update(v => !v); }

  appendMessage(msg: ChatMessage) {
    this._messages.update(list => [...list, msg]);
    this.persist();
  }

  messagesForSend(): ChatMessage[] {
    const all = this._messages();
    return all.length <= MAX_SEND ? all : all.slice(-MAX_SEND);
  }

  reset() {
    this._messages.set([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  private persist() {
    try {
      const payload: Persisted = { sessionId: this.sessionId, messages: this._messages() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage may be unavailable (private browsing). Acceptable to no-op.
    }
  }

  private loadFromStorage(): Persisted | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.sessionId || !Array.isArray(parsed.messages)) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessCI --include='**/chat.service.spec.ts'
```
Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/services/chat.service.ts frontend/src/app/services/chat.service.spec.ts
git commit -m "Add ChatService with localStorage persistence and send-history trim"
```

---

## Task 11: Frontend `ChatApiService` (TDD)

**Files:**
- Create: `frontend/src/app/services/chat-api.service.ts`
- Create: `frontend/src/app/services/chat-api.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Write `frontend/src/app/services/chat-api.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { ChatApiService } from './chat-api.service';
import type { ChatMessage } from './chat.service';

describe('ChatApiService', () => {
  let service: ChatApiService;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ChatApiService] });
    service = TestBed.inject(ChatApiService);
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('POSTs to /api/chat with sessionId and messages and returns the reply', async () => {
    const fetchSpy = jasmine.createSpy('fetch').and.resolveTo(
      new Response(JSON.stringify({ reply: 'hi there' }), { status: 200 }),
    );
    globalThis.fetch = fetchSpy;

    const msgs: ChatMessage[] = [{ role: 'user', content: 'hi' }];
    const result = await service.sendMessage('sess-1', msgs);

    expect(result).toBe('hi there');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.calls.mostRecent().args;
    expect(url).toContain('/chat');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.sessionId).toBe('sess-1');
    expect(body.messages).toEqual(msgs);
  });

  it('throws a "rate_limited" error on 429', async () => {
    globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo(
      new Response('', { status: 429 }),
    );
    await expectAsync(service.sendMessage('s', [])).toBeRejectedWithError(/rate_limited/);
  });

  it('throws a generic error on other non-OK responses', async () => {
    globalThis.fetch = jasmine.createSpy('fetch').and.resolveTo(
      new Response('boom', { status: 500 }),
    );
    await expectAsync(service.sendMessage('s', [])).toBeRejectedWithError(/chat_failed/);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessCI --include='**/chat-api.service.spec.ts'
```
Expected: module not found.

- [ ] **Step 3: Implement the service**

Write `frontend/src/app/services/chat-api.service.ts`:

```ts
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import type { ChatMessage } from './chat.service';

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private url = `${environment.apiUrl}/chat`;

  async sendMessage(sessionId: string, messages: ChatMessage[]): Promise<string> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, messages }),
    });
    if (res.status === 429) throw new Error('rate_limited');
    if (!res.ok)            throw new Error('chat_failed');
    const data = await res.json();
    return data.reply as string;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessCI --include='**/chat-api.service.spec.ts'
```
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/services/chat-api.service.ts frontend/src/app/services/chat-api.service.spec.ts
git commit -m "Add ChatApiService wrapping POST /api/chat"
```

---

## Task 12: Copy avatar asset

**Files:**
- Create: `frontend/src/assets/matcartoon.png`

- [ ] **Step 1: Copy the avatar into the Angular asset tree**

Run:
```bash
mkdir -p frontend/src/assets && cp matcartoon.png frontend/src/assets/matcartoon.png
```

- [ ] **Step 2: Verify Angular build includes the asset**

Open `frontend/angular.json` and confirm the `projects.frontend.architect.build.options.assets` array references `src/assets` (the default Angular config does this). If it does not, add `"src/assets"` to that array. (No edit needed in the default case — just verify.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/assets/matcartoon.png
git commit -m "Add AI Matt avatar to frontend assets"
```

---

## Task 13: `ChatWidgetComponent` — closed bubble (TDD)

**Files:**
- Create: `frontend/src/app/components/chat-widget/chat-widget.component.ts`
- Create: `frontend/src/app/components/chat-widget/chat-widget.component.scss`
- Create: `frontend/src/app/components/chat-widget/chat-widget.component.spec.ts`

- [ ] **Step 1: Write the failing test**

Write `frontend/src/app/components/chat-widget/chat-widget.component.spec.ts`:

```ts
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { ChatWidgetComponent } from './chat-widget.component';
import { ChatService } from '../../services/chat.service';
import { ChatApiService } from '../../services/chat-api.service';

@Component({ standalone: true, template: '' })
class DummyComponent {}

describe('ChatWidgetComponent — closed bubble', () => {
  let fixture: ComponentFixture<ChatWidgetComponent>;
  let chat: ChatService;

  beforeEach(async () => {
    localStorage.removeItem('vl_chat_v1');
    await TestBed.configureTestingModule({
      imports: [ChatWidgetComponent],
      providers: [
        provideRouter([
          { path: '', component: DummyComponent },
          { path: 'admin', component: DummyComponent },
        ]),
        ChatService,
        {
          provide: ChatApiService,
          useValue: { sendMessage: jasmine.createSpy('sendMessage').and.resolveTo('ok') },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ChatWidgetComponent);
    chat = TestBed.inject(ChatService);
  });

  afterEach(() => localStorage.removeItem('vl_chat_v1'));

  it('renders the closed bubble with label "Talk to AI Matt"', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const pill = el.querySelector('.bubble-pill');
    expect(pill?.textContent).toContain('Talk to AI Matt');
  });

  it('hides on /admin routes', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/admin');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.bubble-pill')).toBeNull();
    expect(el.querySelector('.panel')).toBeNull();
  });

  it('opens the panel when the bubble is clicked', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('.bubble-pill') as HTMLElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.panel')).not.toBeNull();
    expect(chat.isOpen()).toBeTrue();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessCI --include='**/chat-widget.component.spec.ts'
```
Expected: module not found.

- [ ] **Step 3: Write the component SCSS**

Write `frontend/src/app/components/chat-widget/chat-widget.component.scss`:

```scss
:host {
  --chat-accent: #0f8a3c;
  --chat-accent-dim: #2a8f4f;
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 9000;
  font-family: 'DM Sans', sans-serif;
}

.bubble-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bubble-pill {
  background: #1a2029;
  color: #eef0f2;
  border: 1px solid rgba(255,255,255,0.08);
  padding: 10px 14px;
  border-radius: 22px;
  font-family: 'Outfit', sans-serif;
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.5);
  white-space: nowrap;
  cursor: pointer;
}

.bubble-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--chat-accent) url('/assets/matcartoon.png') center top / cover;
  border: 2px solid var(--chat-accent-dim);
  box-shadow: 0 6px 20px rgba(15,138,60,0.35);
  cursor: pointer;
}

.panel {
  width: 380px;
  height: 560px;
  max-height: calc(100vh - 32px);
  background: #151a20;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0,0,0,0.6);
}

.p-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: #1a2029;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.p-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--chat-accent) url('/assets/matcartoon.png') center top / cover;
  border: 2px solid var(--chat-accent-dim);
}

.p-title { flex: 1; }
.p-name  { color: #eef0f2; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 14px; }
.p-status { color: #5e6878; font-size: 11px; }
.p-status::before { content: '●'; color: #2ecc71; margin-right: 4px; }

.p-close {
  color: #5e6878;
  font-size: 22px;
  cursor: pointer;
  padding: 0 6px;
  background: none;
  border: none;
}

.p-messages {
  flex: 1;
  padding: 14px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.msg {
  max-width: 80%;
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 13.5px;
  line-height: 1.45;
  white-space: pre-wrap;
}
.msg-bot  { background: #1a2029; color: #eef0f2; border-bottom-left-radius: 4px; align-self: flex-start; }
.msg-user { background: var(--chat-accent); color: #fff; border-bottom-right-radius: 4px; align-self: flex-end; }

.starters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  background: transparent;
  border: 1px solid rgba(47,143,79,0.4);
  color: #7bc893;
  padding: 6px 10px;
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
}

.p-input {
  display: flex;
  gap: 8px;
  padding: 10px;
  background: #1a2029;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.p-input input {
  flex: 1;
  background: #0c0f12;
  border: 1px solid rgba(255,255,255,0.08);
  color: #eef0f2;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  outline: none;
}
.p-input button {
  background: var(--chat-accent);
  color: #fff;
  border: none;
  padding: 0 16px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  font-family: 'Outfit', sans-serif;
}
.p-input button:disabled { opacity: 0.6; cursor: not-allowed; }

.disclaimer {
  text-align: center;
  font-size: 10px;
  color: #5e6878;
  padding: 6px 10px 10px;
  background: #1a2029;
}

@media (max-width: 640px) {
  :host { right: 8px; bottom: 8px; }
  .panel {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }
}
```

- [ ] **Step 4: Write the component**

Write `frontend/src/app/components/chat-widget/chat-widget.component.ts`:

```ts
import { Component, ElementRef, ViewChild, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { ChatApiService } from '../../services/chat-api.service';

const STARTERS = ['Browse inventory', 'Financing options', 'Hours & location'];

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-widget.component.html',
  styleUrls: ['./chat-widget.component.scss'],
})
export class ChatWidgetComponent {
  @ViewChild('messagesRef') messagesRef?: ElementRef<HTMLDivElement>;

  readonly starters = STARTERS;
  readonly visible = signal(true);
  readonly draft = signal('');
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);

  readonly messages = computed(() => this.chat.messages());
  readonly isOpen  = computed(() => this.chat.isOpen());

  constructor(
    public chat: ChatService,
    private api: ChatApiService,
    private router: Router,
  ) {
    this.visible.set(!router.url.startsWith('/admin'));
    router.events.subscribe(ev => {
      if (ev instanceof NavigationEnd) {
        this.visible.set(!ev.urlAfterRedirects.startsWith('/admin'));
      }
    });
  }

  openPanel() {
    this.chat.open();
    if (this.chat.messages().length === 0) {
      this.chat.appendMessage({
        role: 'assistant',
        content: "Hey there! I'm AI Matt. I can help you find a trailer, check what's in stock, or answer questions about financing. What can I help with?",
      });
    }
  }

  closePanel() { this.chat.close(); }

  useStarter(text: string) {
    this.draft.set(text);
    this.send();
  }

  async send() {
    const text = this.draft().trim();
    if (!text || this.sending()) return;
    this.draft.set('');
    this.error.set(null);
    this.chat.appendMessage({ role: 'user', content: text });
    this.sending.set(true);
    try {
      const reply = await this.api.sendMessage(this.chat.sessionId, this.chat.messagesForSend());
      this.chat.appendMessage({ role: 'assistant', content: reply });
    } catch (err: any) {
      const msg = err?.message === 'rate_limited'
        ? "You're sending messages very quickly — give it a minute."
        : "I'm having trouble right now. Please try again in a moment.";
      this.chat.appendMessage({ role: 'assistant', content: msg });
      this.error.set(err?.message ?? 'chat_failed');
    } finally {
      this.sending.set(false);
      queueMicrotask(() => this.scrollToBottom());
    }
  }

  private scrollToBottom() {
    const el = this.messagesRef?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
```

- [ ] **Step 5: Write the template**

Write `frontend/src/app/components/chat-widget/chat-widget.component.html`:

```html
@if (visible()) {
  @if (!isOpen()) {
    <div class="bubble-wrap">
      <div class="bubble-pill" (click)="openPanel()">Talk to AI Matt</div>
      <div class="bubble-avatar" (click)="openPanel()" aria-label="Open chat"></div>
    </div>
  } @else {
    <div class="panel">
      <div class="p-header">
        <div class="p-avatar"></div>
        <div class="p-title">
          <div class="p-name">AI Matt</div>
          <div class="p-status">Online · typically replies instantly</div>
        </div>
        <button class="p-close" (click)="closePanel()" aria-label="Close chat">&times;</button>
      </div>

      <div class="p-messages" #messagesRef>
        @for (m of messages(); track $index) {
          <div class="msg" [class.msg-bot]="m.role==='assistant'" [class.msg-user]="m.role==='user'">{{ m.content }}</div>
        }
        @if (messages().length === 1) {
          <div class="starters">
            @for (s of starters; track s) {
              <button class="chip" (click)="useStarter(s)">{{ s }}</button>
            }
          </div>
        }
      </div>

      <div class="p-input">
        <input
          [value]="draft()"
          (input)="draft.set($any($event.target).value)"
          (keydown.enter)="send()"
          placeholder="Type a message…"
          [disabled]="sending()"
        />
        <button (click)="send()" [disabled]="sending() || !draft().trim()">
          {{ sending() ? '…' : 'Send' }}
        </button>
      </div>
      <div class="disclaimer">AI responses may be inaccurate · not for final quotes</div>
    </div>
  }
}
```

- [ ] **Step 6: Update the component to reference the external template**

Already done in step 4 — the `templateUrl` points at `./chat-widget.component.html`. Confirm no adjustment needed.

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessCI --include='**/chat-widget.component.spec.ts'
```
Expected: 3 tests pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/components/chat-widget
git commit -m "Add ChatWidgetComponent with closed bubble and open panel"
```

---

## Task 14: Widget — message send integration test (TDD)

**Files:**
- Modify: `frontend/src/app/components/chat-widget/chat-widget.component.spec.ts`

- [ ] **Step 1: Append the test**

Append to `chat-widget.component.spec.ts`:

```ts
describe('ChatWidgetComponent — send flow', () => {
  let fixture: ComponentFixture<ChatWidgetComponent>;
  let apiSpy: jasmine.SpyObj<ChatApiService>;
  let chat: ChatService;

  beforeEach(async () => {
    localStorage.removeItem('vl_chat_v1');
    apiSpy = jasmine.createSpyObj<ChatApiService>('ChatApiService', ['sendMessage']);
    await TestBed.configureTestingModule({
      imports: [ChatWidgetComponent],
      providers: [
        provideRouter([{ path: '', component: DummyComponent }]),
        ChatService,
        { provide: ChatApiService, useValue: apiSpy },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ChatWidgetComponent);
    chat = TestBed.inject(ChatService);
  });

  afterEach(() => localStorage.removeItem('vl_chat_v1'));

  it('sends the user message, appends the assistant reply', async () => {
    apiSpy.sendMessage.and.resolveTo('Sure — what kind?');
    fixture.detectChanges();

    // Open panel (also triggers the greeting so messages().length === 1)
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('.bubble-pill') as HTMLElement).click();
    fixture.detectChanges();

    // Type and send
    fixture.componentInstance.draft.set('I need a dump trailer');
    await fixture.componentInstance.send();
    fixture.detectChanges();

    const msgs = chat.messages();
    expect(msgs.length).toBe(3); // greeting + user + assistant
    expect(msgs[1]).toEqual({ role: 'user', content: 'I need a dump trailer' });
    expect(msgs[2]).toEqual({ role: 'assistant', content: 'Sure — what kind?' });
    expect(apiSpy.sendMessage).toHaveBeenCalledWith(chat.sessionId, jasmine.any(Array));
  });

  it('renders an apology when the API throws', async () => {
    apiSpy.sendMessage.and.rejectWith(new Error('chat_failed'));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('.bubble-pill') as HTMLElement).click();
    fixture.detectChanges();

    fixture.componentInstance.draft.set('hi');
    await fixture.componentInstance.send();
    fixture.detectChanges();

    const msgs = chat.messages();
    expect(msgs[msgs.length - 1].content).toContain('trouble');
  });

  it('shows a rate-limit message on 429', async () => {
    apiSpy.sendMessage.and.rejectWith(new Error('rate_limited'));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('.bubble-pill') as HTMLElement).click();
    fixture.detectChanges();

    fixture.componentInstance.draft.set('spam');
    await fixture.componentInstance.send();
    fixture.detectChanges();

    const last = chat.messages().at(-1)!;
    expect(last.content).toContain('very quickly');
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessCI --include='**/chat-widget.component.spec.ts'
```
Expected: 6 tests pass (3 from Task 13 + 3 here).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/components/chat-widget/chat-widget.component.spec.ts
git commit -m "Test chat widget send flow, API errors, and rate limit handling"
```

---

## Task 15: Mount widget on `AppComponent`

**Files:**
- Modify: `frontend/src/app/app.component.ts`

- [ ] **Step 1: Update the shell to import and render the widget**

Replace `frontend/src/app/app.component.ts` with:

```ts
import { Component, OnInit } from '@angular/core';

import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { ChatWidgetComponent } from './components/chat-widget/chat-widget.component';
import { ContentService } from './services/content.service';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, HeaderComponent, FooterComponent, ChatWidgetComponent],
    template: `
    <app-header />
    <main>
      <router-outlet />
    </main>
    <app-footer />
    <app-chat-widget />
  `,
    styles: [`
    main {
      min-height: 100vh;
      padding-top: var(--header-height);
    }
  `]
})
export class AppComponent implements OnInit {
  constructor(private contentService: ContentService) {}

  ngOnInit() {
    // Preload all content into cache so page navigation is instant
    const types = [
      'SITE_INFO', 'PAGE_HOME', 'PAGE_ABOUT', 'SERVICES',
      'CUSTOM_TRAILERS', 'FINANCING', 'CONTACT', 'FAQ',
      'REVIEWS', 'BRANDS', 'CATEGORIES', 'IMAGES',
    ];
    types.forEach(type => this.contentService.getContent(type));
    this.contentService.getTrailers();
  }
}
```

- [ ] **Step 2: Build the frontend to confirm no compile errors**

```bash
cd frontend && npx ng build --configuration production
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/app.component.ts
git commit -m "Mount ChatWidgetComponent in AppComponent shell"
```

---

## Task 16: Wire Lambda tests into PR CI

**Files:**
- Modify: `.github/workflows/pr-check.yml`

- [ ] **Step 1: Add a Lambda test step**

In `.github/workflows/pr-check.yml`, after the existing "Run unit tests" step (the one ending with `run: npx ng test --watch=false --browsers=ChromeHeadlessCI`), add a new step:

```yaml
      - name: Install CDK dependencies for Lambda tests
        working-directory: cdk
        run: npm install

      - name: Run Lambda unit tests
        working-directory: cdk
        run: node --test lambda/chat/__tests__/*.test.mjs
```

Place both steps before the final blank line or any `build:` job boundary in the `test:` job. Sequence matters — frontend tests first, then CDK install + Lambda tests.

- [ ] **Step 2: Verify the YAML parses**

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/pr-check.yml')); print('ok')"
```
Expected: prints `ok`.

- [ ] **Step 3: Run the exact Lambda test command locally to confirm it works on a fresh npm install**

```bash
cd cdk && node --test lambda/chat/__tests__/*.test.mjs
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/pr-check.yml
git commit -m "Run chat Lambda unit tests in PR CI"
```

---

## Task 17: Final verification

**Files:** None (verification only).

- [ ] **Step 1: Full frontend test suite**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessCI
```
Expected: all tests pass, including all new chat tests.

- [ ] **Step 2: Full Lambda test suite**

```bash
cd cdk && node --test lambda/chat/__tests__/*.test.mjs
```
Expected: all tests pass.

- [ ] **Step 3: Frontend production build**

```bash
cd frontend && npx ng build --configuration production
```
Expected: build succeeds; `matcartoon.png` appears under `dist/frontend/browser/assets/`.

- [ ] **Step 4: CDK synth**

```bash
cd cdk && npx cdk synth --quiet
```
Expected: exits 0 with no new warnings about the chat Lambda or Leads table.

- [ ] **Step 5: Spot-check synth output for chat resources**

```bash
cd cdk && npx cdk synth --quiet 2>/dev/null | grep -c -E "ChatApi|VanderLeestLeads"
```
Expected: output is 2 or higher.

- [ ] **Step 6: Manual dev smoke (if local dev server is available)**

Run:
```bash
npm start
```
In the browser: load `http://localhost:4200/`, verify bubble appears bottom-right, click → panel opens → greeting renders → starter chips visible. (Actual AI replies require the deployed backend; expect a "trouble right now" message locally, which is the expected failure mode.)

Navigate to `http://localhost:4200/admin/login` — verify bubble does **not** render on admin routes.

- [ ] **Step 7: No extra commit needed**

Verification only. If a bug surfaces, fix in a focused commit.

---

## Self-Review

1. **Spec coverage**
   - Closed-state bubble + labeled "Talk to AI Matt" → Task 13 (bubble pill + avatar).
   - Open panel layout (header, messages, input, disclaimer, starter chips) → Tasks 13–14.
   - Desktop floating, mobile full-screen → SCSS breakpoint in Task 13.
   - Hidden on `/admin` → Task 13 test + component logic.
   - Persists via `localStorage` key `vl_chat_v1` with `sessionId` + `messages` → Task 10.
   - 20-turn send trim → Task 10 + Task 7 (Lambda safety net).
   - `chat` Lambda on Node 20, 512 MB, 30s, IAM-scoped to Nova Micro → Task 9.
   - Three tools: `searchTrailers`, `getSiteContent`, `submitLead` → Tasks 3–6.
   - Tool-use loop bounded to 3 hops → Task 8.
   - `VanderLeestLeads` table, `pk=LEAD`, `sk=<ISO>#<sessionId>`, pay-per-request → Tasks 1, 6.
   - API Gateway throttle 5 rps / 10 burst → Task 9.
   - CloudFront `/api/*` passthrough — unchanged, no task needed (spec called this out).
   - System prompt hardcoded in Lambda → Task 2.
   - Starter chips on first open → Task 13 template.
   - CI wires Lambda tests → Task 16.

2. **Placeholder scan**
   - No "TBD" / "TODO" / "implement later" markers. Every code block is complete.
   - Test bodies include actual assertions, not "write tests for the above".
   - Error paths have explicit behavior, not "add error handling".

3. **Type consistency**
   - `ChatMessage` shape `{role, content}` consistent across `chat.service.ts`, `chat-api.service.ts`, and the widget.
   - Lambda `ctx` shape `{sessionId, contentTable, leadsTable, ddb}` consistent between `index.mjs` and `tools.mjs`.
   - `runTool(toolUse, ctx)` signature identical in test mocks and real handler.
   - Tool names match in three places: `TOOL_SPECS`, `runTool` switch, and the system prompt's guidance.
   - localStorage key `vl_chat_v1` used identically in service and tests.

No issues found.
