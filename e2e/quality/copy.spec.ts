/// <reference lib="dom" />
/**
 * C-01 Copy: crawl the visible text on every route and dialog and flag
 * what docs/content-style-guide.md rules out: em dashes, Title Case
 * headings and buttons, exclamation points (one real celebration per
 * screen at most, never in errors) and "Click here".
 *
 * Text neighbors wrote (listing titles, bios, messages: the demo's mock
 * data) is skipped: the guide covers Bartrrr's own words, not theirs.
 * ALLOW holds deliberate exceptions; KNOWN holds reported bugs.
 */
import type { Page, TestInfo } from '@playwright/test'
import { test, expect } from '../fixtures'
import fs from 'node:fs'
import { ROUTES, DIALOGS, stabilize, visit, signIn, settle, bugShot } from './helpers'

test.describe.configure({ timeout: 120_000 })

test.beforeEach(async ({ page }) => {
  await stabilize(page)
})

/*
 * The demo data is read as text rather than imported: the app's modules use
 * the "@/" path alias, which this (node) tsconfig doesn't resolve.
 */
const dataFile = (name: string) => fs.readFileSync(new URL(`../../src/data/${name}`, import.meta.url), 'utf8')
const literals = (src: string) =>
  [...src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((m) =>
    (m[1] ?? m[2] ?? m[3] ?? '').replace(/\\(.)/g, '$1'),
  )

/** Everything a neighbor typed in the demo data (listings, bios, messages, agreements). */
const USER_CONTENT: string[] = ['mock-listings.ts', 'mock-users.ts', 'mock-offers.ts', 'mock-agreements.ts']
  .flatMap((f) => literals(dataFile(f)))
  .filter((s) => s.length > 2 && (/\s/.test(s) || /^[A-Z]/.test(s)))
const NEIGHBORHOODS = [...dataFile('neighborhoods.ts').matchAll(/^\s*'?([A-Z][\w -]+?)'?: \{ lat/gm)].map((m) => m[1])
const DISPLAY_NAMES = [...dataFile('mock-users.ts').matchAll(/displayName: '([^']+)'/g)].map((m) => m[1])

const isUserContent = (text: string) => {
  const t = text.trim()
  return t.length > 2 && USER_CONTENT.some((u) => u.includes(t) || (t.length > 12 && t.includes(u)))
}

/** Proper nouns and acronyms that may be capitalized anywhere. */
const PROPER = new Set(
  [
    'Bartrrr', 'Memphis', 'Tennessee', 'TN', 'Cooper-Young', 'ZIP', 'FAQ', 'Google', 'Apple', 'Facebook',
    'OpenFreeMap', 'OpenStreetMap', 'MapLibre', 'Supabase', 'Cloudflare', 'Resend', 'PDF', 'I', "I'd", "I've", "I'm",
    'Former', // "Former neighbor" is a quoted label
    ...NEIGHBORHOODS.flatMap((n) => n.split(/\s+/)),
    ...DISPLAY_NAMES.flatMap((n) => n.split(/\s+/)),
  ].map((w) => w.toLowerCase()),
)

/**
 * Deliberate exceptions, by exact text. Keep this short; every entry says why.
 */
const ALLOW: Record<string, string> = {
  'Welcome, Jamie!': 'onboarding greeting: the one celebration on that screen',
}

/**
 * Reported bugs, by exact text: the run stays green while they're listed.
 * Grouped into one bug per kind of finding in the report.
 */
const KNOWN: Record<string, string> = {}

interface Finding {
  rule: 'em-dash' | 'title-case' | 'exclamation' | 'click-here'
  text: string
  where: string
}

function titleCase(text: string): boolean {
  // Only the first word of each sentence or clause may be capitalized
  const clauses = text.split(/(?<=[.?!:])\s+|\s+·\s+|\n/)
  let caps = 0
  for (const clause of clauses) {
    const words = clause.trim().split(/\s+/).slice(1)
    for (const raw of words) {
      const w = raw.replace(/^[“"'(]+|[”"'),.?!:;…]+$/g, '')
      if (!/^[A-Z][a-z]/.test(w)) continue
      if (PROPER.has(w.toLowerCase())) continue
      caps++
    }
  }
  return caps > 1
}

async function collect(page: Page, where: string, scope = 'body'): Promise<Finding[]> {
  const items = await page.evaluate((sel) => {
    const root = document.querySelector(sel) ?? document.body
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
    }
    const out: { text: string; kind: 'text' | 'heading' | 'control' }[] = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement
      const text = n.textContent?.replace(/\s+/g, ' ').trim()
      if (!el || !text || el.closest('script,style,noscript,textarea,[contenteditable]')) continue
      if (!visible(el)) continue
      out.push({ text, kind: 'text' })
    }
    for (const el of Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"],button,[role="tab"],a[class*="button"]'))) {
      if (!visible(el)) continue
      const text = (el.getAttribute('aria-label') || (el as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim()
      if (text) out.push({ text, kind: /^H|heading/.test(el.tagName + (el.getAttribute('role') ?? '')) ? 'heading' : 'control' })
    }
    // Accessible names people hear but don't see
    for (const el of Array.from(root.querySelectorAll('[aria-label]'))) {
      const text = el.getAttribute('aria-label')!.trim()
      if (text) out.push({ text, kind: 'text' })
    }
    return out
  }, scope)

  const findings: Finding[] = []
  const seen = new Set<string>()
  for (const { text, kind } of items) {
    // Skip what neighbors wrote, and bare punctuation split off a heading ("!")
    if (isUserContent(text) || /^[\p{P}\s]+$/u.test(text)) continue
    const add = (rule: Finding['rule']) => {
      const key = `${rule}|${text}`
      if (seen.has(key)) return
      seen.add(key)
      findings.push({ rule, text, where })
    }
    if (text.includes('—')) add('em-dash')
    if (/!(\s|$)/.test(text)) add('exclamation')
    if (/click here/i.test(text)) add('click-here')
    if (kind !== 'text' && titleCase(text)) add('title-case')
  }
  return findings
}

async function check(page: Page, testInfo: TestInfo, where: string, scope?: string) {
  const findings = await collect(page, where, scope)
  const known = findings.filter((f) => KNOWN[f.text])
  const allowed = findings.filter((f) => ALLOW[f.text])
  const bad = findings.filter((f) => !KNOWN[f.text] && !ALLOW[f.text])
  // Only one celebration per screen: two allowed exclamations is still a finding
  const exclaims = findings.filter((f) => f.rule === 'exclamation')
  await testInfo.attach(`copy-${where}.json`, {
    body: JSON.stringify({ bad, known, allowed }, null, 2),
    contentType: 'application/json',
  })
  for (const f of known) testInfo.annotations.push({ type: 'known-bug', description: `${where}: ${f.rule}: "${f.text}": ${KNOWN[f.text]}` })
  if (bad.length) await bugShot(page, testInfo, `copy-${where}`)
  expect(bad.map((f) => `${f.rule}: "${f.text.slice(0, 120)}"`), `copy findings on ${where}`).toEqual([])
  expect(exclaims.length, `at most one exclamation point on ${where}`).toBeLessThanOrEqual(1)
}

test.describe('C-01 routes', () => {
  for (const r of ROUTES) {
    test(r.name, async ({ page }, testInfo) => {
      await visit(page, r)
      await check(page, testInfo, r.name)
    })
  }
})

test.describe('C-01 dialogs', () => {
  for (const d of DIALOGS) {
    test(d.name, async ({ page }, testInfo) => {
      await signIn(page, d.as)
      await d.open(page)
      await expect(page.getByRole('dialog')).toBeVisible()
      await settle(page)
      await check(page, testInfo, `dialog-${d.name}`, '[role="dialog"]')
    })
  }

  test('notifications menu', async ({ page }, testInfo) => {
    await signIn(page)
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Notifications' }).first().click()
    await settle(page)
    await check(page, testInfo, 'notifications-menu')
  })
})

/** Page titles follow "{Page} | Bartrrr" (style guide section 11). */
const TITLE_BUGS: Record<string, string> = {}

test.describe('C-01 page titles', () => {
  for (const r of ROUTES) {
    test(r.name, async ({ page }, testInfo) => {
      test.fail(!!TITLE_BUGS[r.name], TITLE_BUGS[r.name])
      await visit(page, r)
      const title = await page.title()
      if (r.name === 'landing') {
        expect(title).toBe("Bartrrr: Trade, don't buy")
        return
      }
      const ok = /^[^|]+ \| Bartrrr$/.test(title)
      if (!ok) await bugShot(page, testInfo, `title-${r.name}`)
      expect(title, 'page title is "{Page} | Bartrrr"').toMatch(/^[^|]+ \| Bartrrr$/)
      const name = title.replace(/ \| Bartrrr$/, '')
      // Listing and profile titles are what the neighbor wrote
      if (!isUserContent(name)) expect(titleCase(name), `"${title}" is sentence case`).toBe(false)
    })
  }
})
