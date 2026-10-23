import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import {
  backendError,
  buildEnvFile,
  organizationError,
  profileError,
  runSetup,
  writeEnvFile,
} from './create-env.js';

async function* delayedLines(lines) {
  for (const line of lines) {
    await new Promise(resolve => setImmediate(resolve));
    yield `${ line }\n`;
  }
}

function ttyInput(lines) {
  const input = Readable.from(delayedLines(lines));
  input.isTTY = true;
  return input;
}

function captureOutput() {
  const chunks = [];
  const output = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });

  return { output, text: () => chunks.join('') };
}

function tempEnvPath(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-env-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, '.env');
}

test('buildEnvFile derives the dev API URL for the remote backend', () => {
  assert.equal(buildEnvFile({ organization: 'woody' }), [
    'DEPLOY_AWS_PROFILE=dev',
    'DEPLOY_STAGE=dev',
    'DEPLOY_ORGANIZATION=woody',
    'VITE_DEV_API_URL=https://woody.roundingwell.dev',
    '',
  ].join('\n'));
});

test('buildEnvFile omits the API URL for the local backend and keeps overrides', () => {
  assert.equal(buildEnvFile({ organization: 'qa2', backend: 'local', awsProfile: 'DevSSO', stage: 'qa' }), [
    'DEPLOY_AWS_PROFILE=DevSSO',
    'DEPLOY_STAGE=qa',
    'DEPLOY_ORGANIZATION=qa2',
    '',
  ].join('\n'));
});

test('runSetup writes .env from prompted answers', async t => {
  const envPath = tempEnvPath(t);
  const { output, text } = captureOutput();

  const result = await runSetup({ envPath, input: ttyInput(['woody', '', '', '']), output });

  assert.equal(result, 'created');
  assert.equal(fs.readFileSync(envPath, 'utf8'), buildEnvFile({ organization: 'woody' }));
  assert.match(text(), /Wrote /);
});

test('runSetup supports a local backend and case-sensitive profile', async t => {
  const envPath = tempEnvPath(t);
  const { output } = captureOutput();

  const result = await runSetup({
    envPath,
    input: ttyInput(['woody', 'local', 'DevSSO', 'qa']),
    output,
  });

  assert.equal(result, 'created');
  assert.equal(fs.readFileSync(envPath, 'utf8'), [
    'DEPLOY_AWS_PROFILE=DevSSO',
    'DEPLOY_STAGE=qa',
    'DEPLOY_ORGANIZATION=woody',
    '',
  ].join('\n'));
});

test('runSetup re-prompts for an invalid organization slug', async t => {
  const envPath = tempEnvPath(t);
  const { output, text } = captureOutput();

  await runSetup({ envPath, input: ttyInput(['Woody', 'woody', '', '', '']), output });

  assert.match(text(), /not a valid organization name/);
  assert.equal(fs.readFileSync(envPath, 'utf8'), buildEnvFile({ organization: 'woody' }));
});

test('runSetup skips prompting when .env already exists', async t => {
  const envPath = tempEnvPath(t);
  fs.writeFileSync(envPath, 'EXISTING=1\n');
  const { output, text } = captureOutput();

  const result = await runSetup({ envPath, input: Readable.from([]), output });

  assert.equal(result, 'exists');
  assert.equal(fs.readFileSync(envPath, 'utf8'), 'EXISTING=1\n');
  assert.equal(text(), '');
});

test('runSetup skips prompting when stdin is not a TTY', async t => {
  const envPath = tempEnvPath(t);
  const { output, text } = captureOutput();

  const result = await runSetup({ envPath, input: Readable.from([]), output });

  assert.equal(result, 'skipped');
  assert.equal(fs.existsSync(envPath), false);
  assert.match(text(), /stdin is not a TTY/);
});

test('writeEnvFile never overwrites a concurrently created file', t => {
  const envPath = tempEnvPath(t);
  fs.writeFileSync(envPath, 'EXISTING=1\n');

  assert.equal(writeEnvFile(envPath, 'DEPLOY_STAGE=dev\n'), false);
  assert.equal(fs.readFileSync(envPath, 'utf8'), 'EXISTING=1\n');
});

test('organizationError accepts lowercase slugs only', () => {
  assert.equal(organizationError('woody'), undefined);
  assert.equal(organizationError('qa2'), undefined);
  assert.equal(organizationError('quality-assurance'), undefined);
  assert.match(organizationError(''), /required/);
  assert.match(organizationError('Woody'), /not a valid organization name/);
  assert.match(organizationError('woody_dev'), /not a valid organization name/);
  assert.match(organizationError('-woody'), /not a valid organization name/);
  assert.match(organizationError('woody-'), /not a valid organization name/);
});

test('profileError accepts configured profile names', () => {
  assert.equal(profileError('dev'), undefined);
  assert.equal(profileError('DevSSO'), undefined);
  assert.equal(profileError('dev_sso'), undefined);
  assert.equal(profileError('dev.sso'), undefined);
  assert.match(profileError(''), /not a valid profile or stage/);
  assert.match(profileError('dev sso'), /not a valid profile or stage/);
  assert.match(profileError('dev#sso'), /not a valid profile or stage/);
});

test('backendError accepts only local or remote', () => {
  assert.equal(backendError('local'), undefined);
  assert.equal(backendError('remote'), undefined);
  assert.match(backendError(''), /not a valid backend/);
  assert.match(backendError('cloud'), /not a valid backend/);
});
