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

const ownedFiles = new Set(OWNED_COVERAGE_FILES.map(filePath => path.resolve(filePath)));

function getLocationSignature(location) {
  return JSON.stringify(location);
}

function getBranchSignature(branchMeta) {
  const line = branchMeta.line || branchMeta.loc?.start?.line || null;

  return JSON.stringify({
    line,
    type: branchMeta.type,
    locations: branchMeta.locations,
  });
}

function getFunctionSignature(fnMeta) {
  return JSON.stringify({
    name: fnMeta.name,
    decl: fnMeta.decl,
    loc: fnMeta.loc,
  });
}

function supplementStatementHits(targetCoverage, sourceCoverage) {
  targetCoverage.s ||= {};

  const targetBySignature = new Map(
    Object.entries(targetCoverage.statementMap || {}).map(([id, loc]) => {
      return [getLocationSignature(loc), id];
    }),
  );

  Object.entries(sourceCoverage.statementMap || {}).forEach(([sourceId, sourceLoc]) => {
    const targetId = targetBySignature.get(getLocationSignature(sourceLoc));

    if (targetId === undefined) return;

    targetCoverage.s[targetId] = Math.max(
      targetCoverage.s[targetId] || 0,
      (sourceCoverage.s || {})[sourceId] || 0,
    );
  });
}

function supplementFunctionHits(targetCoverage, sourceCoverage) {
  targetCoverage.f ||= {};

  const targetBySignature = new Map(
    Object.entries(targetCoverage.fnMap || {}).map(([id, meta]) => {
      return [getFunctionSignature(meta), id];
    }),
  );

  Object.entries(sourceCoverage.fnMap || {}).forEach(([sourceId, sourceMeta]) => {
    const targetId = targetBySignature.get(getFunctionSignature(sourceMeta));

    if (targetId === undefined) return;

    targetCoverage.f[targetId] = Math.max(
      targetCoverage.f[targetId] || 0,
      (sourceCoverage.f || {})[sourceId] || 0,
    );
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

    supplementStatementHits(targetCoverage, sourceCoverage);
    supplementFunctionHits(targetCoverage, sourceCoverage);
    supplementBranchHits(targetCoverage, sourceCoverage);
  }

  return mergedCoverage;
}

function main() {
  const cypressCoverage = readCoverage(CYPRESS_COVERAGE_PATH);
  const unitCoverage = readCoverage(UNIT_COVERAGE_PATH);
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
