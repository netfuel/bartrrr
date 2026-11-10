/// <reference lib="dom" />
import type { Page } from '@playwright/test'
import { test, expect as baseExpect } from '../fixtures'
import {
  captureBugShots,
  goInApp,
  imageSize,
  isMobile,
  login,
  notAPhoto,
  photoFiles,
  readStore,
  writeStore,
} from './helpers-core'

/**
 * L-01 post a listing, L-02 photos (limit, order, cover, non-images, busy
 * state), L-03 abandoning a draft, L-04 required fields, L-05 editing,
 * L-06 take down / relist / expiry, L-08 listing detail, L-09 sharing.
 * In demo mode photos stay on the device as blob: URLs.
 */

captureBugShots(test)
const expect = baseExpect.configure({ timeout: 10_000 })

const JAMIE = 'user-001'
const photoInput = (page: Page) => page.locator('input[type="file"]')
const thumbs = (page: Page) => page.getByRole('list', { name: 'Listing photos' }).getByRole('img')
const next = (page: Page) => page.getByRole('button', { name: 'Next' })
const blocker = (page: Page) => page.locator('p[aria-live="polite"].text-right')

async function startListing(page: Page) {
  await login(page, 'Jamie')
  await goInApp(page, '/listing/new')
  await expect(page.getByRole('heading', { level: 1, name: 'Post a listing' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Add some photos' })).toBeVisible()
}

/** Steps 2–4 with valid input, then post. Returns the new listing id. */
async function finishListing(page: Page, title: string, category = 'Goods') {
  await next(page).click()
  await page.getByLabel('Title').fill(title)
  await page.getByRole('group', { name: 'Category' }).getByRole('button', { name: category }).click()
  await next(page).click()
  await page.getByLabel('I\'d trade this for…').fill('Garden help or good books')
  await next(page).click()
  await expect(page.getByRole('heading', { name: 'Review your listing' })).toBeVisible()
  await page.getByRole('button', { name: 'Post listing' }).click()
  await expect(page).toHaveURL(/\/listing\/listing-[\w-]+$/)
  return page.url().split('/listing/')[1]
}

/** A blob: URL that was freed (polls: the old page unmounts after the next one renders). */
async function expectFreed(page: Page, url: string) {
  await expect
    .poll(() => imageSize(page, url).then(() => 'loads', () => 'freed'), { timeout: 5000 })
    .toBe('freed')
}

const thumbSrcs = (page: Page) => thumbs(page).evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).src))

/** Slow down photo decoding so the "uploading" state can be observed. */
async function slowPhotoPrep(page: Page, ms: number) {
  await page.addInitScript((delay) => {
    const original = window.createImageBitmap.bind(window)
    // @ts-expect-error test override
    window.createImageBitmap = (...args: Parameters<typeof createImageBitmap>) =>
      new Promise((r) => setTimeout(r, delay)).then(() => original(...args))
  }, ms)
}

