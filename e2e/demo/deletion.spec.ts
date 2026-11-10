/// <reference lib="dom" />
import type { Page } from '@playwright/test'
import { test, expect as baseExpect } from '../fixtures'
import { captureBugShots, goInApp, login, readStore, writeStore, type Neighbor } from './helpers-core'

/**
 * X-01 the delete-account section and dialog in Settings, X-03 finishing
 * deletion in demo mode (nothing is deleted; the neighbor is logged out),
 * X-04 confirming it's you first: a password for email accounts (Jamie),
 * a trip through Google for Google accounts (Maria, in the demo).
 * The real server-side deletion needs Supabase and is covered elsewhere.
 */

captureBugShots(test)
const expect = baseExpect.configure({ timeout: 10_000 })

async function openSettings(page: Page, who: Neighbor = 'Jamie') {
  await login(page, who)
  await goInApp(page, '/settings')
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
}

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Delete your account?' })

async function openDialog(page: Page, who: Neighbor = 'Jamie') {
  await openSettings(page, who)
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
    await expect(d.getByText('This is the demo, so nothing is deleted: you’ll just be logged out. Any password works.')).toBeVisible()
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
    await d.getByLabel('Your password').fill('demo-password')
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
    await dialog(page).getByLabel('Your password').fill('demo-password')
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
    await expect(dialog(page).getByLabel('Your password')).toHaveValue('')
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

  for (const size of [{ width: 360, height: 640 }, { width: 390, height: 844 }]) {
    test(`both choices are in reach without scrolling at ${size.width}×${size.height}`, async ({ page }) => {
      // T-12: on phones the delete button sat below the fold
      await page.setViewportSize(size)
      await openDialog(page)
      const d = dialog(page)
      for (const name of ['Keep my account', 'Delete account']) {
        const box = (await d.getByRole('button', { name, exact: true }).boundingBox())!
        expect(box.y, name).toBeGreaterThanOrEqual(0)
        expect(box.y + box.height, name).toBeLessThanOrEqual(size.height)
        expect(box.height, name).toBeGreaterThanOrEqual(44)
      }
      // Still asks for the same things, and the pinned button submits the form
      await d.getByLabel('Type DELETE to confirm').fill('DELETE')
      await expect(d.getByRole('button', { name: 'Delete account', exact: true })).toBeDisabled()
      await d.getByLabel('Your password').fill('demo-password')
      await expect(d.getByRole('button', { name: 'Delete account', exact: true })).toBeEnabled()
      await d.getByLabel('Type DELETE to confirm').press('Enter')
      await expect(page).toHaveURL('/goodbye')
    })
  }
})

test.describe('X-04 confirm it’s you before deleting', () => {
  test('email accounts: the password is needed as well as DELETE', async ({ page }) => {
    await openDialog(page)
    const d = dialog(page)
    await expect(d.getByRole('group', { name: 'Confirm it’s you' })).toBeVisible()
    const password = d.getByLabel('Your password')
    await expect(password).toHaveAttribute('type', 'password')
    await expect(password).toHaveAttribute('autocomplete', 'current-password')
    await expect(d.getByRole('button', { name: /Confirm with Google/ })).toHaveCount(0)
    const confirm = d.getByRole('button', { name: 'Delete account' })

    await d.getByLabel('Type DELETE to confirm').fill('DELETE')
    await expect(confirm).toBeDisabled()
    await expect(d.getByText('Enter your password above too.')).toBeVisible()

    await password.fill('anything')
    await expect(confirm).toBeEnabled()
    await expect(d.getByText('Ready when you are.')).toBeVisible()

    await password.fill('')
    await expect(confirm).toBeDisabled()
    // Enter does nothing without a password either
    await d.getByLabel('Type DELETE to confirm').press('Enter')
    await expect(page).toHaveURL('/settings')
  })

  test('Google accounts: no password field, a "Confirm with Google" step instead', async ({ page }) => {
    await openDialog(page, 'Maria')
    const d = dialog(page)
    await expect(d.getByLabel('Your password')).toHaveCount(0)
    await expect(d).toContainText('We’ll send you to Google and bring you back here.')
    await expect(d.getByText('This is the demo, so nothing is deleted: you’ll just be logged out.')).toBeVisible()
    await expect(d).not.toContainText('Any password works.')

    await d.getByLabel('Type DELETE to confirm').fill('DELETE')
    await expect(d.getByRole('button', { name: 'Delete account' })).toBeDisabled()
    await expect(d.getByText('Confirm with Google above too.')).toBeVisible()
  })

  test('Google accounts: the round trip comes back to Settings with the dialog open and confirmed', async ({ page }) => {
    await openDialog(page, 'Maria')
    await dialog(page).getByRole('button', { name: 'Confirm with Google' }).click()

    // Back on Settings (the ?confirm=delete marker is cleaned up), dialog reopened
    await expect(dialog(page)).toBeVisible()
    await expect(page).toHaveURL('/settings')
    const d = dialog(page)
    await expect(d.getByText('Confirmed with Google.')).toBeVisible()
    await expect(d.getByRole('button', { name: 'Confirm with Google' })).toHaveCount(0)

    const confirm = d.getByRole('button', { name: 'Delete account' })
    await expect(confirm).toBeDisabled()
    await d.getByLabel('Type DELETE to confirm').fill('delete')
    await expect(confirm).toBeEnabled()
    await confirm.click()
    await expect(page).toHaveURL('/goodbye')
    await expect.poll(() => readStore<string | null>(page, 'auth-store', 's => s.currentUserId')).toBeNull()
  })

  test('Google accounts: closing the dialog forgets the confirmation', async ({ page }) => {
    await openDialog(page, 'Maria')
    await dialog(page).getByRole('button', { name: 'Confirm with Google' }).click()
    await expect(dialog(page).getByText('Confirmed with Google.')).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Keep my account' }).click()
    await expect(dialog(page)).toHaveCount(0)
    await page.getByRole('region', { name: 'Delete account' }).getByRole('button', { name: 'Delete account' }).click()
    await expect(dialog(page).getByRole('button', { name: 'Confirm with Google' })).toBeVisible()
  })

  test('coming back to ?confirm=delete without starting the round trip asks again', async ({ page }) => {
    await openSettings(page, 'Maria')
    // The page drops ?confirm=delete at once, so don't wait to see it in the URL
    await goInApp(page, '/settings?confirm=delete', { redirects: true })
    const d = dialog(page)
    await expect(d).toBeVisible()
    await expect(d.getByRole('alert')).toHaveText('We couldn’t confirm it’s you, so nothing was deleted. Try again below.')
    await expect(d.getByRole('button', { name: 'Confirm with Google' })).toBeVisible()
    await expect(page).toHaveURL('/settings')
  })
})

test.describe('X-03 finishing deletion (demo)', () => {
  test('deleting goes to the goodbye page and signs out', async ({ page }) => {
    await openDialog(page)
    await dialog(page).getByLabel('Your password').fill('demo-password')
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
    await dialog(page).getByLabel('Your password').fill('demo-password')
    const input = dialog(page).getByLabel('Type DELETE to confirm')
    await input.fill('DELETE')
    await input.press('Enter')
    await expect(page).toHaveURL('/goodbye')
  })

  test('after deleting, Settings and other private pages need a login again', async ({ page }) => {
    await openDialog(page)
    await dialog(page).getByLabel('Your password').fill('demo-password')
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
  test.skip('a wrong password, or a sign-in older than 10 minutes, keeps the account', () => {
    // Needs Supabase Auth and migration 013; covered by unit tests and 40_deletion.sql X-04.
  })
})
