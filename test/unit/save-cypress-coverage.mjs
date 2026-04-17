/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import { normalizeCoverageMap } from './normalize-coverage-map.mjs';

const [targetName] = process.argv.slice(2);
const sourcePath = '.nyc_output/out.json';

if (!targetName) {
  console.error('Usage: node test/unit/save-cypress-coverage.mjs <target-name>');
  process.exit(1);
}

if (!fs.existsSync(sourcePath)) {
  console.error(`Coverage file not found: ${ sourcePath }`);
  process.exit(1);
}

const targetDir = '.nyc_output/cypress';
const targetPath = path.join(targetDir, `${ targetName }.json`);
const sourceCoverage = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const normalizedCoverage = normalizeCoverageMap(sourceCoverage);

fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(targetPath, JSON.stringify(normalizedCoverage));

console.log(`Saved Cypress coverage to ${ targetPath }.`);
