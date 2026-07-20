# "We're Hiring" Application Popup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a site-wide "We're Hiring" popup that emails job applications to vanderleesttrailers@gmail.com via a new SES-backed Lambda, with CMS-editable copy and an on/off switch.

**Architecture:** A new public `POST /api/apply` Lambda validates the application, records it to the existing `leadsTable` (best-effort), and sends an email via SES. The frontend adds a global `HiringPopupComponent` (mounted beside the chat widget) that loads a new CMS-editable `CAREERS` content type and posts through a `CareersService`. The generic admin content editor gains boolean-checkbox support so the client can toggle the popup.

**Tech Stack:** Angular 17 (standalone components, `FormsModule`), AWS CDK (TypeScript), Node 24 Lambda (`.mjs`, AWS SDK v3), `node --test`, Karma/Jasmine.

## Global Constraints

- Lambda runtime: `lambda.Runtime.NODEJS_24_X`; Lambda code is ESM `.mjs`; import `@aws-sdk/*` (provided by the managed runtime — no bundled deps in the lambda dir).
- Authoritative send-to address lives in the Lambda env var `APPLY_TO_EMAIL` (default `vanderleesttrailers@gmail.com`), never trusted from client/CMS input.
- Lambda response CORS headers match existing Lambdas: `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: POST,OPTIONS`.
- Frontend network base URL is `environment.apiUrl` (value `/api`).
- All work must keep `ng test`, `ng build --configuration production`, `node --test lambda/*/__tests__/*.test.mjs` (from `cdk/`), and `npx cdk synth --quiet` green.
- Chat launcher owns bottom-right (z-index 9000); the hiring reopen button goes bottom-left.
- Preserve the existing dark aesthetic and VanderLeest green `#0f8a3c` accent; use existing CSS custom properties / `.btn` classes where present.

---

### Task 1: `apply` Lambda (validation, email, handler)

**Files:**
- Create: `cdk/lambda/apply/index.mjs`
- Create: `cdk/lambda/apply/__tests__/handler.test.mjs`
- Modify: `cdk/package.json` (add `@aws-sdk/client-ses` devDependency so tests resolve it)

**Interfaces:**
- Produces (all from `cdk/lambda/apply/index.mjs`):
  - `handler(event) -> Promise<{ statusCode, headers, body }>`
  - `validateApplication(body) -> { ok: boolean, errors: string[], data: { name, email, phone, position, message } }`
  - `isHoneypot(body) -> boolean`
  - `buildEmail(data, submittedAt) -> { subject: string, text: string, html: string }`
  - `__setSesClient(client)` / `__setDdbClient(client)` — test seams
- Consumes: nothing from other tasks.

- [ ] **Step 1: Add the SES SDK devDependency**

Edit `cdk/package.json` `devDependencies`, adding this line (alphabetical order, next to the other `@aws-sdk` entries):

```json
    "@aws-sdk/client-ses": "^3.1030.0",
```

Then install:

```bash
cd cdk && npm install
```

- [ ] **Step 2: Write the failing test**

Create `cdk/lambda/apply/__tests__/handler.test.mjs`:

