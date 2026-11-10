/// <reference lib="dom" />
/**
 * Y-04 + R-02 Display: 200% zoom and prefers-reduced-motion on the key
 * screens, and no horizontal scroll at common widths on every route.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { ROUTES, route, stabilize, visit, settle, bugShot, isMobile } from './helpers'

test.describe.configure({ timeout: 180_000 })

test.beforeEach(async ({ page }) => {
  await stabilize(page)
})

const KEY_SCREENS = ['landing', 'browse', 'settings', 'agreement-detail'].map(route)
const WIDTHS = [360, 390, 768, 1024, 1280, 1440]

/** Elements that stick out past the right edge without a clipping ancestor. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const width = doc.clientWidth
    const over = doc.scrollWidth - width
    if (over <= 1) return { over: 0, culprits: [] as string[] }
    const clipped = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p)
        if (/(hidden|auto|scroll|clip)/.test(s.overflowX)) return true
      }
      return false
    }
    const culprits: string[] = []
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.right <= width + 1 || clipped(el)) continue
      const cls = typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 3).join('.') : ''
      culprits.push(`${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} right=${Math.round(r.right)} "${(el.textContent ?? '').trim().slice(0, 30)}"`)
      if (culprits.length >= 5) break
    }
    return { over, culprits }
  })
}

test.describe('R-02 no horizontal scroll', () => {
  for (const r of ROUTES) {
    test(r.name, async ({ page }, testInfo) => {
      await visit(page, r)
      const problems: string[] = []
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 800 })
        await page.waitForTimeout(350)
        const o = await overflow(page)
        if (o.over > 0) {
          problems.push(`${w}px: ${o.over}px too wide; ${o.culprits.join(' | ')}`)
          await bugShot(page, testInfo, `hscroll-${r.name}-${w}`)
        }
      }
      expect(problems, `horizontal scroll on ${r.name}`).toEqual([])
    })
  }
})

test.describe('Y-04 200% zoom', () => {
  for (const r of KEY_SCREENS) {
    test(r.name, async ({ page }, testInfo) => {
      // 200% zoom halves the CSS viewport. On phones, WCAG reflow asks for 320px.
      const size = isMobile(testInfo) ? { width: 320, height: 422 } : { width: 640, height: 400 }
      await page.setViewportSize(size)
      await visit(page, r)
      const o = await overflow(page)
      if (o.over > 0) await bugShot(page, testInfo, `zoom-${r.name}`)
      expect(o.culprits, `content wider than the ${size.width}px zoomed viewport`).toEqual([])
      expect(o.over).toBe(0)
      // Text never gets cut to unreadable: no heading is wider than the viewport
      const wideHeadings = await page.evaluate((w) =>
        Array.from(document.querySelectorAll('h1,h2,h3'))
          .filter((h) => h.getBoundingClientRect().width > w + 1)
          .map((h) => h.textContent?.trim().slice(0, 40)), size.width)
      expect(wideHeadings).toEqual([])
    })
  }
})

test.describe('Y-04 prefers-reduced-motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })

  for (const r of KEY_SCREENS) {
    test(r.name, async ({ page }, testInfo) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await visit(page, r)
      await page.waitForTimeout(600)
      await settle(page)

      // Nothing keeps animating (CSS animations and transitions)
      const running = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => a.playState === 'running')
          .map((a) => {
            const t = (a.effect as KeyframeEffect | null)?.target as Element | null
            const name = (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? a.id
            const timing = a.effect?.getComputedTiming()
            return `${name} on ${t?.tagName.toLowerCase()}.${(t?.className?.toString() ?? '').split(' ')[0]} (${timing?.duration}ms x${timing?.iterations})`
          }),
      )
      if (running.length) await bugShot(page, testInfo, `motion-${r.name}`)
      expect(running, `animations still running on ${r.name} with reduced motion`).toEqual([])

      if (r.name === 'landing') {
        const video = await page.evaluate(() => {
          const v = document.querySelector<HTMLVideoElement>('video.hero-video, video')
          return v ? { paused: v.paused, time: v.currentTime, ready: v.readyState } : null
        })
        expect(video, 'hero video is on the page').not.toBeNull()
        await page.waitForTimeout(800)
        const later = await page.evaluate(() => document.querySelector<HTMLVideoElement>('video')!.currentTime)
        expect(video!.paused, 'hero video is paused').toBe(true)
        expect(later, 'hero video holds its frame').toBe(video!.time)
        // The headline isn't left mid-entrance (GSAP isn't a CSS animation)
        const hidden = await page.evaluate(() =>
          Array.from(document.querySelectorAll<HTMLElement>('h1, h1 *, .hero-eyebrow'))
            .filter((el) => getComputedStyle(el).opacity !== '1' || getComputedStyle(el).visibility === 'hidden')
            .map((el) => el.textContent?.trim().slice(0, 20)),
        )
        expect(hidden).toEqual([])
      }
    })
  }
})
