/// <reference lib="dom" />
import { mkdirSync } from 'node:fs'
import type { Page, TestInfo } from '@playwright/test'
import { test, expect as baseExpect } from '../fixtures'
import { NEIGHBORHOOD_CENTERS } from '../../src/data/neighborhoods'
import {
  blockMapStyle,
  captureBugShots,
  goInApp,
  isMobile,
  login,
  readStore,
  stubMapStyle,
  writeStore,
} from './helpers-core'

/**
 * D-01 browse map, D-02 filters, search and empty states, D-03 feed.
 * The basemap is blocked in the sandbox: a stub style lets MapLibre load so
 * pins can be checked; tiles themselves are never asserted.
 */

captureBugShots(test)
const expect = baseExpect.configure({ timeout: 10_000 })

// Initial view in ListingsMap.tsx: the signed-in neighbor's neighborhood at
// zoom 13. The pin-position tests below log in as Jamie (Downtown Memphis).
const MAP_CENTER = NEIGHBORHOOD_CENTERS['Downtown Memphis']
const MAP_ZOOM = 13

const listCards = (page: Page) => page.getByRole('main').getByRole('article')
const markers = (page: Page) => page.locator('.maplibregl-marker')

/**
 * Listings at the same spot (every listing sits at its neighborhood center)
 * share one pin with a count (T-62). Each pin lists the ids it stands for.
 */
const pinFor = (page: Page, listingId: string) =>
  page.locator(`.maplibregl-marker[data-listing-ids~="${listingId}"]`)

/** How many listings the map's pins stand for, all together. */
const pinnedCount = (page: Page) =>
  markers(page).evaluateAll((ms) => ms.reduce((n, m) => n + Number((m as HTMLElement).dataset.count ?? 1), 0))

const expectAllPinned = async (page: Page, n: number) => {
  await expect(markers(page).first()).toBeAttached()
  await expect.poll(() => pinnedCount(page)).toBe(n)
}

/** The list a shared pin opens. */
const pinList = (page: Page) => page.getByRole('region', { name: /^\d+ listings (in .+|here)$/ })

/** Open a listing's preview from the map, through its pin's list when it shares one. */
async function openOnMap(page: Page, listingId: string, title: string) {
  const pin = pinFor(page, listingId)
  // Pins can sit under each other; dispatch the click on the right pin
  await pin.dispatchEvent('click')
  if ((await pin.getAttribute('data-count')) !== '1') {
    await pinList(page).getByRole('button', { name: title }).click()
  }
}

/** Screenshots for the T-62 report, when asked for (CLUSTER_SHOTS_DIR). */
async function clusterShot(page: Page, testInfo: TestInfo, name: string) {
  const dir = process.env.CLUSTER_SHOTS_DIR
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: `${dir}/${name}-${testInfo.project.name}.png` })
}

/** Two new listings that land on the Downtown Memphis center. Returns their ids by title. */
async function addTwoDowntown(page: Page, a: [string, string], b: [string, string]) {
  for (const [title, category] of [a, b]) {
    await writeStore(
      page,
      'listings-store',
      `(store) => store.getState().addListing({
        title: '${title}', description: '', category: '${category}', seeking: 'anything',
        images: [], userId: 'user-002',
        location: { lat: 35.1495, lng: -90.0493, neighborhood: 'Downtown Memphis' } })`,
    )
  }
  return readStore<Record<string, string>>(
    page,
    'listings-store',
    `s => Object.fromEntries(s.listings.filter(l => ['${a[0]}', '${b[0]}'].includes(l.title)).map(l => [l.title, l.id]))`,
  )
}

/** On phones the map is behind the Map view toggle. */
async function showMap(page: Page, testInfo: TestInfo) {
  if (isMobile(testInfo)) await page.getByRole('button', { name: 'Map view' }).click()
}

/** Active listing count straight from the store. */
const activeCount = (page: Page) =>
  readStore<number>(page, 'listings-store', "s => s.listings.filter(l => l.status === 'active').length")

/** Active listings whose title, description, wants or neighborhood contain q. */
const matching = (page: Page, q: string) =>
  readStore<number>(
    page,
    'listings-store',
    `s => s.listings.filter(l => l.status === 'active' &&
      [l.title, l.description, l.seeking, l.location.neighborhood].some(t => t.toLowerCase().includes('${q}'))).length`,
  )

