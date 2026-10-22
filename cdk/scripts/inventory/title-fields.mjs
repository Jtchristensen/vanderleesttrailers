#!/usr/bin/env node
/**
 * Bridge from the Python inventory sync to the shared title helpers.
 *
 * The sync is Python (it hashes photos with Pillow), but a trailer's title,
 * size, variant and model must come from the same code the admin API and the
 * frontend use, or a synced listing would read differently from one saved in
 * the admin portal. So the sync pipes records through here instead of
 * re-implementing the parsers.
 *
 * stdin:  JSON array of { op, data }
 *           op "derive"  — data.name is a cleaned WordPress title; fills model,
 *                          size and variant from it (blank fields only), then
 *                          composes title and slug.
 *           op "compose" — recomposes title from the fields as given.
 * stdout: JSON array of the resulting data objects, same order.
 */
import { composeTitle, extractSize, extractVariant } from '../../lambda/admin-api/trailer-title.mjs';
import { extractModel } from '../lib/extract-model.mjs';

/** Mirrors generateSlug in the admin API so a synced trailer gets the slug the portal would give it. */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

let input = '';
for await (const chunk of process.stdin) input += chunk;

const out = JSON.parse(input).map(({ op, data }) => {
  const d = { ...data };
  if (op === 'derive') {
    d.model = d.model || extractModel(d.make, d.name);
    d.size = d.size || extractSize(d.name);
    d.variant = d.variant || extractVariant(d.name, d);
  }
  d.title = composeTitle(d);
  if (op === 'derive') d.slugBase = generateSlug(d.title);
  return d;
});

process.stdout.write(JSON.stringify(out));
