/* eslint-disable no-console */
import fs from 'fs';

const COVERAGE_PATH = '.nyc_output/merged.json';
const MIN_STATEMENT_COVERAGE = 100;
const MIN_BRANCH_COVERAGE = 100;
const MIN_FUNCTION_COVERAGE = 100;
const MIN_LINE_COVERAGE = 100;

if (!fs.existsSync(COVERAGE_PATH)) {
  console.error(`Coverage file not found: ${ COVERAGE_PATH }`);
  process.exit(1);
}

const coverage = JSON.parse(fs.readFileSync(COVERAGE_PATH, 'utf8'));

let relevantLines = 0;
let coveredLines = 0;
let relevantStatements = 0;
let coveredStatements = 0;
let relevantBranches = 0;
let coveredBranches = 0;
let relevantFunctions = 0;
let coveredFunctions = 0;

for (const fileCoverage of Object.values(coverage)) {
  const lineHits = new Map();

  for (const hits of Object.values(fileCoverage.s || {})) {
    relevantStatements += 1;

    if (hits > 0) {
      coveredStatements += 1;
    }
  }

  for (const [statementId, location] of Object.entries(fileCoverage.statementMap || {})) {
    const line = location.start.line;
    const hits = (fileCoverage.s || {})[statementId] || 0;

    lineHits.set(line, (lineHits.get(line) || 0) + hits);
  }

  relevantLines += lineHits.size;
  coveredLines += [...lineHits.values()].filter(hits => hits > 0).length;

  for (const hits of Object.values(fileCoverage.f || {})) {
    relevantFunctions += 1;

    if (hits > 0) {
      coveredFunctions += 1;
    }
  }

  for (const [branchId, branchMeta] of Object.entries(fileCoverage.branchMap || {})) {
    const hits = (fileCoverage.b || {})[branchId] || [];

    branchMeta.locations.forEach((_, index) => {
      relevantBranches += 1;

      if ((hits[index] || 0) > 0) {
        coveredBranches += 1;
      }
    });
  }
}

const statementCoverage = (coveredStatements / relevantStatements) * 100;
const lineCoverage = (coveredLines / relevantLines) * 100;
const branchCoverage = (coveredBranches / relevantBranches) * 100;
const functionCoverage = (coveredFunctions / relevantFunctions) * 100;
const hasRelevantCoverage = relevantStatements > 0
  && relevantFunctions > 0
  && relevantLines > 0
  && relevantBranches > 0;

if (!hasRelevantCoverage) {
  console.error('Coverage baseline check failed: merged coverage is empty or incomplete.');
  console.error(`- statements: ${ coveredStatements }/${ relevantStatements }`);
  console.error(`- functions: ${ coveredFunctions }/${ relevantFunctions }`);
  console.error(`- lines: ${ coveredLines }/${ relevantLines }`);
  console.error(`- branches: ${ coveredBranches }/${ relevantBranches }`);
  process.exit(1);
}

if (
  statementCoverage < MIN_STATEMENT_COVERAGE
  || branchCoverage < MIN_BRANCH_COVERAGE
  || functionCoverage < MIN_FUNCTION_COVERAGE
  || lineCoverage < MIN_LINE_COVERAGE
) {
  console.error('Coverage baseline check failed:');
  console.error(`- statements: ${ coveredStatements }/${ relevantStatements } (${ statementCoverage.toFixed(2) }%), expected at least ${ MIN_STATEMENT_COVERAGE.toFixed(2) }%`);
  console.error(`- functions: ${ coveredFunctions }/${ relevantFunctions } (${ functionCoverage.toFixed(2) }%), expected at least ${ MIN_FUNCTION_COVERAGE.toFixed(2) }%`);
  console.error(`- lines: ${ coveredLines }/${ relevantLines } (${ lineCoverage.toFixed(2) }%), expected at least ${ MIN_LINE_COVERAGE.toFixed(2) }%`);
  console.error(`- branches: ${ coveredBranches }/${ relevantBranches } (${ branchCoverage.toFixed(2) }%), expected at least ${ MIN_BRANCH_COVERAGE.toFixed(2) }%`);
  process.exit(1);
}

console.log(
  `Coverage baseline check passed: ${ coveredStatements }/${ relevantStatements } statements (${ statementCoverage.toFixed(2) }%), `
  + `${ coveredFunctions }/${ relevantFunctions } functions (${ functionCoverage.toFixed(2) }%), `
  + `${ coveredLines }/${ relevantLines } lines (${ lineCoverage.toFixed(2) }%), `
  + `${ coveredBranches }/${ relevantBranches } branches (${ branchCoverage.toFixed(2) }%).`,
);
