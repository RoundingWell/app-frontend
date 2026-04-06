#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

export function buildMarkerName(environment, version) {
  const markerEnvSlug = environment.replaceAll(':', '-').replaceAll('*', 'all');
  return `deploy-${ markerEnvSlug }-${ version }`;
}

export function readMarkerEnvironments(envFile) {
  return fs.readFileSync(envFile, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

export function readMarkerStatus(statusFile) {
  if (!statusFile || !fs.existsSync(statusFile)) {
    return {
      successfulEnvironments: [],
      failedEnvironments: [],
    };
  }

  return JSON.parse(fs.readFileSync(statusFile, 'utf8'));
}

export function buildMarkerUpdates({
  deployResult,
  failedEnvironments,
  plannedEnvironments,
  successfulEnvironments,
  targetEnvironment,
}) {
  if (deployResult === 'success') {
    return plannedEnvironments.map(environment => ({
      environment,
      status: 'SUCCESS',
    }));
  }

  const updates = Object.create(null);
  const addUpdate = (environment, status) => {
    if (!environment || Object.hasOwn(updates, environment)) return;
    updates[environment] = status;
  };

  if (targetEnvironment.endsWith(':*')) {
    addUpdate(targetEnvironment, 'FAILED');
  }

  for (const environment of successfulEnvironments) {
    addUpdate(environment, 'SUCCESS');
  }

  for (const environment of failedEnvironments) {
    addUpdate(environment, 'FAILED');
  }

  if (!failedEnvironments.length && !successfulEnvironments.length) {
    addUpdate(targetEnvironment, 'FAILED');
  }

  return Object.entries(updates)
    .map(([environment, status]) => ({ environment, status }));
}

function runCircleCi(args) {
  execFileSync('circleci', args, { stdio: 'inherit' });
}

function planMarkers({ componentName, envFile, targetVersion }) {
  for (const environment of readMarkerEnvironments(envFile)) {
    runCircleCi([
      'run',
      'release',
      'plan',
      buildMarkerName(environment, targetVersion),
      `--environment-name=${ environment }`,
      `--component-name=${ componentName }`,
      `--target-version=${ targetVersion }`,
    ]);
  }
}

function updateMarkers({
  deployResult,
  envFile,
  statusFile,
  targetEnvironment,
  targetVersion,
}) {
  const plannedEnvironments = readMarkerEnvironments(envFile);
  const {
    failedEnvironments = [],
    successfulEnvironments = [],
  } = readMarkerStatus(statusFile);
  const updates = buildMarkerUpdates({
    deployResult,
    failedEnvironments,
    plannedEnvironments,
    successfulEnvironments,
    targetEnvironment,
  });

  for (const { environment, status } of updates) {
    runCircleCi([
      'run',
      'release',
      'update',
      buildMarkerName(environment, targetVersion),
      `--status=${ status }`,
    ]);
  }
}

function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      'component-name': { type: 'string' },
      'deploy-result': { type: 'string' },
      'env-file': { type: 'string' },
      'status-file': { type: 'string' },
      'target-environment': { type: 'string' },
      'target-version': { type: 'string' },
    },
  });

  const [command] = positionals;

  if (!command) {
    throw new Error('Expected a command: plan or update');
  }

  if (!values['env-file'] || !values['target-version']) {
    throw new Error('--env-file and --target-version are required');
  }

  if (command === 'plan') {
    if (!values['component-name']) {
      throw new Error('--component-name is required for plan');
    }

    planMarkers({
      componentName: values['component-name'],
      envFile: values['env-file'],
      targetVersion: values['target-version'],
    });
    return;
  }

  if (command === 'update') {
    if (!values['deploy-result'] || !values['target-environment']) {
      throw new Error('--deploy-result and --target-environment are required for update');
    }

    updateMarkers({
      deployResult: values['deploy-result'],
      envFile: values['env-file'],
      statusFile: values['status-file'],
      targetEnvironment: values['target-environment'],
      targetVersion: values['target-version'],
    });
    return;
  }

  throw new Error(`Unsupported command: ${ command }`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
