# "We're Hiring" Application Popup — Design

**Date:** 2026-07-20
**Status:** Draft — pending implementation plan
**Owner:** James Christensen

## Summary

Add a site-wide "We're Hiring" popup that invites visitors to apply for an open
position. The popup auto-opens once per visitor and can be reopened anytime from
a small persistent button. Submitting the short form sends the application by
email to **vanderleesttrailers@gmail.com** via a new SES-backed `apply` Lambda,
and records it to the existing leads table as a durable backup. All popup copy —
and an on/off switch — is editable by the client from the existing admin panel
through a new `CAREERS` content type.

## Goals

- Surface an open-position call-to-action prominently on every public page.
- Collect a short application (name, email, phone, optional note) and deliver it
  to vanderleesttrailers@gmail.com as a real email the client can reply to.
- Never lose an applicant: persist every submission to the `leadsTable` even if
  the email send fails.
- Let the client edit the popup headline/body and turn it on or off without a
  developer, matching how the rest of the site is managed.
- Match the existing dark, industrial-refined aesthetic and the VanderLeest
  green (`#0f8a3c`) accent.

## Non-Goals

- Resume/file upload (v1 is a text form only; applicants can attach when they
  reply to the email).
- Multiple simultaneous job listings or an ATS-style pipeline (single "general"
  posting in v1; the position line is editable text).
- Fixing the unrelated contact-form stub (out of scope; tracked separately).
- Captcha. Abuse is controlled by API Gateway throttling + a honeypot field.
- Server-side application listing UI in the admin panel (applications land in the
  inbox and in DynamoDB; no new admin screen to browse them in v1).

## Delivery Mechanism Decision

The site has **no working email backend** today — the contact form is a visual
stub and there is no SES configuration. We are adding a real server-side email
path (chosen over a `mailto:` handoff) so the applicant never leaves the page.

**One-time manual setup (documented in README):** verify
`vanderleesttrailers@gmail.com` as an SES email identity in the stack's region
(click the link Amazon emails). Because the message is sent **from** and **to**
that same verified address (with the applicant as `Reply-To`), it works even in
the SES sandbox — **no production-access request is required**. Until the
identity is verified, the endpoint returns a 502 and the popup shows its
graceful fallback (the email address as a `mailto:` link), so an un-verified
account degrades cleanly rather than silently dropping applicants.

## Architecture

Four cooperating units, each independently testable:

1. **`apply` Lambda** (`cdk/lambda/apply/index.mjs`) — validates input, records
   the application, sends the email. Pure helpers exported for unit tests.
2. **`CareersService`** (`frontend/src/app/services/careers.service.ts`) — the
   only thing that knows the network shape; posts to `/api/apply`.
3. **`HiringPopupComponent`** (`frontend/src/app/components/hiring-popup/`) — all
   UI and open/dismiss behavior; depends on `ContentService` + `CareersService`.
4. **`CAREERS` content** — data (copy + `enabled` flag), served through the
   existing `ContentService` pipeline with a static fallback.

### Data flow

```
Visitor → HiringPopupComponent → CareersService.apply() → POST /api/apply
   → apply Lambda → (1) leadsTable.put (best-effort)  (2) SES SendEmail
   → 200 → popup shows thank-you  |  4xx/502 → popup shows email fallback
```

Popup copy load: `HiringPopupComponent` → `ContentService.getContent('CAREERS')`
→ API (`/api/content/CAREERS`, DynamoDB) with static `CAREERS_CONTENT` fallback.

## Backend

### `apply` Lambda — `cdk/lambda/apply/index.mjs`

Follows the `chat` Lambda's testability pattern: module-level clients with
`__setSesClient` / `__setDdbClient` setters, plus exported pure helpers.

Handles `OPTIONS` (CORS preflight) and `POST`. Shared CORS headers matching the
other Lambdas (`Access-Control-Allow-Methods: POST,OPTIONS`).

- **`validateApplication(body)`** → `{ ok, errors, data }`
  - Required: `name`, `email`, `phone`. `message` optional.
  - `email` must match a basic email regex. Each field length-capped
    (name/email/phone ≤ 200, message ≤ 2000); values trimmed and coerced to
    strings. `position` optional, defaults to `"General Application"`.
- **`isHoneypot(body)`** → `true` if the hidden `company` field is non-empty.
  Bot submissions are answered `200` **without** sending an email (silent trap).
