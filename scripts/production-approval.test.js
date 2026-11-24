import assert from 'node:assert/strict';
import test from 'node:test';
import { releaseMetadata, validateProductionApproval } from './production-approval.js';

const tag = 'v991231.999';
const tagSha = 'a'.repeat(40);
const commitSha = 'b'.repeat(40);
const sha256 = 'c'.repeat(64);
const workflow = 'ad426d7a-2777-4ec8-8b31-acb6fa14021b';
const circleUser = '5649578a-3265-4eaf-9b3a-636087056d5e';
const ref = { tag, tagSha, commitSha };
const metadata = {
  'release-tag': tag,
  'release-tag-sha': tagSha,
  'release-commit-sha': commitSha,
  'release-pusher-id': '101',
  'release-sha256': sha256,
};
const hold = { name: 'Approve production release', type: 'approval', status: 'success', approved_by: circleUser };
const context = { metadata, ref, items: [hold], approvers: { [circleUser]: 202 }, target: 'prod:*', workflow };

test('a known non-author approves only the exact release for the workflow', () => {
  assert.deepEqual(validateProductionApproval(context), { workflow, target: 'prod:*', tag, sha256 });
  assert.throws(() => validateProductionApproval({ ...context, ref: { ...ref, tagSha: 'd'.repeat(40) } }), /provenance/);
});

test('rejects original tag pusher, missing mapping, and invalid hold records', () => {
  assert.throws(() => validateProductionApproval({ ...context, approvers: { [circleUser]: 101 } }), /tag pusher/);
  assert.throws(() => validateProductionApproval({ ...context, approvers: {} }), /identity mapping/);
  for (const items of [[], [{ ...hold, status: 'on_hold' }], [{ ...hold, approved_by: '' }], [hold, hold]]) {
    assert.throws(() => validateProductionApproval({ ...context, items }), /successful production approval/);
  }
});

test('rejects legacy artifacts and exact demo target', () => {
  assert.throws(() => validateProductionApproval({ ...context, metadata: {} }), /provenance/);
  assert.throws(() => validateProductionApproval({ ...context, target: 'prod:demonstration' }), /real-production workflow/);
});

test('only a real GitHub tag push records the validated GitHub sender', async () => {
  const env = {
    RELEASE_EVENT: 'push',
    RELEASE_REF: `refs/tags/${ tag }`,
    RELEASE_EVENT_SHA: tagSha,
    RELEASE_SENDER: 'release-pusher',
    RELEASE_SENDER_TYPE: 'User',
    RELEASE_REPOSITORY: 'RoundingWell/app-frontend',
    CIRCLE_SHA1: commitSha,
  };
  const github = async url => {
    if (url.endsWith(`/ref/tags/${ tag }`)) return { ref: env.RELEASE_REF, object: { type: 'tag', sha: tagSha } };
    if (url.endsWith(`/tags/${ tagSha }`)) return { tag, sha: tagSha, object: { type: 'commit', sha: commitSha } };
    if (url.endsWith('/users/release-pusher')) return { type: 'User', id: 101, login: 'release-pusher' };
    throw new Error('unexpected URL');
  };
  assert.deepEqual(await releaseMetadata(env, tag, sha256, github), metadata);
  assert.equal(await releaseMetadata({ ...env, RELEASE_EVENT: 'api' }, tag, sha256, github), undefined);
  await assert.rejects(releaseMetadata({ ...env, RELEASE_SENDER_TYPE: 'Bot' }, tag, sha256, github), /push metadata/);
  await assert.rejects(releaseMetadata({ ...env, CIRCLE_SHA1: tagSha }, tag, sha256, github), /disagree/);
});
