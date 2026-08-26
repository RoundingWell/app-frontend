import supersetEmbeddedSdk from '@superset-ui/embedded-sdk';

function embedDashboard({
  id,
  domain,
  container,
  fetchGuestToken,
  dashboardUiConfig = {
    hideTitle: true,
    filters: { expanded: false },
  },
}) {
  return supersetEmbeddedSdk.embedDashboard({
    id,
    supersetDomain: domain,
    mountPoint: container,
    fetchGuestToken,
    dashboardUiConfig,
  });
}

export { embedDashboard };
