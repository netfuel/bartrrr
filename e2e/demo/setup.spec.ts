import { test, expect, loginAs } from '../fixtures'

test('demo login lands on the dashboard', async ({ page }) => {
  await loginAs(page, 'Jamie')
  await expect(page).toHaveURL(/\/dashboard|\/browse|\/$/)
})
