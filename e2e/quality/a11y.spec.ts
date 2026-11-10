/// <reference lib="dom" />
/**
 * Y-01 Accessibility: axe on every route (signed out and signed in as
 * Jamie) and on every dialog. Serious and critical violations fail the
 * test unless they're a known bug listed in KNOWN below, and so do the
 * page-structure rules in STRUCTURE (landmarks, one h1, heading order),
 * which axe rates moderate; everything else is attached to the report as
 * a summary.
 */
import AxeBuilder from '@axe-core/playwright'
import type { Page, TestInfo } from '@playwright/test'
import { test, expect } from '../fixtures'
import { ROUTES, DIALOGS, stabilize, visit, signIn, settle, bugShot } from './helpers'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

/**
 * Known serious/critical findings, by axe rule id. Each is a reported bug:
 * the test stays green while it's listed, and fails again if the rule shows
 * up somewhere new (the `where` list is the set of pages it's known on).
 */
const KNOWN: Record<string, { bug: string; where: string[] }> = {}

/** Moderate rules that fail too: every page has a structure screen readers can navigate. */
const STRUCTURE = new Set(['region', 'landmark-one-main', 'page-has-heading-one', 'heading-order'])

type Result = Awaited<ReturnType<AxeBuilder['analyze']>>

async function scan(page: Page, testInfo: TestInfo, where: string, include?: string) {
  // @axe-core/playwright types its own copy of playwright-core's Page
  let builder = new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'] }).withTags(TAGS)
  if (include) builder = builder.include(include)
  const result: Result = await builder.analyze()
  const blocking = result.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical' || STRUCTURE.has(v.id),
  )
  const minor = result.violations.filter((v) => !blocking.includes(v))

  const summary = result.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
    count: v.nodes.length,
  }))
  await testInfo.attach(`axe-${where}.json`, { body: JSON.stringify(summary, null, 2), contentType: 'application/json' })
  if (minor.length) {
    testInfo.annotations.push({
      type: 'axe-minor',
      description: `${where}: ${minor.map((v) => `${v.id} (${v.impact}, ${v.nodes.length})`).join(', ')}`,
    })
  }

  const unexpected = blocking.filter((v) => !KNOWN[v.id]?.where.includes(where))
  const known = blocking.filter((v) => KNOWN[v.id]?.where.includes(where))
  for (const v of known) {
    testInfo.annotations.push({ type: 'known-bug', description: `${where}: ${v.id}: ${KNOWN[v.id].bug}` })
  }
  if (unexpected.length) await bugShot(page, testInfo, `a11y-${where}`)
  expect(
    unexpected.map((v) => `${v.id} [${v.impact}] ${v.help}\n    ${v.nodes.slice(0, 6).map((n) => n.target.join(' ')).join('\n    ')}`),
    `serious/critical and structure axe violations on ${where}`,
  ).toEqual([])
}

test.describe.configure({ timeout: 120_000 })

test.beforeEach(async ({ page }) => {
  await stabilize(page)
})

test.describe('Y-01 routes signed out', () => {
  for (const r of ROUTES.filter((x) => !x.auth)) {
    test(`${r.name}`, async ({ page }, testInfo) => {
      await visit(page, r, { signedIn: false })
      await scan(page, testInfo, `${r.name}-out`)
    })
  }
})

test.describe('Y-01 routes signed in as Jamie', () => {
  for (const r of ROUTES.filter((x) => !x.signedOutOnly)) {
    test(`${r.name}`, async ({ page }, testInfo) => {
      await visit(page, r, { signedIn: true })
      await scan(page, testInfo, `${r.name}-in`)
    })
  }
})

test.describe('Y-01 dialogs', () => {
  for (const d of DIALOGS) {
    test(`${d.name}`, async ({ page }, testInfo) => {
      await signIn(page, d.as)
      await d.open(page)
      await expect(page.getByRole('dialog')).toBeVisible()
      await settle(page)
      await scan(page, testInfo, `dialog-${d.name}`, '[role="dialog"]')
    })
  }

  test('notifications menu', async ({ page }, testInfo) => {
    await signIn(page)
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Notifications' }).first().click()
    await settle(page)
    await scan(page, testInfo, 'notifications-menu')
  })
})
