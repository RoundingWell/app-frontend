#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

export const ENV_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env');
export const DEFAULT_AWS_PROFILE = 'dev';
export const DEFAULT_STAGE = 'dev';

const ORGANIZATION_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function organizationError(value) {
  if (!value) return 'Organization name is required.';
  if (!ORGANIZATION_PATTERN.test(value)) {
    return `"${ value }" is not a valid organization name. Use lowercase letters, numbers, and hyphens (e.g. "john").`;
  }
  return undefined;
}

export function profileError(value) {
  if (!ORGANIZATION_PATTERN.test(value)) {
    return `"${ value }" is not a valid profile or stage. Use lowercase letters, numbers, and hyphens.`;
  }
  return undefined;
}

export function buildEnvFile({ organization, awsProfile = DEFAULT_AWS_PROFILE, stage = DEFAULT_STAGE }) {
  return [
    `DEPLOY_AWS_PROFILE=${ awsProfile }`,
    `DEPLOY_STAGE=${ stage }`,
    `DEPLOY_ORGANIZATION=${ organization }`,
    `VITE_DEV_API_URL=https://${ organization }.roundingwell.dev`,
    '',
  ].join('\n');
}

async function ask(rl, label, { defaultValue, validate } = {}) {
  for (;;) {
    const suffix = defaultValue ? ` (${ defaultValue })` : '';
    const answer = (await rl.question(`${ label }${ suffix }: `)).trim().toLowerCase();

    if (!answer) {
      if (defaultValue) return defaultValue;
      process.stdout.write('  A value is required.\n');
      continue;
    }

    const error = validate?.(answer);

    if (error) {
      process.stdout.write(`  ${ error }\n`);
      continue;
    }

    return answer;
  }
}

async function main() {
  if (fs.existsSync(ENV_PATH)) return;

  if (!process.stdin.isTTY) {
    process.stdout.write('No .env found; skipping interactive .env setup because stdin is not a TTY.\n');
    return;
  }

  process.stdout.write('No .env found. Let\'s create one for local development.\n\n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let organization;
  let awsProfile;
  let stage;

  try {
    organization = await ask(rl, 'Developer organization name (e.g. john)', { validate: organizationError });
    awsProfile = await ask(rl, 'DEPLOY_AWS_PROFILE', { defaultValue: DEFAULT_AWS_PROFILE, validate: profileError });
    stage = await ask(rl, 'DEPLOY_STAGE', { defaultValue: DEFAULT_STAGE, validate: profileError });
  } finally {
    rl.close();
  }

  fs.writeFileSync(ENV_PATH, buildEnvFile({ organization, awsProfile, stage }));

  process.stdout.write(`\nWrote ${ ENV_PATH }:\n`);
  process.stdout.write(buildEnvFile({ organization, awsProfile, stage }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(error => {
    process.stderr.write(`Failed to create .env: ${ error.message }\n`);
    process.exitCode = 1;
  });
}
