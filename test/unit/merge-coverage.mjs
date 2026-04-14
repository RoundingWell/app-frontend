/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

import { OWNED_COVERAGE_FILES } from './coverage-owned-files.mjs';

const CYPRESS_COVERAGE_PATH = '.nyc_output/out.json';
const UNIT_COVERAGE_PATH = '.nyc_output/coverage-final.json';
const MERGED_COVERAGE_PATH = '.nyc_output/merged.json';

function readCoverage(filePath) {
  return fs.existsSync(filePath) ?
    JSON.parse(fs.readFileSync(filePath, 'utf8')) :
    {};
}

// Extract the project-relative suffix from an absolute instrumented path.
// Coverage files from different CI containers may have different absolute
// prefixes (e.g. /home/circleci/project vs /root/project). Normalizing
// to a common prefix ensures file-level matching works across containers.
function getPathSuffix(filePath) {
  const srcIndex = filePath.indexOf('/src/');
  return srcIndex >= 0 ? filePath.slice(srcIndex) : filePath;
}

export function normalizeCoveragePaths(coverage) {
  const cwd = process.cwd();
  const normalized = {};

  for (const [filePath, data] of Object.entries(coverage)) {
    const suffix = getPathSuffix(filePath);
    const normalizedPath = suffix === filePath ? filePath : path.join(cwd, suffix.slice(1));
    normalized[normalizedPath] = data;

    if (data.path) {
      data.path = normalizedPath;
    }
  }

  return normalized;
}

const ownedFiles = new Set(OWNED_COVERAGE_FILES.map(filePath => path.resolve(filePath)));

function getBranchSignature(branchMeta) {
  const line = branchMeta.line || branchMeta.loc?.start?.line || null;

  return JSON.stringify({
    line,
    type: branchMeta.type,
    locations: branchMeta.locations,
  });
}

function supplementBranchHits(targetCoverage, sourceCoverage) {
  targetCoverage.b ||= {};

  const targetBranchEntries = Object.entries(targetCoverage.branchMap || {}).map(([id, meta]) => {
    return [getBranchSignature(meta), { id, meta }];
  });
  const targetBranchesBySignature = new Map(targetBranchEntries);

  Object.entries(sourceCoverage.branchMap || {}).forEach(([sourceId, sourceMeta]) => {
    const targetEntry = targetBranchesBySignature.get(getBranchSignature(sourceMeta));

    if (!targetEntry) return;

    const sourceHits = (sourceCoverage.b || {})[sourceId] || [];
    const targetHits = (targetCoverage.b || {})[targetEntry.id] || [];

    targetCoverage.b[targetEntry.id] = sourceMeta.locations.map((_, index) => {
      return Math.max(targetHits[index] || 0, sourceHits[index] || 0);
    });
  });
}

export function mergeCoverage(cypressCoverage, unitCoverage) {
  const mergedCoverage = {
    ...cypressCoverage,
  };

  for (const [filePath, sourceCoverage] of Object.entries(unitCoverage)) {
    if (ownedFiles.has(filePath)) {
      mergedCoverage[filePath] = sourceCoverage;
      continue;
    }

    const targetCoverage = mergedCoverage[filePath];
    if (!targetCoverage) continue;

    supplementBranchHits(targetCoverage, sourceCoverage);
  }

  return mergedCoverage;
}

function main() {
  const rawCypressCoverage = readCoverage(CYPRESS_COVERAGE_PATH);
  const rawUnitCoverage = readCoverage(UNIT_COVERAGE_PATH);

  // Normalize paths so coverage from different CI containers can be matched.
  const cypressCoverage = normalizeCoveragePaths(rawCypressCoverage);
  const unitCoverage = normalizeCoveragePaths(rawUnitCoverage);

  const cypressFileCount = Object.keys(cypressCoverage).length;
  const unitFileCount = Object.keys(unitCoverage).length;

  console.log(`Cypress coverage: ${ cypressFileCount } files`);
  console.log(`Unit coverage: ${ unitFileCount } files`);

  if (unitFileCount === 0) {
    console.warn('WARNING: Unit coverage is empty. Check that coverage-final.json was copied correctly.');
  }

  // Diagnostic: count overlapping non-owned files
  const unitNonOwned = Object.keys(unitCoverage).filter(f => !ownedFiles.has(f));
  const overlapping = unitNonOwned.filter(f => cypressCoverage[f]);
  console.log(`Unit non-owned files: ${ unitNonOwned.length }, overlapping with Cypress: ${ overlapping.length }`);

  if (overlapping.length === 0 && unitNonOwned.length > 0) {
    console.warn('WARNING: Zero path overlap between unit and Cypress non-owned files.');
    console.warn('  Sample unit paths:', unitNonOwned.slice(0, 3));
    console.warn('  Sample Cypress paths:', Object.keys(cypressCoverage).slice(0, 3));
  }

  const mergedCoverage = mergeCoverage(cypressCoverage, unitCoverage);

  for (const filePath of ownedFiles) {
    if (unitCoverage[filePath]) {
      mergedCoverage[filePath] = unitCoverage[filePath];
      continue;
    }

    if (cypressCoverage[filePath]) {
      mergedCoverage[filePath] = cypressCoverage[filePath];
    }
  }

  fs.writeFileSync(MERGED_COVERAGE_PATH, JSON.stringify(mergedCoverage));
  fs.writeFileSync(CYPRESS_COVERAGE_PATH, JSON.stringify(mergedCoverage));
  fs.rmSync(UNIT_COVERAGE_PATH, { force: true });

  console.log(`Merged coverage written to ${ MERGED_COVERAGE_PATH } for ${ Object.keys(mergedCoverage).length } files.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