```js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  handler,
  validateApplication,
  isHoneypot,
  buildEmail,
  __setSesClient,
  __setDdbClient,
} from '../index.mjs';

function apiEvent(body, method = 'POST') {
  return { httpMethod: method, body: body === undefined ? undefined : JSON.stringify(body) };
}

// Recording fakes
function makeFakes() {
  const calls = { ses: [], ddb: [] };
  __setSesClient({ send: async (cmd) => { calls.ses.push(cmd); return {}; } });
  __setDdbClient({ send: async (cmd) => { calls.ddb.push(cmd); return {}; } });
  return calls;
}

const VALID = { name: 'Jane Doe', email: 'jane@example.com', phone: '920-555-1234', message: 'Hi' };

describe('validateApplication', () => {
  it('accepts a complete application and defaults position', () => {
    const { ok, errors, data } = validateApplication(VALID);
    assert.equal(ok, true);
    assert.deepEqual(errors, []);
    assert.equal(data.position, 'General Application');
  });

  it('rejects missing required fields', () => {
    const { ok, errors } = validateApplication({ name: '', email: '', phone: '' });
    assert.equal(ok, false);
    assert.ok(errors.length >= 3);
  });

  it('rejects a malformed email', () => {
    const { ok, errors } = validateApplication({ ...VALID, email: 'not-an-email' });
    assert.equal(ok, false);
    assert.ok(errors.some((e) => e.includes('email')));
  });

  it('trims and length-caps fields', () => {
    const { data } = validateApplication({ ...VALID, name: '  ' + 'x'.repeat(500) + '  ' });
    assert.equal(data.name.length, 200);
  });
});

describe('isHoneypot', () => {
  it('is true when the company field is filled', () => {
    assert.equal(isHoneypot({ company: 'bot' }), true);
  });
  it('is false when the company field is empty/absent', () => {
    assert.equal(isHoneypot({ company: '' }), false);
    assert.equal(isHoneypot({}), false);
  });
});

describe('buildEmail', () => {
  it('includes the applicant name in the subject and escapes HTML', () => {
    const { subject, html, text } = buildEmail(
      { name: 'A<b>', email: 'a@b.com', phone: '1', position: 'General Application', message: 'x' },
      '2026-07-20T00:00:00.000Z',
    );
    assert.ok(subject.includes('A<b>'));
    assert.ok(html.includes('A&lt;b&gt;'));
    assert.ok(text.includes('a@b.com'));
  });
});

describe('handler', () => {
  beforeEach(() => { makeFakes(); });

  it('answers OPTIONS preflight with 200', async () => {
    const res = await handler(apiEvent(undefined, 'OPTIONS'));
    assert.equal(res.statusCode, 200);
  });

  it('returns 400 on malformed JSON', async () => {
    const res = await handler({ httpMethod: 'POST', body: '{not json' });
    assert.equal(res.statusCode, 400);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await handler(apiEvent({ name: '', email: '', phone: '' }));
    assert.equal(res.statusCode, 400);
  });

  it('honeypot returns 200 without sending email', async () => {
    const calls = makeFakes();
    const res = await handler(apiEvent({ ...VALID, company: 'bot' }));
    assert.equal(res.statusCode, 200);
    assert.equal(calls.ses.length, 0);
  });

  it('valid application sends via SES and returns 200', async () => {
    const calls = makeFakes();
    const res = await handler(apiEvent(VALID));
    assert.equal(res.statusCode, 200);
    assert.equal(calls.ses.length, 1);
    const input = calls.ses[0].input;
    assert.deepEqual(input.Destination.ToAddresses, ['vanderleesttrailers@gmail.com']);
    assert.deepEqual(input.ReplyToAddresses, ['jane@example.com']);
  });

  it('returns 502 when SES throws', async () => {
    __setSesClient({ send: async () => { throw new Error('SES down'); } });
    __setDdbClient({ send: async () => ({}) });
    const res = await handler(apiEvent(VALID));
    assert.equal(res.statusCode, 502);
  });

  it('still emails and returns 200 when the DynamoDB write throws', async () => {
    const sesCalls = [];
    __setSesClient({ send: async (cmd) => { sesCalls.push(cmd); return {}; } });
    __setDdbClient({ send: async () => { throw new Error('ddb down'); } });
    const res = await handler(apiEvent(VALID));
    assert.equal(res.statusCode, 200);
    assert.equal(sesCalls.length, 1);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd cdk && node --test lambda/apply/__tests__/handler.test.mjs`
Expected: FAIL — cannot resolve `../index.mjs` (module not found).

- [ ] **Step 4: Write the Lambda**

Create `cdk/lambda/apply/index.mjs`:

