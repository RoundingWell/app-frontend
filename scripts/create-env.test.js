import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEnvFile, organizationError, profileError } from './create-env.js';

test('buildEnvFile derives the dev API URL and applies defaults', () => {
  assert.equal(buildEnvFile({ organization: 'john' }), [
    'DEPLOY_AWS_PROFILE=dev',
    'DEPLOY_STAGE=dev',
    'DEPLOY_ORGANIZATION=john',
    'VITE_DEV_API_URL=https://john.roundingwell.dev',
    '',
  ].join('\n'));
});

test('buildEnvFile keeps overridden profile and stage', () => {
  assert.equal(buildEnvFile({ organization: 'qa2', awsProfile: 'sandbox', stage: 'qa' }), [
    'DEPLOY_AWS_PROFILE=sandbox',
    'DEPLOY_STAGE=qa',
    'DEPLOY_ORGANIZATION=qa2',
    'VITE_DEV_API_URL=https://qa2.roundingwell.dev',
    '',
  ].join('\n'));
});

test('organizationError accepts slugs', () => {
  assert.equal(organizationError('john'), undefined);
  assert.equal(organizationError('qa2'), undefined);
  assert.equal(organizationError('quality-assurance'), undefined);
});

test('organizationError rejects invalid values', () => {
  assert.match(organizationError(''), /required/);
  assert.match(organizationError('John'), /not a valid organization name/);
  assert.match(organizationError('Bob_Dev'), /not a valid organization name/);
  assert.match(organizationError('-jane'), /not a valid organization name/);
  assert.match(organizationError('jane-'), /not a valid organization name/);
});

test('profileError rejects empty or malformed values', () => {
  assert.match(profileError(''), /not a valid profile or stage/);
  assert.equal(profileError('qa'), undefined);
  assert.equal(profileError('dev-sso'), undefined);
});
