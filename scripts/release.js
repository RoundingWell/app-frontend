#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { parseArgs } from 'node:util';
import dayjs from 'dayjs';
import utcPlugin from 'dayjs/plugin/utc.js';

dayjs.extend(utcPlugin);

const RELEASE_BRANCH_PATTERN = /^release\//;

function fail(message) {
  throw new Error(message);
}

function writeLine(message = '') {
  process.stdout.write(`${ message }\n`);
}

function writeErrorLine(message = '') {
  process.stderr.write(`${ message }\n`);
}

function formatGitFailure(error) {
  return {
    ok: false,
    stdout: String(error.stdout || '').trim(),
    stderr: String(error.stderr || '').trim(),
    code: typeof error.status === 'number' ? error.status : 1,
  };
}

function handleGitFailure(args, failure, allowFailure) {
  if (allowFailure) {
    return failure;
  }

  const command = `git ${ args.join(' ') }`;
  const details = failure.stderr || failure.stdout || 'Unknown git error';
  throw new Error(`Command failed: ${ command }\n${ details }`);
}

function runGit(args, { allowFailure = false } = {}) {
  try {
    const stdout = execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return {
      ok: true,
      stdout: stdout.trim(),
      stderr: '',
      code: 0,
    };
  } catch(error) {
    const failure = formatGitFailure(error);
    return handleGitFailure(args, failure, allowFailure);
  }
}

function ensureCleanWorkingTree() {
  const status = runGit(['status', '--porcelain']).stdout;

  if (status) {
    fail(
      'Working tree must be clean before creating a release tag.\n'
      + 'Commit, stash, or discard local changes and try again.\n\n'
      + `Pending changes:\n${ status }`,
    );
  }
}