```js
// Job-application intake: validates a short application, records it to the
// leads table (best-effort), and emails it to the shop via SES. The send-to
// address is server-controlled (APPLY_TO_EMAIL) — never taken from the client.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const LEADS_TBL  = process.env.LEADS_TABLE     || '';
const TO_EMAIL   = process.env.APPLY_TO_EMAIL  || 'vanderleesttrailers@gmail.com';
const FROM_EMAIL = process.env.APPLY_FROM_EMAIL || 'vanderleesttrailers@gmail.com';

let ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
let sesClient = new SESClient({});

export function __setDdbClient(client) { ddbClient = client; }
export function __setSesClient(client) { sesClient = client; }

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIMITS = { name: 200, email: 200, phone: 200, position: 200, message: 2000 };

function clampStr(v, max) {
  return String(v ?? '').trim().slice(0, max);
}

export function isHoneypot(body) {
  return typeof body?.company === 'string' && body.company.trim().length > 0;
}

export function validateApplication(body) {
  const data = {
    name: clampStr(body?.name, LIMITS.name),
    email: clampStr(body?.email, LIMITS.email),
    phone: clampStr(body?.phone, LIMITS.phone),
    position: clampStr(body?.position, LIMITS.position) || 'General Application',
    message: clampStr(body?.message, LIMITS.message),
  };
  const errors = [];
  if (!data.name) errors.push('name is required');
  if (!data.email) errors.push('email is required');
  else if (!EMAIL_RE.test(data.email)) errors.push('email is invalid');
  if (!data.phone) errors.push('phone is required');
  return { ok: errors.length === 0, errors, data };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildEmail(data, submittedAt) {
  const subject = `New job application — ${data.name}`;
  const rows = [
    ['Name', data.name],
    ['Email', data.email],
    ['Phone', data.phone],
    ['Position', data.position],
    ['Message', data.message || '(none)'],
    ['Submitted', submittedAt],
  ];
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  const html =
    '<h2>New job application</h2>' +
    '<table cellpadding="6" style="border-collapse:collapse">' +
    rows
      .map(
        ([k, v]) =>
          `<tr><td style="vertical-align:top"><strong>${escapeHtml(k)}</strong></td>` +
          `<td>${escapeHtml(v)}</td></tr>`,
      )
      .join('') +
    '</table>';
  return { subject, text, html };
}

export const handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, errors: ['invalid JSON'] }) };
  }

  // Silent bot trap — pretend success, send nothing.
  if (isHoneypot(body)) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  const { ok, errors, data } = validateApplication(body);
  if (!ok) {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, errors }) };
  }

  const submittedAt = new Date().toISOString();

  // Durable backup — never blocks the email.
  if (LEADS_TBL) {
    try {
      await ddbClient.send(
        new PutCommand({
          TableName: LEADS_TBL,
          Item: {
            pk: 'APPLICATION',
            sk: `${submittedAt}#${Math.random().toString(36).slice(2, 10)}`,
            data,
            createdAt: submittedAt,
          },
        }),
      );
    } catch (err) {
      console.error('Failed to record application lead:', err);
    }
  }

  const { subject, text, html } = buildEmail(data, submittedAt);
  try {
    await sesClient.send(
      new SendEmailCommand({
        Source: FROM_EMAIL,
        Destination: { ToAddresses: [TO_EMAIL] },
        ReplyToAddresses: data.email ? [data.email] : [],
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: text, Charset: 'UTF-8' },
            Html: { Data: html, Charset: 'UTF-8' },
          },
        },
      }),
    );
  } catch (err) {
    console.error('SES send failed:', err);
    return { statusCode: 502, headers, body: JSON.stringify({ ok: false, errors: ['email delivery failed'] }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd cdk && node --test lambda/apply/__tests__/handler.test.mjs`
Expected: PASS (all tests green).

- [ ] **Step 6: Commit**

```bash
git add cdk/lambda/apply/index.mjs cdk/lambda/apply/__tests__/handler.test.mjs cdk/package.json cdk/package-lock.json
git commit -m "Feature: apply Lambda — validate + email job applications via SES"
```

---

### Task 2: Wire the `apply` Lambda into the CDK stack

**Files:**
- Modify: `cdk/lib/vanderleest-stack.ts`

**Interfaces:**
- Consumes: `cdk/lambda/apply` (Task 1).
- Produces: public route `POST /api/apply`.

- [ ] **Step 1: Add the throttle override for the apply route**

In `cdk/lib/vanderleest-stack.ts`, inside the `api = new apigateway.RestApi(...)` `deployOptions.methodOptions` object, add an entry beside the existing `/api/chat/POST` one:

```ts
          "/api/apply/POST": {
            throttlingRateLimit: 2,
            throttlingBurstLimit: 5,
          },
```

- [ ] **Step 2: Define the apply Lambda**

After the `chatLambda` block (and its IAM policy), add:

```ts
    // Apply Lambda — emails job applications to the shop via SES and records
    // them to the leads table as a durable backup.
    const applyLambda = new lambda.Function(this, "ApplyApi", {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/apply")),
      environment: {
        LEADS_TABLE: leadsTable.tableName,
        APPLY_TO_EMAIL: "vanderleesttrailers@gmail.com",
        APPLY_FROM_EMAIL: "vanderleesttrailers@gmail.com",
      },
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
    });
    leadsTable.grantWriteData(applyLambda);
    applyLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: [`arn:aws:ses:${this.region}:${this.account}:identity/*`],
      })
    );
```

- [ ] **Step 3: Add the public route**

After the reviews route block (`reviewsResource.addMethod("GET", ...)`), add:

```ts
    // Apply route (public) — job applications
    const applyIntegration = new apigateway.LambdaIntegration(applyLambda);
    const applyResource = apiResource.addResource("apply");
    applyResource.addMethod("POST", applyIntegration);
