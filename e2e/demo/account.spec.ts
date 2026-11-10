/// <reference lib="dom" />
import { test, expect as baseExpect } from '../fixtures'
import { captureBugShots, goInApp, isMobile, login, readStore } from './helpers-core'

/**
 * A-01 sign up and log in (demo mode), A-02 sign out, A-05 protected pages
 * and the back button. Demo mode has no backend: the email and password
 * forms are hidden and the demo picker stands in for an account.
 */

captureBugShots(test)
const expect = baseExpect.configure({ timeout: 10_000 })

test.describe('A-01 log in and sign up (demo)', () => {
  test('login page shows the demo picker, not an email form, and logs in as the picked neighbor', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page).toHaveTitle('Log in | Bartrrr')
    await expect(page.getByRole('heading', { name: 'Welcome back, neighbor.' })).toBeVisible()
    // No backend in demo mode: no email or password fields
    await expect(page.getByLabel('Email')).toHaveCount(0)
    await expect(page.getByLabel('Password')).toHaveCount(0)

    const picker = page.getByRole('group', { name: /pick a sample neighbor/i })
    await expect(picker.getByRole('button')).toHaveCount(8)
    // First neighbor is preselected
    await expect(picker.getByRole('button', { name: /Jamie Oakley/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Log in as Jamie' })).toBeEnabled()

    await picker.getByRole('button', { name: /Maria Santos/ }).click()
    await expect(picker.getByRole('button', { name: /Maria Santos/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(picker.getByRole('button', { name: /Jamie Oakley/ })).toHaveAttribute('aria-pressed', 'false')
    await page.getByRole('button', { name: 'Log in as Maria' }).click()

    await expect(page).toHaveURL('/browse')
    expect(await readStore<string>(page, 'auth-store', 's => s.currentUserId')).toBe('user-002')
    await expect(page.getByText('This is a demo: pick any neighbor to explore Bartrrr.')).toHaveCount(0)
  })

  test('login page links to sign up, terms and privacy', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/auth/signup')
    await page.getByRole('link', { name: 'Create an account' }).click()
    await expect(page).toHaveURL('/auth/signup')
    await expect(page).toHaveTitle('Join | Bartrrr')
    await expect(page.getByRole('heading', { name: 'Join your neighbors. Start trading.' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/auth/login')
  })

  test('a deep link survives login (returnTo)', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL('/auth/login?returnTo=%2Fsettings')
    await page.getByRole('button', { name: 'Log in as Jamie' }).click()
    await expect(page).toHaveURL('/settings')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('an off-site returnTo is ignored', async ({ page }) => {
    await page.goto('/auth/login?returnTo=%2F%2Fevil.example%2Fsteal')
    await page.getByRole('button', { name: 'Log in as Jamie' }).click()
    await expect(page).toHaveURL('/browse')
  })

  test('visiting login while logged in goes straight into the app', async ({ page }) => {
    await login(page, 'Jamie')
    await page.goto('/auth/login')
    await expect(page).toHaveURL('/browse')
    await page.goto('/auth/signup')
    await expect(page).toHaveURL('/browse')
  })

  test('sign up: the ZIP field explains what it needs', async ({ page }) => {
    await page.goto('/auth/signup')
    await expect(page.getByText('Available in Memphis, TN')).toBeVisible()
    await page.getByRole('button', { name: 'Enter a ZIP code instead' }).click()
    const zip = page.getByLabel('ZIP code')
    await expect(zip).toBeVisible()
    await expect(zip).toHaveAttribute('inputmode', 'numeric')

    await zip.fill('381')
    await page.getByRole('button', { name: 'Check availability' }).click()
    await expect(page.getByText('Enter a 5-digit ZIP code, like 38104.')).toBeVisible()
    await expect(zip).toHaveAttribute('aria-invalid', 'true')

    // Typing clears the error
    await zip.fill('3810')
    await expect(page.getByText('Enter a 5-digit ZIP code, like 38104.')).toHaveCount(0)

    await zip.fill('abcde')
    await zip.press('Enter')
    await expect(page.getByText('Enter a 5-digit ZIP code, like 38104.')).toBeVisible()

    // maxLength keeps it to 5 characters
    await zip.fill('3810412')
    await expect(zip).toHaveValue('38104')
  })

  test('sign up with a Memphis ZIP shows the demo picker, then onboarding', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.getByRole('button', { name: 'Enter a ZIP code instead' }).click()
    await page.getByLabel('ZIP code').fill('38104')
    await page.getByRole('button', { name: 'Check availability' }).click()
    await expect(page.getByText('Good news: 38104 is in our area.')).toBeVisible()
    // Demo mode: no email form, the picker joins as a sample neighbor
    await expect(page.getByLabel('Your name')).toHaveCount(0)
    await page.getByRole('group', { name: /pick a sample neighbor/i }).getByRole('button', { name: /Priya Patel/ }).click()
    await page.getByRole('button', { name: 'Join as Priya' }).click()
    await expect(page).toHaveURL('/onboarding')
    await expect(page.getByRole('heading', { name: /Welcome, Priya!/ })).toBeVisible()
  })

  test.describe('with location allowed', () => {
    test.use({ permissions: ['geolocation'], geolocation: { latitude: 35.1183, longitude: -89.9374 } })
    test('"Check my location" in Memphis finds the ZIP and continues', async ({ page }) => {
      await page.goto('/auth/signup')
      await page.getByRole('button', { name: 'Check my location' }).click()
      await expect(page.getByText('Good news: 38152 is in our area.')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Join as Jamie' })).toBeVisible()
    })
  })

  test.describe('with location denied', () => {
    test.use({ permissions: [] })
    test('"Check my location" without permission falls back to ZIP entry', async ({ page, context }) => {
      await context.clearPermissions()
      await page.goto('/auth/signup')
      await page.getByRole('button', { name: 'Check my location' }).click()
      await expect(page.getByText("We couldn't get your location. Enter your ZIP code instead.")).toBeVisible()
      await expect(page.getByLabel('ZIP code')).toBeVisible()
      await page.getByRole('button', { name: 'Use my location instead' }).click()
      await expect(page.getByRole('button', { name: 'Check my location' })).toBeVisible()
    })
  })

  test('sign up and log in pages state the terms and the age limit', async ({ page }) => {
    test.fail(true, 'BUG: demo login/signup never show the terms, privacy and 18+ notice (LegalConsent only renders with a backend)')
    await page.goto('/auth/login')
    await expect(page.getByText(/You must be 18 or older/)).toBeVisible()
  })

  test.skip('email and password sign up, confirmation email', () => {
    // Needs Supabase Auth: demo mode hides the email form. Covered by the smoke suite against a real project.
  })
  test.skip('continue with Google or Apple', () => {
    // Needs a real OAuth provider and Supabase project.
  })
  test.skip('forgot and reset password', () => {
    // Needs Supabase Auth to send and verify the reset link.
  })
  test.skip('session expiry signs out', () => {
    // Needs real Supabase sessions and token refresh; demo logins never expire.
  })
})

test.describe('A-02 sign out', () => {
  test('Log out in Settings signs out and clears the saved demo login', async ({ page }) => {
    await login(page, 'Jamie')
    await goInApp(page, '/settings')
    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL('/auth/login')
    await expect(page.getByRole('heading', { name: 'Welcome back, neighbor.' })).toBeVisible()
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bartrrr-auth') ?? '{}'))
    expect(saved.state?.currentUserId ?? null).toBeNull()
    // A reload doesn't bring the session back
    await page.reload()
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/auth\/login\?returnTo=%2Fdashboard/)
  })

  test("signing out wipes the previous neighbor's changes before the next one logs in", async ({ page }) => {
    await login(page, 'Jamie')
    // Jamie changes their bio (kept in memory only in demo mode)
    await goInApp(page, '/settings')
    await page.getByLabel('Bio').fill('Secret note from Jamie')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Settings saved.')).toBeVisible()
    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL('/auth/login')

    // Same tab, no reload: Maria logs in through the picker
    await page.getByRole('button', { name: /Maria Santos/ }).click()
    await page.getByRole('button', { name: 'Log in as Maria' }).click()
    await expect(page).toHaveURL('/browse')
    const jamieBio = await readStore<string>(page, 'users-store', "s => s.users.find(u => u.id === 'user-001').bio")
    expect(jamieBio).not.toContain('Secret note')
    expect(await readStore<string>(page, 'auth-store', 's => s.currentUserId')).toBe('user-002')
  })

  test('Settings (and so Log out) is reachable from the app navigation', async ({ page }, testInfo) => {
    await login(page, 'Jamie')
    if (isMobile(testInfo)) {
      // Phones: header avatar → your profile → Edit profile (2 taps)
      await page.getByRole('link', { name: 'Your profile' }).click()
      await page.getByRole('main').getByRole('link', { name: 'Edit profile' }).click()
    } else {
      const settings = page.getByRole('link', { name: 'Settings' }).first()
      await expect(settings).toBeVisible()
      await settings.click()
    }
    await expect(page).toHaveURL('/settings')
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
  })
})

test.describe('A-05 private pages after sign out', () => {
  for (const path of ['/dashboard', '/settings', '/offers', '/agreements', '/listing/new', '/profile/me', '/feed', '/browse']) {
    test(`${path} redirects to login when signed out`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(`/auth/login?returnTo=${encodeURIComponent(path)}`.replace('?returnTo=%2Fbrowse', ''))
      await expect(page.getByRole('heading', { name: 'Welcome back, neighbor.' })).toBeVisible()
    })
  }

  test('the back button after logging out does not show the private page', async ({ page }) => {
    await login(page, 'Jamie')
    await goInApp(page, '/dashboard')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await goInApp(page, '/settings')
    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL('/auth/login')
    await page.goBack()
    // Whatever history entry we land on, it must not render private content
    await expect(page).toHaveURL(/\/auth\/login/)
    await expect(page.getByRole('button', { name: 'Log out' })).toHaveCount(0)
    await page.goBack()
    await expect(page).toHaveURL(/\/auth\/login/)
    await expect(page.getByText('Quick stats', { exact: false })).toHaveCount(0)
  })

  test('the back button after logging in does not return to the login page', async ({ page }) => {
    await page.goto('/')
    await page.goto('/auth/login')
    await page.getByRole('button', { name: 'Log in as Jamie' }).click()
    await expect(page).toHaveURL('/browse')
    await page.goBack()
    // Back goes to where they were before login (the landing page), not the picker
    await expect(page).not.toHaveURL(/\/auth\/login/)
  })
})