function getCurrentBranch() {
  const branchResult = runGit(['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFailure: true });

  if (!branchResult.ok || !branchResult.stdout) {
    fail('HEAD is detached. Check out `develop` or `release/*` before releasing.');
  }

  return branchResult.stdout;
}

function ensureAllowedBranch(branchName) {
  if (branchName === 'develop') {
    return;
  }

  if (RELEASE_BRANCH_PATTERN.test(branchName)) {
    return;
  }

  fail(
    'Releases can only be created from `develop` or `release/*`.\n'
    + `Current branch: \`${ branchName }\``,
  );
}

function getHeadSha() {
  return runGit(['rev-parse', 'HEAD']).stdout;
}

function ensureHeadMatchesUpstream() {
  const upstreamResult = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { allowFailure: true });

  if (!upstreamResult.ok || !upstreamResult.stdout) {
    return null;
  }

  const upstreamBranch = upstreamResult.stdout;
  const headSha = runGit(['rev-parse', 'HEAD']).stdout;
  const upstreamSha = runGit(['rev-parse', '@{u}']).stdout;

  if (headSha !== upstreamSha) {
    const divergence = runGit(['rev-list', '--left-right', '--count', 'HEAD...@{u}']).stdout;
    const [ahead = '0', behind = '0'] = divergence.split(/\s+/);

    fail(
      `Local HEAD must match upstream \`${ upstreamBranch }\` before tagging.\n`
      + `Ahead: ${ ahead }, Behind: ${ behind }.\n`
      + 'Push or pull first, then retry.',
    );
  }

  return upstreamBranch;
}

function isAncestor(ancestorSha, refName) {
  return runGit(['merge-base', '--is-ancestor', ancestorSha, refName], { allowFailure: true }).ok;
}

function ensureHeadReachableFromAllowedRemote(headSha) {
  const checks = [];

  const developExists = runGit(['show-ref', '--verify', '--quiet', 'refs/remotes/origin/develop'], { allowFailure: true }).ok;

  if (developExists) {
    const reachableFromDevelop = isAncestor(headSha, 'origin/develop');
    checks.push(`origin/develop: ${ reachableFromDevelop ? 'yes' : 'no' }`);

    if (reachableFromDevelop) {
      return 'origin/develop';
    }
  } else {
    checks.push('origin/develop: missing');
  }

  const releaseBranchesOutput = runGit(['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/release/*']).stdout;
  const releaseBranches = releaseBranchesOutput ? releaseBranchesOutput.split('\n').filter(Boolean) : [];

  for (const releaseBranch of releaseBranches) {
    if (isAncestor(headSha, releaseBranch)) {
      checks.push(`${ releaseBranch }: yes`);
      return releaseBranch;
    }

    checks.push(`${ releaseBranch }: no`);
  }

  const releaseCheckSummary = checks.length ? checks.join('\n') : 'No allowed remote refs were found.';

  fail(
    `HEAD (${ headSha }) is not reachable from \`origin/develop\` or any \`origin/release/*\` branch.\n`
    + 'Release tags must point to commits already present on an allowed remote branch.\n\n'
    + `Reachability checks:\n${ releaseCheckSummary }`,
  );
}

function listRemoteTags(tagPattern) {
  const output = runGit(['ls-remote', '--tags', 'origin', tagPattern]).stdout;

  if (!output) {
    return [];
  }

  return output
    .split('\n')
    .filter(Boolean)
    .map(line => line.split('\t')[1])
    .filter(Boolean)
    .map(ref => ref.replace('refs/tags/', '').replace(/\^\{\}$/, ''));
}

function computeNextReleaseTag() {
  const datePart = dayjs.utc().format('YYYYMMDD');
  const prefix = `release-${ datePart }`;
  const matchingTags = listRemoteTags(`refs/tags/${ prefix }.*`)
    .filter(tag => new RegExp(`^${ prefix }\\.\\d+$`).test(tag));

  const tagSet = new Set(matchingTags);

  let sequence = 1;

  while (tagSet.has(`${ prefix }.${ sequence }`)) {
    sequence += 1;
  }

  return `${ prefix }.${ sequence }`;
}

function ensureTagUniqueRemotely(tagName) {
  const remoteTag = listRemoteTags(`refs/tags/${ tagName }`);

  if (remoteTag.length > 0) {
    fail(
      `Remote tag \`${ tagName }\` already exists.\n`
      + 'Release tags are immutable and cannot be reused or moved.',
    );
  }
}

function ensureTagDoesNotExistLocally(tagName) {
  const localExists = runGit(['show-ref', '--tags', '--verify', '--quiet', `refs/tags/${ tagName }`], {
    allowFailure: true,
  }).ok;

  if (localExists) {
    fail(
      `Local tag \`${ tagName }\` already exists.\n`
      + 'Delete it locally or choose a different release date/sequence before retrying.',
    );
  }
}

function buildTagMessage({ tagName, branchName, headSha, timestampUtc }) {
  return [
    `Release tag: ${ tagName }`,
    `Branch: ${ branchName }`,
    `Commit: ${ headSha }`,
    `Created UTC: ${ timestampUtc }`,
  ].join('\n');
}

function createAnnotatedTag({ tagName, headSha, tagMessage }) {
  runGit(['tag', '-a', tagName, headSha, '-m', tagMessage]);
}

function pushTag(tagName) {
  runGit(['push', 'origin', tagName]);
}

function printSummary({ tagName, headSha, branchName, dryRun }) {
  if (dryRun) {
    writeLine('');
    writeLine('Dry run successful.');
    writeLine(`Tag to create: ${ tagName }`);
    writeLine(`Commit SHA: ${ headSha }`);
    writeLine(`Branch: ${ branchName }`);
    writeLine('No tag was created or pushed.');
    writeLine('Next step: run `npm run release` to create and push this tag.');
    return;
  }

  writeLine('');
  writeLine('Release tag created and pushed successfully.');
  writeLine(`Tag: ${ tagName }`);
  writeLine(`Commit SHA: ${ headSha }`);
  writeLine(`Branch: ${ branchName }`);
  writeLine('Next step: CircleCI should now deploy from this tag.');
}

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      'dry-run': {
        type: 'boolean',
        short: 'd',
      },
    },
    allowPositionals: true,
  });

  if (positionals.length > 0) {
    fail(
      `Unexpected arguments: ${ positionals.join(' ') }\n`
      + 'Use `npm run release` or `npm run release -- --dry-run`.',
    );
  }

  const dryRun = Boolean(values['dry-run']);

  writeLine('Fetching latest refs and tags from origin...');
  runGit(['fetch', 'origin', '--prune', '--tags']);

  ensureCleanWorkingTree();

  const branchName = getCurrentBranch();
  ensureAllowedBranch(branchName);

  const upstreamBranch = ensureHeadMatchesUpstream();
  const headSha = getHeadSha();
  const reachableFrom = ensureHeadReachableFromAllowedRemote(headSha);

  const tagName = computeNextReleaseTag();
  ensureTagUniqueRemotely(tagName);
  ensureTagDoesNotExistLocally(tagName);

  writeLine(`Validated release source branch: ${ branchName }`);
  writeLine(`Validated HEAD reachability via: ${ reachableFrom }`);

  if (upstreamBranch) {
    writeLine(`Validated upstream sync with: ${ upstreamBranch }`);
  } else {
    writeLine('No upstream configured for current branch; upstream sync check skipped.');
  }

  if (!dryRun) {
    const timestampUtc = dayjs.utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
    const tagMessage = buildTagMessage({ tagName, branchName, headSha, timestampUtc });

    createAnnotatedTag({ tagName, headSha, tagMessage });
    pushTag(tagName);
  }

  printSummary({ tagName, headSha, branchName, dryRun });
}

main().catch(error => {
  writeErrorLine('');
  writeErrorLine('Release failed.');
  writeErrorLine(error.message || error);
  process.exit(1);
});
