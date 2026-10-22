import { lstatSync, mkdirSync, readlinkSync, statSync, symlinkSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const skill = join(root, 'node_modules/marionette/skills/marionette');

if (!statSync(join(skill, 'SKILL.md'), { throwIfNoEntry: false })?.isFile()) {
  throw new Error('Installed Marionette skill is missing. Run npm ci first.');
}

for (const client of ['.agents', '.claude']) {
  const directory = join(root, client, 'skills');
  for (const parent of [dirname(directory), directory]) {
    const entry = lstatSync(parent, { throwIfNoEntry: false });
    if (entry && !entry.isDirectory()) {
      throw new Error(`Expected a real project directory: ${ relative(root, parent) }`);
    }
  }
  const path = join(directory, 'marionette');
  const target = relative(directory, skill);
  const entry = lstatSync(path, { throwIfNoEntry: false });
  if (entry && (!entry.isSymbolicLink() || readlinkSync(path) !== target)) {
    throw new Error(`Refusing to replace ${ relative(root, path) }; move the existing entry aside before retrying.`);
  }
  if (entry) continue;
  mkdirSync(directory, { recursive: true });
  symlinkSync(target, path, 'dir');
}
process.stdout.write('Project Marionette skill links ready. Verify skill loading in your client.\n');
