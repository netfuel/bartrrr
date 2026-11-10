/// <reference lib="dom" />
import type { Page } from '@playwright/test'
import { test, expect as baseExpect } from '../fixtures'
import { NEIGHBORHOODS } from '../../src/data/neighborhoods'
import {
  captureBugShots,
  goInApp,
  imageSize,
  isMobile,
  login,
  makePng,
  notAPhoto,
  readStore,
  writeStore,
} from './helpers-core'

/**
 * P-01 name and bio, P-02 neighborhood picker, P-03 profile photo,
 * P-04 public profile header, P-05 public profile listings and reviews.
 */

captureBugShots(test)
const expect = baseExpect.configure({ timeout: 10_000 })

const JAMIE = 'user-001'

async function openSettings(page: Page) {
  await login(page, 'Jamie')
  await goInApp(page, '/settings')
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
}

const me = <T,>(page: Page, pick: string) =>
  readStore<T>(page, 'users-store', `s => (${pick})(s.users.find(u => u.id === '${JAMIE}'))`)

const neighborhoodGroup = (page: Page) => page.getByRole('group', { name: 'Neighborhood' })
const changeNeighborhood = (page: Page) => page.getByRole('button', { name: 'Change neighborhood' })

/** Phones show the saved neighborhood with a Change button (T-11); open the grid there. */
async function showNeighborhoods(page: Page) {
  if (await changeNeighborhood(page).isVisible()) await changeNeighborhood(page).click()
  await expect(neighborhoodGroup(page)).toBeVisible()
}
const avatarInput = (page: Page) => page.locator('input[type="file"]')

/** Set fields on Jamie before Settings mounts (it reads them once). */
async function setJamie(page: Page, fields: Record<string, unknown>) {
  await writeStore(
    page,
    'users-store',
    `(store, f) => store.setState(s => ({ users: s.users.map(u => u.id === '${JAMIE}' ? { ...u, ...f } : u) }))`,
    fields,
  )
}

test.describe('P-01 name and bio', () => {
  test('saving trims and stores the new name and bio', async ({ page }) => {
    await openSettings(page)
    const name = page.getByLabel('Display name')
    await expect(name).toHaveValue('Jamie Oakley')
    await expect(page.getByText('This is how neighbors see you.')).toBeVisible()
    await name.fill('  Jamie O.  ')
    await page.getByLabel('Bio').fill('  Trading tomatoes for tools.  ')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Settings saved.')).toBeVisible()
    await expect(page.getByRole('button', { name: '✓ Saved' })).toBeVisible()
    expect(await me<{ displayName: string; bio: string }>(page, 'u => ({ displayName: u.displayName, bio: u.bio })')).toEqual({
      displayName: 'Jamie O.',
      bio: 'Trading tomatoes for tools.',
    })
    // The new name shows on the public profile
    await goInApp(page, '/profile/me')
    await expect(page.getByRole('heading', { level: 1, name: 'Jamie O.' })).toBeVisible()
    await expect(page.getByText('Trading tomatoes for tools.')).toBeVisible()
  })

  test('an empty name is refused with a reason', async ({ page }) => {
    await openSettings(page)
    const name = page.getByLabel('Display name')
    for (const empty of ['', '    ']) {
      await name.fill(empty)
      await page.getByRole('button', { name: 'Save changes' }).click()
      await expect(page.getByText('Add a name so neighbors know who they’re trading with.')).toBeVisible()
      await expect(name).toHaveAttribute('aria-invalid', 'true')
      await expect(page.getByText('Settings saved.')).toHaveCount(0)
    }
    expect(await me<string>(page, 'u => u.displayName')).toBe('Jamie Oakley')
    // Typing clears the error
    await name.fill('J')
    await expect(page.getByText('Add a name so neighbors know who they’re trading with.')).toHaveCount(0)
  })

  test('bio is capped at 500 characters', async ({ page }) => {
    await openSettings(page)
    const bio = page.getByLabel('Bio')
    await bio.fill('a'.repeat(600))
    await expect(bio).toHaveValue('a'.repeat(500))
    await expect(page.getByText('500 of 500 characters')).toBeVisible()
    await page.getByRole('button', { name: 'Save changes' }).click()
    expect((await me<string>(page, 'u => u.bio')).length).toBe(500)
  })

  test('T-66: emoji count once, so 500 fit in the bio and 60 in the name', async ({ page }) => {
    await openSettings(page)
    const bio = page.getByLabel('Bio')
    await expect(bio).not.toHaveAttribute('maxlength', /.*/)
    await bio.fill('🌻'.repeat(520))
    await expect(bio).toHaveValue('🌻'.repeat(500))
    const name = page.getByLabel('Display name')
    await name.fill('🦊'.repeat(60))
    await expect(name).toHaveValue('🦊'.repeat(60))
    await page.getByRole('button', { name: 'Save changes' }).click()
    expect(await me<string>(page, 'u => u.bio')).toBe('🌻'.repeat(500))
    expect(await me<string>(page, 'u => u.displayName')).toBe('🦊'.repeat(60))
  })

  test('the name allows as many characters as sign up does (60)', async ({ page }) => {
    await openSettings(page)
    const name = page.getByLabel('Display name')
    await name.fill('N'.repeat(60))
    await expect(name).toHaveValue('N'.repeat(60), { timeout: 2000 })
  })

  test('notification switches save with the profile', async ({ page }) => {
    await openSettings(page)
    const sw = page.getByRole('checkbox', { name: 'Messages from neighbors' })
    await expect(sw).toBeChecked()
    await sw.click()
    await expect(sw).not.toBeChecked()
    await page.getByRole('button', { name: 'Save changes' }).click()
    expect(await me<boolean>(page, 'u => u.notificationPrefs.messages')).toBe(false)
    expect(await me<boolean>(page, 'u => u.notificationPrefs.newOffers')).toBe(true)
  })
})

