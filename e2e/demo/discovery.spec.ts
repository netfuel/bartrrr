/// <reference lib="dom" />
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

// Initial view in ListingsMap.tsx
const MAP_CENTER = { lng: -90.049, lat: 35.1495 }
const MAP_ZOOM = 13

const listCards = (page: Page) => page.getByRole('main').getByRole('article')
const markers = (page: Page) => page.locator('.maplibregl-marker')

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
      return [...document.querySelectorAll<HTMLElement>('.maplibregl-marker')].map((m) => {
        const b = m.getBoundingClientRect()
        const x = cx + (b.left + b.width / 2 - (map.left + map.width / 2))
        const y = cy + (b.top + b.height / 2 - (map.top + map.height / 2))
        const n = Math.PI - (2 * Math.PI * y) / world
        return {
          title: m.getAttribute('aria-label') ?? '',
          lng: (x / world) * 360 - 180,
          lat: (Math.atan(Math.sinh(n)) * 180) / Math.PI,
        }
      })
    },
    { center: MAP_CENTER, zoom: MAP_ZOOM },
  )
}

test.describe('D-01 browse map', () => {
  test('map mounts with one pin per active listing', async ({ page }, testInfo) => {
    await stubMapStyle(page)
    await login(page, 'Jamie')
    await expect(page).toHaveURL('/browse')
    await expect(page).toHaveTitle('Browse listings | Bartrrr')
    await showMap(page, testInfo)
    await expect(page.locator('.maplibregl-map')).toBeVisible()
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible()
    const n = await activeCount(page)
    await expect(markers(page)).toHaveCount(n)
    // Each pin is named after its listing
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
    await expect(markers(page)).toHaveCount(await activeCount(page))
    const pin = (await pinPositions(page)).find((p) => p.title === 'Pin check')!
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
    await expect(markers(page)).toHaveCount(await activeCount(page))
    const listings = await readStore<{ title: string; hood: string }[]>(
      page,
      'listings-store',
      "s => s.listings.filter(l => l.status === 'active').map(l => ({ title: l.title, hood: l.location.neighborhood }))",
    )
    const pins = await pinPositions(page)
    const off = listings
      .map((l) => {
        const p = pins.find((x) => x.title === l.title)!
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
    const pin = markers(page).and(page.getByRole('button', { name: 'Bike Tune-Up Service', exact: true }))
    await expect(pin).toBeAttached()
    // Pins can sit under each other; dispatch the click on the named pin
    await pin.dispatchEvent('click')
    const preview = page.locator('.maplibregl-map').locator('..').getByRole('button', { name: 'View listing' })
    await expect(preview).toBeVisible()
    await expect(page.getByText('Overton Square').first()).toBeVisible()
    await expect(page.getByText('Sam Nguyen').first()).toBeVisible()
    await page.getByRole('button', { name: 'Close preview' }).click()
    await expect(preview).toBeHidden()
    await pin.dispatchEvent('click')
    await page.getByRole('button', { name: 'View listing' }).click()
    await expect(page).toHaveURL('/listing/listing-004')
    await expect(page.getByRole('heading', { level: 1, name: 'Bike Tune-Up Service' })).toBeVisible()
  })

  test('pins can be reached and opened with the keyboard', async ({ page }, testInfo) => {
    test.fail(true, 'BUG: map pins have role="button" but no tabindex or key handler, so keyboard users cannot open them')
    await stubMapStyle(page)
    await login(page, 'Jamie')
    await showMap(page, testInfo)
    const pin = markers(page).and(page.getByRole('button', { name: 'Bike Tune-Up Service', exact: true }))
    await expect(pin).toHaveAttribute('tabindex', '0', { timeout: 3000 })
  })

  test('the map opens on your own neighborhood', async ({ page }, testInfo) => {
    test.fail(true, "BUG: the map always opens on downtown Memphis at zoom 13, not the neighbor's neighborhood (PRD 5.3); Germantown pins start off screen")
    await stubMapStyle(page)
    await login(page, 'Priya')
    await showMap(page, testInfo)
    await expect(markers(page)).toHaveCount(await activeCount(page))
    const box = await page.locator('.maplibregl-map').boundingBox()
    const own = markers(page).and(page.getByRole('button', { name: 'Succulent Collection (12 pots)', exact: true }))
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
    await expect(markers(page)).toHaveCount(services.length)
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
    await expect(markers(page)).toHaveCount(await activeCount(page))
    await expect(page.locator('.maplibregl-marker[aria-label="KitchenAid Stand Mixer"]')).toHaveCount(0)
  })

  test('with nothing listed, browse invites the first listing', async ({ page }) => {
    await login(page, 'Jamie')
    await writeStore(page, 'listings-store', `(store) => store.setState(s => ({ listings: s.listings.map(l => ({ ...l, status: 'closed' })) }))`)
    await expect(page.getByRole('heading', { name: 'No listings here yet' })).toBeVisible()
    await page.getByRole('button', { name: 'Post a listing' }).click()
    await expect(page).toHaveURL('/listing/new')
  })

  test("browse cards don't offer to trade for your own listing", async ({ page }) => {
    test.fail(true, "BUG: browse cards show an Offer button on the neighbor's own listings (TradeCard gets onOffer for every card)")
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
    test.fail(true, 'BUG: feed entries are plain text: "Jamie listed Vintage Record Player" cannot be tapped to open the listing')
    await login(page, 'Jamie')
    await goInApp(page, '/feed')
    await expect(page.getByRole('heading', { level: 1, name: /What's happening in/ })).toBeVisible()
    await expect(page.getByRole('main').getByRole('link', { name: /Vintage Record Player/ })).toBeVisible({ timeout: 3000 })
  })
})