```

- [ ] **Step 4: Validate the stack synthesizes**

Run: `cd cdk && npx cdk synth --quiet`
Expected: PASS (no errors). The `/api/apply` POST is served by the existing `/api/*` CloudFront catch-all — no CloudFront change needed.

- [ ] **Step 5: Commit**

```bash
git add cdk/lib/vanderleest-stack.ts
git commit -m "Feature: wire apply Lambda + /api/apply route + SES IAM"
```

---

### Task 3: `CAREERS` content type (data, fallback, seed, admin registration)

**Files:**
- Modify: `frontend/src/app/data/site-content.ts`
- Modify: `frontend/src/app/services/content.service.ts`
- Modify: `frontend/src/app/app.component.ts`
- Modify: `cdk/lambda/seed/index.mjs`
- Modify: `frontend/src/app/admin/dashboard/dashboard.component.ts`
- Modify: `frontend/src/app/admin/content-editor/content-editor.component.ts`

**Interfaces:**
- Produces: content type key `CAREERS` resolvable via `ContentService.getContent('CAREERS')` and `ContentService.getContentSync('CAREERS')`, shape `{ enabled, headline, subheadline, body, position, ctaLabel, email }`.

- [ ] **Step 1: Add the static content**

At the end of `frontend/src/app/data/site-content.ts`, add:

```ts
export const CAREERS_CONTENT = {
  enabled: true,
  headline: "We're Hiring!",
  subheadline: 'Join the VanderLeest Trailer Sales team',
  body: "We're looking for hard-working people who care about doing right by our customers. Tell us a little about yourself and we'll be in touch.",
  position: 'General Application',
  ctaLabel: 'Apply Now',
  email: 'vanderleesttrailers@gmail.com',
};
```

- [ ] **Step 2: Register it in the ContentService fallback map**

In `frontend/src/app/services/content.service.ts`, add to the `fallbackMap` object (after `IMAGES`):

```ts
    CAREERS: staticContent.CAREERS_CONTENT,
```

- [ ] **Step 3: Preload it on app start**

In `frontend/src/app/app.component.ts`, add `'CAREERS'` to the `types` array in `ngOnInit` (append to the last line):

```ts
      'REVIEWS', 'BRANDS', 'CATEGORIES', 'IMAGES', 'CAREERS',
```

- [ ] **Step 4: Seed it into DynamoDB**

In `cdk/lambda/seed/index.mjs`, add a new object to the `seedItems` array (place it after the `CONTACT` item; keep valid JS syntax):

```js
      {
        pk: 'CAREERS', sk: '_',
        data: {
          enabled: true,
          headline: "We're Hiring!",
          subheadline: 'Join the VanderLeest Trailer Sales team',
          body: "We're looking for hard-working people who care about doing right by our customers. Tell us a little about yourself and we'll be in touch.",
          position: 'General Application',
          ctaLabel: 'Apply Now',
          email: 'vanderleesttrailers@gmail.com',
        },
      },
```

- [ ] **Step 5: Add the admin dashboard section**

In `frontend/src/app/admin/dashboard/dashboard.component.ts`, add to the `sections` array (after `Categories`):

```ts
    { label: 'Careers / Hiring', description: 'Hiring popup: headline, text, on/off switch', route: '/admin/edit/CAREERS', icon: '&#128188;' },
```

- [ ] **Step 6: Add the editor label**

In `frontend/src/app/admin/content-editor/content-editor.component.ts`, add to the `labelMap` object (after `IMAGES`):

```ts
    CAREERS: 'Careers / Hiring',
```

- [ ] **Step 7: Verify the build**

Run:
```bash
cd frontend && mkdir -p src/environments && cat > src/environments/environment.ts <<'EOF'
export const environment = { apiUrl: '/api', userPoolId: 'stub', userPoolClientId: 'stub', region: 'us-east-1' };
EOF
npx ng build --configuration production
```
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/data/site-content.ts frontend/src/app/services/content.service.ts frontend/src/app/app.component.ts cdk/lambda/seed/index.mjs frontend/src/app/admin/dashboard/dashboard.component.ts frontend/src/app/admin/content-editor/content-editor.component.ts
git commit -m "Feature: CAREERS content type (data, fallback, seed, admin registration)"
```

---

### Task 4: Boolean-checkbox support in the generic content editor

**Files:**
- Modify: `frontend/src/app/admin/content-editor/content-editor.component.ts`
- Modify: `frontend/src/app/admin/content-editor/content-editor.component.html`

**Interfaces:**
- Consumes/extends: `getFields()` in the content editor (Task 3 touched this file's `labelMap` only).
- Produces: boolean leaves render as a checkbox in the simple editor.

- [ ] **Step 1: Emit boolean fields from `getFields`**

In `frontend/src/app/admin/content-editor/content-editor.component.ts`, inside `getFields`, extend the leaf loop so booleans are surfaced. Replace the existing `for (const [key, val] of Object.entries(obj))` body's `if` with:

```ts
      if (typeof val === 'string' || typeof val === 'number') {
        fields.push({
          path,
          label: path,
          value: val,
          type: typeof val === 'number' ? 'number' : (val as string).length > 100 ? 'textarea' : 'text',
        });
      } else if (typeof val === 'boolean') {
        fields.push({ path, label: path, value: val, type: 'boolean' });
      }
```

- [ ] **Step 2: Render the checkbox in the top-level and nested field loops**

In `frontend/src/app/admin/content-editor/content-editor.component.html`, in **both** the top-level fields loop and the nested-section fields loop, add a `boolean` branch. For the top-level loop, change the field-input block to:

```html
              @if (field.type === 'textarea') {
                <textarea [ngModel]="field.value" (ngModelChange)="updateField(field.path, $event)" rows="3"></textarea>
              } @else if (field.type === 'number') {
                <input type="number" [ngModel]="field.value" (ngModelChange)="updateField(field.path, +$event)" />
              } @else if (field.type === 'boolean') {
                <label class="admin-checkbox">
                  <input type="checkbox" [ngModel]="field.value" (ngModelChange)="updateField(field.path, $event)" />
                  <span>{{ field.value ? 'On' : 'Off' }}</span>
                </label>
              } @else {
                <input type="text" [ngModel]="field.value" (ngModelChange)="updateField(field.path, $event)" />
              }
```

For the nested-section loop, change its input block to:

```html
                @if (field.type === 'textarea') {
                  <textarea [ngModel]="field.value" (ngModelChange)="updateField(field.path, $event)" rows="3"></textarea>
                } @else if (field.type === 'boolean') {
                  <label class="admin-checkbox">
                    <input type="checkbox" [ngModel]="field.value" (ngModelChange)="updateField(field.path, $event)" />
                    <span>{{ field.value ? 'On' : 'Off' }}</span>
                  </label>
                } @else {
                  <input type="text" [ngModel]="field.value" (ngModelChange)="updateField(field.path, $event)" />
                }
```

- [ ] **Step 3: Verify the build**

Run: `cd frontend && npx ng build --configuration production`
Expected: build succeeds. (Manual check available after deploy: Admin → Careers / Hiring shows an On/Off checkbox for `enabled`.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/content-editor/content-editor.component.ts frontend/src/app/admin/content-editor/content-editor.component.html
git commit -m "Feature: boolean checkbox support in the generic content editor"
```

---

### Task 5: `CareersService`

**Files:**
- Create: `frontend/src/app/services/careers.service.ts`
- Create: `frontend/src/app/services/careers.service.spec.ts`

**Interfaces:**
- Produces:
  - `interface ApplicationPayload { name: string; email: string; phone: string; message?: string; position?: string; company?: string; }`
  - `CareersService.apply(data: ApplicationPayload): Promise<void>` — POSTs to `${environment.apiUrl}/apply`; throws on non-OK.

- [ ] **Step 1: Write the failing spec**

Create `frontend/src/app/services/careers.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { CareersService } from './careers.service';

describe('CareersService', () => {
  let service: CareersService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CareersService);
  });

  it('POSTs the application to /api/apply', async () => {
    const fetchSpy = spyOn(window, 'fetch').and.resolveTo(
      new Response('{"ok":true}', { status: 200 }),
    );
    await service.apply({ name: 'A', email: 'a@b.com', phone: '1' });
    expect(fetchSpy).toHaveBeenCalled();
    const [url, opts] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    expect(url).toContain('/apply');
    expect(opts.method).toBe('POST');
  });

  it('throws when the response is not OK', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response('', { status: 502 }));
    await expectAsync(
      service.apply({ name: 'A', email: 'a@b.com', phone: '1' }),
    ).toBeRejected();
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessCI --include='**/careers.service.spec.ts'`
Expected: FAIL — `careers.service` module not found.

