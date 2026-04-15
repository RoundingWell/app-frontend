/* eslint-disable no-console */
import http from 'http';
import { spawn } from 'child_process';

const [mode, ...cypressArgs] = process.argv.slice(2);
const PREVIEW_URL = 'http://localhost:8090/';

if (!mode) {
  console.error('Usage: node test/unit/run-cypress-coverage.mjs <mode> [cypress-args...]');
  process.exit(1);
}

function waitForPreview(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const request = http.get(url, response => {
        response.resume();

        if (response.statusCode && response.statusCode < 500) {
          resolve();
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for preview at ${ url }`));
          return;
        }

        setTimeout(tryConnect, 250);
      });

      request.on('error', () => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for preview at ${ url }`));
          return;
        }

        setTimeout(tryConnect, 250);
      });
    };

    tryConnect();
  });
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Process exited via signal ${ signal }`));
        return;
      }

      resolve(code ?? 0);
    });

    child.on('error', reject);
  });
}

const preview = spawn('npx', ['vite', 'preview', '-m', 'test'], {
  stdio: 'inherit',
});

let exiting = false;

function stopPreview() {
  if (exiting || preview.killed) return;

  exiting = true;
  preview.kill('SIGTERM');
}

for (const signal of ['SIGINT', 'SIGTERM', 'exit']) {
  process.on(signal, stopPreview);
}

try {
  await waitForPreview(PREVIEW_URL);

  const cypress = spawn('npx', ['cypress', 'run', ...cypressArgs], {
    stdio: 'inherit',
  });

  const cypressExitCode = await waitForExit(cypress);

  if (cypressExitCode !== 0) {
    process.exit(cypressExitCode);
  }

  const saveCoverage = spawn('node', ['test/unit/save-cypress-coverage.mjs', mode], {
    stdio: 'inherit',
  });

  process.exit(await waitForExit(saveCoverage));
} finally {
  stopPreview();
}