- **`buildEmail(data)`** → `{ subject, text, html }`
  - Subject: `New job application — <name>`.
  - Body lists name, email, phone, position, message, and a submission
    timestamp. Plain-text + minimal HTML. User content is HTML-escaped.
- **`handler`**:
  1. `OPTIONS` → 200.
  2. Parse JSON body (malformed → 400).
  3. Honeypot → 200 (no send).
  4. `validateApplication` fails → 400 with `{ errors }`.
  5. Best-effort `PutCommand` to `leadsTable` (`pk="APPLICATION"`,
     `sk="<ISO timestamp>#<random>"`, `data` = the application). Wrapped in
     try/catch — a DynamoDB failure is logged and does **not** block the email.
  6. `SESClient.send(SendEmailCommand)` with `Source=APPLY_FROM_EMAIL`,
     `Destination.ToAddresses=[APPLY_TO_EMAIL]`,
     `ReplyToAddresses=[applicant email]`.
  7. Success → 200 `{ ok: true }`. SES throws → 502 `{ ok: false }` (logged).

Env vars: `APPLY_TO_EMAIL` (default `vanderleesttrailers@gmail.com`),
`APPLY_FROM_EMAIL` (default same), `LEADS_TABLE`.

Uses `@aws-sdk/client-ses` — provided by the Node 24 Lambda managed runtime
(same as the other Lambdas importing `@aws-sdk/*` with no bundled deps).

### CDK — `cdk/lib/vanderleest-stack.ts`

- New `applyLambda` (`NODEJS_24_X`, asset `../lambda/apply`, env as above,
  timeout 15s, memory 256).