- [ ] **Step 3: Write the service**

Create `frontend/src/app/services/careers.service.ts`:

```ts
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface ApplicationPayload {
  name: string;
  email: string;
  phone: string;
  message?: string;
  position?: string;
  company?: string; // honeypot — always empty for real users
}

@Injectable({ providedIn: 'root' })
export class CareersService {
  private apiUrl = environment.apiUrl;

  async apply(data: ApplicationPayload): Promise<void> {
    const res = await fetch(`${this.apiUrl}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessCI --include='**/careers.service.spec.ts'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/services/careers.service.ts frontend/src/app/services/careers.service.spec.ts
git commit -m "Feature: CareersService — posts applications to /api/apply"
```

---

### Task 6: `HiringPopupComponent` + mount in app root

**Files:**
- Create: `frontend/src/app/components/hiring-popup/hiring-popup.component.ts`
- Create: `frontend/src/app/components/hiring-popup/hiring-popup.component.html`
- Create: `frontend/src/app/components/hiring-popup/hiring-popup.component.scss`
- Create: `frontend/src/app/components/hiring-popup/hiring-popup.component.spec.ts`
- Modify: `frontend/src/app/app.component.ts`

**Interfaces:**
- Consumes: `ContentService` (`CAREERS` content), `CareersService.apply()` (Task 5).
- Produces: `<app-hiring-popup />` global widget.

- [ ] **Step 1: Write the failing spec**

Create `frontend/src/app/components/hiring-popup/hiring-popup.component.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HiringPopupComponent } from './hiring-popup.component';
import { ContentService } from '../../services/content.service';
import { CareersService } from '../../services/careers.service';

class FakeContent {
  value: any = { enabled: true, headline: 'We\'re Hiring!', ctaLabel: 'Apply Now', position: 'General Application', email: 'vanderleesttrailers@gmail.com' };
  async getContent() { return this.value; }
}
class FakeCareers {
  apply = jasmine.createSpy('apply').and.resolveTo(undefined);
}

function setup(content: any) {
  const fakeContent = new FakeContent();
  fakeContent.value = content;
  const fakeCareers = new FakeCareers();
  TestBed.configureTestingModule({
    imports: [HiringPopupComponent],
    providers: [
      { provide: ContentService, useValue: fakeContent },
      { provide: CareersService, useValue: fakeCareers },
    ],
  });
  const fixture = TestBed.createComponent(HiringPopupComponent);
  return { fixture, fakeCareers };
}

// ngOnInit runs on the first detectChanges and loads content asynchronously —
// so render, wait for the promise to settle, then render again.
async function ready(fixture: ComponentFixture<HiringPopupComponent>) {
  fixture.detectChanges();      // triggers ngOnInit (async content load)
  await fixture.whenStable();   // wait for getContent() to resolve
  fixture.detectChanges();      // re-render with the resolved content
}

