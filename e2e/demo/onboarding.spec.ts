/// <reference lib="dom" />
import type { Page } from '@playwright/test'
import { test, expect as baseExpect } from '../fixtures'
import { NEIGHBORHOODS } from '../../src/data/neighborhoods'
import { blockExternalMedia, captureBugShots, goInApp, login, readStore, writeStore, type Neighbor } from './helpers-core'

/**
 * O-01 the Memphis ZIP check at sign up, O-02 onboarding (name, shared
 * neighborhood picker, interests, required steps, reload).
 *
 * How a demo neighbor reaches onboarding: Sign up → ZIP check → "Join as
 * <name>" sends a sample neighbor to /onboarding. Sample neighbors already
 * have a neighborhood; a brand-new account (no neighborhood, placeholder
 * name "Neighbor") is simulated by clearing those fields in the users store.
 */

captureBugShots(test)
const expect = baseExpect.configure({ timeout: 10_000 })

async function checkZip(page: Page, zip: string) {
  await page.goto('/auth/signup')
  await page.getByRole('button', { name: 'Enter a ZIP code instead' }).click()
  await page.getByLabel('ZIP code').fill(zip)
  await page.getByRole('button', { name: 'Check availability' }).click()
}

/** Sign up (demo) through the ZIP check and land on onboarding. */
async function joinAs(page: Page, name: Neighbor, zip = '38104') {
  await blockExternalMedia(page)
  await checkZip(page, zip)
  await page
    .getByRole('group', { name: /pick a sample neighbor/i })
    .getByRole('button', { name: new RegExp(`\\b${name}\\b`) })
    .click()
  await page.getByRole('button', { name: `Join as ${name}` }).click()
  await expect(page).toHaveURL('/onboarding')
}

const picker = (page: Page) => page.getByRole('group', { name: 'Neighborhood' })
const interests = (page: Page) => page.getByRole('group', { name: 'Interests' })

