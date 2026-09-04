import { defineConfig, devices } from '@playwright/test';

/**
 * Project A.E.G.I.S — Playwright E2E Configuration (Phase 10 §10)
 *
 * Drives the fallback console (the same harness anyone without a
 * WebMCP-capable browser uses) through the full §0 loop end to end,
 * against a real production build rather than the dev server, so the
 * client-only Canvas subtree and its dynamic import are exercised as a
 * real visitor would hit them.
 */
export default defineConfig({
  testDir: './e2e',
  // CI runners are GPU-less (SwiftShader software rendering) and only 2
  // cores; the clearcoat-shaded facility + shadow-casting robot meshes
  // (added in 28be2e9) render far slower there than on a real GPU, so the
  // mission-loop test needs real headroom or it times out mid-click even
  // though the app is functioning correctly.
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run start -- -p 3100',
    url: 'http://127.0.0.1:3100',
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
