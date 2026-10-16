import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.ROUTER_CONFORMANCE_PORT || 8097);

export default defineConfig({
  testDir: 'test/browser',
  testMatch: '*.spec.js',
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${ port }` },
  webServer: {
    command: 'node test/browser/server.js',
    url: `http://127.0.0.1:${ port }/`,
    env: { ROUTER_CONFORMANCE_PORT: String(port) },
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
