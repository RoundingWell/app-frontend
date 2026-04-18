/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';

import { OWNED_COVERAGE_FILES } from './coverage-owned-files.mjs';

const COVERAGE_PATH = '.nyc_output/merged.json';

function summarize(cov, key) {
  const values = Object.values(cov[key] || {}).flat();
  const total = values.length;
  const covered = values.filter(value => value > 0).length;

  return total === 0 ? 100 : (covered / total) * 100;
}

function summarizeLines(cov) {
  const lineHits = new Map();

  for (const [statementId, location] of Object.entries(cov.statementMap || {})) {
    const line = location.start.line;
    const hits = (cov.s || {})[statementId] || 0;

    lineHits.set(line, (lineHits.get(line) || 0) + hits);
  }

  const total = lineHits.size;
  const covered = [...lineHits.values()].filter(hits => hits > 0).length;

  return total === 0 ? 100 : (covered / total) * 100;
}

if (!fs.existsSync(COVERAGE_PATH)) {
  console.error(`Coverage file not found: ${ COVERAGE_PATH }`);
  process.exit(1);
}

const coverage = JSON.parse(fs.readFileSync(COVERAGE_PATH, 'utf8'));
const failures = [];

for (const relativePath of OWNED_COVERAGE_FILES) {
  const entry = Object.entries(coverage).find(([filePath]) => {
    return filePath.endsWith(relativePath);
  });

  if (!entry) {
    failures.push(`${ relativePath }: missing from merged coverage`);
    continue;
  }

  const [filePath, fileCoverage] = entry;
  const metrics = {
    statements: summarize(fileCoverage, 's'),
    branches: summarize(fileCoverage, 'b'),
    functions: summarize(fileCoverage, 'f'),
    lines: summarizeLines(fileCoverage),
  };

  const failingMetrics = Object.entries(metrics).filter(([, value]) => value !== 100);

  if (!failingMetrics.length) continue;

  failures.push(`${ path.relative(process.cwd(), filePath) }: ${ failingMetrics.map(([metric, value]) => `${ metric }=${ value.toFixed(2) }`).join(', ') }`);
}

if (failures.length) {
  console.error('Migrated file coverage check failed:');
  failures.forEach(failure => console.error(`- ${ failure }`));
  process.exit(1);
}

console.log(`Migrated file coverage check passed for ${ OWNED_COVERAGE_FILES.length } files.`);
