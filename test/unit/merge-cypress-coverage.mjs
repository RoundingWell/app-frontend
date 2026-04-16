/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const CYPRESS_COVERAGE_DIR = '.nyc_output/cypress';
const OUTPUT_PATH = '.nyc_output/out.json';

if (!fs.existsSync(CYPRESS_COVERAGE_DIR)) {
  console.error(`Cypress coverage directory not found: ${ CYPRESS_COVERAGE_DIR }`);
  process.exit(1);
}

const coverageFiles = fs.readdirSync(CYPRESS_COVERAGE_DIR)
  .filter(fileName => fileName.endsWith('.json'))
  .map(fileName => path.join(CYPRESS_COVERAGE_DIR, fileName))
  .sort();

if (!coverageFiles.length) {
  console.error(`No Cypress coverage files found in ${ CYPRESS_COVERAGE_DIR }`);
  process.exit(1);
}

const tempDir = fs.mkdtempSync(path.join('/tmp', 'care-ops-cypress-coverage-'));

try {
  coverageFiles.forEach((filePath, index) => {
    fs.copyFileSync(filePath, path.join(tempDir, `${ index }.json`));
  });

  execFileSync('npx', ['nyc', 'merge', tempDir, OUTPUT_PATH], {
    stdio: 'inherit',
  });
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log(`Merged Cypress coverage written to ${ OUTPUT_PATH } from ${ coverageFiles.length } files.`);