test.describe('P-02 neighborhood picker', () => {
  test('the saved neighborhood is selected and a new one saves', async ({ page }) => {
    await openSettings(page)
    await showNeighborhoods(page)
    const group = neighborhoodGroup(page)
    await expect(group.getByRole('button')).toHaveCount(NEIGHBORHOODS.length)
    await expect(group.getByRole('button', { name: 'Downtown Memphis' })).toHaveAttribute('aria-pressed', 'true')
    await expect(group.locator('[aria-pressed="true"]')).toHaveCount(1)
    await expect(page.getByText(/Shown on your listings instead of your address\./)).toBeVisible()

    await group.getByRole('button', { name: 'Midtown' }).click()
    await showNeighborhoods(page)
    await expect(group.getByRole('button', { name: 'Midtown' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('New listings will show in Midtown once you save. Listings you’ve already posted stay where they are.')).toBeVisible()
    // Not saved until Save changes
    expect(await me<string>(page, 'u => u.neighborhood')).toBe('Downtown Memphis')
    await page.getByRole('button', { name: 'Save changes' }).click()
    expect(await me<string>(page, 'u => u.neighborhood')).toBe('Midtown')
  })

  test('a neighborhood saved in other casing still selects the list entry', async ({ page }) => {
    await login(page, 'Jamie')
    await setJamie(page, { neighborhood: 'cooper-young' })
    await goInApp(page, '/settings')
    await showNeighborhoods(page)
    await expect(neighborhoodGroup(page).getByRole('button', { name: 'Cooper-Young' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Not on our map')).toHaveCount(0)
  })

  test('an old typed neighborhood shows as "Not on our map" and can be replaced', async ({ page }) => {
    await login(page, 'Jamie')
    await setJamie(page, { neighborhood: 'Vinton Square' })
    await goInApp(page, '/settings')
    await showNeighborhoods(page)
    const group = neighborhoodGroup(page)
    await expect(group.getByRole('button')).toHaveCount(NEIGHBORHOODS.length + 1)
    const legacy = group.getByRole('button', { name: /Vinton Square/ })
    await expect(legacy).toHaveAttribute('aria-pressed', 'true')
    await expect(legacy).toContainText('Not on our map')
    await expect(page.getByText('“Vinton Square” isn’t on our map yet, so new listings go near the center of Memphis. Pick the closest neighborhood to place them better.')).toBeVisible()

    await group.getByRole('button', { name: 'Midtown' }).click()
    await expect(page.getByText(/isn’t on our map yet/)).toHaveCount(0)
    // The old value stays as a choice until saved
    await showNeighborhoods(page)
    await expect(legacy).toBeVisible()
    await page.getByRole('button', { name: 'Save changes' }).click()
    expect(await me<string>(page, 'u => u.neighborhood')).toBe('Midtown')
  })

  test('phones show the neighborhood on one line with Change; wider screens show the grid', async ({ page }, testInfo) => {
    // T-11: the full grid made Settings very long on phones
    await openSettings(page)
    if (!isMobile(testInfo)) {
      await expect(changeNeighborhood(page)).toBeHidden()
      await expect(neighborhoodGroup(page)).toBeVisible()
      return
    }
    const change = changeNeighborhood(page)
    await expect(change).toHaveAttribute('aria-expanded', 'false')
    await expect(neighborhoodGroup(page)).toBeHidden()
    await expect(change.locator('xpath=..')).toContainText('Downtown Memphis')
    const short = await page.evaluate(() => document.documentElement.scrollHeight)

    await change.click()
    await expect(change).toHaveAttribute('aria-expanded', 'true')
    const group = neighborhoodGroup(page)
    await expect(group.getByRole('button')).toHaveCount(NEIGHBORHOODS.length)
    const tall = await page.evaluate(() => document.documentElement.scrollHeight)
    expect(tall - short).toBeGreaterThan(400)

    // Picking one folds the list back up, keeps focus on Change, and saves as before
    await group.getByRole('button', { name: 'Midtown' }).click()
    await expect(group).toBeHidden()
    await expect(change).toBeFocused()
    await expect(change.locator('xpath=..')).toContainText('Midtown')
    await expect(page.getByText('New listings will show in Midtown once you save. Listings you’ve already posted stay where they are.')).toBeVisible()
    await page.getByRole('button', { name: 'Save changes' }).click()
    expect(await me<string>(page, 'u => u.neighborhood')).toBe('Midtown')
  })

  test('phones show an old typed neighborhood on the summary line, marked "Not on our map"', async ({ page }, testInfo) => {
    test.skip(!isMobile(testInfo), 'Phone layout only')
    await login(page, 'Jamie')
    await setJamie(page, { neighborhood: 'Vinton Square' })
    await goInApp(page, '/settings')
    const summary = changeNeighborhood(page).locator('xpath=..')
    await expect(summary).toContainText('Vinton Square')
    await expect(summary).toContainText('Not on our map')
    await expect(page.getByText('“Vinton Square” isn’t on our map yet', { exact: false })).toBeVisible()
  })

  test('keeping the old typed neighborhood saves it unchanged', async ({ page }) => {
    await login(page, 'Jamie')
    await setJamie(page, { neighborhood: 'Vinton Square' })
    await goInApp(page, '/settings')
    await page.getByLabel('Bio').fill('Still in Vinton Square')
    await page.getByRole('button', { name: 'Save changes' }).click()
    expect(await me<string>(page, 'u => u.neighborhood')).toBe('Vinton Square')
  })
})

test.describe('P-03 profile photo', () => {
  test('a wide photo is cropped to a square no bigger than 512 px', async ({ page }) => {
    await openSettings(page)
    await expect(page.getByRole('button', { name: 'Change profile photo' })).toBeVisible()
    await avatarInput(page).setInputFiles({ name: 'wide.png', mimeType: 'image/png', buffer: makePng(1200, 700) })
    await expect(page.getByText('Profile photo saved.')).toBeVisible()
    const url = await me<string>(page, 'u => u.avatarUrl')
    expect(url).toMatch(/^blob:/)
    const size = await imageSize(page, url)
    expect(size.w).toBe(size.h)
    expect(size.w).toBe(512)
    // The button shows the new photo
    await expect(page.getByRole('button', { name: 'Change profile photo' }).locator('img')).toHaveAttribute('src', url)
    await expect(page.getByText(/We crop it to a square and remove hidden details/)).toBeVisible()
  })

  test('a small photo is squared but not enlarged', async ({ page }) => {
    await openSettings(page)
    await avatarInput(page).setInputFiles({ name: 'tall.png', mimeType: 'image/png', buffer: makePng(200, 300) })
    await expect(page.getByText('Profile photo saved.')).toBeVisible()
    const size = await imageSize(page, await me<string>(page, 'u => u.avatarUrl'))
    expect(size).toEqual({ w: 200, h: 200 })
  })

  test('replacing a photo frees the previous one', async ({ page }) => {
    await openSettings(page)
    await avatarInput(page).setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: makePng(300, 300) })
    await expect(page.getByText('Profile photo saved.')).toBeVisible()
    const first = await me<string>(page, 'u => u.avatarUrl')
    await avatarInput(page).setInputFiles({ name: 'b.png', mimeType: 'image/png', buffer: makePng(320, 300, [77, 106, 98]) })
    await expect.poll(() => me<string>(page, 'u => u.avatarUrl')).not.toBe(first)
    await expect.poll(() => imageSize(page, first).then(() => 'loads', () => 'freed')).toBe('freed')
  })

  test('a file that is not an image is refused with a message', async ({ page }) => {
    await openSettings(page)
    const before = await me<string>(page, 'u => u.avatarUrl')
    await avatarInput(page).setInputFiles(notAPhoto)
    await expect(page.getByText('That file isn’t a photo. Choose a JPEG, PNG, WebP or HEIC image.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
    expect(await me<string>(page, 'u => u.avatarUrl')).toBe(before)
  })

  test('a broken image file is refused with a message', async ({ page }) => {
    await openSettings(page)
    await avatarInput(page).setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not really a png') })
    await expect(page.getByText('This browser can’t open that photo. Try a JPEG or PNG, or take a screenshot of it.')).toBeVisible()
  })

  test('removing the photo falls back to initials', async ({ page }) => {
    await openSettings(page)
    // Start from an uploaded photo so the fallback is visible (sample photos are blocked here)
    await avatarInput(page).setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: makePng(300, 300) })
    await expect(page.getByText('Profile photo saved.')).toBeVisible()
    const url = await me<string>(page, 'u => u.avatarUrl')
    await page.getByRole('button', { name: 'Remove photo' }).click()
    await expect(page.getByText('Profile photo removed.')).toBeVisible()
    expect(await me<string>(page, 'u => u.avatarUrl')).toBe('')
    const addButton = page.getByRole('button', { name: 'Add a profile photo' })
    await expect(addButton).toBeVisible()
    await expect(addButton.locator('img')).toHaveCount(0)
    await expect(addButton).toContainText('JO')
    await expect(page.getByRole('button', { name: 'Add a photo' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove photo' })).toHaveCount(0)
    await expect.poll(() => imageSize(page, url).then(() => 'loads', () => 'freed')).toBe('freed')
  })
})

test.describe('T-06 use my Google photo', () => {
  // Maria "signed up with Google" in the demo (DEMO_OAUTH_USERS) and starts with her Google picture
  const MARIA = 'user-002'
  const GOOGLE = 'https://picsum.photos/seed/maria/200/200'
  const googleBtn = (page: Page) => page.getByRole('button', { name: 'Use my Google photo' })
  const maria = <T,>(page: Page, pick: string) =>
    readStore<T>(page, 'users-store', `s => (${pick})(s.users.find(u => u.id === '${MARIA}'))`)

  async function openMariaSettings(page: Page) {
    await login(page, 'Maria')
    await goInApp(page, '/settings')
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  }

  test('hidden while the Google picture is the profile photo', async ({ page }) => {
    await openMariaSettings(page)
    await expect(page.getByRole('button', { name: 'Change photo' })).toBeVisible()
    expect(await maria<string>(page, 'u => u.avatarUrl')).toBe(GOOGLE)
    await expect(googleBtn(page)).toHaveCount(0)
  })

  test('after uploading a new photo, brings the Google picture back and frees the upload', async ({ page }) => {
    await openMariaSettings(page)
    await avatarInput(page).setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: makePng(300, 300) })
    await expect(page.getByText('Profile photo saved.')).toBeVisible()
    const uploaded = await maria<string>(page, 'u => u.avatarUrl')
    expect(uploaded).toMatch(/^blob:/)

    await googleBtn(page).click()
    await expect(page.getByText('Your Google photo is back.')).toBeVisible()
    expect(await maria<string>(page, 'u => u.avatarUrl')).toBe(GOOGLE)
    await expect(googleBtn(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Remove photo' })).toBeVisible()
    await expect.poll(() => imageSize(page, uploaded).then(() => 'loads', () => 'freed')).toBe('freed')
  })

  test('after removing the photo, brings it back', async ({ page }) => {
    await openMariaSettings(page)
    await page.getByRole('button', { name: 'Remove photo' }).click()
    await expect(page.getByText('Profile photo removed.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add a photo' })).toBeVisible()
    await googleBtn(page).click()
    await expect(page.getByText('Your Google photo is back.')).toBeVisible()
    expect(await maria<string>(page, 'u => u.avatarUrl')).toBe(GOOGLE)
  })

  test('neighbors who use a password never see it', async ({ page }) => {
    await openSettings(page)
    await avatarInput(page).setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: makePng(300, 300) })
    await expect(page.getByText('Profile photo saved.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove photo' })).toBeVisible()
    await expect(googleBtn(page)).toHaveCount(0)
  })
})

test.describe('P-04 public profile header', () => {
  test("another neighbor's profile shows rating, trades, neighborhood and bio", async ({ page }) => {
    await login(page, 'Jamie')
    await goInApp(page, '/profile/maria_s')
    await expect(page).toHaveTitle('Maria Santos | Bartrrr')
    await expect(page.getByRole('heading', { level: 1, name: 'Maria Santos' })).toBeVisible()
    const stats = page.getByText('41 trades', { exact: true }).locator('..')
    await expect(stats).toBeVisible()
    await expect(stats).toContainText('4.9')
    await expect(page.getByText('Midtown', { exact: true }).first()).toBeVisible()
    await expect(page.getByText(/^Joined /)).toBeVisible()
    await expect(page.getByText(/Retired teacher offering tutoring/)).toBeVisible()
    await expect(page.getByText(/late cancellation/)).toHaveCount(0)
  })

  test('late cancellations show with the right plural', async ({ page }) => {
    await login(page, 'Jamie')
    await writeStore(
      page,
      'users-store',
      `(store) => store.setState(s => ({ users: s.users.map(u =>
        u.id === 'user-002' ? { ...u, lateCancellations: 2 } : u.id === 'user-003' ? { ...u, lateCancellations: 1, tradeCount: 1 } : u) }))`,
    )
    await goInApp(page, '/profile/maria_s')
    await expect(page.getByText('2 late cancellations (canceled less than 24 hours before a swap)')).toBeVisible()
    await goInApp(page, '/profile/alex_builds')
    await expect(page.getByRole('heading', { level: 1, name: 'Alex Chen' })).toBeVisible()
    await expect(page.getByText('1 late cancellation (canceled less than 24 hours before a swap)')).toBeVisible()
    await expect(page.getByText('1 trade', { exact: true })).toBeVisible()
  })

  test('T-69: a neighbor with no reviews shows "No ratings yet", never 5.0 stars', async ({ page }) => {
    await login(page, 'Jamie')
    // A brand-new neighbor: the server's default 5.0 score, no trades, no reviews
    await writeStore(
      page,
      'users-store',
      `(store) => store.setState(s => ({ users: s.users.map(u =>
        u.id === 'user-005' ? { ...u, reputationScore: 5, reviewCount: 0, tradeCount: 0 } : u) }))`,
    )
    await goInApp(page, '/profile/jordan_w')
    await expect(page.getByRole('heading', { level: 1, name: 'Jordan Williams' })).toBeVisible()
    const stats = page.getByText('0 trades', { exact: true }).locator('..')
    await expect(stats).toContainText('No ratings yet')
    await expect(stats).not.toContainText('5.0')

    // The owner block on their listing
    await goInApp(page, '/listing/listing-006')
    await expect(page.getByRole('heading', { level: 1, name: 'IKEA Kallax Shelf Unit' })).toBeVisible()
    const owner = page.getByRole('link', { name: /Jordan Williams/ }).filter({ hasText: '0 trades' })
    await expect(owner).toContainText('No ratings yet')
    await expect(owner).not.toContainText('5.0')

    // Their card when browsing
    await goInApp(page, '/browse')
    const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'IKEA Kallax Shelf Unit' }) })
    await expect(card).toContainText('No ratings yet')
    await expect(card).not.toContainText('5.0')

    // Their first review: now the stars show
    await writeStore(
      page,
      'reviews-store',
      `(store) => store.getState().addReview({ agreementId: 'agreement-t69', reviewerId: 'user-001', revieweeId: 'user-005', rating: 4, comment: 'Easy swap.' })`,
    )
    await writeStore(
      page,
      'users-store',
      `(store) => store.setState(s => ({ users: s.users.map(u => u.id === 'user-005' ? { ...u, reputationScore: 4 } : u) }))`,
    )
    await goInApp(page, '/profile/jordan_w')
    await expect(page.getByText('0 trades', { exact: true }).locator('..')).toContainText('4.0')
    await expect(page.getByText('No ratings yet')).toHaveCount(0)
    await goInApp(page, '/browse')
    await expect(card).toContainText('4.0')
    await expect(card).not.toContainText('No ratings yet')
  })

  test('rated neighbors keep their stars with a spoken label', async ({ page }) => {
    await login(page, 'Jamie')
    await goInApp(page, '/profile/maria_s')
    await expect(page.getByText('4.9 out of 5 stars').first()).toBeAttached()
    await expect(page.getByText('No ratings yet')).toHaveCount(0)
  })

  test('an unknown neighbor shows a friendly message', async ({ page }) => {
    await login(page, 'Jamie')
    await goInApp(page, '/profile/nobody_here')
    await expect(page.getByText("We couldn't find this neighbor.")).toBeVisible()
    await page.getByRole('main').getByRole('link', { name: 'Browse listings' }).click()
    await expect(page).toHaveURL('/browse')
  })
})