test.describe('O-01 ZIP check', () => {
  for (const zip of ['38104', '38122', '38152', '38103', '38138', '38016']) {
    test(`Memphis ZIP ${zip} is in the area`, async ({ page }) => {
      await checkZip(page, zip)
      await expect(page.getByText(`Good news: ${zip} is in our area.`)).toBeVisible()
      await expect(page.getByRole('button', { name: /^Join as / })).toBeVisible()
    })
  }

  for (const [zip, place] of [
    ['10001', 'New York'],
    ['38654', 'Olive Branch, MS'],
    ['72301', 'West Memphis, AR'],
    ['38002', 'Arlington, TN'],
  ] as const) {
    test(`ZIP ${zip} (${place}) is refused with a helpful message`, async ({ page }) => {
      await checkZip(page, zip)
      await expect(page.getByText('Not available yet')).toBeVisible()
      await expect(page.getByText(`Your ZIP code: ${zip}`)).toBeVisible()
      await expect(page.getByText(/only in the Memphis, TN metro right now/)).toBeVisible()
      await expect(page.getByText(/If you're in the Memphis area, try your home ZIP code/)).toBeVisible()
      await expect(page.getByRole('button', { name: /^Join as / })).toHaveCount(0)
      await page.getByRole('button', { name: 'Try a different ZIP code' }).click()
      await expect(page.getByLabel('ZIP code')).toHaveValue(zip)
      await page.getByLabel('ZIP code').fill('38122')
      await page.getByRole('button', { name: 'Check availability' }).click()
      await expect(page.getByText('Good news: 38122 is in our area.')).toBeVisible()
    })
  }

  test.describe('location in Memphis', () => {
    test.use({ permissions: ['geolocation'], geolocation: { latitude: 35.1571, longitude: -89.9224 } })
    test('"Check my location" resolves 38122 on the device', async ({ page }) => {
      await page.goto('/auth/signup')
      await page.getByRole('button', { name: 'Check my location' }).click()
      await expect(page.getByText('Good news: 38122 is in our area.')).toBeVisible()
    })
  })

  test.describe('location just outside Memphis', () => {
    test.use({ permissions: ['geolocation'], geolocation: { latitude: 35.1343, longitude: -90.1793 } })
    test('"Check my location" in West Memphis, AR is refused', async ({ page }) => {
      await page.goto('/auth/signup')
      await page.getByRole('button', { name: 'Check my location' }).click()
      await expect(page.getByText('Not available yet')).toBeVisible()
      await expect(page.getByText('Your ZIP code: 72301')).toBeVisible()
    })
  })

  test.describe('location far away', () => {
    test.use({ permissions: ['geolocation'], geolocation: { latitude: 40.7506, longitude: -73.9972 } })
    test('"Check my location" far from Memphis is refused without a ZIP', async ({ page }) => {
      await page.goto('/auth/signup')
      await page.getByRole('button', { name: 'Check my location' }).click()
      await expect(page.getByText('Not available yet')).toBeVisible()
      await expect(page.getByText(/Your ZIP code:/)).toHaveCount(0)
    })
  })
})

test.describe('O-02 onboarding', () => {
  test('joining walks through welcome, neighborhood, interests and done', async ({ page }) => {
    await joinAs(page, 'Priya', '38138')
    await expect(page.getByText('Step 1 of 3')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: /Welcome, Priya!/ })).toBeVisible()
    await page.getByRole('button', { name: 'Get started' }).click()

    // Step 2: the shared picker, with the saved neighborhood selected
    await expect(page.getByText('Step 2 of 3')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Where do you live?' })).toBeVisible()
    await expect(picker(page).getByRole('button')).toHaveCount(NEIGHBORHOODS.length)
    await expect(picker(page).getByRole('button', { name: 'Germantown' })).toHaveAttribute('aria-pressed', 'true')
    await expect(picker(page).locator('[aria-pressed="true"]')).toHaveCount(1)
    await picker(page).getByRole('button', { name: 'Cooper-Young' }).click()
    await expect(picker(page).getByRole('button', { name: 'Cooper-Young' })).toHaveAttribute('aria-pressed', 'true')
    await expect(picker(page).getByRole('button', { name: 'Germantown' })).toHaveAttribute('aria-pressed', 'false')
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 3: at least 3 interests
    await expect(page.getByText('Step 3 of 3')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'What are you looking for?' })).toBeVisible()
    await expect(interests(page).getByRole('button')).toHaveCount(16)
    const next = page.getByRole('button', { name: 'Continue' })
    await expect(page.getByText('Tap a category to select it.')).toBeVisible()
    await expect(next).toBeDisabled()
    await interests(page).getByRole('button', { name: /Tools/ }).click()
    await expect(page.getByText('1 picked. Choose 2 more to continue.')).toBeVisible()
    await interests(page).getByRole('button', { name: /Garden/ }).click()
    await expect(page.getByText('2 picked. Choose 1 more to continue.')).toBeVisible()
    await expect(next).toBeDisabled()
    await interests(page).getByRole('button', { name: /Books & media/ }).click()
    await expect(page.getByText('3 picked. Nice!')).toBeVisible()
    // Unpicking one takes it back below the minimum
    await interests(page).getByRole('button', { name: /Garden/ }).click()
    await expect(next).toBeDisabled()
    await interests(page).getByRole('button', { name: /Pet care/ }).click()
    await expect(interests(page).getByRole('button', { name: /Pet care/ })).toHaveAttribute('aria-pressed', 'true')
    await next.click()

    // Done
    await expect(page.getByRole('heading', { name: "You're all set!" })).toBeVisible()
    await expect(page.getByText(/Step \d of 3/)).toHaveCount(0)
    await expect(page.getByText(/You're in\s+Cooper-Young\./)).toBeVisible()
    await expect(page.getByText('You can change your neighborhood anytime in Settings.')).toBeVisible()
    await page.getByRole('button', { name: 'Browse listings' }).click()
    await expect(page).toHaveURL('/browse')

    const me = await readStore<{ neighborhood: string; interests: string[] }>(
      page,
      'users-store',
      "s => { const u = s.users.find(u => u.id === 'user-004'); return { neighborhood: u.neighborhood, interests: u.interests } }",
    )
    expect(me.neighborhood).toBe('Cooper-Young')
    expect([...me.interests].sort()).toEqual(['books', 'pets', 'tools'])
    expect(await readStore<string[]>(page, 'auth-store', 's => s.onboardedUserIds')).toContain('user-004')
  })

  test('Back keeps earlier choices', async ({ page }) => {
    await joinAs(page, 'Alex')
    await page.getByRole('button', { name: 'Get started' }).click()
    await picker(page).getByRole('button', { name: 'Midtown' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await interests(page).getByRole('button', { name: /Tech help/ }).click()
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(picker(page).getByRole('button', { name: 'Midtown' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(interests(page).getByRole('button', { name: /Tech help/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('1 picked. Choose 2 more to continue.')).toBeVisible()
    await page.getByRole('button', { name: 'Back' }).click()
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByText('Step 1 of 3')).toBeVisible()
  })

  test('"Post your first listing" saves and opens the listing form', async ({ page }) => {
    await joinAs(page, 'Sam')
    await page.getByRole('button', { name: 'Get started' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    for (const c of [/Household/, /Electronics/, /Furniture/]) await interests(page).getByRole('button', { name: c }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Post your first listing' }).click()
    await expect(page).toHaveURL('/listing/new')
    await expect(page.getByRole('heading', { name: 'Post a listing' })).toBeVisible()
    expect(await readStore<string[]>(page, 'auth-store', 's => s.onboardedUserIds')).toContain('user-006')
  })

  test('a brand-new neighbor must add a name and pick a neighborhood', async ({ page }) => {
    await login(page, 'Jordan')
    // Simulate a fresh account: placeholder name, no neighborhood, no interests
    await writeStore(
      page,
      'users-store',
      `(store) => store.setState(s => ({ users: s.users.map(u => u.id === 'user-005'
        ? { ...u, displayName: 'Neighbor', neighborhood: '', interests: [] } : u) }))`,
    )
    // Any private page now sends them to onboarding
    await goInApp(page, '/dashboard', { redirects: true })
    await expect(page).toHaveURL('/onboarding')
    await expect(page.getByRole('heading', { level: 1, name: /Welcome, neighbor!/ })).toBeVisible()

    const name = page.getByLabel('What should neighbors call you?')
    await expect(name).toHaveAttribute('maxlength', '60')
    await expect(page.getByText(/Add a name to continue/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Get started' })).toBeDisabled()
    await name.fill('   ')
    await expect(page.getByRole('button', { name: 'Get started' })).toBeDisabled()
    await name.fill('  Jo  ')
    await page.getByRole('button', { name: 'Get started' }).click()

    await expect(picker(page).locator('[aria-pressed="true"]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
    await picker(page).getByRole('button', { name: 'Raleigh' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    for (const c of [/Kids & baby/, /Sports/, /Transport/]) await interests(page).getByRole('button', { name: c }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText(/You're in\s+Raleigh\./)).toBeVisible()
    await page.getByRole('button', { name: 'Browse listings' }).click()
    await expect(page).toHaveURL('/browse')

    const me = await readStore<{ displayName: string; neighborhood: string }>(
      page,
      'users-store',
      "s => s.users.find(u => u.id === 'user-005')",
    )
    expect(me.displayName).toBe('Jo')
    expect(me.neighborhood).toBe('Raleigh')
    // Onboarded: private pages open normally now
    await goInApp(page, '/dashboard')
    await expect(page).toHaveURL('/dashboard')
  })

  test('the onboarding steps say why Continue is disabled', async ({ page }) => {
    await login(page, 'Jordan')
    await writeStore(
      page,
      'users-store',
      `(store) => store.setState(s => ({ users: s.users.map(u => u.id === 'user-005' ? { ...u, neighborhood: '' } : u) }))`,
    )
    await goInApp(page, '/dashboard', { redirects: true })
    await page.getByRole('button', { name: 'Get started' }).click()
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
    await expect(page.getByText(/pick (your|a) neighborhood to continue/i)).toBeVisible({ timeout: 2000 })
  })

  test('reloading mid-flow starts onboarding again without losing the session', async ({ page }) => {
    await joinAs(page, 'Maria')
    await page.getByRole('button', { name: 'Get started' }).click()
    await picker(page).getByRole('button', { name: 'Harbor Town' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await interests(page).getByRole('button', { name: /Tutoring/ }).click()
    await page.reload()
    await expect(page).toHaveURL('/onboarding')
    await expect(page.getByText('Step 1 of 3')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: /Welcome, Maria!/ })).toBeVisible()
    // Nothing was saved before finishing
    await page.getByRole('button', { name: 'Get started' }).click()
    await expect(picker(page).getByRole('button', { name: 'Midtown' })).toHaveAttribute('aria-pressed', 'true')
  })
})