describe('HiringPopupComponent', () => {
  beforeEach(() => localStorage.clear());

  it('renders the reopen button when enabled', async () => {
    const { fixture } = setup({ enabled: true, headline: 'Hi', ctaLabel: 'Apply' });
    await ready(fixture);
    expect(fixture.nativeElement.querySelector('.hiring-fab')).toBeTruthy();
  });

  it('renders nothing when disabled', async () => {
    const { fixture } = setup({ enabled: false });
    await ready(fixture);
    expect(fixture.nativeElement.querySelector('.hiring-fab')).toBeNull();
    expect(fixture.nativeElement.querySelector('.hiring-overlay')).toBeNull();
  });

  it('opens the modal on button click', async () => {
    const { fixture } = setup({ enabled: true, headline: 'Hi', ctaLabel: 'Apply' });
    await ready(fixture);
    fixture.nativeElement.querySelector('.hiring-fab').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.open).toBeTrue();
    expect(fixture.nativeElement.querySelector('.hiring-overlay')).toBeTruthy();
  });

  it('submits via CareersService and shows success', async () => {
    const { fixture, fakeCareers } = setup({ enabled: true, headline: 'Hi', ctaLabel: 'Apply', position: 'General Application' });
    await ready(fixture);
    const c = fixture.componentInstance;
    c.openModal();
    c.form = { name: 'Jane', email: 'j@e.com', phone: '1', message: '', company: '' };
    await c.submit();
    expect(fakeCareers.apply).toHaveBeenCalled();
    expect(c.submitted).toBeTrue();
    expect(localStorage.getItem('vlt-hiring-applied')).toBe('1');
  });

  it('shows the error state when the submit fails', async () => {
    const { fixture, fakeCareers } = setup({ enabled: true, headline: 'Hi', ctaLabel: 'Apply' });
    fakeCareers.apply.and.rejectWith(new Error('boom'));
    await ready(fixture);
    const c = fixture.componentInstance;
    c.openModal();
    c.form = { name: 'Jane', email: 'j@e.com', phone: '1', message: '', company: '' };
    await c.submit();
    expect(c.error).toBeTrue();
    expect(c.submitted).toBeFalse();
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessCI --include='**/hiring-popup.component.spec.ts'`
Expected: FAIL — component module not found.

- [ ] **Step 3: Write the component class**

Create `frontend/src/app/components/hiring-popup/hiring-popup.component.ts`:

```ts
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ContentService } from '../../services/content.service';
import { CareersService } from '../../services/careers.service';

@Component({
  selector: 'app-hiring-popup',
  imports: [FormsModule],
  templateUrl: './hiring-popup.component.html',
  styleUrls: ['./hiring-popup.component.scss'],
})
export class HiringPopupComponent implements OnInit, OnDestroy {
  content: any = ContentService.getContentSync('CAREERS');
  open = false;
  submitting = false;
  submitted = false;
  error = false;

  form = { name: '', email: '', phone: '', message: '', company: '' };

  private static readonly DISMISS_KEY = 'vlt-hiring-dismissed';
  private static readonly APPLIED_KEY = 'vlt-hiring-applied';
  private static readonly AUTO_DELAY_MS = 6000;
  private autoTimer: any = null;

  constructor(private contentService: ContentService, private careers: CareersService) {}

  get enabled(): boolean {
    return !!this.content?.enabled;
  }

  async ngOnInit() {
    try {
      this.content = await this.contentService.getContent('CAREERS');
    } catch {
      // keep the static fallback already in this.content
    }
    if (this.enabled && !this.hasSeen()) {
      this.autoTimer = setTimeout(() => this.openModal(), HiringPopupComponent.AUTO_DELAY_MS);
    }
  }

  ngOnDestroy() {
    if (this.autoTimer) clearTimeout(this.autoTimer);
  }

  private hasSeen(): boolean {
    try {
      return (
        localStorage.getItem(HiringPopupComponent.DISMISS_KEY) === '1' ||
        localStorage.getItem(HiringPopupComponent.APPLIED_KEY) === '1'
      );
    } catch {
      return false;
    }
  }

  private remember(key: string) {
    try {
      localStorage.setItem(key, '1');
    } catch {
      // localStorage unavailable (private mode) — non-fatal
    }
  }

  openModal() {
    if (this.autoTimer) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
    this.open = true;
  }

  dismiss() {
    this.open = false;
    this.remember(HiringPopupComponent.DISMISS_KEY);
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.open && !this.submitting) this.dismiss();
  }

  async submit() {
    if (this.submitting) return;
    this.submitting = true;
    this.error = false;
    try {
      await this.careers.apply({
        name: this.form.name,
        email: this.form.email,
        phone: this.form.phone,
        message: this.form.message,
        company: this.form.company,
        position: this.content?.position || 'General Application',
      });
      this.submitted = true;
      this.remember(HiringPopupComponent.APPLIED_KEY);
    } catch {
      this.error = true;
    } finally {
      this.submitting = false;
    }
  }
}
```

- [ ] **Step 4: Write the template**

Create `frontend/src/app/components/hiring-popup/hiring-popup.component.html`:

```html
@if (enabled) {
  @if (!open) {
    <button type="button" class="hiring-fab" (click)="openModal()" aria-haspopup="dialog">
      <span class="hiring-fab__dot" aria-hidden="true"></span>
      {{ content.ctaLabel || "We're Hiring" }}
    </button>
  }

  @if (open) {
    <div class="hiring-overlay" (click)="dismiss()">
      <div class="hiring-modal" role="dialog" aria-modal="true" aria-labelledby="hiring-headline" (click)="$event.stopPropagation()">
        <button type="button" class="hiring-modal__close" (click)="dismiss()" aria-label="Close">&times;</button>

        @if (submitted) {
          <div class="hiring-modal__success">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-success, #0f8a3c)" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="16 8 10 16 7 13" />
            </svg>
            <h2 id="hiring-headline">Thanks{{ form.name ? ', ' + form.name : '' }}!</h2>
            <p>We've received your application and will be in touch soon.</p>
            <button class="btn btn--primary" (click)="open = false">Close</button>
          </div>
        } @else {
          <div class="hiring-modal__header">
            <span class="hiring-modal__badge">Now Hiring</span>
            <h2 id="hiring-headline">{{ content.headline }}</h2>
            @if (content.subheadline) {
              <p class="hiring-modal__sub">{{ content.subheadline }}</p>
            }
          </div>

          @if (content.body) {
            <p class="hiring-modal__body">{{ content.body }}</p>
          }

          <form (ngSubmit)="submit()" #applyForm="ngForm">
            <div class="hiring-field">
              <label for="hp-name">Name *</label>
              <input id="hp-name" name="name" [(ngModel)]="form.name" required placeholder="Your full name" />
            </div>
            <div class="hiring-field">
              <label for="hp-email">Email *</label>
              <input id="hp-email" type="email" name="email" [(ngModel)]="form.email" required placeholder="you@example.com" />
            </div>
            <div class="hiring-field">
              <label for="hp-phone">Phone *</label>
              <input id="hp-phone" type="tel" name="phone" [(ngModel)]="form.phone" required placeholder="(555) 123-4567" />
            </div>
            <div class="hiring-field">
              <label for="hp-message">Anything you'd like us to know?</label>
              <textarea id="hp-message" name="message" [(ngModel)]="form.message" rows="3" placeholder="Experience, availability, etc."></textarea>
            </div>

            <!-- Honeypot: hidden from humans; a filled value silently drops the submission server-side -->
            <input class="hiring-hp" type="text" name="company" [(ngModel)]="form.company" tabindex="-1" autocomplete="off" aria-hidden="true" />

            @if (error) {
              <p class="hiring-error">
                Something went wrong. Please email us directly at
                <a [href]="'mailto:' + (content.email || 'vanderleesttrailers@gmail.com')">{{ content.email || 'vanderleesttrailers@gmail.com' }}</a>.
              </p>
            }

            <button type="submit" class="btn btn--primary hiring-submit" [disabled]="submitting || applyForm.invalid">
              {{ submitting ? 'Sending…' : (content.ctaLabel || 'Apply Now') }}
            </button>
          </form>
        }
      </div>
    </div>
  }
}
```

- [ ] **Step 5: Write the styles**

Create `frontend/src/app/components/hiring-popup/hiring-popup.component.scss`:

```scss
:host { display: contents; } // the host box is inert; children position themselves fixed

.hiring-fab {
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 8900; // below the chat launcher (9000)
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border: none;
  border-radius: 999px;
  background: var(--color-primary, #0f8a3c);
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:hover { transform: translateY(-2px); box-shadow: 0 8px 26px rgba(0, 0, 0, 0.38); }
  &__dot {
    width: 9px; height: 9px; border-radius: 50%; background: #fff;
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
    animation: hiring-pulse 2s infinite;
  }
}

@keyframes hiring-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.6); }
  70%  { box-shadow: 0 0 0 8px rgba(255, 255, 255, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
}

.hiring-overlay {
  position: fixed;
  inset: 0;
  z-index: 9500; // above the chat panel
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.6);
  animation: hiring-fade 0.2s ease;
}

