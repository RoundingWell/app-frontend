import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/core';

const E2E_REPO_OWNER = 'RoundingWell';
const E2E_REPO_NAME = 'app-tests';

function createGitHubAppClient() {
  const appId = process.env.GH_APP_ID;
  const privateKey = process.env.GH_APP_PRIVATE_KEY;
  const installationId = process.env.GH_APP_INSTALLATION_ID;

  if (!appId || !privateKey || !installationId) {
    throw new Error('GH_APP_ID, GH_APP_PRIVATE_KEY, and GH_APP_INSTALLATION_ID are required');
  }
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      installationId,
    },
    userAgent: 'care-ops-frontend-github-app',
  });
}

export async function dispatchAppTestsEvent({
  eventType,
  clientPayload,
}) {
  const octokit = createGitHubAppClient();

  await octokit.request('POST /repos/{owner}/{repo}/dispatches', {
    owner: E2E_REPO_OWNER,
    repo: E2E_REPO_NAME,
    event_type: eventType,
    client_payload: clientPayload,
  });
}
