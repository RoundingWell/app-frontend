#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { dispatchAppTestsEvent } from './lib/github-e2e-app.js';

const __filename = fileURLToPath(import.meta.url);
const EVENT_TYPE = 'qa2_deploy_succeeded';

function isMainModule() {
  if (!process.argv[1]) {
    return false;
  }

  return path.resolve(process.argv[1]) === __filename;
}

export function buildClientPayload({ version, sourceSha, sourceRunUrl }) {
  return {
    source_repo: 'RoundingWell/app-frontend',
    component: 'frontend',
    source_ref: `refs/tags/${ version }`,
    source_sha: sourceSha,
    source_run_url: sourceRunUrl,
    environment: 'qa2',
    source_system: 'circleci',
  };
}

export function resolveInputs(values) {
  const version = values.version;
  const sourceSha = values['source-sha'];
  const sourceRunUrl = values['source-run-url'];

  if (!version || !sourceSha || !sourceRunUrl) {
    throw new Error('--version, --source-sha, and --source-run-url are required');
  }

  return { version, sourceSha, sourceRunUrl };
}

export async function dispatchQa2E2E(values) {
  const { version, sourceSha, sourceRunUrl } = resolveInputs(values);
  const clientPayload = buildClientPayload({ version, sourceSha, sourceRunUrl });

  await dispatchAppTestsEvent({
    eventType: EVENT_TYPE,
    clientPayload,
  });
}

async function main() {
  const { values } = parseArgs({
    options: {
      'version': { type: 'string' },
      'source-sha': { type: 'string' },
      'source-run-url': { type: 'string' },
    },
  });

  await dispatchQa2E2E(values);
}

if (isMainModule()) {
  main().catch(error => {
    process.stderr.write(`Failed to dispatch QA2 E2E run: ${ error.message }\n`);
    process.exit(1);
  });
}
