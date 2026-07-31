#!/usr/bin/env node
/**
 * Migrates trailers from a hand-typed `name` to a derived `title`.
 *
 * The title is composed from year/make/model/size/category/GVWR, so the two new
 * inputs are `size` (parsed out of the old name, e.g. "MAXX-D 83x22 EHX" ->
 * "83x22") and `year`, which legacy names almost never carry — that one stays
 * blank for the dealer to fill in from the admin portal.
 *
 * Runs in two phases so the site is never mid-migration:
 *   expand   — adds `size` and `title`, leaving `name` in place. Safe to run
 *              before the new frontend is deployed; both fields read fine.
 *   contract — removes the now-unused `name`. Run only after the new frontend
 *              is live, since the old one renders `name` and nothing else.
 *
 * Always dry-run first. Nothing is written without --commit.
 *
 *   node scripts/migrate-title.mjs --phase=expand
 *   node scripts/migrate-title.mjs --phase=expand --commit
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { composeTitle, extractSize } from '../lambda/admin-api/trailer-title.mjs';

const TABLE = process.env.TABLE_NAME || 'VanderLeestContent';
const REGION = process.env.AWS_REGION || 'us-east-1';

const args = process.argv.slice(2);
const phase = (args.find(a => a.startsWith('--phase=')) || '').split('=')[1];
const commit = args.includes('--commit');

if (phase !== 'expand' && phase !== 'contract') {
  console.error('Usage: migrate-title.mjs --phase=expand|contract [--commit]');
  process.exit(1);
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

async function fetchTrailers() {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': 'TRAILER' },
      ExclusiveStartKey,
    }));
    items.push(...(res.Items || []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function expand(items) {
  const plan = items.map(it => {
    const d = it.data || {};
    const size = d.size || extractSize(d.name);
    // Compose from the record as it will exist after this write, not as it is.
    const title = composeTitle({ ...d, size });
    return { sk: it.sk, name: d.name || '', size, title, year: d.year || '' };
  });

  const noSize = plan.filter(p => !p.size);
  const noYear = plan.filter(p => !p.year);
  const echoesName = plan.filter(p => p.title === p.name);

  console.log(`\n${plan.length} trailers | size parsed: ${plan.length - noSize.length} | year present: ${plan.length - noYear.length}`);

  console.log('\nTITLE PREVIEW (old name -> new title)');
  for (const p of plan) {
    const flag = p.title === p.name ? '  [unchanged — no structured fields, title falls back to name]' : '';
    console.log(`\n  ${p.name || '(no name)'}\n  -> ${p.title}${flag}`);
  }

  if (noSize.length) {
    console.log(`\nNO SIZE PARSED (${noSize.length}) — these names carry no NNxNN pattern:`);
    for (const p of noSize) console.log(`    ${p.name}`);
  }
  if (echoesName.length) {
    console.log(`\nWARNING — ${echoesName.length} trailers have no make/model/size/category/GVWR at all.`);
    console.log('Their titles still fall back to the old name. Fill those in from the admin portal');
    console.log('BEFORE running --phase=contract, or they will end up with an empty heading.');
  }
  console.log(`\nYear is never parsed from a name — all ${noYear.length} blanks are filled in from the admin portal.`);

  if (!commit) {
    console.log('\nDRY RUN — nothing written. Re-run with --commit to apply.');
    return;
  }

  let n = 0;
  for (const p of plan) {
    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { pk: 'TRAILER', sk: p.sk },
      UpdateExpression: 'SET #d.#size = :size, #d.#title = :title, updatedAt = :now',
      ExpressionAttributeNames: { '#d': 'data', '#size': 'size', '#title': 'title' },
      ExpressionAttributeValues: { ':size': p.size, ':title': p.title, ':now': new Date().toISOString() },
    }));
    n++;
  }
  console.log(`\nEXPAND COMPLETE — ${n} trailers now carry size + title.`);
}

async function contract(items) {
  // Dropping `name` from a record whose title only echoes that name would leave
  // it with no heading at all, so refuse until those are filled in.
  const wouldBlank = items.filter(it => {
    const d = it.data || {};
    return !composeTitle({ ...d, name: '' });
  });

  if (wouldBlank.length) {
    console.error(`\nREFUSING TO CONTRACT — ${wouldBlank.length} trailers would be left with an empty title:`);
    for (const it of wouldBlank) console.error(`    ${it.sk} — ${(it.data || {}).name || '(no name)'}`);
    console.error('\nGive each a make, model, or size in the admin portal, then re-run.');
    process.exit(1);
  }

  console.log(`\n${items.length} trailers will have the legacy \`name\` removed.`);
  if (!commit) {
    console.log('DRY RUN — nothing written. Re-run with --commit to apply.');
    return;
  }

  let n = 0;
  for (const it of items) {
    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { pk: 'TRAILER', sk: it.sk },
      UpdateExpression: 'REMOVE #d.#name SET updatedAt = :now',
      ExpressionAttributeNames: { '#d': 'data', '#name': 'name' },
      ExpressionAttributeValues: { ':now': new Date().toISOString() },
    }));
    n++;
  }
  console.log(`\nCONTRACT COMPLETE — legacy name removed from ${n} trailers.`);
}

const items = await fetchTrailers();
console.log(`Read ${items.length} trailers from ${TABLE} (${REGION}).`);
await (phase === 'expand' ? expand(items) : contract(items));
