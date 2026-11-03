import { test, expect, loginAs, type DemoNeighbor } from '../fixtures'

for (const who of ['Jamie', 'Maria', 'Dave'] as DemoNeighbor[]) {
  test(`demo login works for ${who}`, async ({ page }) => {
    await loginAs(page, who)
    await expect(page).not.toHaveURL(/\/auth\//)
  })
}
