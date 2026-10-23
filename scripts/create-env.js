#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

export const ENV_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env');
export const DEFAULT_AWS_PROFILE = 'dev';
export const DEFAULT_STAGE = 'dev';
export const DEFAULT_BACKEND = 'remote';

const ORGANIZATION_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const PROFILE_PATTERN = /^[A-Za-z0-9._-]+$/;

export function organizationError(value) {
  if (!value) return 'Organization name is required.';
  if (!ORGANIZATION_PATTERN.test(value)) {
    return `"${ value }" is not a valid organization name. Use lowercase letters, numbers, and hyphens (e.g. "woody").`;
  }
  return undefined;
}

export function profileError(value) {
  if (!PROFILE_PATTERN.test(value)) {
    return `"${ value }" is not a valid profile or stage. Use letters, numbers, dots, underscores, and hyphens.`;
  }
  return undefined;
}

export function backendError(value) {
  if (value !== 'local' && value !== 'remote') {
    return `"${ value }" is not a valid backend. Use "local" or "remote".`;
  }
  return undefined;
}

export function buildEnvFile({
  organization,
  backend = DEFAULT_BACKEND,
  awsProfile = DEFAULT_AWS_PROFILE,
  stage = DEFAULT_STAGE,
}) {
  const lines = [
    `DEPLOY_AWS_PROFILE=${ awsProfile }`,
    `DEPLOY_STAGE=${ stage }`,
    `DEPLOY_ORGANIZATION=${ organization }`,
  ];

  if (backend === 'remote') {
    lines.push(`VITE_DEV_API_URL=https://${ organization }.roundingwell.dev`);
  }

  return `${ lines.join('\n') }\n`;
}

export function writeEnvFile(filePath, contents) {
  try {
    fs.writeFileSync(filePath, contents, { flag: 'wx' });
    return true;
  } catch(error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
}

async function ask(rl, output, label, { defaultValue, validate } = {}) {
  for (;;) {
    const suffix = defaultValue ? ` (${ defaultValue })` : '';
    const answer = (await rl.question(`${ label }${ suffix }: `)).trim();

    if (!answer) {
      if (defaultValue) return defaultValue;
      output.write('  A value is required.\n');
      continue;
    }

    const error = validate?.(answer);

    if (error) {
      output.write(`  ${ error }\n`);
      continue;
    }

    return answer;
  }
}

export async function runSetup({ envPath = ENV_PATH, input = process.stdin, output = process.stdout } = {}) {
  if (fs.existsSync(envPath)) return 'exists';

  if (!input.isTTY) {
    output.write('No .env found; skipping interactive .env setup because stdin is not a TTY.\n');
    return 'skipped';
  }

  output.write('No .env found. Let\'s create one for local development.\n\n');

  const rl = createInterface({ input, output });
  let options;

  try {
    options = {
      organization: await ask(rl, output, 'Developer organization name (e.g. woody)', { validate: organizationError }),
      backend: await ask(rl, output, 'Backend [local/remote]', { defaultValue: DEFAULT_BACKEND, validate: backendError }),
      awsProfile: await ask(rl, output, 'DEPLOY_AWS_PROFILE', { defaultValue: DEFAULT_AWS_PROFILE, validate: profileError }),
      stage: await ask(rl, output, 'DEPLOY_STAGE', { defaultValue: DEFAULT_STAGE, validate: profileError }),
    };
  } finally {
    rl.close();
  }

  const contents = buildEnvFile(options);

  if (!writeEnvFile(envPath, contents)) {
    output.write(`\n${ envPath } already exists; leaving it unchanged.\n`);
    return 'exists';
  }

  output.write(`\nWrote ${ envPath }:\n${ contents }`);
  return 'created';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runSetup().catch(error => {
    process.stderr.write(`Failed to create .env: ${ error.message }\n`);
    process.exitCode = 1;
  });
}
