import { globSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

import { transformSync } from '@babel/core';
import istanbul from 'istanbul-lib-coverage';
import coverageConfig from '../config/coverage.cjs';

const require = createRequire(import.meta.url);
const { coverageBabelOptions } = coverageConfig;
const normalize = path => path.replaceAll('\\', '/');

export function assertCompleteInventory(coverage, files) {
  const missing = files.filter(file => !coverage.files().includes(file));
  if (missing.length) throw new Error(`Coverage inventory is missing: ${ missing.join(', ') }`);
}

function instrumentSources(cwd, files, config) {
  const sourceMaps = new Map();
  for (const file of files) {
    transformSync(readFileSync(file, 'utf8'), {
      ...coverageBabelOptions({ cwd, config, onCover: (path, coverage) => {
        sourceMaps.set(normalize(path), coverage);
      } }),
      filename: file,
    });
    if (!sourceMaps.has(file)) throw new Error(`Eligible file was not instrumented: ${ file }`);
  }
  return sourceMaps;
}

function assertCompatibleSource(source, coverage, path) {
  for (const field of ['statementMap', 'fnMap', 'branchMap']) {
    // Istanbul merges ignored if-arm placeholders with empty locations.
    // Compare executable locations rather than unstable counter IDs.
    const locations = value => Object.values(value).filter(item => {
      return field !== 'branchMap' || item.locations.some(location => location.start.line);
    }).map(item => JSON.stringify(item)).sort();
    if (JSON.stringify(locations(source[field])) !== JSON.stringify(locations(coverage[field]))) {
      throw new Error(`Coverage source map differs from current source: ${ path } (${ field })`);
    }
  }
}

function mergeInputs(map, inputs, cwd, files, sourceMaps) {
  for (const input of inputs) {
    for (const [key, coverage] of Object.entries(input)) {
      const inputPath = normalize(coverage.path || key);
      // Match foreign checkout paths only against a unique eligible source suffix.
      // Never infer identity from a basename, or keep two records for one source.
      const matches = files.filter(file => {
        return inputPath === normalize(resolve(cwd, file)) || inputPath === normalize(file)
          || inputPath.endsWith(`/${ normalize(file) }`);
      });
      if (!matches.length) continue; // Outside the configured reporting scope.
      if (matches.length !== 1) throw new Error(`Ambiguous coverage path: ${ inputPath }`);
      const path = normalize(resolve(cwd, matches[0]));
      assertCompatibleSource(sourceMaps.get(path), coverage, path);
      map.merge({ [path]: { ...coverage, path } });
    }
  }
}

export function completeCoverage(cwd, inputs, config) {
  cwd = realpathSync(cwd);
  const excluded = new Set(globSync(config.exclude, { cwd }));
  const files = globSync(config.include, { cwd }).filter(file => !excluded.has(file)).sort();
  const canonical = files.map(file => normalize(resolve(cwd, file)));
  const sourceMaps = instrumentSources(cwd, canonical, config);
  const map = istanbul.createCoverageMap({});
  mergeInputs(map, inputs, cwd, files, sourceMaps);
  for (const file of canonical) {
    if (!map.files().includes(file)) map.addFileCoverage(sourceMaps.get(file));
  }
  assertCompleteInventory(map, canonical);
  return { map, files: canonical };
}

export function reportCoverage(cwd, args = []) {
  const config = JSON.parse(readFileSync(join(cwd, '.nycrc.json'), 'utf8'));
  const inputDirectory = resolve(cwd, config['temp-dir'] || '.nyc_output');
  const inputs = readdirSync(inputDirectory).filter(file => file.endsWith('.json'))
    .map(file => JSON.parse(readFileSync(join(inputDirectory, file), 'utf8')));
  if (!inputs.length) throw new Error('No collected coverage input; run the relevant tests first');
  const { map, files } = completeCoverage(cwd, inputs, config);
  const directory = mkdtempSync(join(tmpdir(), 'complete-coverage-'));
  try {
    writeFileSync(join(directory, 'out.json'), JSON.stringify(map));
    const ci = args.includes('--ci');
    const reporters = ci ? ['lcovonly'] : ['html', 'text', 'lcovonly'];
    process.stdout.write(`Coverage inventory: ${ files.length } eligible files, including unloaded files\n`);
    const result = spawnSync(process.execPath, [
      require.resolve('nyc/bin/nyc.js'), 'report', '--temp-dir', directory,
      ...reporters.map(reporter => `--reporter=${ reporter }`),
      ...args.filter(arg => arg !== '--ci'),
    ], { cwd, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Coverage reporter exited ${ result.status }`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  reportCoverage(process.cwd(), process.argv.slice(2));
}
