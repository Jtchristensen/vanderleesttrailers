---
name: update-inventory
description: Re-sync the trailer inventory from the dealer's old WordPress site (vanderleesttrailers.com) into the live site's DynamoDB table and S3 photos. Use when asked to update, refresh, re-scrape or sync inventory, prices, new trailers, sold trailers or photos from the old site.
---

# Update inventory from the old WordPress site

The dealer still edits listings on the legacy WordPress site, so it is the source of truth for **what is in
stock, prices, specs and photos**. The new site owns everything curated after import: make/model/size/variant,
`hidden`, manual `sortOrder`, cleaned-up galleries. `cdk/scripts/inventory/sync_inventory.py` merges the two
without letting either clobber the other.

The user cares most that **no inventory gets messed up**. Never skip the review steps below, never write to
AWS outside `apply`, and look at the photos yourself.

## Prerequisites

- AWS CLI default profile → account 975050278082, us-east-1 (`aws sts get-caller-identity`). The CLI user
  needs DynamoDB write + S3 write on the images bucket (it has `AmazonS3FullAccess` as of 2026-10).
- `python3` with `boto3` and `Pillow` (`pip3 install boto3 pillow`), and `node`.
- Run Python with `-P`, not `-I`: `-I` hides the user site-packages where Pillow lives.
- Use a work dir outside the repo (the session scratchpad), e.g. `W=<scratchpad>/inventory-YYYYMMDD`.

## 1. Plan (read-only)

```bash
python3 -P cdk/scripts/inventory/sync_inventory.py plan --work "$W"
```

It crawls WordPress (posts, attached media, and every listing **page**), reads the live table, and writes
`$W/report.md`, `$W/plan.json` and `$W/sheets/*.jpg`. It takes ~2 minutes. While you iterate on
`overrides.json`, add `--reuse-fetch` to skip the crawl. The first time (no saved baseline in S3) it needs
`--since YYYY-MM-DD`, the date of the previous sync.

## 2. Review — every time, by hand

1. Read `report.md` top to bottom. Expect to see: price changes, new listings, removals (sold), photo changes.
2. **Needs a decision** items are left untouched until resolved in `overrides.json`:
   - `replaced-unit`: the dealer reused a post for a newly arrived unit (every photo on the page is new).
     Look at its sheet and compare the old-site title against the live title. Use `replace-photos` for the
     same model as a new unit, `new-listing` when it is now a different trailer (another size/colour; the old
     listing is retired and a fresh one gets a correct slug), or `keep`.
   - `conflict`: a field was edited both in the admin portal and on WordPress since the last sync. Ask the
     user which wins, then pin the answer.
   - `duplicate-post`: the old site has the same trailer twice. Add it to `ignore_wp_posts`.
3. **Open every image in `sheets/`** with the Read tool. Every photo must show the right trailer; none may
   be a manufacturer studio shot (grey seamless background, watermark) or a different unit.
4. Run a sanity check over `plan.json` for anything the report wording could hide:
   - updates may only change `price msrp gvwr payload emptyWeight siding category year features
     upgradedFeatures title images`;
   - price moves over ~15%, `msrp <= price`, and empty `make`/`gvwr` on new listings.
5. Ask the user about anything that is a business call (which price wins, retiring a listing). Record each
   decision in `overrides.json` **with a `_why`**, then re-plan with `--reuse-fetch` until `needs review: 0`
   and the report reads right.

## 3. Apply

```bash
python3 -P cdk/scripts/inventory/sync_inventory.py apply --work "$W"
```

Apply runs in this order:

1. It refuses if any live record changed since the plan was made. If so, re-run plan.
2. It backs up the whole table to `backups/trailers-backup-<ts>.json` (gitignored) and to
   `s3://<images bucket>/sync/backups/`.
3. It uploads photos first, resuming and skipping any already there. If any upload fails, nothing is written.
4. It writes the DynamoDB records, each conditional on the record being unchanged.
5. It deletes sold trailers last, and only if every write succeeded.
6. It saves the WordPress baseline to `s3://…/sync/wordpress/state.json`. The next plan uses it for 3-way
   merges and as the photo cut-off date.

## 4. Verify

```bash
python3 -P cdk/scripts/inventory/sync_inventory.py verify --work "$W"
```

Must print `VERIFY PASSED`. It proves the table equals the backup plus exactly the planned changes. It also
checks that the public API (`/api/trailers`, through CloudFront's 60s cache, so wait a minute after apply)
lists the right count and serves each changed listing correctly, and it HEADs **every** photo of **every**
trailer.

Then check by hand in the browser (the site is `https://d3jcsvpfdt5k9f.cloudfront.net`): the inventory page,
a couple of new listings, one listing with a photo swap, and one with a price change.

## 5. Finish

- Commit any `overrides.json` changes, so the decisions are in git for the next run.
- Tell the user what changed: counts, the new listings, the removed (sold) listings, and anything left for them.

## If something went wrong

```bash
python3 -P cdk/scripts/inventory/sync_inventory.py restore --backup backups/trailers-backup-<ts>.json        # dry run
python3 -P cdk/scripts/inventory/sync_inventory.py restore --backup backups/trailers-backup-<ts>.json --yes
```

`apply` never deletes S3 objects, so restoring the table is a complete rollback. Afterwards, delete
`sync/wordpress/state.json` (or re-plan with `--since`) so the next run doesn't trust the undone baseline.

## Things that have bitten us

- **The WordPress host 403s Python's default User-Agent.** The script sends a browser UA; any ad-hoc fetch
  must too (curl's default works).
- **A listing's photos are its page gallery, not its attached media.** Divi renders `et_pb_lightbox_image`
  (the cover) plus `et_pb_gallery_item` links. Reused posts keep the old unit's photos attached but hidden.
  Some galleries also use photos attached to other posts, which the July 2026 sync missed.
- **Posts get reused for new units**: same slug and publish date, new photos and sometimes a new title. That
  is why matching uses the saved post→slug map / original publish date, and photo hashes catch the swap.
- **ACF defaults:** `trailer_siding_type` is "Charcoal Polycore" on almost every post. It only means something
  when `trailer_siding` is "yes". The year field is often stale, and the dealer puts the year in the title.
- **Option codes** come as prose plus newline lists, not just `<ul>`. Manufacturer build/spec links are dropped.
- **Duplicate posts** exist on WordPress (see `ignore_wp_posts`). New posts that share most of their photos
  with an existing one are flagged.
- **Photo hashing must be EXIF-aware**: live originals are stored rotated (orientation 6).
- **Known bad WordPress values** are pinned in `overrides.json` (e.g. the 20'+5' Gatormade with GVWR 1500).
