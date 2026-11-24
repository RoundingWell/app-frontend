import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const repository = 'RoundingWell/app-frontend';
const bucket = 'rw-frontend-artifacts-dev';
const tagPattern = /^v\d{6}\.\d+$/;
const shaPattern = /^[0-9a-f]{40}$/;
const hashPattern = /^[0-9a-f]{64}$/;
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const loginPattern = /^[a-z0-9][a-z0-9-]{0,38}$/i;
const realProdPattern = /^prod:(?!demonstration$)[a-z0-9*-]+$/;

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(url, headers = {}) {
  const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
  requireValue(response.ok, `${ new URL(url).hostname } returned HTTP ${ response.status }`);
  return response.json();
}

export async function getReleaseRef(tag, getJson = json) {
  requireValue(tagPattern.test(tag), 'Expected a release tag vYYMMDD.N');
  const root = `https://api.github.com/repos/${ repository }/git`;
  const ref = await getJson(`${ root }/ref/tags/${ tag }`);
  requireValue(ref.ref === `refs/tags/${ tag }` && ref.object?.type === 'tag'
    && shaPattern.test(ref.object.sha), 'Could not resolve the exact annotated release tag');
  const tagObject = await getJson(`${ root }/tags/${ ref.object.sha }`);
  requireValue(tagObject.tag === tag && tagObject.sha === ref.object.sha
    && tagObject.object?.type === 'commit' && shaPattern.test(tagObject.object.sha),
  'Release tag does not identify a commit');
  return { tag, tagSha: ref.object.sha, commitSha: tagObject.object.sha };
}

export async function releaseMetadata(env, tag, sha256, getJson = json) {
  // Manual re-publishes may still serve non-production workflows, but do not acquire provenance.
  if (env.RELEASE_EVENT !== 'push') return undefined;

  requireValue(env.RELEASE_REF === `refs/tags/${ tag }` && env.RELEASE_SENDER_TYPE === 'User'
    && loginPattern.test(env.RELEASE_SENDER ?? '')
    && env.RELEASE_REPOSITORY === repository && hashPattern.test(sha256), 'Missing trusted release tag push metadata');

  const refs = await getReleaseRef(tag, getJson);
  requireValue(refs.commitSha === env.CIRCLE_SHA1
    && [refs.tagSha, refs.commitSha].includes(env.RELEASE_EVENT_SHA), 'Tag push and artifact checkout disagree');
  const pusher = await getJson(`https://api.github.com/users/${ env.RELEASE_SENDER }`);
  requireValue(pusher.type === 'User' && Number.isSafeInteger(pusher.id) && pusher.id > 0
    && pusher.login?.toLowerCase() === env.RELEASE_SENDER.toLowerCase(), 'Release pusher is not a verified GitHub user');

  return {
    'release-tag': refs.tag,
    'release-tag-sha': refs.tagSha,
    'release-commit-sha': refs.commitSha,
    'release-pusher-id': String(pusher.id),
    'release-sha256': sha256,
  };
}

export function validateProductionApproval({ metadata, ref, items, approvers, target, workflow }) {
  requireValue(typeof workflow === 'string' && uuidPattern.test(workflow) && realProdPattern.test(target),
    'Expected a real-production workflow');
  requireValue(metadata?.['release-tag'] === ref.tag && metadata['release-tag-sha'] === ref.tagSha
    && metadata['release-commit-sha'] === ref.commitSha && hashPattern.test(metadata['release-sha256'] ?? '')
    && /^[1-9]\d*$/.test(metadata['release-pusher-id'] ?? ''), 'Artifact has no matching release provenance');
  const holds = items.filter(job => job.name === 'Approve production release' && job.type === 'approval');
  requireValue(holds.length === 1 && holds[0].status === 'success' && uuidPattern.test(holds[0].approved_by ?? ''),
    'Could not identify the successful production approval');
  const approvedBy = holds[0].approved_by.toLowerCase();
  const approverId = Object.hasOwn(approvers, approvedBy) ? approvers[approvedBy] : null;
  requireValue(Number.isSafeInteger(approverId) && approverId > 0, 'Production approver has no trusted identity mapping');
  requireValue(String(approverId) !== metadata['release-pusher-id'], 'The release-tag pusher cannot approve production');
  return { workflow, target, tag: ref.tag, sha256: metadata['release-sha256'] };
}

async function approvalJobs(workflow, token) {
  requireValue(uuidPattern.test(workflow) && token, 'Missing workflow ID or CircleCI read token');
  const page = await json(`https://circleci.com/api/v2/workflow/${ workflow }/job`, {
    Authorization: `Bearer ${ token }`,
  });
  // This workflow has only three jobs. A paginated result is not the intended workflow.
  requireValue(Array.isArray(page.items) && !page.next_page_token, 'Unexpected production workflow jobs response');
  return page.items;
}

async function main() {
  const [mode, proofFile, target, tag, workflow] = process.argv.slice(2);
  requireValue(proofFile && realProdPattern.test(target ?? '') && tagPattern.test(tag ?? '')
    && uuidPattern.test(workflow ?? ''), 'Missing or invalid production approval inputs');
  if (mode === 'verify') {
    const items = await approvalJobs(workflow, process.env.CIRCLECI_APPROVAL_READ_TOKEN);
    const ref = await getReleaseRef(tag);
    const response = JSON.parse(execFileSync('aws', [
      's3api', 'head-object', '--bucket', bucket, '--key', `app-frontend/${ tag }/dist.tar.gz`, '--output', 'json',
    ], { encoding: 'utf8', timeout: 15000 }));
    const proof = validateProductionApproval({
      metadata: response.Metadata, ref, items, workflow, target,
      approvers: JSON.parse(process.env.PRODUCTION_APPROVER_IDENTITIES ?? '{}'),
    });
    writeFileSync(proofFile, JSON.stringify(proof), { flag: 'wx' });
  } else if (mode === 'require') {
    const proof = JSON.parse(readFileSync(proofFile, 'utf8'));
    requireValue(proof.target === target && proof.tag === tag && proof.workflow === workflow
      && hashPattern.test(proof.sha256 ?? ''), 'Production approval does not match this deployment');
    process.stdout.write(proof.sha256);
  } else {
    throw new Error('Expected verify or require');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    process.stderr.write(`Production approval failed: ${ error.message }\n`);
    process.exitCode = 1;
  });
}