.hiring-modal {
  position: relative;
  width: 100%;
  max-width: 440px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--color-surface, #12171e);
  color: var(--color-text, #eef0f2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 28px 26px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
  animation: hiring-rise 0.25s ease;

  &__close {
    position: absolute; top: 12px; right: 14px;
    background: none; border: none; color: inherit;
    font-size: 1.6rem; line-height: 1; cursor: pointer; opacity: 0.7;
    &:hover { opacity: 1; }
  }

  &__badge {
    display: inline-block;
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--color-primary, #0f8a3c);
    background: rgba(15, 138, 60, 0.12);
    padding: 4px 10px; border-radius: 999px; margin-bottom: 10px;
  }

  &__header h2 { margin: 0 0 4px; font-size: 1.5rem; }
  &__sub { margin: 0 0 8px; opacity: 0.85; }
  &__body { margin: 0 0 18px; opacity: 0.8; font-size: 0.95rem; line-height: 1.5; }

  &__success { text-align: center; padding: 10px 0; }
  &__success h2 { margin: 12px 0 6px; }
  &__success p { opacity: 0.8; margin-bottom: 18px; }
}

.hiring-field {
  margin-bottom: 14px;
  display: flex; flex-direction: column; gap: 6px;

  label { font-size: 0.85rem; font-weight: 600; opacity: 0.9; }
  input, textarea {
    width: 100%;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    color: inherit;
    font: inherit;
    &:focus { outline: none; border-color: var(--color-primary, #0f8a3c); }
  }
}

// Honeypot — off-screen, never shown, not announced.
.hiring-hp {
  position: absolute !important;
  left: -9999px !important;
  width: 1px; height: 1px;
  opacity: 0;
  pointer-events: none;
}

.hiring-error {
  color: var(--color-error, #e5534b);
  font-size: 0.88rem;
  margin: 4px 0 12px;
  a { color: inherit; text-decoration: underline; }
}

.hiring-submit { width: 100%; margin-top: 4px; justify-content: center; }

@keyframes hiring-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes hiring-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }

@media (max-width: 640px) {
  .hiring-fab { left: 12px; bottom: 12px; font-size: 0.82rem; padding: 10px 14px; }
}

@media (prefers-reduced-motion: reduce) {
  .hiring-overlay, .hiring-modal, .hiring-fab, .hiring-fab__dot { animation: none; transition: none; }
}
```

- [ ] **Step 6: Mount it in the app root**

In `frontend/src/app/app.component.ts`:
1. Add the import:
```ts
import { HiringPopupComponent } from './components/hiring-popup/hiring-popup.component';
```
2. Add `HiringPopupComponent` to the `imports` array of the `@Component` decorator.
3. Add `<app-hiring-popup />` to the template, right after `<app-chat-widget />`:
```ts
    <app-chat-widget />
    <app-hiring-popup />
```

- [ ] **Step 7: Run the spec to verify it passes**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessCI --include='**/hiring-popup.component.spec.ts'`
Expected: PASS.

- [ ] **Step 8: Full frontend gate**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessCI && npx ng build --configuration production`
Expected: all specs pass; build succeeds.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/components/hiring-popup frontend/src/app/app.component.ts
git commit -m "Feature: HiringPopupComponent — global we're-hiring popup + form"
```

---

### Task 7: CI test glob + README docs

**Files:**
- Modify: `.github/workflows/pr-check.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: the apply Lambda tests (Task 1).

- [ ] **Step 1: Widen the Lambda test glob**

In `.github/workflows/pr-check.yml`, change the Lambda test step command from:

```yaml
        run: node --test lambda/chat/__tests__/*.test.mjs
```
to:
```yaml
        run: node --test lambda/*/__tests__/*.test.mjs
```

- [ ] **Step 2: Document the SES setup + new route in the README**

In `README.md`, under the Backend Architecture section (near the other Lambda descriptions), add a short subsection:

```markdown
### Job Applications (`apply` Lambda + SES)

The "We're Hiring" popup posts to `POST /api/apply`. The `apply` Lambda validates
the application, stores it in the leads table, and emails it to the shop via
Amazon SES (`Reply-To` is set to the applicant).

**One-time setup:** in the SES console for the stack's region, verify the
identity `vanderleesttrailers@gmail.com` (click the link Amazon emails). Because
the message is sent from and to that same verified address, this works in the
SES sandbox with no production-access request. The send-to address is the
Lambda env var `APPLY_TO_EMAIL`. Until the identity is verified, `/api/apply`
returns 502 and the popup shows a "email us directly" fallback.

Popup copy and an on/off switch are editable in the admin panel under
**Careers / Hiring** (`CAREERS` content type).
```

- [ ] **Step 3: Verify the workflow glob locally**

Run: `cd cdk && node --test lambda/*/__tests__/*.test.mjs`
Expected: PASS — runs both the chat and apply Lambda tests.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/pr-check.yml README.md
git commit -m "Chore: run apply Lambda tests in CI + document SES setup"
```

---

## Final Verification (before opening the PR)

- [ ] `cd cdk && node --test lambda/*/__tests__/*.test.mjs` — all Lambda tests pass.
- [ ] `cd cdk && npx cdk synth --quiet` — stack synthesizes.
- [ ] `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessCI` — all specs pass.
- [ ] `cd frontend && npx ng build --configuration production` — build succeeds.
- [ ] Drive the popup in a real browser (see superpowers:verification-before-completion / the `run` skill): enabled shows the button + auto-open; submit success and forced-failure paths both render correctly.
- [ ] Open the PR to `main` with a summary of the feature and the SES one-time-setup note.
