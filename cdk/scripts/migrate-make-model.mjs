#!/usr/bin/env node
/**
 * Migrates trailer records from { brand, description } to { make, model }.
 *
 * Runs in two phases so the site is never mid-migration:
 *   expand   — adds `make` (copied from brand) and `model`, leaving brand/description in place.
 *              Safe to run before the new frontend is deployed.
 *   contract — removes the now-unused `brand` and `description` attributes.
 *              Run only after the new frontend is live.
 *
 * Always dry-run first. Nothing is written without --commit.
 *
 *   node scripts/migrate-make-model.mjs --phase=expand
 *   node scripts/migrate-make-model.mjs --phase=expand --commit
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { extractModel } from './lib/extract-model.mjs';

const TABLE = process.env.TABLE_NAME || 'VanderLeestContent';
const REGION = process.env.AWS_REGION || 'us-east-1';

const args = process.argv.slice(2);
const phase = (args.find(a => a.startsWith('--phase=')) || '').split('=')[1];
const commit = args.includes('--commit');

if (phase !== 'expand' && phase !== 'contract') {
  console.error('Usage: migrate-make-model.mjs --phase=expand|contract [--commit]');
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
    return {
      sk: it.sk,
      name: d.name,
      make: d.make || d.brand || '',
      model: d.model || extractModel(d.brand || d.make, d.name),
    };
  });

  const withModel = plan.filter(p => p.model);
  console.log(`\n${plan.length} trailers | make set: ${plan.filter(p => p.make).length} | model derived: ${withModel.length}`);

  const byMake = {};
  for (const p of plan) {
    const k = p.make || '(no make)';
    byMake[k] ||= { total: 0, withModel: 0, models: new Set(), blanks: [] };
    byMake[k].total++;
    if (p.model) { byMake[k].withModel++; byMake[k].models.add(p.model); }
    else byMake[k].blanks.push(p.name);
  }

  console.log('\nMODEL COVERAGE BY MAKE');
  for (const [make, s] of Object.entries(byMake).sort((a, b) => b[1].total - a[1].total)) {
    console.log(`\n  ${make} — ${s.withModel}/${s.total}`);
    if (s.models.size) console.log(`    models: ${[...s.models].sort().join(', ')}`);
    for (const b of s.blanks) console.log(`    (blank) ${b}`);
  }

  if (!commit) {
    console.log('\nDRY RUN — nothing written. Re-run with --commit to apply.');
    return;
  }

  let n = 0;
  for (const p of plan) {
    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { pk: 'TRAILER', sk: p.sk },
      UpdateExpression: 'SET #d.#make = :make, #d.#model = :model, updatedAt = :now',
      ExpressionAttributeNames: { '#d': 'data', '#make': 'make', '#model': 'model' },
      ExpressionAttributeValues: { ':make': p.make, ':model': p.model, ':now': new Date().toISOString() },
    }));
    n++;
  }
  console.log(`\nEXPAND COMPLETE — ${n} trailers now carry make + model.`);
}

async function contract(items) {
  const unsafe = items.filter(it => !(it.data || {}).make && (it.data || {}).brand);
  if (unsafe.length) {
    console.error(`\nREFUSING TO CONTRACT — ${unsafe.length} trailers still have brand but no make.`);
    console.error('Run --phase=expand --commit first.');
    process.exit(1);
  }

  console.log(`\n${items.length} trailers will have \`brand\` and \`description\` removed.`);
  if (!commit) {
    console.log('DRY RUN — nothing written. Re-run with --commit to apply.');
    return;
  }

  let n = 0;
  for (const it of items) {
    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { pk: 'TRAILER', sk: it.sk },
      UpdateExpression: 'REMOVE #d.#brand, #d.#description SET updatedAt = :now',
      ExpressionAttributeNames: { '#d': 'data', '#brand': 'brand', '#description': 'description' },
      ExpressionAttributeValues: { ':now': new Date().toISOString() },
    }));
    n++;
  }
  console.log(`\nCONTRACT COMPLETE — legacy fields removed from ${n} trailers.`);
}

const items = await fetchTrailers();
console.log(`Read ${items.length} trailers from ${TABLE} (${REGION}).`);
await (phase === 'expand' ? expand(items) : contract(items));
