// Reproduce the private JavaScript vendor copy from the exact reviewed source.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform, version } from 'esbuild';

const revision = 'c4a7134d8d37322c31e1595ecad037ba64ce2356';
const upstream = path.resolve(process.argv[2]);
if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: upstream, encoding: 'utf8' }).trim() !== revision) {
  throw new Error(`Expected canonical router revision ${ revision }`);
}
if (execFileSync('git', ['status', '--porcelain', '--', 'packages/router'], { cwd: upstream, encoding: 'utf8' }).trim()) {
  throw new Error('Upstream router package has local modifications');
}
const root = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(root, 'source-manifest.json');
const previous = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const source = path.join(upstream, 'packages/router/src');
const files = {};
const hash = value => createHash('sha256').update(value).digest('hex');
for (const file of fs.readdirSync(source, { recursive: true }).filter(entry => entry.endsWith('.ts')).sort()) {
  const original = fs.readFileSync(path.join(source, file), 'utf8');
  const { code } = await transform(original, { loader: 'ts', target: 'esnext', format: 'esm' });
  const javascript = code.replace(/(from\s+["'][^"']+)\.ts(["'])/g, '$1.js$2');
  const output = file.replace(/\.ts$/, '.js');
  fs.mkdirSync(path.dirname(path.join(root, 'src', output)), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', output), javascript);
  files[file] = { source: hash(original), output, javascript: hash(javascript) };
}
for (const { output } of Object.values(previous.files)) {
  if (!Object.values(files).some(file => file.output === output)) {
    fs.rmSync(path.join(root, 'src', output));
  }
}
const documents = {};
const upstreamPackage = path.join(upstream, 'packages/router');
for (const file of ['readme.md', 'DESIGN.md', 'PROVENANCE.md',
  ...fs.readdirSync(path.join(upstreamPackage, 'examples'), { recursive: true })
    .filter(entry => fs.statSync(path.join(upstreamPackage, 'examples', entry)).isFile())
    .sort()
    .map(entry => path.join('examples', entry))]) {
  const original = fs.readFileSync(path.join(upstreamPackage, file));
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), original);
  documents[file] = hash(original);
}
fs.writeFileSync(manifestPath, `${ JSON.stringify({ revision, esbuild: version, files, documents }, null, 2) }\n`);
