# Live Trailer Count on Homepage

## Problem

The homepage "Trailers In Stock" stat (`frontend/src/app/pages/home/home.component.html:88-90`) is hardcoded to `100+`. It doesn't reflect actual inventory and can drift arbitrarily out of sync with reality.

## Goal

Replace the hardcoded number with a live count of trailers currently in inventory, sourced from the existing `GET /api/trailers` endpoint.

## Background / Constraints

- Trailer data lives in DynamoDB and is served via `GET /api/trailers` (`cdk/lambda/content-api/index.mjs`), fetched in the frontend through `ContentService.getTrailers()` (`frontend/src/app/services/content.service.ts:90-98`).
- The trailer data model has no `status`/`sold`/`inStock` field — every trailer the API returns is implicitly available. So "count of all trailers in inventory" is simply `(await contentService.getTrailers()).length`; no filtering is needed.
- `ContentService.getTrailers()` already swallows fetch errors internally and resolves to `[]` rather than throwing (there is deliberately no static trailer fallback, per an existing code comment). A trailer dealership realistically never has zero inventory, so an empty/failed fetch should be treated as "count unavailable" rather than displayed as `0`.
- `HomeComponent` (`frontend/src/app/pages/home/home.component.ts`) already renders its template immediately from synchronous fallback content (`ContentService.getContentSync(...)`), then upgrades fields once `ngOnInit`'s `Promise.all` resolves — the same pattern used today for the Google review count (`reviewCount`, rendered conditionally once loaded). The trailer count will follow this same upgrade-in-place pattern, so no new loading state or spinner is needed.

## Design

**Component (`home.component.ts`):**
- Add `trailerCount: number | null = null;`.
- Fetch `this.contentService.getTrailers()` separately from the existing `Promise.all(...)` of other homepage content, via a plain `.then()` after that `Promise.all` resolves — not inside it. `getTrailers()` hits an uncached network call while every other item in the `Promise.all` is a cached (or synchronously-resolving) `getContent()`/`getGoogleReviews()` call; bundling it in would let one slow, uncached fetch delay the rest of the page's already-available content from rendering.
- Once it resolves, set `this.trailerCount = trailers.length || null;` (an empty array becomes `null`, triggering the fallback below — treated as "unavailable," not "zero inventory").

**Service (`content.service.ts`):**
- `getTrailers()` had two pre-existing issues, both now more consequential because a second call site (the homepage) depends on it: it returned `res.json()` unawaited inside its `try` block, so a malformed-JSON 200 response would reject the whole function instead of being caught and falling back to `[]`; and it had no caching at all, unlike `getContent()`, even though `AppComponent.ngOnInit` already fire-and-forgets a `getTrailers()` call on every page load intending to prefetch it (per its "Preload all content into cache" comment) — a prefetch that was previously silently discarded since there was nowhere to cache it. Fixed by awaiting `res.json()` inside the `try` (so parse failures hit the existing `catch` → `[]`) and adding the same `this.cache`/`cacheTTL` lookup-and-store `getContent()` already uses, keyed as `'TRAILERS'`.

**Template (`home.component.html:88-90`):**
- Change the stat tile's number from the literal `100+` to `{{ trailerCount ?? '100+' }}`.
- No `+` suffix on the live count — unlike the neighboring approximate stats (`6+ Premium Brands`), this number is now exact, so it's displayed as-is (e.g. `47`).
- `100+` remains as the literal fallback shown only when `trailerCount` is `null` (initial render, before the fetch resolves, or if the fetch failed/returned empty).

**Out of scope:**
- No header/nav badge (a site-wide live count elsewhere was considered and explicitly deferred; this spec covers only the homepage stat).
- No changes to the inventory page's existing filtered-result counts (`inventory.component.html`), which serve a different purpose (showing matches against active filters, not total inventory).
- No backend/API changes — the existing `/api/trailers` endpoint already returns everything needed.

## Testing

- Unit test in `home.component.spec.ts`: mock `ContentService.getTrailers()` to resolve with a fixed-length array and assert `trailerCount` is set to that length after `ngOnInit`.
- Unit test: mock `getTrailers()` to resolve `[]` and assert `trailerCount` stays `null` (so the template falls back to `100+`).
- Unit tests in `content.service.spec.ts` for `getTrailers()`: returns the parsed array on success; returns `[]` (not a rejection) on malformed JSON; repeat calls within the TTL skip the network (cache hit).
- Manual/CI verification: `ng build --configuration production` to confirm the template compiles; Karma spec runs in GitHub Actions CI per this repo's existing frontend testing constraints (this sandbox cannot run Karma locally — no browser available).