test.describe('P-05 public profile listings and reviews', () => {
  test('only active listings are shown', async ({ page }) => {
    await login(page, 'Jamie')
    await writeStore(
      page,
      'listings-store',
      `(store) => store.setState(s => ({ listings: s.listings.map(l =>
        l.id === 'listing-011' ? { ...l, status: 'closed' } : l) }))`,
    )
    await goInApp(page, '/profile/priya_green')
    await expect(page.getByRole('heading', { level: 1, name: 'Priya Patel' })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Listings/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { level: 3, name: 'Succulent Collection (12 pots)' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: 'Handmade Ceramic Mugs (set of 4)' })).toHaveCount(0)
    await expect(page.getByRole('main').getByRole('article')).toHaveCount(1)
  })

  test('a neighbor with nothing listed gets an empty state', async ({ page }) => {
    await login(page, 'Jamie')
    await writeStore(
      page,
      'listings-store',
      `(store) => store.setState(s => ({ listings: s.listings.map(l => l.userId === 'user-002' ? { ...l, status: 'pending' } : l) }))`,
    )
    await goInApp(page, '/profile/maria_s')
    await expect(page.getByText("Maria doesn't have anything listed right now.")).toBeVisible()
  })

  test('your own profile invites you to post when you have nothing up', async ({ page }) => {
    await login(page, 'Jamie')
    await writeStore(
      page,
      'listings-store',
      `(store) => store.setState(s => ({ listings: s.listings.map(l => l.userId === '${JAMIE}' ? { ...l, status: 'closed' } : l) }))`,
    )
    await goInApp(page, '/profile/me')
    await expect(page.getByRole('heading', { level: 1, name: 'Jamie Oakley' })).toBeVisible()
    await expect(page.getByText("You don't have any active listings. Post one so neighbors can make offers.")).toBeVisible()
    await page.getByRole('main').getByRole('link', { name: 'Post a listing' }).click()
    await expect(page).toHaveURL('/listing/new')
  })

  test('reviews tab shows a count and an empty state', async ({ page }) => {
    await login(page, 'Jamie')
    await goInApp(page, '/profile/priya_green')
    const reviewsTab = page.getByRole('tab', { name: /Reviews/ })
    await reviewsTab.click()
    await expect(reviewsTab).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('No reviews yet. Reviews show up after Priya completes a trade.')).toBeVisible()
  })

  test('your own profile links to edit it in Settings', async ({ page }) => {
    await login(page, 'Jamie')
    await goInApp(page, '/profile/me')
    await expect(page.getByRole('heading', { level: 1, name: 'Jamie Oakley' })).toBeVisible()
    await expect(page.getByRole('main').getByRole('link', { name: /edit profile|settings/i })).toBeVisible({ timeout: 2000 })
  })
})
