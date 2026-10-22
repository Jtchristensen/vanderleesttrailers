#!/usr/bin/env python3
"""
Syncs trailer inventory from the dealer's legacy WordPress site into DynamoDB + S3.

The dealer still maintains listings on vanderleesttrailers.com (WordPress), so
that site is the source of truth for what is in stock and what it costs. This
script mirrors those edits into the new site WITHOUT clobbering anything that
was curated here: make/model/size/variant, hidden flags, manual sort order and
cleaned-up photo galleries all belong to the new site.

It never writes without a reviewed plan:

    plan    read-only. Fetches WordPress and the live table, works out every
            change, and writes plan.json + report.md + photo contact sheets
            into --work. Nothing is written to AWS.
    apply   executes exactly the reviewed plan.json. Refuses if any live record
            changed since the plan was made. Backs the table up first (local +
            S3), uploads photos, and only then touches DynamoDB. Never deletes
            S3 objects, so a restore from the backup is always complete.
    verify  proves the live table == backup + the planned changes, field by
            field, then checks the public API and HEADs every photo through
            CloudFront.

Decisions that need a human (a post reused for a different unit, a disputed
price, a duplicate post) live in overrides.json next to this file, so they are
reviewed in git rather than buried in a one-off run.

    python3 cdk/scripts/inventory/sync_inventory.py plan   --work /tmp/inv
    python3 cdk/scripts/inventory/sync_inventory.py apply  --work /tmp/inv
    python3 cdk/scripts/inventory/sync_inventory.py verify --work /tmp/inv

Requires: boto3, Pillow, node (for the shared title helpers).
"""
import argparse
import concurrent.futures as cf
import copy
import datetime as dt
import html as htmllib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
OVERRIDES = HERE / 'overrides.json'

WP = 'https://vanderleesttrailers.com'
TABLE = os.environ.get('TABLE_NAME', 'VanderLeestContent')
REGION = os.environ.get('AWS_REGION', 'us-east-1')
STACK = os.environ.get('STACK_NAME', 'VanderLeestTrailersStack')
STATE_KEY = 'sync/wordpress/state.json'
BACKUP_PREFIX = 'sync/backups/'
# The WordPress host 403s urllib's default agent.
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

# Fields WordPress owns. Everything else on a record belongs to the new site.
WP_FIELDS = ['price', 'msrp', 'gvwr', 'payload', 'emptyWeight', 'siding', 'category', 'year',
             'features', 'upgradedFeatures']
CATEGORY_MAP = {'equipment-haulers': 'car-equipment-haulers'}
SKIP_TERMS = {'notifications', 'template', 'uncategorized'}
MAKES = [
    (r'black\s*rhino', 'Black Rhino'), (r'rock\s*solid', 'Rock Solid Cargo'),
    (r'gator\s*made', 'Gatormade'), (r'maxx\s*-?\s*d\b', 'Maxx-D'), (r'\bretco\b', 'Retco'),
    (r'dura\s*bull', 'DuraBull'), (r'southern\s*utility', 'Southern Utility'),
]
# Sentinel: WordPress explicitly says the trailer has no siding (see wp_fields).
NO_SIDING = '<none>'
# Same photo if the 16x16 dHash differs by this many bits or fewer.
SAME_PHOTO = 4

# Dealer photos vs manufacturer studio shots, by filename (see SKILL.md).
DEALER_NAME = re.compile(r'^(img_|dsc_?|pxl_|gopr|image\d|att[._-]|[0-9a-f]{8}-[0-9a-f]{4}-|20\d{6})', re.I)
DIMENSIONED = re.compile(r'\d+\s*x\s*\d+', re.I)
MFR_NAME = re.compile(r'(\b|_)(dkx|djx|dtx|dox|ydx|lkx|ldx|tox|ehx|h9x|h5x|g6x|d6x|d6k|d9x|s3x|t8x|tdx|gsx)(\b|_)'
                      r'|gator|gatro|retco|rhino|maxx|-thumb', re.I)


# --------------------------------------------------------------------------- #
# Small utilities
# --------------------------------------------------------------------------- #

def log(*a):
    print(*a, file=sys.stderr, flush=True)


def http_get(url, retries=8):
    """GET with backoff — the dealer's host and the local DNS both blip."""
    delay = 1.0
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read(), dict(r.headers)
        except urllib.error.HTTPError as e:
            if e.code in (400, 401, 403, 404) or attempt == retries - 1:
                raise
        except Exception:
            if attempt == retries - 1:
                raise
        time.sleep(delay)
        delay = min(delay * 2, 30)


def clean_text(s):
    s = re.sub(r'<[^>]+>', ' ', s or '')
    return re.sub(r'\s+', ' ', htmllib.unescape(s)).strip()


def norm_basename(url):
    """IMG_8479-scaled.jpeg, IMG_8479-300x225.jpeg and IMG_8479.jpeg are one photo."""
    b = url.rsplit('/', 1)[-1].lower()
    b = re.sub(r'\.(jpe?g|png|webp|gif)$', '', b)
    b = re.sub(r'-\d+x\d+$', '', b)
    b = re.sub(r'-e\d{6,}$', '', b)
    return re.sub(r'-scaled$', '', b)


def now_iso():
    return dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'


def load_overrides():
    o = json.loads(OVERRIDES.read_text())
    o.setdefault('ignore_wp_posts', {})
    o.setdefault('decisions', {})
    o.setdefault('pins', {})
    return o


