import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/core';

// Both Apps use Octokit authentication; callers supply separate credentials.
export function createGitHubAppClient({ appId, privateKey, installationId }) {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey: privateKey.replace(/\\n/g, '\n'), installationId },
    userAgent: 'care-ops-frontend-github-app',
  });
}

export async function dispatchAppTestsEvent({
  eventType,
  clientPayload,
}) {
  const appId = process.env.GH_APP_ID;
  const privateKey = process.env.GH_APP_PRIVATE_KEY;
  const installationId = process.env.GH_APP_INSTALLATION_ID;
  if (!appId || !privateKey || !installationId) {
    throw new Error('GH_APP_ID, GH_APP_PRIVATE_KEY, and GH_APP_INSTALLATION_ID are required');
  }
  const octokit = createGitHubAppClient({ appId, privateKey, installationId });

  await octokit.request('POST /repos/{owner}/{repo}/dispatches', {
    owner: 'RoundingWell',
    repo: 'app-tests',
    event_type: eventType,
    client_payload: clientPayload,
  });
}