/**
 * Where each pin sits, as longitude/latitude, worked out from its pixel
 * position on the initial (unmoved) map view.
 */
async function pinPositions(page: Page) {
  return page.evaluate(
    ({ center, zoom }) => {
      const map = document.querySelector('.maplibregl-map')!.getBoundingClientRect()
      const world = 512 * 2 ** zoom
      const toY = (lat: number) => {
        const r = (lat * Math.PI) / 180
        return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * world
      }
      const cx = ((center.lng + 180) / 360) * world
      const cy = toY(center.lat)
      return [...document.querySelectorAll<HTMLElement>('.maplibregl-marker')].flatMap((m) => {
        const b = m.getBoundingClientRect()
        const x = cx + (b.left + b.width / 2 - (map.left + map.width / 2))
        const y = cy + (b.top + b.height / 2 - (map.top + map.height / 2))
        const n = Math.PI - (2 * Math.PI * y) / world
        const lng = (x / world) * 360 - 180
        const lat = (Math.atan(Math.sinh(n)) * 180) / Math.PI
        // One entry per listing the pin stands for
        return (m.dataset.listingIds ?? '').split(' ').map((id) => ({ id, lng, lat }))
      })
    },
    { center: MAP_CENTER, zoom: MAP_ZOOM },
  )
}

