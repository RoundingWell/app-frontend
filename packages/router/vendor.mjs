// Reproduce the private JavaScript vendor copy from the exact reviewed source.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform, version } from 'esbuild';

const revision = 'a613f8de3a7c5a9a4d9aebe42a5f04b64b3ac6d0';
const upstream = path.resolve(process.argv[2]);
if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: upstream, encoding: 'utf8' }).trim() !== revision) {
  throw new Error(`Expected canonical router revision ${revision}`);
}
if (execFileSync('git', ['status', '--porcelain', '--', 'packages/router/src'], { cwd: upstream, encoding: 'utf8' }).trim()) {
  throw new Error('Upstream router source has local modifications');
}
const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(upstream, 'packages/router/src');
const files = {};
const hash = value => createHash('sha256').update(value).digest('hex');
for (const file of fs.readdirSync(source, { recursive: true }).filter(file => file.endsWith('.ts')).sort()) {
  const original = fs.readFileSync(path.join(source, file), 'utf8');
  const { code } = await transform(original, { loader: 'ts', target: 'esnext', format: 'esm' });
  const javascript = code.replace(/(from\s+["'][^"']+)\.ts(["'])/g, '$1.js$2');
  const output = file.replace(/\.ts$/, '.js');
  fs.mkdirSync(path.dirname(path.join(root, 'src', output)), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', output), javascript);
  files[file] = { source: hash(original), output, javascript: hash(javascript) };
}
fs.writeFileSync(path.join(root, 'source-manifest.json'), JSON.stringify({ revision, esbuild: version, files }, null, 2) + '\n');
