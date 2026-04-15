# AI Matt Chat Assistant — Design

**Date:** 2026-04-15
**Status:** Draft — pending implementation plan
**Owner:** James Christensen

## Summary

Add a floating chat widget to the public VanderLeest Trailers site so visitors can ask questions about inventory, services, hours, and financing, and hand off as a lead to Matt. The widget is labeled **"Talk to AI Matt"** and uses the cartoon Matt image as an avatar. Backed by a new `chat` Lambda calling Amazon Bedrock (Nova Micro) with tool use for live DynamoDB lookups.

## Goals

- Answer common pre-sales questions using existing site content without a human in the loop.
- Let visitors check current inventory by category, brand, or price in natural language.
- Capture qualified leads (name + phone, with optional email and message) and write them to a new `Leads` table that Matt can review.
- Match the existing site's dark, industrial-refined aesthetic; use the VanderLeest green (`#0f8a3c`) as the accent.

## Non-Goals

- Admin-editable bot personality (system prompt is hardcoded in v1; can be promoted to a CMS content type later).
- Server-side transcript storage (chat history lives in the browser's `localStorage` only; only submitted leads are persisted).
- Proactive behaviors (auto-open, exit-intent popups, timed greetings).
- Captcha, per-IP quotas, or CloudWatch spend alarms. API Gateway throttling + per-request token caps are the only controls.
- Voice, attachments, or image input.

## User Experience

### Closed state

A pill reading **"Talk to AI Matt"** sits next to a 56px round avatar (cartoon Matt) in the bottom-right of every public page, 16px from each edge. Dark pill (`#1a2029`), green-tinted avatar border (`#2a8f4f`), subtle shadow. Clicking either the pill or the avatar opens the panel.

### Open state

- **Desktop:** a floating panel, 380×560px, anchored bottom-right, with an `×` close button in the header.
- **Mobile (<640px):** a full-screen takeover.
- Header shows the avatar, "AI Matt," and a green "Online" dot with the subtitle "typically replies instantly."
- Messages render as rounded bubbles — bot messages in `#1a2029`, user messages in VanderLeest green.
- On first open, the bot posts a greeting and three starter chips: *Browse inventory*, *Financing options*, *Hours & location*.
- Input bar at the bottom: text field + green "Send" button.
- A small disclaimer line under the input: "AI responses may be inaccurate · not for final quotes."

### Handoff flow (conversational)

When the bot detects buying intent, it asks for the visitor's details in sequence inside the chat (name, then phone, then optional email, then optional message). Once it has at least name + phone it calls `submitLead`. On success the bot confirms in chat and offers to continue helping. On failure it apologizes and points to the existing `/contact` page.

### Visibility

Shown on all public routes. Hidden on any route starting with `/admin`. Widget loads with the `AppComponent` shell, so it persists across client-side navigation without remounting.

## Architecture

```
Browser (Angular chat-widget)
        │  POST /api/chat  { sessionId, messages }
        ▼
CloudFront (/api/chat → pass-through, no cache)
        ▼
API Gateway  (throttled: 5 rps, 10 burst, same as /api/recommend)
        ▼
chat Lambda  (Node.js 20, 512 MB, 30s timeout)
   │
   ├── Bedrock Converse API (amazon.nova-micro-v1:0) with tools:
   │     • searchTrailers({ category?, brand?, maxPrice?, query? })
   │     • getSiteContent({ type })      # SITE_INFO, SERVICES, FINANCING, FAQ, …
   │     • submitLead({ name, phone, email?, message? })
   │
   ├── DynamoDB reads: VanderLeestContent  (content + trailers)
   │
   └── DynamoDB write: VanderLeestLeads    (new)
```

### New AWS resources

| Resource | Notes |
|---|---|
| `chat` Lambda | Mirror of `recommend` Lambda: Node 20, 512 MB, 30s timeout. IAM-scoped to `amazon.nova-micro-v1:0`. Model ID injected via `MODEL_ID` env var for easy swap. |
| `VanderLeestLeads` DynamoDB table | `pk = LEAD`, `sk = <ISO-timestamp>#<sessionId>`. Pay-per-request. `RemovalPolicy.DESTROY`. |
| API Gateway `POST /api/chat` | Public. Method-level throttle override: 5 rps / 10 burst, matching `/api/recommend`. |
| IAM additions on the new Lambda | `contentTable.grantReadData`, `leadsTable.grantWriteData`, `bedrock:InvokeModel` on the Nova Micro ARN. |

### Unchanged

- CloudFront `/api/*` behavior already routes this path.
- No new Cognito client, S3 bucket, or frontend environment variables.
- No changes to the existing `recommend`, `content-api`, `admin-api`, or `seed` Lambdas.

## Frontend

### New components / services

- `components/chat-widget/` — standalone component with two visual states (bubble / panel). Loaded by `AppComponent`.
- `services/chat.service.ts` — holds `sessionId`, message history, open/closed state. Persists `{ sessionId, messages }` to `localStorage` under the key `vl_chat_v1`. On boot, rehydrates from `localStorage` if present.
- `services/chat-api.service.ts` — wraps `POST /api/chat`.

### Behavior

- On first user turn, the service generates a UUIDv4 `sessionId` and stores it.
- Each turn the frontend sends the full `messages[]` — the Lambda is stateless.
- Before sending, history is trimmed client-side to the last 20 turns (the Lambda also truncates as a safety net).
- Hidden when the active URL starts with `/admin`. Subscribes to `Router.events` to toggle visibility.
- Styled entirely with component SCSS using the existing global CSS variables. Accent color uses VanderLeest green (`#0f8a3c`) to harmonize with the cartoon avatar's hat.

## Backend: `chat` Lambda

### Request

```json
POST /api/chat
{ "sessionId": "uuid", "messages": [ { "role": "user|assistant", "content": "..." } ] }
```

### Response

```json
200 { "reply": "..." }
429 { "error": "rate_limited" }                 // from API Gateway
500 { "error": "internal", "fallbackPhone": "…" }
```

### Tool-use loop

Uses the Bedrock **Converse API** (not raw `InvokeModel`) for native tool support. Pseudocode:

```js
let messages = truncate(incoming.messages, 20);

for (let i = 0; i < 3; i++) {                    // max 3 tool hops per turn
  const res = await bedrock.send(new ConverseCommand({
    modelId: process.env.MODEL_ID,
    system: [{ text: SYSTEM_PROMPT }],
    messages,
    toolConfig: { tools: TOOL_SPECS },
    inferenceConfig: { maxTokens: 500, temperature: 0.4 }
  }));

  if (res.stopReason !== "tool_use") {
    return { reply: extractText(res) };
  }

  const toolUse = findToolUse(res.output.message);
  const toolResult = await runTool(toolUse);     // DDB query / write

  messages = [
    ...messages,
    res.output.message,
    { role: "user", content: [{ toolResult: {
        toolUseId: toolUse.toolUseId,
        content: [{ json: toolResult }]
    }}]}
  ];
}

// Loop ceiling hit — return the model's latest text or a safe fallback.
```

### Tool implementations

- **`searchTrailers`** — queries `VanderLeestContent` where `pk = TRAILER`, filters in-memory by category / brand / `maxPrice` / case-insensitive `query` over name and description. Returns up to 10 items.
- **`getSiteContent`** — GetItem by `pk = <type>, sk = _`. Whitelists allowed types: `SITE_INFO`, `SERVICES`, `FINANCING`, `CONTACT`, `FAQ`, `BRANDS`, `CATEGORIES`.
- **`submitLead`** — validates `name` + `phone` present, writes `{ pk: "LEAD", sk: "<ISO>#<sessionId>", name, phone, email?, message?, sessionId, createdAt }` to `VanderLeestLeads`. Returns `{ ok: true, leadId }` on success.

### System prompt (hardcoded, v1)

```
You are AI Matt, a friendly assistant for VanderLeest Trailer Sales in
Northeastern Wisconsin. You help visitors find trailers, understand
services (welding, painting, custom work), and answer questions about
financing, hours, and location. You are warm, plainspoken, and helpful —
never pushy.

Rules:
- Only discuss VanderLeest, trailers, and adjacent topics (towing,
  hauling, financing). Politely redirect off-topic questions.
- Use `searchTrailers` before claiming anything about current stock or
  prices. Never invent inventory.
- Use `getSiteContent` for hours, address, phone, financing partners,
  services, and FAQs.
- When a visitor shows buying intent, offer to take their contact info
  and pass it to Matt. Call `submitLead` only after you have at minimum
  a name and phone number.
- You are an AI, not the real Matt. If asked directly, say so and offer
  to connect them with the real Matt.
- Never quote firm prices as final — say "listed at $X, final pricing
  subject to confirmation."
```

### Hard caps

- `maxTokens: 500` per model call.
- Max 3 tool hops per user turn.
- Conversation truncated to last 20 turns before sending to Bedrock.
- API Gateway throttling: 5 rps, 10 burst (matching `/api/recommend`).

## Data Model

### New table: `VanderLeestLeads`

| Attribute | Type | Notes |
|---|---|---|
| `pk` | String | Always `LEAD` |
| `sk` | String | `<ISO-timestamp>#<sessionId>` — naturally sorts newest-last |
| `name` | String | Required |
| `phone` | String | Required |
| `email` | String? | Optional |
| `message` | String? | Optional |
| `sessionId` | String | UUIDv4 generated by the frontend |
| `createdAt` | String | ISO timestamp, same value as prefix of `sk` |

No GSIs needed for v1. Billing: pay-per-request.

## Error Handling

| Failure | Behavior |
|---|---|
| Bedrock timeout or throttle | Reply "I'm having trouble right now — try again, or call Matt at `<phone>`." Logged with error name. |
| Tool call error (DynamoDB) | Continue the turn without that tool's data. The model is instructed not to fabricate. |
| `submitLead` validation or write failure | Apologize in chat, surface a link to `/contact` as fallback. Lead is **not** silently dropped. |
| API Gateway 429 | Frontend shows inline "too many messages — try in a minute." |
| Malformed request | Lambda returns 400; frontend shows a generic error. |

## Testing

### Lambda unit tests (`cdk/lambda/chat/__tests__`)

- Tool routing: each tool name dispatches to the right handler.
- `searchTrailers` filter logic (category, brand, price, query, 10-item cap).
- `getSiteContent` whitelist (rejects unknown types).
- `submitLead` validation (rejects missing name or phone).
- Truncation: 25-message history is trimmed to 20 before Bedrock call.
- Bedrock client and DynamoDB client are mocked.

### Frontend unit tests

- `ChatService`: session creation, localStorage persist/rehydrate, 20-turn trim.
- `ChatWidgetComponent`: open/close state, message rendering, auto-scroll to bottom, starter-chip click, hidden on `/admin` routes.

### Manual smoke checks

- Ask about inventory (e.g., "do you have any dump trailers?") — verify `searchTrailers` is called (CloudWatch logs) and the answer reflects current data.
- Ask about hours — verify `getSiteContent` call.
- Complete a lead capture end-to-end — verify a new row in `VanderLeestLeads` with correct fields.
- Refresh mid-conversation — verify history is restored from `localStorage`.

### CI

New tests wire into the existing `pr-check.yml` alongside the current suite.

## Observability

- Lambda structured logs (CloudWatch) per turn: `sessionId`, turn number, tool calls made, input/output token counts, total latency. Same shape as the existing `recommend` Lambda logs.
- EMF metric `ChatLeadSubmitted` (count) emitted on successful `submitLead` for the client to track lead volume.

## Rollout

- Single PR, deployed through the existing `deploy.yml` GitHub Actions workflow.
- No feature flag — additive, public, siloed behind `/api/chat` and a new widget component. No regression surface on existing pages.
- No post-deploy manual steps beyond the standard deploy.

## Future Enhancements (explicitly deferred)

- Admin-editable personality and starter chips (promote the system prompt and chip list to `CHAT_CONFIG` in the CMS).
- Admin leads dashboard (`/admin/leads`) to list, search, and mark leads as contacted.
- Email/SMS notification when a lead arrives (SES or SNS).
- Conversation transcripts persisted alongside leads for context.
- Proactive behaviors (auto-open after idle, exit-intent).
- Swap Nova Micro for Claude Haiku via `MODEL_ID` env var if conversational quality proves insufficient.
