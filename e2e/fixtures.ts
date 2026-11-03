import { test as base, expect, type Page } from '@playwright/test'

export type DemoNeighbor = 'Jamie' | 'Maria' | 'Alex' | 'Priya' | 'Jordan' | 'Sam' | 'Dave'

/** Sign in through the demo picker on /auth/login (demo mode only). */
export async function loginAs(page: Page, name: DemoNeighbor = 'Jamie') {
  await page.goto('/auth/login')
  // Picker labels read "JO Jamie Oakley …" once avatars fall back to initials,
  // so match the first name anywhere in the label, not at the start
  await page
    .getByRole('group', { name: /pick a sample neighbor/ })
    .getByRole('button', { name: new RegExp(`\\b${name} `) })
    .click()
  await page.getByRole('button', { name: `Log in as ${name}` }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/'))
}

/** Fails the test on uncaught page errors. Console errors from blocked
 *  external images are expected in the sandbox and ignored. */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await use(errors)
      expect(errors, 'uncaught page errors').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