- `leadsTable.grantWriteData(applyLambda)`.
- SES send permission, scoped to this account's identities:
  ```
  applyLambda.addToRolePolicy(new iam.PolicyStatement({
    actions: ["ses:SendEmail", "ses:SendRawEmail"],
    resources: [`arn:aws:ses:${this.region}:${this.account}:identity/*`],
  }));
  ```
- Route: `apiResource.addResource("apply").addMethod("POST", applyIntegration)`
  (public).
- Throttle override in `deployOptions.methodOptions` for `"/api/apply/POST"`:
  `rate 2 / burst 5` — email is abuse-prone.
- **No CloudFront change** — the existing `/api/*` catch-all already forwards
  POST uncached with viewer headers.

## CMS-Editable Content (`CAREERS`)

`CAREERS_CONTENT` shape (static fallback in `site-content.ts`, seeded to
DynamoDB):

```ts
export const CAREERS_CONTENT = {
  enabled: true,
  headline: "We're Hiring!",
  subheadline: "Join the VanderLeest Trailer Sales team",
  body: "We're looking for hard-working people who care about doing right by our customers. Tell us a little about yourself and we'll be in touch.",
  position: "General Application",
  ctaLabel: "Apply Now",
  email: "vanderleesttrailers@gmail.com",
};
```

Registered in:
- `content.service.ts` fallback map: `CAREERS: staticContent.CAREERS_CONTENT`.
- `app.component.ts` preload list: add `'CAREERS'`.
- `seed/index.mjs`: seed item `{ pk: 'CAREERS', sk: '_', data: {...} }`.
- `dashboard.component.ts` sections: `{ label: 'Careers / Hiring', description:
  'Hiring popup: headline, text, on/off switch', route: '/admin/edit/CAREERS',
  icon: '&#128188;' }` (briefcase).
- `content-editor.component.ts` label map: `CAREERS: 'Careers / Hiring'`.

The popup consumes `email` from content only to render the fallback `mailto:`
link; the authoritative send-to address is the Lambda's `APPLY_TO_EMAIL` env var
so a mis-edit in the CMS cannot silently redirect real applications.

### Generic editor enhancement — boolean checkbox

Today the simple editor's `getFields()` surfaces only `string`/`number` leaves;
booleans appear only in the raw-JSON editor. To let the client flip `enabled`
easily, extend the generic editor:
- `content-editor.component.ts` `getFields()`: also emit boolean leaves with
  `type: 'boolean'`.
- `content-editor.component.html`: render `type === 'boolean'` as a checkbox
  (`[ngModel]` / `(ngModelChange)="updateField(path, $event)"`) in both the
  top-level and nested-section field loops.

This is a small, general improvement that benefits any future boolean setting.

## Frontend Popup

### `HiringPopupComponent` (standalone), mounted in `app.component.ts`

Rendered after `<app-chat-widget />`. On init, loads `CAREERS`. If
`content.enabled === false`, renders nothing (no button, no auto-open).

**Open/dismiss behavior**
- Auto-open ~6s after load, but only if enabled **and** the visitor has not
  previously dismissed or applied.
- `localStorage` keys: `vlt-hiring-dismissed` and `vlt-hiring-applied`
  (either suppresses future auto-open; the reopen button always works).
- Persistent **bottom-left** floating button "We're Hiring" (chat launcher owns
  bottom-right at z-index 9000). Hidden while the modal is open.

**Modal (accessible dialog)**
- Overlay above chat (z-index ~9500). `role="dialog"`, `aria-modal="true"`,
  `aria-labelledby` the headline. Close via `×`, backdrop click, and `Esc`.
  Focus the first field on open; restore focus to the reopen button on close.
  Animations gated behind `prefers-reduced-motion`.
- Content from `CAREERS`: headline, subheadline, body, position line.
- Form fields: **Name\***, **Email\***, **Phone\***, optional "Anything you'd
  like us to know?" note, and a visually-hidden honeypot `company` field
  (`autocomplete="off"`, `tabindex="-1"`, `aria-hidden`).
- Submit button shows a loading state while posting.

**Submit**
- Calls `CareersService.apply({ name, email, phone, message, company, position })`.
- Success → set `vlt-hiring-applied`, show a thank-you panel ("Thanks — we'll be
  in touch.").
- Failure → error panel with fallback copy: "Something went wrong — please email
  us directly at <a mailto>vanderleesttrailers@gmail.com</a>" (address from
  `CAREERS.email`).

### `CareersService`

```ts
async apply(data): Promise<void> {
  const res = await fetch(`${environment.apiUrl}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
```

## Error Handling

| Case | Behavior |
| --- | --- |
| Invalid/malformed submission | Lambda 400; popup keeps the form open and shows an inline error. |
| Client-side required-field gaps | Native form validation blocks submit before any request. |
| SES not yet verified / send fails | Lambda records the lead to DynamoDB, returns 502; popup shows the email fallback so the applicant still has a path. |
| Bot fills honeypot | Lambda returns 200 without sending; no lead recorded. |
| `CAREERS` content unreachable | `ContentService` static fallback keeps the popup working offline/local. |
| `enabled === false` | Component renders nothing. |

## Testing

- **Lambda** (`cdk/lambda/apply/__tests__/handler.test.mjs`, `node --test`):
  `validateApplication` (missing/invalid/oversized fields, defaults),
  `isHoneypot`, `buildEmail` (subject/body, HTML-escaping), and `handler` with
  mocked SES + DDB clients — honeypot→200-no-send, valid→SES called with correct
  params + 200, SES-throws→502, DDB-throws→still emails + 200.
- **CI:** widen `pr-check.yml`'s Lambda test glob from `lambda/chat/__tests__/*`
  to also run `lambda/apply/__tests__/*` (e.g. `lambda/*/__tests__/*.test.mjs`).
- **Angular specs:** `careers.service.spec.ts` (posts to `/api/apply`, throws on
  non-OK) and `hiring-popup.component.spec.ts` (renders nothing when disabled;
  opens on button click; success + failure submit paths; honeypot present).
- **Gates:** `ng test`, `ng build --configuration production`, and `cdk synth`
  all pass (mirrors `pr-check.yml`).

## Files Touched

**New**
- `cdk/lambda/apply/index.mjs`
- `cdk/lambda/apply/__tests__/handler.test.mjs`
- `frontend/src/app/services/careers.service.ts` (+ `.spec.ts`)
- `frontend/src/app/components/hiring-popup/hiring-popup.component.{ts,html,scss}` (+ `.spec.ts`)

**Modified**
- `cdk/lib/vanderleest-stack.ts` (apply Lambda, IAM, route, throttle)
- `cdk/lambda/seed/index.mjs` (`CAREERS` seed item)
- `frontend/src/app/data/site-content.ts` (`CAREERS_CONTENT`)
- `frontend/src/app/services/content.service.ts` (fallback map)
- `frontend/src/app/app.component.ts` (mount popup + preload `CAREERS`)
- `frontend/src/app/admin/dashboard/dashboard.component.ts` (dashboard section)
- `frontend/src/app/admin/content-editor/content-editor.component.{ts,html}` (boolean checkbox)
- `.github/workflows/pr-check.yml` (Lambda test glob)
- `README.md` (SES verification step + `/api/apply` route)
