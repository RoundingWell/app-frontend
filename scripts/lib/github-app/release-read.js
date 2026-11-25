const repository = 'RoundingWell/app-frontend';
const api = 'https://api.github.com';
const endpointAllowed = /^\/(?:repos\/RoundingWell\/app-frontend\/git\/(?:ref\/tags\/v\d{6}\.\d+|tags\/[0-9a-f]{40})|users\/[a-z0-9][a-z0-9-]{0,38})$/i;

async function mintToken(env, createClient) {
  const { GH_APP_ID: appId, GH_APP_INSTALLATION_ID: installationId, GH_APP_PRIVATE_KEY: privateKey } = env;
  if (!appId || !/^\d+$/.test(installationId ?? '') || !privateKey) {
    throw new Error('Missing E2E GitHub App credentials for release metadata');
  }

  try {
    createClient ??= (await import('./index.js')).createGitHubAppClient;
    const octokit = createClient({ appId, installationId, privateKey });
    const { data } = await octokit.request('POST /app/installations/{installation_id}/access_tokens', {
      installation_id: installationId,
      repositories: ['app-frontend'],
      permissions: { contents: 'read' },
      request: { redirect: 'error', signal: AbortSignal.timeout(15000) },
    });
    return data;
  } catch (error) {
    // Octokit errors may carry the request headers. Never forward the raw error.
    const status = Number.isInteger(error.status) ? ` (HTTP ${ error.status })` : '';
    throw new Error(`Could not mint the release GitHub App token${ status }`);
  }
}

export async function withReleaseGitHub(read, { env = process.env, createClient, fetchApi = fetch } = {}) {
  const { token, permissions, repositories } = await mintToken(env, createClient);
  if (typeof token !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(token)) {
    throw new Error('Invalid release GitHub App token');
  }
  const headers = { Authorization: `Bearer ${ token }`, Accept: 'application/vnd.github+json' };
  const request = (url, method) => fetchApi(url, {
    method, headers, redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  try {
    if (repositories?.length !== 1 || repositories[0].full_name !== repository
      || permissions?.contents !== 'read'
      || Object.entries(permissions).some(([name, level]) => name !== 'contents' && !(name === 'metadata' && level === 'read'))) {
      throw new Error('Release GitHub App token must be scoped to app-frontend Contents: read');
    }

    return await read(async url => {
      const endpoint = new URL(url);
      if (endpoint.origin !== api || endpoint.search || endpoint.hash || !endpointAllowed.test(endpoint.pathname)) {
        throw new Error('Unexpected GitHub release lookup endpoint');
      }
      const response = await request(url, 'GET');
      if (!response.ok) throw new Error(`GitHub release lookup returned HTTP ${ response.status }`);
      return response.json();
    });
  } finally {
    try {
      const response = await request(`${ api }/installation/token`, 'DELETE');
      if (!response.ok && response.status !== 401) throw new Error();
    } catch {
      // The token is never stored and expires on its own if early revocation fails.
      console.warn('Could not revoke the short-lived release GitHub App token');
    }
  }
}