test.describe('L-01 post a listing', () => {
  test('post without photos: every step, then the live listing', async ({ page }) => {
    await startListing(page)
    await expect(page.getByText('0 of 6 photos. The first one is the cover.')).toBeVisible()
    await expect(page.getByText(/Photos are optional, so you can skip this step\./)).toBeVisible()
    await expect(next(page)).toBeEnabled()
    const before = await readStore<number>(page, 'listings-store', 's => s.listings.length')
    const id = await finishListing(page, 'Box of canning jars')

    await expect(page.getByText('Your listing is live.')).toBeVisible()
    await expect(page.getByText('Your listing is live!')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Box of canning jars' })).toBeVisible()
    const saved = await readStore<Record<string, unknown>>(page, 'listings-store', `s => s.listings.find(l => l.id === '${id}')`)
    expect(saved).toMatchObject({
      title: 'Box of canning jars',
      category: 'goods',
      seeking: 'Garden help or good books',
      images: [],
      userId: JAMIE,
      status: 'active',
      location: { neighborhood: 'Downtown Memphis' },
    })
    // Stays up for 30 days
    const days = (Date.parse(saved.expiresAt as string) - Date.now()) / 864e5
    expect(days).toBeGreaterThan(29.9)
    expect(days).toBeLessThanOrEqual(30)
    expect(await readStore<number>(page, 'listings-store', 's => s.listings.length')).toBe(before + 1)
  })

  test('post with one photo: it becomes the cover and shows on the listing', async ({ page }) => {
    await startListing(page)
    await photoInput(page).setInputFiles(photoFiles(1))
    await expect(thumbs(page)).toHaveCount(1)
    await expect(page.getByRole('img', { name: 'Photo 1, cover' })).toBeVisible()
    await expect(page.getByText('1 of 6 photos. The first one is the cover.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add more' })).toBeVisible()
    const [src] = await thumbSrcs(page)
    expect(src).toMatch(/^blob:/)
    const id = await finishListing(page, 'Hand-thrown bowl')
    await expect(page.getByRole('region', { name: /Photos of Hand-thrown bowl: 1 photo\./ })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Hand-thrown bowl photo 1' })).toHaveAttribute('src', src)
    expect(await readStore<string[]>(page, 'listings-store', `s => s.listings.find(l => l.id === '${id}').images`)).toEqual([src])
  })

  test('post with six photos keeps the chosen order', async ({ page }) => {
    await startListing(page)
    const files = photoFiles(6)
    await photoInput(page).setInputFiles(files)
    await expect(thumbs(page)).toHaveCount(6)
    await expect(page.getByText('6 of 6 photos. The first one is the cover.')).toBeVisible()
    // Full: no add button
    await expect(page.getByRole('button', { name: /Add (photos|more)/ })).toHaveCount(0)
    const srcs = await thumbSrcs(page)
    // Generated photos are 96, 97 … 101 px wide: widths prove the order
    for (let i = 0; i < 6; i++) expect((await imageSize(page, srcs[i])).w).toBe(96 + i)
    const id = await finishListing(page, 'Six photo lamp')
    expect(await readStore<string[]>(page, 'listings-store', `s => s.listings.find(l => l.id === '${id}').images`)).toEqual(srcs)
    await expect(page.getByRole('region', { name: /6 photos\./ })).toBeVisible()
  })

  test('condition is offered only for goods and outdoor listings', async ({ page }) => {
    await startListing(page)
    await next(page).click()
    const cat = page.getByRole('group', { name: 'Category' })
    const condition = page.getByRole('group', { name: 'Condition (optional)' })
    await expect(condition).toHaveCount(0)
    await cat.getByRole('button', { name: 'Goods' }).click()
    await expect(condition.getByRole('button')).toHaveText(['New', 'Like new', 'Good', 'Fair'])
    await cat.getByRole('button', { name: 'Services' }).click()
    await expect(condition).toHaveCount(0)
    await cat.getByRole('button', { name: 'Skills & expertise' }).click()
    await expect(condition).toHaveCount(0)
    await cat.getByRole('button', { name: 'Outdoor & garden' }).click()
    await expect(condition).toBeVisible()
    await condition.getByRole('button', { name: 'Like new' }).click()
    await expect(condition.getByRole('button', { name: 'Like new' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('a condition picked for goods is not saved on a services listing', async ({ page }) => {
    await startListing(page)
    await next(page).click()
    await page.getByLabel('Title').fill('Gutter cleaning')
    await page.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Goods' }).click()
    await page.getByRole('group', { name: 'Condition (optional)' }).getByRole('button', { name: 'Fair' }).click()
    await page.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Services' }).click()
    await next(page).click()
    await page.getByLabel('I\'d trade this for…').fill('Baked goods')
    await next(page).click()
    await expect(page.getByText('Condition', { exact: true })).toHaveCount(0, { timeout: 2000 })
  })
})

test.describe('L-02 photos', () => {
  test('a 7th photo is refused with a message', async ({ page }) => {
    // Slow decoding a little so the message can be read while photos upload
    await slowPhotoPrep(page, 800)
    await startListing(page)
    await photoInput(page).setInputFiles(photoFiles(7))
    await expect(page.getByText('Only the first 6 photos were added. Listings hold up to 6.')).toBeVisible()
    await expect(thumbs(page)).toHaveCount(6)
    // Choosing more once full
    await photoInput(page).setInputFiles(photoFiles(1))
    await expect(page.getByText('You can add up to 6 photos. Remove one to add another.')).toBeVisible()
    await expect(thumbs(page)).toHaveCount(6)
  })

  test('the photo-limit message stays up after the uploads finish', async ({ page }) => {
    await startListing(page)
    await photoInput(page).setInputFiles(photoFiles(7))
    await expect(thumbs(page)).toHaveCount(6)
    await expect(page.getByText('Only the first 6 photos were added. Listings hold up to 6.')).toBeVisible({ timeout: 2000 })
  })

  test('adding in two batches keeps the order and the 6-photo limit', async ({ page }) => {
    await slowPhotoPrep(page, 800)
    await startListing(page)
    await photoInput(page).setInputFiles(photoFiles(4))
    await expect(thumbs(page)).toHaveCount(4)
    await photoInput(page).setInputFiles(photoFiles(4).map((f, i) => ({ ...f, name: `second-${i}.png` })))
    await expect(page.getByText('Only the first 2 photos were added. Listings hold up to 6.')).toBeVisible()
    await expect(thumbs(page)).toHaveCount(6)
    const widths = []
    for (const s of await thumbSrcs(page)) widths.push((await imageSize(page, s)).w)
    expect(widths).toEqual([96, 97, 98, 99, 96, 97])
  })

  test('Make cover moves a photo to the front', async ({ page }) => {
    await startListing(page)
    await photoInput(page).setInputFiles(photoFiles(3))
    await expect(thumbs(page)).toHaveCount(3)
    const [a, b, c] = await thumbSrcs(page)
    // Only non-cover photos offer "Make cover"
    await expect(page.getByRole('button', { name: 'Make cover' })).toHaveCount(2)
    await page.getByRole('button', { name: 'Make cover' }).nth(1).click()
    await expect(page.getByText('Cover photo changed.')).toBeVisible()
    expect(await thumbSrcs(page)).toEqual([c, a, b])
    await expect(page.getByRole('img', { name: 'Photo 1, cover' })).toHaveAttribute('src', c)
    const id = await finishListing(page, 'Cover check')
    expect(await readStore<string[]>(page, 'listings-store', `s => s.listings.find(l => l.id === '${id}').images`)).toEqual([c, a, b])
  })

  test('removing a photo frees it and keeps the rest in order', async ({ page }) => {
    await startListing(page)
    await photoInput(page).setInputFiles(photoFiles(3))
    await expect(thumbs(page)).toHaveCount(3)
    const [a, b, c] = await thumbSrcs(page)
    await page.getByRole('button', { name: 'Remove photo 2' }).click()
    await expect(page.getByText('Photo 2 removed.')).toBeVisible()
    expect(await thumbSrcs(page)).toEqual([a, c])
    await expectFreed(page, b)
  })

  test('a file that is not a photo is refused with a message', async ({ page }) => {
    await startListing(page)
    await photoInput(page).setInputFiles([...photoFiles(1), notAPhoto])
    await expect(page.getByText('That file isn’t a photo. Choose a JPEG, PNG, WebP or HEIC image.')).toBeVisible()
    await expect(page.getByText('1 photo couldn’t be added.')).toBeVisible()
    await expect(thumbs(page)).toHaveCount(1)
    // Not retryable; can be dismissed
    await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Remove this photo' }).click()
    await expect(page.getByText('That file isn’t a photo.', { exact: false })).toHaveCount(0)
    await expect(next(page)).toBeEnabled()
  })

  test('Next waits while photos are uploading, and says why', async ({ page }) => {
    await slowPhotoPrep(page, 1500)
    await startListing(page)
    await photoInput(page).setInputFiles(photoFiles(2))
    await expect(page.getByText('Uploading 2 photos…')).toBeVisible()
    await expect(page.getByText('Uploading', { exact: true }).first()).toBeVisible()
    await expect(next(page)).toBeDisabled()
    await expect(blocker(page)).toHaveText('Wait for your photos to finish uploading.')
    await expect(thumbs(page)).toHaveCount(2, { timeout: 10_000 })
    await expect(next(page)).toBeEnabled()
    await expect(blocker(page)).toHaveText('')
  })
})

test.describe('L-03 abandoning a draft', () => {
  test('leaving without posting frees the photos and adds nothing', async ({ page }) => {
    await startListing(page)
    const before = await readStore<number>(page, 'listings-store', 's => s.listings.length')
    await photoInput(page).setInputFiles(photoFiles(2))
    await expect(thumbs(page)).toHaveCount(2)
    const srcs = await thumbSrcs(page)
    await next(page).click()
    await page.getByLabel('Title').fill('Never posted')
    await page.getByRole('link', { name: 'Cancel and go back to browse' }).click()
    await expect(page).toHaveURL('/browse')
    for (const s of srcs) await expectFreed(page, s)
    expect(await readStore<number>(page, 'listings-store', 's => s.listings.length')).toBe(before)
    await expect(page.getByRole('heading', { level: 3, name: 'Never posted' })).toHaveCount(0)
  })

  test('photos still uploading when you leave are freed too', async ({ page }) => {
    await slowPhotoPrep(page, 1200)
    await startListing(page)
    const before = await readStore<number>(page, 'listings-store', 's => s.listings.length')
    await photoInput(page).setInputFiles(photoFiles(1))
    await expect(page.getByText('Uploading 1 photo…')).toBeVisible()
    const previews = await page.getByRole('list', { name: 'Listing photos' }).locator('img').evaluateAll((imgs) =>
      imgs.map((i) => (i as HTMLImageElement).src),
    )
    await page.getByRole('link', { name: 'Cancel and go back to browse' }).click()
    await expect(page).toHaveURL('/browse')
    for (const s of previews) await expectFreed(page, s)
    // Let the late upload land; it must not create a listing
    await expect.poll(() => readStore<number>(page, 'listings-store', 's => s.listings.length'), { timeout: 3000 }).toBe(before)
  })
})

test.describe('L-04 required fields', () => {
  test('Next explains what is missing at each step', async ({ page }) => {
    await startListing(page)
    await next(page).click()
    await expect(next(page)).toBeDisabled()
    await expect(blocker(page)).toHaveText('Add a title (at least 3 characters) to continue.')
    await page.getByLabel('Title').fill('ab')
    await expect(next(page)).toBeDisabled()
    await page.getByLabel('Title').fill('   ab   ')
    await expect(next(page)).toBeDisabled()
    await page.getByLabel('Title').fill('Rake')
    await expect(blocker(page)).toHaveText('Pick a category to continue.')
    await page.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Outdoor & garden' }).click()
    await expect(next(page)).toBeEnabled()
    await expect(blocker(page)).toHaveText('')
    await next(page).click()
    await expect(next(page)).toBeDisabled()
    await expect(blocker(page)).toHaveText('Tell neighbors what you’d like in return to continue.')
    await page.getByLabel('I\'d trade this for…').fill('  x ')
    await expect(next(page)).toBeDisabled()
    await page.getByLabel('I\'d trade this for…').fill('Seeds')
    await expect(next(page)).toBeEnabled()
    // Back keeps what was typed
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByLabel('Title')).toHaveValue('Rake')
  })

  test('the title is capped at 80 characters', async ({ page }) => {
    await startListing(page)
    await next(page).click()
    const title = page.getByLabel('Title')
    await title.fill('T'.repeat(100))
    await expect(title).toHaveValue('T'.repeat(80))
    await expect(page.getByText('80 of 80 characters')).toBeVisible()
  })

  test('T-66: emoji count as one character, so 80 emoji fit an 80-character title', async ({ page }) => {
    await startListing(page)
    await next(page).click()
    const title = page.getByLabel('Title')
    // maxLength counts UTF-16 units and would have cut this at 40 bikes
    await expect(title).not.toHaveAttribute('maxlength', /.*/)
    await title.fill('🚲'.repeat(80))
    await expect(title).toHaveValue('🚲'.repeat(80))
    await title.fill('🚲'.repeat(90))
    await expect(title).toHaveValue('🚲'.repeat(80))
    await expect(page.getByText('80 of 80 characters')).toBeVisible()
    await page.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Goods' }).click()
    await next(page).click()
    await page.getByLabel('I\'d trade this for…').fill('🌱'.repeat(1000))
    await expect(page.getByLabel('I\'d trade this for…')).toHaveValue('🌱'.repeat(1000))
    await next(page).click()
    await page.getByRole('button', { name: 'Post listing' }).click()
    await expect(page).toHaveURL(/\/listing\/listing-[\w-]+$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('🚲'.repeat(80))
  })

  test('the review step shows exactly what will be posted', async ({ page }) => {
    await startListing(page)
    await next(page).click()
    await page.getByLabel('Title').fill('Cast iron skillet')
    await page.getByLabel('Description (optional)').fill('10 inch, seasoned')
    await page.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Goods' }).click()
    await page.getByRole('group', { name: 'Condition (optional)' }).getByRole('button', { name: 'Good' }).click()
    await next(page).click()
    await page.getByLabel('I\'d trade this for…').fill('Fresh eggs')
    await next(page).click()
    const main = page.getByRole('main')
    await expect(main.getByText('Cast iron skillet')).toBeVisible()
    await expect(main.getByText('10 inch, seasoned')).toBeVisible()
    await expect(main.getByText('Goods', { exact: true })).toBeVisible()
    await expect(main.getByText('Good', { exact: true })).toBeVisible()
    await expect(main.getByText('Fresh eggs')).toBeVisible()
    await expect(main.getByText('Your listing stays up for 30 days. Neighbors see your neighborhood, never your address.')).toBeVisible()
  })
})

test.describe('L-05 edit a listing', () => {
  async function openEdit(page: Page) {
    await login(page, 'Jamie')
    await goInApp(page, '/listing/listing-013')
    await expect(page.getByRole('heading', { level: 1, name: 'Raised Garden Bed Kit' })).toBeVisible()
    await page.getByRole('button', { name: 'Edit listing' }).click()
    await expect(page).toHaveURL('/listing/listing-013/edit')
    await expect(page.getByRole('heading', { level: 1, name: 'Edit listing' })).toBeVisible()
  }

  test('switching a listing with a condition to Services drops the condition', async ({ page }) => {
    await login(page, 'Jamie')
    await writeStore(
      page,
      'listings-store',
      "(store) => store.setState(s => ({ listings: s.listings.map(l => l.id === 'listing-013' ? { ...l, condition: 'good' } : l) }))",
    )
    await goInApp(page, '/listing/listing-013')
    await expect(page.getByText('Good', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Edit listing' }).click()
    const condition = page.getByRole('group', { name: 'Condition (optional)' })
    await expect(condition.getByRole('button', { name: 'Good' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Services' }).click()
    await expect(condition).toHaveCount(0)
    // Back to a category with a condition: the old pick doesn't come back
    await page.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Goods' }).click()
    await expect(condition.getByRole('button', { name: 'Good' })).toHaveAttribute('aria-pressed', 'false')
    await page.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Services' }).click()
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL('/listing/listing-013')
    await expect(page.getByText('Services', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Good', { exact: true })).toHaveCount(0)
    // T-49: the old condition is cleared in the store too, not just hidden
    const stored = await readStore<string | null | undefined>(
      page,
      'listings-store',
      "s => s.listings.find(l => l.id === 'listing-013').condition",
    )
    expect(stored ?? null).toBeNull()
    // So switching back to Goods doesn't bring it back
    await page.getByRole('button', { name: 'Edit listing' }).click()
    await page.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Goods' }).click()
    await expect(page.getByRole('group', { name: 'Condition (optional)' }).locator('[aria-pressed="true"]')).toHaveCount(0)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL('/listing/listing-013')
    await expect(page.getByText('Good', { exact: true })).toHaveCount(0)
  })

  test('edit text and photos, then save', async ({ page }) => {
    await openEdit(page)
    await expect(page.getByLabel('Title')).toHaveValue('Raised Garden Bed Kit')
    await expect(thumbs(page)).toHaveCount(2)
    const [first, second] = await thumbSrcs(page)
    await page.getByLabel('Title').fill('Cedar raised bed kit')
    await page.getByLabel('What would you like in return?').fill('Seedlings')
    await page.getByRole('button', { name: 'Remove photo 1' }).click()
    await photoInput(page).setInputFiles(photoFiles(1))
    await expect(thumbs(page)).toHaveCount(2)
    const after = await thumbSrcs(page)
    expect(after[0]).toBe(second)
    expect(after[1]).toMatch(/^blob:/)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Changes saved.')).toBeVisible()
    await expect(page).toHaveURL('/listing/listing-013')
    await expect(page.getByRole('heading', { level: 1, name: 'Cedar raised bed kit' })).toBeVisible()
    await expect(page.getByText('Seedlings', { exact: true })).toBeVisible()
    const saved = await readStore<{ images: string[]; title: string }>(page, 'listings-store', "s => s.listings.find(l => l.id === 'listing-013')")
    expect(saved.images).toEqual(after)
    expect(saved.images).not.toContain(first)
  })

  test('an empty title or wish list cannot be saved', async ({ page }) => {
    await openEdit(page)
    const save = page.getByRole('button', { name: 'Save changes' })
    await page.getByLabel('Title').fill('ab')
    await expect(page.getByText('Add a title (at least 3 characters).')).toBeVisible()
    await expect(save).toBeDisabled()
    await page.getByLabel('Title').fill('Garden bed')
    await page.getByLabel('What would you like in return?').fill('')
    await expect(page.getByText('Tell neighbors what you’d like in return.')).toBeVisible()
    await expect(save).toBeDisabled()
    await page.getByLabel('Title').fill('T'.repeat(100))
    await expect(page.getByLabel('Title')).toHaveValue('T'.repeat(80))
  })

  test('Cancel leaves the listing as it was and frees new photos', async ({ page }) => {
    await openEdit(page)
    await page.getByLabel('Title').fill('Changed but not saved')
    await photoInput(page).setInputFiles(photoFiles(1))
    await expect(thumbs(page)).toHaveCount(3)
    const added = (await thumbSrcs(page))[2]
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page).toHaveURL('/listing/listing-013')
    await expect(page.getByRole('heading', { level: 1, name: 'Raised Garden Bed Kit' })).toBeVisible()
    await expectFreed(page, added)
    expect(await readStore<string[]>(page, 'listings-store', "s => s.listings.find(l => l.id === 'listing-013').images")).toHaveLength(2)
  })

  test("someone else's listing cannot be edited", async ({ page }) => {
    await login(page, 'Jamie')
    await goInApp(page, '/listing/listing-002/edit')
    await expect(page.getByText("We couldn't open this listing for editing.")).toBeVisible()
    await expect(page.getByLabel('Title')).toHaveCount(0)
    await page.getByRole('link', { name: 'Go to your listings' }).click()
    await expect(page).toHaveURL('/dashboard')
  })
})

test.describe('L-06 take down, relist and expiry', () => {
  test('take down asks first, then relist brings it back', async ({ page }) => {
    await login(page, 'Jamie')
    await goInApp(page, '/listing/listing-001')
    await expect(page.getByRole('heading', { level: 1, name: 'Vintage Record Player' })).toBeVisible()
    await page.getByRole('button', { name: 'Take down' }).click()
    const dialog = page.getByRole('dialog', { name: 'Take down this listing?' })
    await expect(dialog).toContainText("Neighbors won't see it anymore and can't make new offers. You can relist it later from this page.")
    await dialog.getByRole('button', { name: 'Keep it up' }).click()
    await expect(dialog).toHaveCount(0)
    expect(await readStore<string>(page, 'listings-store', "s => s.listings.find(l => l.id === 'listing-001').status")).toBe('active')

    await page.getByRole('button', { name: 'Take down' }).click()
    await dialog.getByRole('button', { name: 'Take down listing' }).click()
    await expect(page.getByText('Listing taken down. You can relist it anytime.')).toBeVisible()
    await expect(page).toHaveURL('/dashboard')
    expect(await readStore<string>(page, 'listings-store', "s => s.listings.find(l => l.id === 'listing-001').status")).toBe('closed')

    await goInApp(page, '/listing/listing-001')
    await expect(page.getByText('No longer available', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit listing' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Relist for 30 days' }).click()
    await expect(page.getByText(/It stays up for another 30 days\./)).toBeVisible()
    await expect(page.getByText('No longer available', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Take down' })).toBeVisible()
    const l = await readStore<{ status: string; expiresAt: string }>(page, 'listings-store', "s => s.listings.find(l => l.id === 'listing-001')")
    expect(l.status).toBe('active')
    expect((Date.parse(l.expiresAt) - Date.now()) / 864e5).toBeGreaterThan(29.9)
  })

  test('the relist message uses "relist", not "renew"', async ({ page }) => {
    await login(page, 'Jamie')
    await writeStore(page, 'listings-store', "(store) => store.getState().withdrawListing('listing-001')")
    await goInApp(page, '/listing/listing-001')
    await page.getByRole('button', { name: 'Relist for 30 days' }).click()
    await expect(page.getByText(/relisted/i)).toBeVisible({ timeout: 2000 })
  })

  test('a taken-down listing can be found again to relist it', async ({ page }) => {
    await login(page, 'Jamie')
    await writeStore(page, 'listings-store', "(store) => store.getState().withdrawListing('listing-001')")
    await goInApp(page, '/dashboard')
    await expect(page.getByRole('main').getByText('Vintage Record Player')).toBeVisible({ timeout: 3000 })
  })

  test('relist from the dashboard: taken down and expired listings', async ({ page }) => {
    await login(page, 'Jamie')
    await writeStore(page, 'listings-store', "(store) => store.getState().withdrawListing('listing-001')")
    // listing-013 (Jamie's garden bed kit) ran out of time but the server hasn't closed it yet
    await writeStore(
      page,
      'listings-store',
      `(store) => store.setState(s => ({ listings: s.listings.map(l => l.id === 'listing-013'
        ? { ...l, status: 'active', expiresAt: new Date(Date.now() - 3600e3).toISOString() } : l) }))`,
    )
    // Your own profile points there
    await goInApp(page, '/profile/me')
    await page.getByRole('main').getByRole('link', { name: 'Relist from your dashboard' }).click()
    await expect(page).toHaveURL('/dashboard#closed-listings')
    const section = page.getByRole('region', { name: 'Taken down and expired' })
    await expect(section).toBeVisible()
    await expect(section.getByRole('article')).toHaveCount(2)
    await expect(section.getByRole('article').filter({ hasText: 'Vintage Record Player' })).toContainText('Taken down')
    await expect(section.getByRole('article').filter({ hasText: 'Raised Garden Bed Kit' })).toContainText('Expired')

    await section.getByRole('button', { name: 'Relist Vintage Record Player' }).click()
    await expect(page.getByText('Listing relisted. It stays up for another 30 days.')).toBeVisible()
    await expect(section.getByRole('article')).toHaveCount(1)
    const l = await readStore<{ status: string; expiresAt: string }>(page, 'listings-store', "s => s.listings.find(l => l.id === 'listing-001')")
    expect(l.status).toBe('active')
    expect((Date.parse(l.expiresAt) - Date.now()) / 864e5).toBeGreaterThan(29.9)
  })

  test('neighbors see a taken-down listing as no longer available', async ({ page }) => {
    await login(page, 'Maria')
    await writeStore(page, 'listings-store', "(store) => store.getState().withdrawListing('listing-001')")
    await goInApp(page, '/listing/listing-001')
    await expect(page.getByText('No longer available', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'This listing is no longer available' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Make an offer', exact: true })).toHaveCount(0)
  })

  test('a listing past its 30 days reads as closed', async ({ page }) => {
    await login(page, 'Maria')
    await writeStore(
      page,
      'listings-store',
      `(store) => store.setState(s => ({ listings: s.listings.map(l => l.id === 'listing-001'
        ? { ...l, status: 'active', expiresAt: new Date(Date.now() - 3600e3).toISOString() } : l) }))`,
    )
    await goInApp(page, '/listing/listing-001')
    await expect(page.getByRole('heading', { level: 1, name: 'Vintage Record Player' })).toBeVisible()
    await expect(page.getByText('No longer available', { exact: true })).toBeVisible({ timeout: 2000 })
  })

  test('a listing with a trade in progress cannot be edited or taken down', async ({ page }) => {
    await login(page, 'Jamie')
    await writeStore(
      page,
      'listings-store',
      "(store) => store.setState(s => ({ listings: s.listings.map(l => l.id === 'listing-001' ? { ...l, status: 'pending' } : l) }))",
    )
    await goInApp(page, '/listing/listing-001')
    await expect(page.getByText('Trade in progress', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'You have a trade in progress for this listing' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Take down' })).toHaveCount(0)
  })
})

test.describe('L-08 listing detail', () => {
  test("someone else's listing: gallery, owner card and Make an offer", async ({ page }, testInfo) => {
    await login(page, 'Jamie')
    await goInApp(page, '/listing/listing-003')
    await expect(page).toHaveTitle('KitchenAid Stand Mixer | Bartrrr')
    const gallery = page.getByRole('region', { name: 'Photos of KitchenAid Stand Mixer: 2 photos. Use the arrow keys to browse.' })
    await expect(gallery).toBeVisible()
    await expect(gallery.getByRole('img')).toHaveCount(2)
    await expect(gallery.getByRole('img', { name: 'KitchenAid Stand Mixer photo 2' })).toBeAttached()
    if (!isMobile(testInfo)) {
      await expect(page.getByRole('button', { name: 'Next photo' })).toBeVisible()
      await page.getByRole('button', { name: 'Next photo' }).click()
      await expect.poll(() => gallery.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
      await page.getByRole('button', { name: 'Previous photo' }).click()
      await expect.poll(() => gallery.evaluate((el) => el.scrollLeft)).toBe(0)
    }
    // Keyboard browsing
    await gallery.focus()
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => gallery.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)

    await expect(page.getByText('Goods', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Looking for', { exact: true }).first()).toBeVisible()
    const owner = page.getByRole('link', { name: /Dave Morrison/ }).filter({ hasText: /trades?/ })
    await expect(owner).toHaveAttribute('href', '/profile/dave_cooks')
    await expect(owner).toContainText('East Memphis')
    await expect(owner).toContainText('4.4')
    await expect(owner).toContainText('11 trades')
    await expect(page.getByRole('button', { name: 'Make an offer', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit listing' })).toHaveCount(0)
    // Similar listings: other active goods
    await expect(page.getByRole('heading', { name: 'Similar listings' })).toBeVisible()
    await owner.click()
    await expect(page).toHaveURL('/profile/dave_cooks')
  })

  test('your own listing has no Make an offer, only edit and take down', async ({ page }) => {
    await login(page, 'Jamie')
    await goInApp(page, '/listing/listing-001')
    await expect(page.getByRole('heading', { level: 1, name: 'Vintage Record Player' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Make an offer', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Edit listing' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Take down' })).toBeVisible()
  })

  test('similar listings never include closed ones or this listing', async ({ page }) => {
    await login(page, 'Jamie')
    await writeStore(page, 'listings-store', "(store) => store.getState().withdrawListing('listing-006')")
    await goInApp(page, '/listing/listing-003')
    const similar = page.getByRole('heading', { name: 'Similar listings' }).locator('..')
    await expect(similar.getByRole('article').first()).toBeVisible()
    await expect(similar.getByRole('heading', { level: 3, name: 'IKEA Kallax Shelf Unit' })).toHaveCount(0)
    await expect(similar.getByRole('heading', { level: 3, name: 'KitchenAid Stand Mixer' })).toHaveCount(0)
    expect(await similar.getByRole('article').count()).toBeLessThanOrEqual(4)
  })

  test('a missing listing says so', async ({ page }) => {
    await login(page, 'Jamie')
    await goInApp(page, '/listing/listing-does-not-exist')
    await expect(page.getByText("We couldn't find this listing.")).toBeVisible()
    await expect(page.getByText('It may have been traded or taken down.')).toBeVisible()
    await page.getByRole('link', { name: 'Browse other listings' }).click()
    await expect(page).toHaveURL('/browse')
  })

  test('the action bar does not cover the page content on phones', async ({ page }, testInfo) => {
    test.skip(!isMobile(testInfo), 'Phone layout check')
    await login(page, 'Jamie')
    await goInApp(page, '/listing/listing-003')
    await expect(page.getByRole('heading', { name: 'Similar listings' })).toBeVisible()
    // Scroll to the bottom: the last card must clear the sticky bar and bottom nav
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const lastCard = page.getByRole('main').getByRole('article').last()
    const cardBox = await lastCard.boundingBox()
    const bar = await page.getByRole('button', { name: 'Make an offer', exact: true }).locator('xpath=ancestor::div[contains(@class,"fixed")]').boundingBox()
    expect(cardBox!.y + cardBox!.height).toBeLessThanOrEqual(bar!.y + 1)
  })
})

test.describe('L-09 share a listing', () => {
  test('Share uses the device share sheet when there is one', async ({ page }) => {
    await page.addInitScript(() => {
      const calls: unknown[] = []
      // @ts-expect-error test hook
      window.__shares = calls
      Object.defineProperty(navigator, 'share', { configurable: true, value: async (d: unknown) => { calls.push(d) } })
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false })
    })
    await login(page, 'Jamie')
    await goInApp(page, '/listing/listing-003')
    await page.getByRole('button', { name: 'Share' }).click()
    // @ts-expect-error test hook
    await expect.poll(() => page.evaluate(() => window.__shares.length)).toBe(1)
    // @ts-expect-error test hook
    const shared = await page.evaluate(() => window.__shares[0])
    expect(shared).toMatchObject({ title: 'KitchenAid Stand Mixer', url: expect.stringMatching(/\/listing\/listing-003$/) })
    expect(shared.text).toContain('KitchenAid Stand Mixer')
  })

  test('without a share sheet, Share copies the link', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    })
    await login(page, 'Jamie')
    await goInApp(page, '/listing/listing-003')
    await page.getByRole('button', { name: 'Share' }).click()
    await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible()
    const text = await page.evaluate(() => navigator.clipboard.readText())
    expect(text).toContain('KitchenAid Stand Mixer')
    expect(text).toMatch(/\/listing\/listing-003$/)
  })

  test('a newly posted listing offers to share it', async ({ page }) => {
    await startListing(page)
    await finishListing(page, 'Share me')
    const banner = page.getByText('Your listing is live!').locator('xpath=ancestor::div[contains(@class,"border-teal")]')
    await expect(banner.getByRole('button', { name: 'Share' })).toBeVisible()
    await expect(banner).toContainText('Share it to get offers sooner.')
  })
})
