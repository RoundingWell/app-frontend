import { execSync } from 'child_process';

try {
  const dirty = execSync('git status --porcelain').toString().trim();

  if (dirty) {
    console.error('Uncommitted changes detected. Aborting.');
    process.exit(1);
  }
} catch(e) {
  console.error('Failed to check git status:', e.message);
  process.exit(1);
}
