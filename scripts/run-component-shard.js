import { globSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export function splitSpecs(specs, count) {
  if (!Number.isInteger(count) || count < 1 || count > specs.length) {
    throw new Error('Worker count must be between 1 and the number of component specs');
  }

  const groups = Array.from({ length: count }, () => ({ specs: [], size: 0 }));
  const sorted = [...specs].sort((a, b) => b.size - a.size || a.path.localeCompare(b.path));
  for (const spec of sorted) {
    const group = groups.reduce((smallest, candidate) => candidate.size < smallest.size ? candidate : smallest);
    group.specs.push(spec.path);
    group.size += Math.max(spec.size, 1);
  }
  return groups.map(group => group.specs.sort());
}

export function selectSpecs(specs, env) {
  const count = Number(env.CIRCLE_NODE_TOTAL ?? 1);
  const index = Number(env.CIRCLE_NODE_INDEX ?? 0);
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new Error('Worker index must be an integer within the configured worker count');
  }
  return splitSpecs(specs, count)[index];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const specs = globSync('src/**/*.component.cy.js').map(path => ({ path, size: statSync(path).size }));
  const selected = selectSpecs(specs, process.env);
  process.stdout.write(`Component worker ${ Number(process.env.CIRCLE_NODE_INDEX ?? 0) + 1 }/${ process.env.CIRCLE_NODE_TOTAL ?? 1 }: ${ selected.length } specs\n`);
  const result = spawnSync(process.execPath, [
    resolve('node_modules/cypress/bin/cypress'), 'run', '--component', '--spec', selected.join(','), ...process.argv.slice(2),
  ], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