def aws():
    import boto3
    from botocore.config import Config
    cfg = Config(retries={'max_attempts': 10, 'mode': 'adaptive'})
    session = boto3.session.Session(region_name=REGION)
    outputs = {o['OutputKey']: o['OutputValue'] for o in session.client('cloudformation').describe_stacks(
        StackName=STACK)['Stacks'][0]['Outputs']}
    return {
        'table': session.resource('dynamodb', config=cfg).Table(TABLE),
        's3': session.client('s3', config=cfg),
        'bucket': os.environ.get('IMAGES_BUCKET', outputs['ImagesBucketName']),
        'site': os.environ.get('SITE_URL', outputs['CloudFrontURL']).rstrip('/'),
    }


def from_ddb(v):
    """boto3 hands numbers back as Decimal (e.g. sortOrder); plans and backups are plain JSON."""
    from decimal import Decimal
    if isinstance(v, dict):
        return {k: from_ddb(x) for k, x in v.items()}
    if isinstance(v, list):
        return [from_ddb(x) for x in v]
    if isinstance(v, Decimal):
        return int(v) if v == v.to_integral_value() else float(v)
    return v


def to_ddb(v):
    from decimal import Decimal
    if isinstance(v, dict):
        return {k: to_ddb(x) for k, x in v.items()}
    if isinstance(v, list):
        return [to_ddb(x) for x in v]
    if isinstance(v, float):
        return Decimal(str(v))
    return v


def read_live(table):
    items, kw = [], {}
    from boto3.dynamodb.conditions import Key
    while True:
        r = table.query(KeyConditionExpression=Key('pk').eq('TRAILER'), **kw)
        items += r['Items']
        if 'LastEvaluatedKey' not in r:
            return [from_ddb(it) for it in items]
        kw['ExclusiveStartKey'] = r['LastEvaluatedKey']


def read_state(a):
    try:
        return json.loads(a['s3'].get_object(Bucket=a['bucket'], Key=STATE_KEY)['Body'].read())
    except a['s3'].exceptions.NoSuchKey:
        return None