test.describe('D-01 browse map', () => {
  test('map mounts with every active listing pinned', async ({ page }, testInfo) => {
    await stubMapStyle(page)
    await login(page, 'Jamie')
    await expect(page).toHaveURL('/browse')
    await expect(page).toHaveTitle('Browse listings | Bartrrr')
    await showMap(page, testInfo)
    await expect(page.locator('.maplibregl-map')).toBeVisible()
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible()
    await expectAllPinned(page, await activeCount(page))
    // Each pin is named after its listing, or its listings and neighborhood
    await expect(markers(page).first()).toHaveAttribute('role', 'button')
    await expect(markers(page).first()).toHaveAttribute('aria-label', /\S/)
    // Required map credit
    await expect(page.getByText('OpenStreetMap')).toBeAttached()
  })

  test('phones start in list view and switch to the map and back', async ({ page }, testInfo) => {
    test.skip(!isMobile(testInfo), 'Desktop shows the map and list side by side')
    await stubMapStyle(page)
    await login(page, 'Jamie')
    await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true')
    await expect(listCards(page).first()).toBeVisible()
    await expect(page.locator('.maplibregl-map')).toHaveCount(0)
    await page.getByRole('button', { name: 'Map view' }).click()
    await expect(page.getByRole('button', { name: 'Map view' })).toHaveAttribute('aria-pressed', 'true')
    await expect(markers(page).first()).toBeVisible()
    await expect(listCards(page).first()).toBeHidden()
    await page.getByRole('button', { name: 'List view' }).click()
    await expect(listCards(page).first()).toBeVisible()
  })

  test('a new listing is pinned at its neighborhood center, not an address', async ({ page }, testInfo) => {
    await stubMapStyle(page)
    await login(page, 'Jamie')
    const uid = 'user-001'
    await writeStore(
      page,
      'listings-store',
      `(store) => store.getState().addListing({
        title: 'Pin check', description: '', category: 'goods', seeking: 'anything',
        images: [], userId: '${uid}',
        location: { lat: 35.14567, lng: -90.05111, neighborhood: 'Downtown Memphis' } })`,
    )
    await showMap(page, testInfo)
    await expectAllPinned(page, await activeCount(page))
    const id = await readStore<string>(page, 'listings-store', "s => s.listings.find(l => l.title === 'Pin check').id")
    const pin = (await pinPositions(page)).find((p) => p.id === id)!
    const center = NEIGHBORHOOD_CENTERS['Downtown Memphis']
    // Stored at ~1 km precision (two decimals), so within 0.006° of the center
    expect(Math.abs(pin.lat - center.lat)).toBeLessThan(0.006)
    expect(Math.abs(pin.lng - center.lng)).toBeLessThan(0.006)
    // and never at the full-precision point that was passed in
    const stored = await readStore<{ lat: number; lng: number }>(
      page,
      'listings-store',
      "s => s.listings.find(l => l.title === 'Pin check').location",
    )
    expect(stored).toMatchObject({ lat: 35.15, lng: -90.05 })
  })

  test('sample listing pins sit at their neighborhood centers', async ({ page }, testInfo) => {
    test.fail(true, 'BUG: demo listings in src/data/mock-listings.ts use made-up coordinates up to ~3 km from their neighborhood center (e.g. Cooper-Young lawn mowing sits in Midtown)')
    await stubMapStyle(page)
    await login(page, 'Jamie')
    await showMap(page, testInfo)
    await expectAllPinned(page, await activeCount(page))
    const listings = await readStore<{ id: string; title: string; hood: string }[]>(
      page,
      'listings-store',
      "s => s.listings.filter(l => l.status === 'active').map(l => ({ id: l.id, title: l.title, hood: l.location.neighborhood }))",
    )
    const pins = await pinPositions(page)
    const off = listings
      .map((l) => {
        const p = pins.find((x) => x.id === l.id)!
        const c = NEIGHBORHOOD_CENTERS[l.hood]
        return { title: l.title, dLat: Math.abs(p.lat - c.lat), dLng: Math.abs(p.lng - c.lng) }
      })
      .filter((d) => d.dLat > 0.006 || d.dLng > 0.006)
    expect(off).toEqual([])
  })

  test('tapping a pin opens a preview that leads to the listing', async ({ page }, testInfo) => {
    await stubMapStyle(page)
    await login(page, 'Jamie')
    await showMap(page, testInfo)
    await expect(pinFor(page, 'listing-004')).toBeAttached()
    await openOnMap(page, 'listing-004', 'Bike Tune-Up Service')
    const preview = page.locator('.maplibregl-map').locator('..').getByRole('button', { name: 'View listing' })
    await expect(preview).toBeVisible()
    await expect(page.getByText('Overton Square').first()).toBeVisible()
    await expect(page.getByText('Sam Nguyen').first()).toBeVisible()
    await page.getByRole('button', { name: 'Close preview' }).click()
    await expect(preview).toBeHidden()
    await openOnMap(page, 'listing-004', 'Bike Tune-Up Service')
    await page.getByRole('button', { name: 'View listing' }).click()
    await expect(page).toHaveURL('/listing/listing-004')
    await expect(page.getByRole('heading', { level: 1, name: 'Bike Tune-Up Service' })).toBeVisible()
  })

  test('pins can be reached and opened with the keyboard', async ({ page }, testInfo) => {
    await stubMapStyle(page)
    await login(page, 'Jamie')
    await showMap(page, testInfo)
    const pin = pinFor(page, 'listing-004')
    await expect(pin).toHaveAttribute('tabindex', '0')
    const shared = (await pin.getAttribute('data-count')) !== '1'
    const row = pinList(page).getByRole('button', { name: 'Bike Tune-Up Service' })
    // Enter opens the preview (or the pin's list) and moves focus into it
    await pin.focus()
    await page.keyboard.press('Enter')
    if (shared) {
      await expect(pinList(page).getByRole('listitem').first().getByRole('button')).toBeFocused()
      await row.press('Enter')
    }
    const view = page.getByRole('button', { name: 'View listing' })
    await expect(view).toBeFocused()
    await expect(page.getByText('Sam Nguyen').first()).toBeVisible()
    // Space works too
    await page.getByRole('button', { name: 'Close preview' }).click()
    await pin.focus()
    await page.keyboard.press(' ')
    if (shared) await row.press(' ')
    await expect(view).toBeVisible()
    // Escape closes it and puts focus back on the pin
    await page.keyboard.press('Escape')
    await expect(view).toBeHidden()
    await expect(pin).toBeFocused()
  })

  test('T-62: listings at the same neighborhood center share one pin with a count', async ({ page }, testInfo) => {
    await stubMapStyle(page)
    await login(page, 'Jamie')
    // Both land on the Downtown Memphis center (stored at ~1 km precision)
    const ids = await addTwoDowntown(page, ['Cluster lamp', 'goods'], ['Cluster bike repair', 'services'])
    const lamp = ids['Cluster lamp']
    const repair = ids['Cluster bike repair']
    await showMap(page, testInfo)
    await expectAllPinned(page, await activeCount(page))
    // One pin for both: not two stacked pins with only the top one clickable
    const pin = pinFor(page, lamp)
    await expect(pin).toHaveCount(1)
    await expect(pinFor(page, repair)).toHaveCount(1)
    expect((await pin.getAttribute('data-listing-ids'))!.split(' ')).toContain(repair)
    const count = Number(await pin.getAttribute('data-count'))
    expect(count).toBeGreaterThanOrEqual(2)
    await expect(pin).toHaveAttribute('aria-label', `${count} listings in Downtown Memphis`)
    await expect(pin).toHaveText(String(count))
    // Never moved off the neighborhood center
    const center = NEIGHBORHOOD_CENTERS['Downtown Memphis']
    const pos = (await pinPositions(page)).find((p) => p.id === lamp)!
    expect(Math.abs(pos.lat - center.lat)).toBeLessThan(0.006)
    expect(Math.abs(pos.lng - center.lng)).toBeLessThan(0.006)
    await clusterShot(page, testInfo, 'cluster-pin')

    await pin.dispatchEvent('click')
    const list = page.getByRole('region', { name: `${count} listings in Downtown Memphis` })
    await expect(list).toBeVisible()
    await expect(list.getByRole('listitem')).toHaveCount(count)
    await expect(list.getByRole('button', { name: /Cluster lamp/ })).toBeVisible()
    await expect(list.getByRole('button', { name: /Cluster bike repair/ })).toBeVisible()
    await clusterShot(page, testInfo, 'cluster-list')
    await list.getByRole('button', { name: /Cluster bike repair/ }).click()
    await expect(page.getByRole('button', { name: 'View listing' })).toBeVisible()
    // Back to the list, then on to the listing
    await page.getByRole('button', { name: `All ${count} listings here` }).click()
    await expect(list).toBeVisible()
    await list.getByRole('button', { name: /Cluster lamp/ }).click()
    await page.getByRole('button', { name: 'View listing' }).click()
    await expect(page).toHaveURL(`/listing/${lamp}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Cluster lamp' })).toBeVisible()
  })

  test('T-62: a shared pin opens its list from the keyboard, and Escape returns to the pin', async ({ page }, testInfo) => {
    await stubMapStyle(page)
    await login(page, 'Jamie')
    const ids = await addTwoDowntown(page, ['Cluster one', 'goods'], ['Cluster two', 'goods'])
    await showMap(page, testInfo)
    const pin = pinFor(page, ids['Cluster one'])
    await expect(pin).toHaveAttribute('tabindex', '0')
    await expect(pin).toHaveAttribute('role', 'button')
    await pin.focus()
    await page.keyboard.press('Enter')
    const list = pinList(page)
    await expect(list.getByRole('listitem').first().getByRole('button')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(list).toBeHidden()
    await expect(pin).toBeFocused()
    await page.keyboard.press(' ')
    await expect(list).toBeVisible()
    await list.getByRole('button', { name: /Cluster two/ }).press('Enter')
    await expect(page.getByRole('button', { name: 'View listing' })).toBeFocused()
    await expect(page.getByText('Cluster two').first()).toBeVisible()
  })

  test('the map opens on your own neighborhood', async ({ page }, testInfo) => {
    await stubMapStyle(page)
    await login(page, 'Priya')
    await showMap(page, testInfo)
    await expectAllPinned(page, await activeCount(page))
    const box = await page.locator('.maplibregl-map').boundingBox()
    const own = pinFor(page, 'listing-005')
    const pinBox = await own.boundingBox()
    expect(pinBox).not.toBeNull()
    expect(pinBox!.x).toBeGreaterThanOrEqual(box!.x)
    expect(pinBox!.x + pinBox!.width).toBeLessThanOrEqual(box!.x + box!.width)
    expect(pinBox!.y).toBeGreaterThanOrEqual(box!.y)
    expect(pinBox!.y + pinBox!.height).toBeLessThanOrEqual(box!.y + box!.height)
  })

  test('when the map cannot load, it says so and the list still works', async ({ page }, testInfo) => {
    await blockMapStyle(page)
    await login(page, 'Jamie')
    await showMap(page, testInfo)
    await expect(page.getByText("Map isn't available right now")).toBeVisible()
    await expect(page.getByText('You can still see every nearby listing in the list view.')).toBeVisible()
    if (isMobile(testInfo)) await page.getByRole('button', { name: 'List view' }).click()
    await expect(listCards(page)).toHaveCount(await activeCount(page))
  })
})

test.describe('D-02 filters, search and empty states', () => {
  test('category chips filter the list and the map', async ({ page }, testInfo) => {
    await stubMapStyle(page)
    await login(page, 'Jamie')
    const group = page.getByRole('group', { name: 'Category' })
    await expect(group.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    await group.getByRole('button', { name: 'Services' }).click()
    await expect(group.getByRole('button', { name: 'Services' })).toHaveAttribute('aria-pressed', 'true')
    await expect(group.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
    const services = await readStore<string[]>(
      page,
      'listings-store',
      "s => s.listings.filter(l => l.status === 'active' && l.category === 'services').map(l => l.title)",
    )
    await expect(listCards(page)).toHaveCount(services.length)
    for (const title of services) await expect(page.getByRole('heading', { level: 3, name: title })).toBeVisible()
    await showMap(page, testInfo)
    await expectAllPinned(page, services.length)
    if (isMobile(testInfo)) await page.getByRole('button', { name: 'List view' }).click()
    // Pressing the selected chip again clears it
    await group.getByRole('button', { name: 'Services' }).click()
    await expect(group.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    await expect(listCards(page)).toHaveCount(await activeCount(page))
  })

  test('distance filter keeps listings within the chosen radius', async ({ page }) => {
    await login(page, 'Jamie')
    await page.getByRole('button', { name: 'Distance filter' }).click()
    await expect(page.getByRole('button', { name: 'Distance filter' })).toHaveAttribute('aria-expanded', 'true')
    const within = page.getByRole('group', { name: 'Within' })
    await within.getByRole('button', { name: '0.5 mi' }).click()
    const near = await readStore<number>(
      page,
      'listings-store',
      "s => s.listings.filter(l => l.status === 'active' && l.distanceMi <= 0.5).length",
    )
    await expect(listCards(page)).toHaveCount(near)
    await within.getByRole('button', { name: 'Any' }).click()
    await expect(listCards(page)).toHaveCount(await activeCount(page))
  })

  test('header search finds listings by word and by neighborhood', async ({ page }) => {
    await login(page, 'Jamie')
    const search = page.getByRole('searchbox', { name: 'Search listings' })
    await search.fill('bike')
    await search.press('Enter')
    await expect(page).toHaveURL('/browse?q=bike')
    const bikes = await matching(page, 'bike')
    await expect(page.getByText(`${bikes} listings for`)).toBeVisible()
    await expect(listCards(page)).toHaveCount(bikes)
    await expect(page.getByRole('heading', { level: 3, name: 'Bike Tune-Up Service' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: /Mountain Bike/ })).toBeVisible()

    await search.fill('germantown')
    await search.press('Enter')
    await expect(page).toHaveURL('/browse?q=germantown')
    const gt = await matching(page, 'germantown')
    expect(gt).toBeGreaterThanOrEqual(2)
    await expect(listCards(page)).toHaveCount(gt)
    await expect(page.getByText(`${gt} listings for`)).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: 'Succulent Collection (12 pots)' })).toBeVisible()

    await page.getByRole('button', { name: 'Clear search' }).click()
    await expect(page).toHaveURL('/browse')
    await expect(listCards(page)).toHaveCount(await activeCount(page))
  })

  test('a search with no matches says so and can be cleared', async ({ page }) => {
    await login(page, 'Jamie')
    const search = page.getByRole('searchbox', { name: 'Search listings' })
    await search.fill('zzqx unicorn')
    await search.press('Enter')
    await expect(page.getByText('0 listings for')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No matches' })).toBeVisible()
    await expect(page.getByText(/Nothing nearby matches “zzqx unicorn”/)).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page).toHaveURL('/browse')
    await expect(listCards(page)).toHaveCount(await activeCount(page))
  })

  test('a filter with no matches offers to clear filters', async ({ page }) => {
    await login(page, 'Jamie')
    // No skills listing is within 0.5 mi in the demo data
    await page.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Skills & expertise' }).click()
    await page.getByRole('button', { name: 'Distance filter' }).click()
    await page.getByRole('group', { name: 'Within' }).getByRole('button', { name: '0.5 mi' }).click()
    await expect(page.getByRole('heading', { name: 'No matches' })).toBeVisible()
    await expect(page.getByText('Nothing nearby matches these filters. Try another category or a wider distance.')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(listCards(page)).toHaveCount(await activeCount(page))
    await expect(page.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('closed and in-progress listings are hidden from browse and the map', async ({ page }, testInfo) => {
    await stubMapStyle(page)
    await login(page, 'Jamie')
    await writeStore(
      page,
      'listings-store',
      `(store) => store.setState(s => ({ listings: s.listings.map(l =>
        l.id === 'listing-003' ? { ...l, status: 'closed' } : l.id === 'listing-004' ? { ...l, status: 'pending' } : l) }))`,
    )
    await expect(page.getByRole('heading', { level: 3, name: 'KitchenAid Stand Mixer' })).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 3, name: 'Bike Tune-Up Service' })).toHaveCount(0)
    await expect(listCards(page)).toHaveCount(await activeCount(page))
    await showMap(page, testInfo)
    await expectAllPinned(page, await activeCount(page))
    await expect(pinFor(page, 'listing-003')).toHaveCount(0)
    await expect(pinFor(page, 'listing-004')).toHaveCount(0)
  })

  test('with nothing listed, browse invites the first listing', async ({ page }) => {
    await login(page, 'Jamie')
    await writeStore(page, 'listings-store', `(store) => store.setState(s => ({ listings: s.listings.map(l => ({ ...l, status: 'closed' })) }))`)
    await expect(page.getByRole('heading', { name: 'No listings here yet' })).toBeVisible()
    await page.getByRole('button', { name: 'Post a listing' }).click()
    await expect(page).toHaveURL('/listing/new')
  })

  test("browse cards don't offer to trade for your own listing", async ({ page }) => {
    await login(page, 'Jamie')
    await expect(page.getByRole('heading', { level: 3, name: 'Raised Garden Bed Kit' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Make an offer on Raised Garden Bed Kit' })).toHaveCount(0, { timeout: 2000 })
  })
})

test.describe('D-03 neighborhood feed', () => {
  test('feed lists active listings from your neighborhood, newest first', async ({ page }) => {
    await login(page, 'Jamie')
    await goInApp(page, '/feed')
    await expect(page).toHaveTitle('Neighborhood feed | Bartrrr')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText("What's happening in Downtown Memphis")
    const titles = await readStore<string[]>(
      page,
      'listings-store',
      `s => s.listings.filter(l => l.status === 'active' && l.location.neighborhood === 'Downtown Memphis')
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map(l => l.title)`,
    )
    expect(titles.length).toBeGreaterThan(0)
    for (const t of titles) await expect(page.getByText(t, { exact: true })).toBeVisible()
    // Other neighborhoods stay out
    await expect(page.getByText('KitchenAid Stand Mixer')).toHaveCount(0)
    // Newest first
    const shown = await page.getByRole('main').locator('.font-display.text-\\[19px\\]').allTextContents()
    expect(shown.filter((s) => titles.includes(s))).toEqual(titles)
  })

  test('closed listings drop out of the feed', async ({ page }) => {
    await login(page, 'Jamie')
    await goInApp(page, '/feed')
    await expect(page.getByRole('heading', { level: 1, name: /What's happening in/ })).toBeVisible()
    await expect(page.getByText('Vintage Record Player', { exact: true })).toBeVisible()
    await writeStore(page, 'listings-store', `(store) => store.getState().withdrawListing('listing-001')`)
    await expect(page.getByText('Vintage Record Player', { exact: true })).toHaveCount(0)
  })

  test('feed with nothing nearby explains and links to posting', async ({ page }) => {
    await login(page, 'Jamie')
    await writeStore(page, 'listings-store', `(store) => store.setState(s => ({ listings: s.listings.map(l => ({ ...l, status: 'closed' })) }))`)
    await goInApp(page, '/feed')
    await expect(page.getByText('No activity yet')).toBeVisible()
    await expect(page.getByText(/When neighbors in Downtown Memphis post listings/)).toBeVisible()
    await page.getByRole('main').getByRole('link', { name: 'Post a listing' }).click()
    await expect(page).toHaveURL('/listing/new')
  })

  test('feed entries open the listing', async ({ page }) => {
    await login(page, 'Jamie')
    await goInApp(page, '/feed')
    await expect(page.getByRole('heading', { level: 1, name: /What's happening in/ })).toBeVisible()
    await expect(page.getByRole('main').getByRole('link', { name: /Vintage Record Player/ })).toBeVisible({ timeout: 3000 })
  })
})
