/// <reference lib="dom" />
import type { Page } from '@playwright/test'
import { test, expect as baseExpect } from '../fixtures'
import { captureBugShots, goInApp, login, readStore, writeStore } from './helpers-core'

/**
 * X-01 the delete-account section and dialog in Settings, X-03 finishing
 * deletion in demo mode (nothing is deleted; the neighbor is logged out).
 * The real server-side deletion needs Supabase and is covered elsewhere.
 */

captureBugShots(test)
const expect = baseExpect.configure({ timeout: 10_000 })

async function openSettings(page: Page) {
  await login(page, 'Jamie')
  await goInApp(page, '/settings')
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
}

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Delete your account?' })

async function openDialog(page: Page) {
  await openSettings(page)
  await page.getByRole('region', { name: 'Delete account' }).getByRole('button', { name: 'Delete account' }).click()
  await expect(dialog(page)).toBeVisible()
}

test.describe('X-01 delete account section', () => {
  test('Settings explains what deleting does before anything happens', async ({ page }) => {
    await openSettings(page)
    const section = page.getByRole('region', { name: 'Delete account' })
    await expect(section.getByRole('heading', { name: 'Delete account' })).toBeVisible()
    await expect(section).toContainText('Remove your profile, listings and photos from Bartrrr for good.')
    await expect(section).toContainText('“Former neighbor”')
    await expect(dialog(page)).toHaveCount(0)
  })

  test('the dialog lists the consequences and the demo note', async ({ page }) => {
    await openDialog(page)
    const d = dialog(page)
    await expect(d).toHaveAttribute('aria-modal', 'true')
    await expect(d).toContainText('This can’t be undone.')
    await expect(d.getByRole('listitem')).toHaveCount(5)
    await expect(d).toContainText('Withdraw your open offers and cancel trade agreements that aren’t finished.')
    await expect(d).toContainText('Messages you sent stay in their conversations.')
    await expect(d.getByText('This is the demo, so nothing is deleted: you’ll just be logged out.')).toBeVisible()
  })

  test('open offers and agreements are named in the warning', async ({ page }) => {
    await openSettings(page)
    // Give Jamie a known open offer with Maria
    await writeStore(
      page,
      'offers-store',
      `(store) => store.setState(s => ({ offers: [{ id: 'offer-test', listingId: 'listing-002', fromUserId: 'user-001',
        toUserId: 'user-002', messages: [], status: 'pending', round: 1, maxRounds: 5,
        expiresAt: new Date(Date.now() + 864e5).toISOString(), createdAt: new Date().toISOString() }, ...s.offers] }))`,
    )
    await page.getByRole('region', { name: 'Delete account' }).getByRole('button', { name: 'Delete account' }).click()
    await expect(dialog(page)).toContainText(/You have \d+ open offers?/)
    await expect(dialog(page)).toContainText(/Maria/)
    await expect(dialog(page)).toContainText('If you can, let them know first.')
  })

  test('the delete button stays off until DELETE is typed, in any case', async ({ page }) => {
    await openDialog(page)
    const d = dialog(page)
    const input = d.getByLabel('Type DELETE to confirm')
    const confirm = d.getByRole('button', { name: 'Delete account' })
    await expect(confirm).toBeDisabled()
    await expect(d.getByText('The button turns on once this matches.')).toBeVisible()

    for (const wrong of ['DELET', 'DELETED', 'remove', 'D E L E T E']) {
      await input.fill(wrong)
      await expect(confirm).toBeDisabled()
    }
    for (const right of ['DELETE', 'delete', 'Delete', '  dElEtE  ']) {
      await input.fill(right)
      await expect(confirm).toBeEnabled()
      await expect(d.getByText('Ready when you are.')).toBeVisible()
    }
    // Enter does nothing while it doesn't match
    await input.fill('nope')
    await input.press('Enter')
    await expect(d).toBeVisible()
    await expect(page).toHaveURL('/settings')
  })

  test('focus moves into the dialog and Tab stays inside it', async ({ page }) => {
    await openDialog(page)
    const d = dialog(page)
    await expect(d).toBeFocused()
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      expect(await d.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    }
  })

  test('"Keep my account" closes the dialog and returns focus', async ({ page }) => {
    await openDialog(page)
    await dialog(page).getByLabel('Type DELETE to confirm').fill('DELETE')
    await dialog(page).getByRole('button', { name: 'Keep my account' }).click()
    await expect(dialog(page)).toHaveCount(0)
    const opener = page.getByRole('region', { name: 'Delete account' }).getByRole('button', { name: 'Delete account' })
    await expect(opener).toBeFocused()
    // Still signed in, still on Settings
    await expect(page).toHaveURL('/settings')
    expect(await readStore<string>(page, 'auth-store', 's => s.currentUserId')).toBe('user-001')
    // Reopening starts fresh
    await opener.click()
    await expect(dialog(page).getByLabel('Type DELETE to confirm')).toHaveValue('')
  })

  test('Escape closes the dialog', async ({ page }) => {
    await openDialog(page)
    await dialog(page).getByLabel('Type DELETE to confirm').fill('del')
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toHaveCount(0)
    await expect(page).toHaveURL('/settings')
  })

  test('clicking outside the dialog closes it', async ({ page }) => {
    await openDialog(page)
    await page.mouse.click(5, 5)
    await expect(dialog(page)).toHaveCount(0)
  })
})

