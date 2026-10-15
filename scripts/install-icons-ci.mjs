import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const appVariables = ['PKG_ICONS_APP_CLIENT_ID', 'PKG_ICONS_APP_INSTALLATION_ID', 'PKG_ICONS_APP_PRIVATE_KEY_BASE64'];
const privateVariables = [...appVariables, 'PKG_ICONS_APP_PRIVATE_KEY', 'PKG_ICONS_READ_TOKEN'];

function fail(message) {
  throw new Error(`pkg-icons App authentication: ${message}`);
}

// CircleCI does not automatically mask tokens minted during a run.
function redact(stream, destination, token) {
  let pending = '';
  stream.setEncoding('utf8');
  stream.on('data', chunk => {
    pending = (pending + chunk).replaceAll(token, '[REDACTED]');
    const count = Math.max(0, pending.length - token.length + 1);
    destination.write(pending.slice(0, count));
    pending = pending.slice(count);
  });
  stream.on('end', () => destination.write(pending.replaceAll(token, '[REDACTED]')));
}

let token;
try {
  const credentials = appVariables.map(name => process.env[name]);
  // Project variables otherwise return in every later CircleCI run step.
  if (process.env.BASH_ENV) appendFileSync(process.env.BASH_ENV, `\nunset ${privateVariables.join(' ')}\n`, { mode: 0o600 });
  for (const name of [...privateVariables, 'GH_APP_ID', 'GH_APP_PRIVATE_KEY', 'GH_APP_INSTALLATION_ID']) delete process.env[name];
  delete process.env.BASH_ENV;
  const missing = appVariables.filter((name, index) => !credentials[index]);
  if (missing.length) fail(`required CI variables missing: ${missing.join(', ')}; personal-token fallback is disabled`);
  const [clientId, installationId, privateKey] = credentials;
  if (!/^[A-Za-z0-9_.-]+$/.test(clientId) || !/^\d+$/.test(installationId)) fail('invalid App client or installation identifier');
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(privateKey)) fail('invalid PKG_ICONS_APP_PRIVATE_KEY_BASE64');
  // Only the pinned public Octokit dependencies bootstrap before the private fetch.
  const bootstrap = spawnSync('npm', ['ci', '--ignore-scripts', '--prefer-offline', '--no-audit', '--no-fund'], {
    cwd: fileURLToPath(new URL('./lib/github-app/', import.meta.url)), stdio: 'inherit',
  });
  if (bootstrap.status !== 0) fail('Octokit bootstrap failed');
  const { createGitHubAppClient } = await import('./lib/github-app/index.js');
  const octokit = createGitHubAppClient({ appId: clientId, installationId, privateKey: Buffer.from(privateKey, 'base64').toString('utf8') });
  const { data: result } = await octokit.request('POST /app/installations/{installation_id}/access_tokens', {
    installation_id: installationId, repositories: ['pkg-icons'], permissions: { contents: 'read' },
    request: { redirect: 'error', signal: AbortSignal.timeout(15000) },
  });
  if (typeof result.token !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(result.token)) fail('invalid installation token');
  token = result.token;
  if (result.repositories?.length !== 1 || result.repositories[0].full_name !== 'RoundingWell/pkg-icons') fail('token must target only RoundingWell/pkg-icons; verify the installation');
  console.log('pkg-icons: App token scoped to RoundingWell/pkg-icons, Contents: read');
  const child = spawn('bash', [fileURLToPath(new URL('./with-icons-auth.sh', import.meta.url))], {
    env: { ...process.env, PKG_ICONS_READ_TOKEN: token }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  redact(child.stdout, process.stdout, token);
  redact(child.stderr, process.stderr, token);
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => resolve(code ?? 1));
  });
} catch (error) {
  console.error(error.message?.startsWith('pkg-icons App authentication:') ? error.message : `pkg-icons App authentication: bootstrap failed${Number.isInteger(error.status) ? ` (HTTP ${error.status})` : ''}`);
  process.exitCode = 1;
} finally {
  if (token) {
    try {
      // Revoke the issued token directly; App-auth hooks would mint another one.
      const response = await fetch('https://api.github.com/installation/token', {
        method: 'DELETE', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      });
      if (!response.ok && response.status !== 401) fail(`token revocation returned HTTP ${response.status}`);
      console.log('pkg-icons: installation token revoked');
    } catch (error) {
      console.error(error.message?.startsWith('pkg-icons App authentication:') ? error.message : 'pkg-icons App authentication: token revocation failed');
      process.exitCode ||= 1;
    }
  }
}