def node_titles(rows):
    """[{op, data}] -> [data] through title-fields.mjs (the shared title code)."""
    if not rows:
        return []
    r = subprocess.run(['node', str(HERE / 'title-fields.mjs')], input=json.dumps(rows),
                       capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


# --------------------------------------------------------------------------- #
# WordPress
# --------------------------------------------------------------------------- #

def is_junk(post):
    s, t = post['slug'], post['title']['rendered'].lower()
    return 'template' in s or 'template' in t or s.startswith('trailer-page')


def fetch_wordpress(work):
    """Posts, each post's attached media, and each post's rendered page (for its gallery)."""
    wpdir = work / 'wp'
    (wpdir / 'media').mkdir(parents=True, exist_ok=True)
    (wpdir / 'pages').mkdir(parents=True, exist_ok=True)

    posts, page, total = [], 1, 1
    while page <= total:
        body, headers = http_get(f'{WP}/wp-json/wp/v2/trailers?per_page=50&page={page}&_embed')
        posts += json.loads(body)
        total = int({k.lower(): v for k, v in headers.items()}['x-wp-totalpages'])
        page += 1
    (wpdir / 'posts.json').write_text(json.dumps(posts))
    log(f'WordPress: {len(posts)} posts')

    def one(p):
        m, _ = http_get(f"{WP}/wp-json/wp/v2/media?parent={p['id']}&per_page=100&media_type=image")
        (wpdir / 'media' / f"{p['id']}.json").write_bytes(m)
        h, _ = http_get(p['link'])
        (wpdir / 'pages' / f"{p['id']}.html").write_bytes(h)

    with cf.ThreadPoolExecutor(8) as ex:
        list(ex.map(one, posts))  # any failure raises: never plan from a partial fetch
    return posts


def parse_gallery(page_html):
    """The photos the listing page actually shows: Divi's main image, then its gallery grid, in order."""
    urls = re.findall(r'<a href="([^"]+)" class="et_pb_lightbox_image"', page_html)[:1]
    urls += re.findall(r'class="et_pb_gallery_item [^"]*"><div class="et_pb_gallery_image[^"]*">\s*<a href="([^"]+)"',
                       page_html)
    out, seen = [], set()
    for u in urls:
        if '/wp-content/uploads/' in u and norm_basename(u) not in seen:
            seen.add(norm_basename(u))
            out.append(u)
    return out


def parse_features(raw):
    """ACF feature fields are usually a <ul>, but ~30 trailers use prose + newline-separated option codes."""
    if not raw:
        return None
    li = [clean_text(x) for x in re.findall(r'<li[^>]*>(.*?)</li>', raw, re.S | re.I)]
    if li:
        return [x for x in li if x]
    text = re.sub(r'<br\s*/?>|</p>|</div>', '\n', raw, flags=re.I)
    out = []
    for line in text.split('\n'):
        line = clean_text(line)
        # Manufacturer build/spec-sheet links are not features (and there is nowhere to show them).
        if not line or 'http' in line.lower():
            continue
        for part in (line.split('•') if line.count('•') >= 2 else [line]):
            # Option codes are typed both "C17 : COUPLER" and "C17: COUPLER"; store one form.
            part = re.sub(r'\s+:', ':', part.strip(' •-–'))
            # Marketing prose is not a feature bullet.
            if not part or len(part) > 140 or (len(part.split()) >= 14 and '.' in part):
                continue
            out.append(part)
    return out


def title_year(title):
    m = re.search(r'\b(20[2-3]\d)\b', title)
    return m.group(1) if m else ''


def clean_title(title):
    """Strips the stock-status chatter the dealer types into titles ('**ON SALE**', '-ON ORDER', '2027')."""
    t = htmllib.unescape(title)
    t = re.sub(r'\*\*.*?\*\*', ' ', t)
    t = re.sub(r'[-–—\s]*\b(on order|price cut|on sale|new)\b', ' ', t, flags=re.I)
    t = re.sub(r'\b20[2-3]\d\b(\s+models)?', ' ', t, flags=re.I)
    t = re.sub(r'\s+', ' ', t).strip(' -–—|')
    return t


def wp_fields(post, year_from_title):
    """The WordPress-owned field values for a post, in the table's format (numbers stay strings).

    ACF fills trailer_siding_type with 'Charcoal Polycore' by default, even on open trailers; the
    trailer_siding yes/no flag says whether it means anything, so 'no' yields siding = NO_SIDING.
    """
    a = post.get('acf') or {}
    s = lambda v: str(v).strip() if v not in (None, False) else ''
    cats = [t['slug'] for group in post.get('_embedded', {}).get('wp:term', []) for t in group
            if t.get('taxonomy') == 'category' and t['slug'] not in SKIP_TERMS]
    # The title is what the old site shows customers; the ACF year field is often stale (2026 on a "2027 ..." post).
    year = (title_year(post['title']['rendered']) if year_from_title else '') or s(a.get('year'))
    return {
        'price': s(a.get('price')),
        'msrp': s(a.get('msrp')),
        'gvwr': s(a.get('gvwr')),
        'payload': s(a.get('payload')),
        'emptyWeight': s(a.get('empty_weight')),
        'siding': NO_SIDING if s(a.get('trailer_siding')).lower() == 'no' else s(a.get('trailer_siding_type')),
        'category': CATEGORY_MAP.get(cats[0], cats[0]) if cats else '',
        'year': year,
        'features': parse_features(a.get('standard_features')),
        'upgradedFeatures': parse_features(a.get('upgraded_features')),
    }


def make_from_title(title):
    for pat, make in MAKES:
        if re.search(pat, title, re.I):
            return make
    return ''


def is_manufacturer_photo(url):
    b = url.rsplit('/', 1)[-1]
    if DEALER_NAME.search(b) or DIMENSIONED.search(b):
        return False
    return bool(MFR_NAME.search(b))


# --------------------------------------------------------------------------- #
# Photo hashing
# --------------------------------------------------------------------------- #

class Hasher:
    """dHash cache keyed by URL. EXIF-aware: live originals are stored rotated (orientation 6)."""

    def __init__(self, work):
        self.path = work / 'hashes.json'
        self.cache = json.loads(self.path.read_text()) if self.path.exists() else {}

    def _hash(self, url):
        from PIL import Image, ImageOps
        body, _ = http_get(url)
        im = ImageOps.exif_transpose(Image.open(io.BytesIO(body))).convert('L').resize((17, 16), Image.LANCZOS)
        px = list(im.get_flattened_data() if hasattr(im, "get_flattened_data") else im.getdata())
        bits = 0
        for row in range(16):
            for col in range(16):
                bits = (bits << 1) | (px[row * 17 + col] > px[row * 17 + col + 1])
        return format(bits, '064x')

    def many(self, urls):
        todo = [u for u in dict.fromkeys(urls) if u not in self.cache]
        with cf.ThreadPoolExecutor(8) as ex:
            for u, h in zip(todo, ex.map(self._hash, todo)):
                self.cache[u] = h
        self.path.write_text(json.dumps(self.cache))
        return [self.cache[u] for u in urls]

    @staticmethod
    def dist(a, b):
        return bin(int(a, 16) ^ int(b, 16)).count('1')


# --------------------------------------------------------------------------- #
# plan
# --------------------------------------------------------------------------- #

def cmd_plan(args):
    work = Path(args.work)
    work.mkdir(parents=True, exist_ok=True)
    o = load_overrides()
    a = aws()
    state = read_state(a)
    since = args.since or (state or {}).get('lastSyncAt')
    if not since:
        sys.exit('No sync state in S3 yet — pass --since YYYY-MM-DD (date of the last full sync).')
    year_from_title = o.get('year_from_title', False)

    if args.reuse_fetch and (work / 'wp' / 'posts.json').exists():
        posts = json.loads((work / 'wp' / 'posts.json').read_text())  # iterate on decisions without re-crawling
    else:
        posts = fetch_wordpress(work)
    posts = [p for p in posts if not is_junk(p)]
    live_items = read_live(a['table'])
    live = {it['sk']: it for it in live_items}
    log(f'Live: {len(live)} trailers | photos new since {since} get hash-checked')

    media = {p['id']: json.loads((work / 'wp' / 'media' / f"{p['id']}.json").read_text()) for p in posts}
    media_by_name = {}
    for items in media.values():
        for m in items:
            media_by_name.setdefault(norm_basename(m['source_url']), m)
    galleries = {p['id']: parse_gallery((work / 'wp' / 'pages' / f"{p['id']}.html").read_text(errors='replace'))
                 for p in posts}

    def gallery_media(pid):
        """Gallery as [{url (download), thumb (hashing), date, name}] — prefers WP's 2560px 'scaled' copy."""
        out = []
        for href in galleries[pid]:
            m = media_by_name.get(norm_basename(href))
            sizes = (m or {}).get('media_details', {}).get('sizes', {})
            thumb = (sizes.get('medium_large') or sizes.get('large') or {}).get('source_url')
            out.append({
                'url': m['source_url'] if m else href,
                'thumb': thumb or (m['source_url'] if m else href),
                'date': m['date_gmt'] if m else None,
                'name': href.rsplit('/', 1)[-1],
            })
        return out

    # ---- match posts to live records: saved mapping, then original publish date, then slug
    by_date = {}
    for sk, it in live.items():
        by_date.setdefault((it['data'].get('publishedAt') or '')[:19], []).append(sk)
    saved = {str(k): v['slug'] for k, v in ((state or {}).get('posts') or {}).items()}
    match, claimed = {}, set()
    for p in posts:
        pid = str(p['id'])
        cands = [saved[pid]] if saved.get(pid) in live else by_date.get(p['date_gmt'][:19], [])
        if len(cands) != 1 and p['slug'] in live:
            cands = [p['slug']]
        if len(cands) == 1 and cands[0] not in claimed:
            match[pid] = cands[0]
            claimed.add(cands[0])

    hasher = Hasher(work)
    plan = {'createdAt': now_iso(), 'since': since, 'table': TABLE, 'bucket': a['bucket'],
            'firstRun': state is None, 'changes': [], 'review': [], 'notes': []}
    new_slugs = set(live)

    def review(kind, msg, **extra):
        plan['review'].append({'kind': kind, 'message': msg, **extra})

    posts_to_create = []

    # ---- existing trailers
    for p in posts:
        pid = str(p['id'])
        if pid not in match:
            continue
        sk = match[pid]
        before = live[sk]
        d = copy.deepcopy(before['data'])
        wf = wp_fields(p, year_from_title)
        base = ((state or {}).get('posts') or {}).get(pid, {}).get('fields')
        pins = {k: v for k, v in o['pins'].get(sk, {}).items() if not k.startswith('_')}
        diffs = []

        for f in WP_FIELDS:
            new, cur = wf[f], d.get(f)
            if f in pins:
                if pins[f] != cur:
                    diffs.append({'field': f, 'from': cur, 'to': pins[f], 'why': 'pinned in overrides.json'})
                    d[f] = pins[f]
                continue
            if new == NO_SIDING:
                # Only clear an existing value when overrides.json opts in; a new listing never gets one.
                new = '' if o.get('clear_siding_when_flag_no') else None
            # Blank on WordPress means "no information", never "erase it here" (bar the siding flag above).
            if new is None or new == cur or (new in ('', []) and f != 'siding'):
                continue
            if base is not None:
                old = base.get(f)
                if new == old:
                    continue  # WordPress unchanged since last sync; any difference is an edit made here
                if cur != old and cur not in (None, ''):
                    review('conflict', f'{sk}: {f} edited on both sides since last sync — kept the live value',
                           slug=sk, wp_id=pid, field=f, live=cur, wordpress=new, last_sync=old)
                    continue
            diffs.append({'field': f, 'from': cur, 'to': new, 'why': 'changed on WordPress'})
            d[f] = new

        # ---- photos: only hash-check when the page shows photos uploaded since the last sync
        gal = gallery_media(p['id'])
        fresh = [g for g in gal if not g['date'] or g['date'] >= since]
        image_plan = None
        if fresh:
            live_urls = [a['site'] + u for u in d.get('images', [])]
            lh = hasher.many(live_urls)
            gh = hasher.many([g['thumb'] for g in gal])
            seen_live = [any(Hasher.dist(h, x) <= SAME_PHOTO for x in lh) for h in gh]
            if gal and not any(seen_live):
                decision = o['decisions'].get(pid)
                cleaned = clean_title(p['title']['rendered'])
                info = dict(slug=sk, wp_id=pid, wp_title=htmllib.unescape(p['title']['rendered']),
                            live_title=d.get('title'), gallery=len(gal))
                if decision is None:
                    review('replaced-unit',
                           f'{sk}: every photo on the WordPress page is new — the post was reused for another '
                           f'unit. Left untouched until overrides.json decides: "replace-photos" (same listing, '
                           f'new unit), "new-listing" (old one sold; retire it, create a fresh one) or "keep".',
                           **info)
                    continue
                if decision == 'keep':
                    plan['notes'].append(f'{sk}: replaced-unit post {pid} kept as-is (overrides.json)')
                    continue
                if decision == 'new-listing':
                    plan['changes'].append({'action': 'delete', 'slug': sk, 'wp_id': pid,
                                            'before': before, 'why': f'WordPress post {pid} now lists a different unit'})
                    posts_to_create.append(p)
                    continue
                if decision == 'replace-photos':
                    image_plan = {'mode': 'replace', 'add': keep_photos(gal, gh)}
                    plan['notes'].append(f'{sk}: photos replaced with the new unit\'s (overrides.json)')
            else:
                added = [(g, h) for g, h, s in zip(gal, gh, seen_live) if not s]
                if added:
                    image_plan = {'mode': 'append', 'add': keep_photos([g for g, _ in added], [h for _, h in added],
                                                                       existing=lh)}

        if image_plan and image_plan['add']['keep']:
            diffs.append({'field': 'images', 'from': len(d.get('images', [])),
                          'to': f"{image_plan['mode']} {len(image_plan['add']['keep'])}", 'why': 'new photos on WordPress'})

        if diffs or image_plan:
            plan['changes'].append({'action': 'update', 'slug': sk, 'wp_id': pid, 'before': before,
                                    'after': d, 'diffs': diffs, 'images': image_plan})

    # ---- WordPress posts with no live record
    for p in posts:
        pid = str(p['id'])
        if pid in match:
            continue
        if pid in o['ignore_wp_posts']:
            plan['notes'].append(f"WP {pid} ignored: {o['ignore_wp_posts'][pid]}")
            continue
        mine = {norm_basename(u) for u in galleries[p['id']]}
        dup = None
        for q in posts:
            if q['id'] != p['id'] and str(q['id']) in match:
                theirs = {norm_basename(u) for u in galleries[q['id']]}
                if mine and len(mine & theirs) >= len(mine) / 2:
                    dup = q
                    break
        if dup:
            review('duplicate-post', f"WP {pid} shares most of its photos with WP {dup['id']} "
                   f"({match[str(dup['id'])]}) — skipped. Add it to ignore_wp_posts to silence this.",
                   wp_id=pid, wp_title=htmllib.unescape(p['title']['rendered']))
            continue
        posts_to_create.append(p)

    rows = []
    for p in posts_to_create:
        title = htmllib.unescape(p['title']['rendered'])
        cleaned = clean_title(title)
        wf = wp_fields(p, True)  # a brand-new listing takes the year from its title
        data = {'name': cleaned, 'make': make_from_title(cleaned), 'model': '', 'size': '', 'variant': '',
                'publishedAt': p['date_gmt'] + 'Z', 'images': []}
        for f in WP_FIELDS:
            data[f] = wf[f] if wf[f] is not None else []
        if data['siding'] == NO_SIDING:
            data['siding'] = ''
        # New listings are pinned by post id ("wp:<id>"): their slug does not exist until derived.
        data.update({k: v for k, v in o['pins'].get(f"wp:{p['id']}", {}).items() if not k.startswith('_')})
        rows.append({'op': 'derive', 'data': data})
    derived = node_titles(rows)

    for p, data in zip(posts_to_create, derived):
        pid = str(p['id'])
        base = data.pop('slugBase')
        slug = base
        for n in range(2, 21):
            if slug not in new_slugs:
                break
            slug = f'{base[:76]}-{n}'
        new_slugs.add(slug)
        data['slug'] = slug
        gal = gallery_media(p['id'])
        gh = hasher.many([g['thumb'] for g in gal])
        photos = keep_photos(gal, gh)
        plan['changes'].append({'action': 'create', 'slug': slug, 'wp_id': pid, 'after': data,
                                'wp_title': htmllib.unescape(p['title']['rendered']),
                                'images': {'mode': 'replace', 'add': photos}})
        if not data['make']:
            review('incomplete', f'{slug}: no make recognised in "{data["name"]}" — fill it in after sync',
                   slug=slug, wp_id=pid)

    # ---- live records whose post is gone from WordPress (sold)
    matched_slugs = set(match.values())
    for sk, it in live.items():
        if sk in matched_slugs:
            continue
        if o['decisions'].get(f'live:{sk}') == 'keep':
            plan['notes'].append(f'{sk}: not on WordPress, kept (overrides.json)')
            continue
        plan['changes'].append({'action': 'delete', 'slug': sk, 'before': it,
                                'why': 'no longer listed on WordPress (sold or withdrawn)'})

    # ---- assign S3 keys for photos and finish the records
    for c in plan['changes']:
        if c['action'] == 'delete' or not c.get('images'):
            continue
        img = c['images']
        existing = c['after'].get('images', []) if img['mode'] == 'append' else []
        # Number past every key already in the folder — including orphans of an older listing with this
        # slug — so an upload can never be mistaken for (or overwrite) a photo that is already there.
        prefix = f"uploads/trailers/{c['slug']}/"
        stored = [o['Key'] for page in a['s3'].get_paginator('list_objects_v2').paginate(Bucket=a['bucket'], Prefix=prefix)
                  for o in page.get('Contents', [])]
        taken = [int(m.group(1)) for u in stored + c['after'].get('images', [])
                 for m in [re.search(r'/(\d+)\.\w+$', u)] if m]
        n = max(taken, default=0)
        uploads = []
        for g in img['add']['keep']:
            n += 1
            ext = re.search(r'\.(jpe?g|png|webp)$', g['url'], re.I)
            ext = ext.group(1).lower() if ext else 'jpg'
            key = f"uploads/trailers/{c['slug']}/{n}.{ext}"
            uploads.append({'src': g['url'], 'key': key, 'name': g['name']})
        img['uploads'] = uploads
        c['after']['images'] = existing + ['/' + u['key'] for u in uploads]

    # Recompose titles through the shared helper (a year or category change alters the heading).
    upd = [c for c in plan['changes'] if c['action'] in ('update', 'create')]
    for c, data in zip(upd, node_titles([{'op': 'compose', 'data': c['after']} for c in upd])):
        if c['action'] == 'update' and data['title'] != c['after'].get('title'):
            c['diffs'].append({'field': 'title', 'from': c['after'].get('title'), 'to': data['title'],
                               'why': 'recomposed from changed fields'})
        c['after'] = data

    plan['matchedPosts'] = {pid: sk for pid, sk in match.items()}
    plan['wpBaseline'] = {str(p['id']): {'fields': wp_fields(p, year_from_title)} for p in posts}
    (work / 'plan.json').write_text(json.dumps(plan, indent=1, default=str))
    write_report(work, plan, a['site'])
    contact_sheets(work, plan, a['site'])
    log(f'\nPlan written: {work / "plan.json"}\nReport:       {work / "report.md"}\nSheets:       {work / "sheets"}')


def keep_photos(gal, hashes, existing=()):
    """Drops manufacturer studio shots and repeat photos; keeps page order (so the cover stays first)."""
    keep, dropped, kept_hashes = [], [], list(existing)
    for g, h in zip(gal, hashes):
        if is_manufacturer_photo(g['url']):
            dropped.append({**g, 'reason': 'manufacturer photo'})
        elif any(Hasher.dist(h, k) <= SAME_PHOTO for k in kept_hashes):
            dropped.append({**g, 'reason': 'duplicate photo'})
        else:
            keep.append({**g, 'hash': h})
            kept_hashes.append(h)
    return {'keep': keep, 'dropped': dropped}


def write_report(work, plan, site):
    by = lambda act: [c for c in plan['changes'] if c['action'] == act]
    L = [f"# Inventory sync plan — {plan['createdAt']}", '',
         f"Photos uploaded to WordPress since **{plan['since']}** were hash-checked. "
         f"{'First run: no saved baseline, so WordPress wins every differing field unless pinned.' if plan['firstRun'] else ''}",
         '', f"- updates: {len(by('update'))}", f"- new listings: {len(by('create'))}",
         f"- removals: {len(by('delete'))}", f"- needs review: {len(plan['review'])}", '']
    if plan['review']:
        L += ['## Needs a decision (left untouched until overrides.json says otherwise)', '']
        L += [f"- **{r['kind']}** — {r['message']}" for r in plan['review']] + ['']
    L += ['## New listings', '']
    for c in by('create'):
        d = c['after']
        L.append(f"- **{d['title']}** `{c['slug']}` (WP {c['wp_id']}: {c['wp_title']}) — ${d.get('price')}"
                 f"{' MSRP $' + d['msrp'] if d.get('msrp') else ''} | {d.get('category')} | "
                 f"{len(c['images']['add']['keep'])} photos, {len(c['images']['add']['dropped'])} dropped")
    L += ['', '## Removals', '']
    L += [f"- `{c['slug']}` — {c['before']['data'].get('title')} (${c['before']['data'].get('price')}) — {c['why']}"
          for c in by('delete')]
    L += ['', '## Updates', '']
    for c in by('update'):
        L.append(f"- `{c['slug']}`")
        for x in c['diffs']:
            fr, to = x['from'], x['to']
            if isinstance(fr, list) or isinstance(to, list):
                fr, to = f'{len(fr or [])} items', f'{len(to or [])} items'
            L.append(f"    - {x['field']}: {fr!r} → {to!r} ({x['why']})")
    if plan['notes']:
        L += ['', '## Notes', ''] + [f'- {n}' for n in plan['notes']]
    (work / 'report.md').write_text('\n'.join(L) + '\n')


def contact_sheets(work, plan, site):
    """One JPEG per listing whose photos change, so a human can eyeball every photo before apply."""
    from PIL import Image, ImageDraw, ImageOps
    out = work / 'sheets'
    shutil.rmtree(out, ignore_errors=True)  # sheets from an earlier plan would mislead the review
    out.mkdir()

    def thumb(url):
        try:
            body, _ = http_get(url)
            im = ImageOps.exif_transpose(Image.open(io.BytesIO(body))).convert('RGB')
            im.thumbnail((260, 260))
            return im
        except Exception:
            return Image.new('RGB', (260, 260), 'red')

    for c in plan['changes']:
        img = c.get('images')
        if not img:
            continue
        tiles = []
        if img['mode'] == 'append':
            tiles += [(f'LIVE {i + 1}', site + u) for i, u in enumerate(c['before']['data'].get('images', []))]
        tiles += [(f"ADD {g['name'][:26]}", g['thumb']) for g in img['add']['keep']]
        tiles += [(f"DROP ({g['reason']}) {g['name'][:14]}", g['thumb']) for g in img['add']['dropped']]
        with cf.ThreadPoolExecutor(8) as ex:
            ims = list(ex.map(thumb, [u for _, u in tiles]))
        cols = 6
        rows = (len(ims) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * 270, rows * 290 + 30), 'white')
        dr = ImageDraw.Draw(sheet)
        dr.text((6, 8), f"{c['action'].upper()} {c['slug']} — {c['after'].get('title', '')}"[:200], fill='black')
        for i, (im, (label, _)) in enumerate(zip(ims, tiles)):
            x, y = (i % cols) * 270 + 5, (i // cols) * 290 + 30
            sheet.paste(im, (x, y))
            dr.text((x, y + 264), label, fill='red' if label.startswith('DROP') else 'black')
        sheet.save(out / f"{c['action']}_{c['slug'][:70]}.jpg", quality=80)


# --------------------------------------------------------------------------- #
# apply
# --------------------------------------------------------------------------- #

def cmd_apply(args):
    work = Path(args.work)
    plan = json.loads((work / 'plan.json').read_text())
    a = aws()
    from boto3.dynamodb.conditions import Attr

    if plan['table'] != TABLE or plan['bucket'] != a['bucket']:
        sys.exit('Plan was made against a different table/bucket.')

    live_items = read_live(a['table'])
    live = {it['sk']: it for it in live_items}

    # The plan is only valid against the exact records it was computed from.
    stale = []
    for c in plan['changes']:
        if c['action'] in ('update', 'delete'):
            cur = live.get(c['slug'])
            if cur is None or cur != c['before']:
                stale.append(c['slug'])
        elif c['action'] == 'create' and c['slug'] in live:
            stale.append(c['slug'])
    if stale:
        sys.exit(f'REFUSING: {len(stale)} records changed since the plan was made ({", ".join(stale[:5])}...). '
                 'Re-run plan.')

    deletes = [c for c in plan['changes'] if c['action'] == 'delete']
    if len(deletes) > max(10, len(live) // 10) and not args.allow_mass_delete:
        sys.exit(f'REFUSING: plan deletes {len(deletes)} of {len(live)} trailers. Pass --allow-mass-delete if real.')

    # Backup first — locally, in the repo's (gitignored) backups/, and in S3.
    stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = json.dumps(live_items, indent=1, default=str)
    (work / f'backup-{stamp}.json').write_text(backup)
    (REPO / 'backups').mkdir(exist_ok=True)
    (REPO / 'backups' / f'trailers-backup-{stamp}.json').write_text(backup)
    a['s3'].put_object(Bucket=a['bucket'], Key=f'{BACKUP_PREFIX}trailers-{stamp}.json', Body=backup.encode(),
                       ContentType='application/json')
    (work / 'last-backup.txt').write_text(f'trailers-backup-{stamp}.json')
    log(f'Backed up {len(live_items)} trailers -> backups/trailers-backup-{stamp}.json and s3://{a["bucket"]}/{BACKUP_PREFIX}')

    # Photos before records, so no record ever points at a missing photo.
    uploads = [u for c in plan['changes'] if c.get('images') for u in c['images'].get('uploads', [])]

    def put(u):
        try:
            a['s3'].head_object(Bucket=a['bucket'], Key=u['key'])
            return None  # already there from an interrupted run
        except Exception:
            pass
        body, _ = http_get(u['src'])
        ext = u['key'].rsplit('.', 1)[-1]
        ctype = {'png': 'image/png', 'webp': 'image/webp'}.get(ext, 'image/jpeg')
        a['s3'].put_object(Bucket=a['bucket'], Key=u['key'], Body=body, ContentType=ctype)
        return None

    failures = []
    with cf.ThreadPoolExecutor(6) as ex:
        futs = {ex.submit(put, u): u for u in uploads}
        for f in cf.as_completed(futs):
            try:
                f.result()
            except Exception as e:
                failures.append(f"{futs[f]['key']}: {e}")
    log(f'Photos: {len(uploads) - len(failures)}/{len(uploads)} uploaded')
    if failures:
        sys.exit('Photo upload failures — NOTHING written to DynamoDB. Re-run apply (it resumes):\n  '
                 + '\n  '.join(failures))

    stamp_iso = now_iso()
    done, errors = 0, []
    for c in plan['changes']:
        try:
            if c['action'] == 'update':
                a['table'].put_item(Item=to_ddb({'pk': 'TRAILER', 'sk': c['slug'], 'data': c['after'], 'updatedAt': stamp_iso}),
                                    ConditionExpression=Attr('updatedAt').eq(c['before']['updatedAt']))
            elif c['action'] == 'create':
                a['table'].put_item(Item=to_ddb({'pk': 'TRAILER', 'sk': c['slug'], 'data': c['after'], 'updatedAt': stamp_iso}),
                                    ConditionExpression=Attr('sk').not_exists())
            else:
                continue
            done += 1
        except Exception as e:
            errors.append(f"{c['action']} {c['slug']}: {e}")
    # Deletions last, and only on a clean run: a failed write must never look like a sold trailer.
    if not errors:
        for c in deletes:
            try:
                a['table'].delete_item(Key={'pk': 'TRAILER', 'sk': c['slug']},
                                       ConditionExpression=Attr('updatedAt').eq(c['before']['updatedAt']))
                done += 1
            except Exception as e:
                errors.append(f"delete {c['slug']}: {e}")
    log(f'DynamoDB: {done} writes')
    if errors:
        sys.exit('Errors (deletions skipped if any write failed):\n  ' + '\n  '.join(errors))

    created = {c['wp_id']: c['slug'] for c in plan['changes'] if c['action'] == 'create'}
    state = {'lastSyncAt': plan['createdAt'][:10], 'syncedAt': stamp_iso,
             'posts': {pid: {'slug': created.get(pid) or plan['matchedPosts'].get(pid), **plan['wpBaseline'][pid]}
                       for pid in plan['wpBaseline']}}
    a['s3'].put_object(Bucket=a['bucket'], Key=STATE_KEY, Body=json.dumps(state).encode(),
                       ContentType='application/json')
    log(f'Saved sync baseline -> s3://{a["bucket"]}/{STATE_KEY}\nNow run: verify --work {work}')


# --------------------------------------------------------------------------- #
# verify
# --------------------------------------------------------------------------- #

def check_api(site, plan, expected):
    out = []
    api = json.loads(http_get(f'{site}/api/trailers')[0])
    visible = [sk for sk, d in expected.items() if not d.get('hidden')]
    if len(api) != len(visible):
        out.append(f'public API lists {len(api)} trailers, expected {len(visible)} visible')
    for c in plan['changes']:
        if c['action'] in ('update', 'create') and not c['after'].get('hidden'):
            try:
                got = json.loads(http_get(f"{site}/api/trailers/{c['slug']}", retries=3)[0])
            except urllib.error.HTTPError as e:
                out.append(f"API {c['slug']}: HTTP {e.code}")
                continue
            for k in ('title', 'price', 'msrp', 'gvwr', 'category', 'siding', 'year', 'images'):
                if (got.get(k) or '') != (c['after'].get(k) or ''):
                    out.append(f"API {c['slug']}: {k} = {got.get(k)!r}, expected {c['after'].get(k)!r}")
        elif c['action'] == 'delete':
            # CloudFront's SPA fallback turns the API's 404 into 200 + index.html, so "gone" means "not JSON".
            try:
                body, headers = http_get(f"{site}/api/trailers/{c['slug']}", retries=1)
                if 'json' in {k.lower(): v for k, v in headers.items()}.get('content-type', ''):
                    out.append(f"API still serves deleted {c['slug']}")
            except urllib.error.HTTPError:
                pass
    return out


def cmd_verify(args):
    work = Path(args.work)
    plan = json.loads((work / 'plan.json').read_text())
    a = aws()
    backup_name = (work / 'last-backup.txt').read_text().strip()
    backup = {it['sk']: it for it in json.loads((REPO / 'backups' / backup_name).read_text())}
    live = {it['sk']: it for it in read_live(a['table'])}
    problems = []

    # 1. live == backup + exactly the planned changes
    expected = {sk: it['data'] for sk, it in backup.items()}
    for c in plan['changes']:
        if c['action'] == 'delete':
            expected.pop(c['slug'], None)
        else:
            expected[c['slug']] = c['after']
    for sk in set(expected) | set(live):
        if sk not in live:
            problems.append(f'missing from table: {sk}')
        elif sk not in expected:
            problems.append(f'unexpected record: {sk}')
        elif live[sk]['data'] != expected[sk]:
            diff = sorted(k for k in set(live[sk]['data']) | set(expected[sk])
                          if live[sk]['data'].get(k) != expected[sk].get(k))
            problems.append(f'{sk}: fields differ from plan: {diff}')
    log(f'Table: {len(live)} trailers, expected {len(expected)}')

    # 2. public API. CloudFront caches it (max TTL 300s) and ignores query strings, so retry until it catches up.
    for attempt in range(7):
        api_problems = check_api(a['site'], plan, expected)
        if not api_problems:
            break
        log(f'API not caught up yet ({len(api_problems)} differences) — retrying in 60s')
        time.sleep(60)
    problems += api_problems

    # 3. every photo of every trailer resolves through CloudFront
    urls = [a['site'] + u for d in expected.values() for u in d.get('images', [])]

    def head(u):
        req = urllib.request.Request(u, method='HEAD', headers={'User-Agent': UA})
        for attempt in range(5):
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    return None if r.status == 200 and r.headers.get('Content-Type', '').startswith('image/') \
                        else f'{u}: {r.status} {r.headers.get("Content-Type")}'
            except urllib.error.HTTPError as e:
                return f'{u}: {e.code}'
            except Exception as e:
                if attempt == 4:
                    return f'{u}: {e}'
                time.sleep(2)

    with cf.ThreadPoolExecutor(16) as ex:
        bad = [r for r in ex.map(head, urls) if r]
    log(f'Photos: {len(urls) - len(bad)}/{len(urls)} OK through CloudFront')
    problems += bad
    empty = [sk for sk, d in expected.items() if not d.get('images') and not d.get('hidden')]
    if empty:
        log(f'Note: {len(empty)} visible trailers have no photos: {empty}')

    if problems:
        print('VERIFY FAILED:\n  ' + '\n  '.join(problems))
        sys.exit(1)
    print(f'VERIFY PASSED — {len(live)} trailers match the plan exactly; API and all {len(urls)} photos OK.')


def cmd_restore(args):
    """Puts the table back exactly as a backup file has it. Photos need no restore: apply never deletes any."""
    a = aws()
    backup = {it['sk']: it for it in json.loads(Path(args.backup).read_text())}
    live = {it['sk']: it for it in read_live(a['table'])}
    extra = sorted(set(live) - set(backup))
    changed = sorted(sk for sk in backup if live.get(sk) != backup[sk])
    print(f'Restore {args.backup}: rewrite {len(changed)} records, delete {len(extra)} not in the backup.')
    if not args.yes:
        print('Dry run. Re-run with --yes to restore.')
        return
    with a['table'].batch_writer() as bw:
        for sk in changed:
            bw.put_item(Item=to_ddb(backup[sk]))
        for sk in extra:
            bw.delete_item(Key={'pk': 'TRAILER', 'sk': sk})
    print('Restored. (The S3 sync baseline still reflects the undone run — delete it or re-run plan with --since.)')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('plan')
    p.add_argument('--work', required=True)
    p.add_argument('--since', help='YYYY-MM-DD of the last sync (only needed before the first saved baseline)')
    p.add_argument('--reuse-fetch', action='store_true', help='reuse the WordPress crawl already in --work')
    p = sub.add_parser('apply')
    p.add_argument('--work', required=True)
    p.add_argument('--allow-mass-delete', action='store_true')
    p = sub.add_parser('verify')
    p.add_argument('--work', required=True)
    p = sub.add_parser('restore')
    p.add_argument('--backup', required=True, help='a backups/trailers-backup-*.json file written by apply')
    p.add_argument('--yes', action='store_true')
    args = ap.parse_args()
    {'plan': cmd_plan, 'apply': cmd_apply, 'verify': cmd_verify, 'restore': cmd_restore}[args.cmd](args)


if __name__ == '__main__':
    main()
