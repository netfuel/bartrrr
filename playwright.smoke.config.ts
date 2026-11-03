import { defineConfig, devices } from '@playwright/test'

/** Read-only checks against production (layer 8). Never writes data. */
export default defineConfig({
  testDir: './e2e/smoke',
  reporter: process.env.CI ? [['github']] : [['list']],
  use: { baseURL: process.env.SMOKE_URL ?? 'https://bartrrr.app', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
