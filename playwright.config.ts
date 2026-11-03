import { defineConfig, devices } from '@playwright/test'

/**
 * Demo end-to-end and quality tests (layers 3 and 6 of the regression plan).
 * They run against the offline demo build: mock data, no backend.
 *
 * PW_PORT lets several runs (e.g. parallel agents) use their own server.
 */
const port = Number(process.env.PW_PORT ?? 5180)
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: './e2e',
  testMatch: ['demo/**/*.spec.ts', 'quality/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One retry absorbs the dev server's first-load dependency reload; CI reports retries as flaky
  retries: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    // WebKit isn't installed in the cloud workspace; CI installs it
    ...(process.env.CI || process.env.PW_WEBKIT
      ? [{ name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } } }]
      : []),
  ],
  webServer: {
    command: `npx vite --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { VITE_DEMO_MODE: 'true', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
})