test.describe('X-03 finishing deletion (demo)', () => {
  test('deleting goes to the goodbye page and signs out', async ({ page }) => {
    await openDialog(page)
    await dialog(page).getByLabel('Type DELETE to confirm').fill('delete')
    await dialog(page).getByRole('button', { name: 'Delete account' }).click()
    await expect(page).toHaveURL('/goodbye')
    await expect(page).toHaveTitle('Account deleted | Bartrrr')
    await expect(page.getByRole('heading', { level: 1, name: /Thanks for trading,\s*neighbor\./ })).toBeVisible()
    await expect(page.getByText('Logged out', { exact: true })).toBeVisible()
    await expect(page.getByText(/This was the demo, so nothing was deleted\./)).toBeVisible()
    await expect.poll(() => readStore<string | null>(page, 'auth-store', 's => s.currentUserId')).toBeNull()
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bartrrr-auth') ?? '{}'))
    expect(saved.state?.currentUserId ?? null).toBeNull()

    await page.getByRole('link', { name: 'Go to the home page' }).click()
    await expect(page).toHaveURL('/')
  })

  test('pressing Enter in the confirm field deletes too', async ({ page }) => {
    await openDialog(page)
    const input = dialog(page).getByLabel('Type DELETE to confirm')
    await input.fill('DELETE')
    await input.press('Enter')
    await expect(page).toHaveURL('/goodbye')
  })

  test('after deleting, Settings and other private pages need a login again', async ({ page }) => {
    await openDialog(page)
    await dialog(page).getByLabel('Type DELETE to confirm').fill('DELETE')
    await dialog(page).getByRole('button', { name: 'Delete account' }).click()
    await expect(page).toHaveURL('/goodbye')
    await expect.poll(() => readStore<string | null>(page, 'auth-store', 's => s.currentUserId')).toBeNull()
    // In-app back button: must not land on Settings
    await page.goBack()
    await expect(page).not.toHaveURL('/settings')
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toHaveCount(0)
    // Fresh loads
    await page.goto('/settings')
    await expect(page).toHaveURL('/auth/login?returnTo=%2Fsettings')
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/auth/login?returnTo=%2Fdashboard')
    // Reloading the goodbye page later just goes home
    await page.goto('/goodbye')
    await expect(page).toHaveURL('/')
  })

  test.skip('real deletion removes photos, profile and listings on the server', () => {
    // Needs Supabase (delete_my_account RPC and storage); demo mode never deletes data.
  })
  test.skip('network and expired-session errors keep the dialog open with a message', () => {
    // Needs a backend to fail; ACCOUNT_DELETION_IS_DEMO short-circuits in demo mode.
  })
})
