#!/usr/bin/env node
/*
 * build-site-config.mjs — BESPOKE per-site UE authoring-config builder.
 *
 * ⚠️ PoC / demonstration only.
 * This script exists ONLY to fake "per-site block collections" from a single
 * shared codebase. It assembles a separate component-definition/models/filters
 * set for EACH site, then copies ONE of them to the canonical files that Edge
 * Delivery actually serves.
 *
 * THE WALL it demonstrates: a single deployed code ref serves exactly ONE
 * component-*.json. There is no per-site override
 * (see https://www.aem.live/developer/repoless-multisite-manager). To serve
 * another site's config you need another branch/deploy — i.e. your "one repo"
 * quietly becomes one branch per site.
 *
 * With a repo per site NONE of this exists: each repo has its own
 * component-*.json natively.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Every brand added here multiplies the config surface below.
const SITES = ['mlc', 'plum'];
// Only ONE site's config can be served from a single code ref/branch.
const SERVED = process.env.SITE || 'mlc';
const KINDS = ['definition', 'models', 'filters'];
const bin = resolve(root, 'node_modules', '.bin', 'merge-json-cli');

// 1. Build a full config set per site.
SITES.forEach((site) => {
  KINDS.forEach((kind) => {
    const input = `models/sites/${site}/_component-${kind}.json`;
    const output = `component-${kind}.${site}.json`;
    execFileSync(bin, ['-i', input, '-o', output], { cwd: root, stdio: 'inherit' });
  });
});

// 2. Copy the SERVED site's set to the canonical files EDS actually serves.
KINDS.forEach((kind) => {
  copyFileSync(
    resolve(root, `component-${kind}.${SERVED}.json`),
    resolve(root, `component-${kind}.json`),
  );
});

const others = SITES.filter((s) => s !== SERVED);
process.stdout.write(`\n[per-site build] served config = "${SERVED}".\n`);
process.stdout.write(
  `[per-site build] ${others.join(', ')} built as component-*.<site>.json but CANNOT be `
  + 'served from this same branch — that needs a branch/deploy per site.\n',
);
process.stdout.write('[per-site build] See docs/POC-per-site-block-collection.md\n\n');
