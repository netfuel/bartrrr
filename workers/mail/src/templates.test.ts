// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { renderEmail, type EmailKind } from './templates'

const SITE = 'https://bartrrr.app'
const URL_ = 'https://proj.supabase.co/auth/v1/verify?token=abc&type=signup&redirect_to=https%3A%2F%2Fbartrrr.app'

const ALL: EmailKind[] = [
  { kind: 'signup', url: URL_ },
  { kind: 'recovery', url: URL_ },
  { kind: 'magiclink', url: URL_, code: '123456' },
  { kind: 'magiclink', url: URL_ },
  { kind: 'invite', url: URL_ },
  { kind: 'email_change_new', url: URL_ },
  { kind: 'email_change_current', url: URL_, newEmail: 'new@example.com' },
  { kind: 'reauthentication', code: '654321' },
  { kind: 'otp', code: '111222' },
  { kind: 'password_changed' },
  { kind: 'email_changed', oldEmail: 'old@example.com' },
  { kind: 'email_changed' },
  { kind: 'account_updated' },
]

const SUBJECTS: Record<EmailKind['kind'], string> = {
  signup: 'Confirm your email for Bartrrr',
  recovery: 'Reset your Bartrrr password',
  magiclink: 'Your Bartrrr sign-in link',
  invite: "You're invited to Bartrrr",
  email_change_new: 'Confirm your new email for Bartrrr',
  email_change_current: 'Confirm your Bartrrr email change',
  reauthentication: 'Your Bartrrr confirmation code',
  otp: 'Your Bartrrr sign-in code',
  password_changed: 'Your Bartrrr password was changed',
  email_changed: 'Your Bartrrr email was changed',
  account_updated: 'Your Bartrrr account was updated',
}

/** Words that may be capitalized mid-sentence */
const PROPER = new Set(['Bartrrr', 'I'])

function isSentenceCase(s: string): boolean {
  const words = s.split(/\s+/).filter(Boolean)
  if (!/^[A-Z0-9"'‘“]/.test(words[0] ?? '')) return false
  return words.slice(1).every((w) => !/^[A-Z]/.test(w) || PROPER.has(w.replace(/[^\w]/g, '')))
}

const hasUrl = (e: EmailKind): e is Extract<EmailKind, { url: string }> => 'url' in e
const hasCode = (e: EmailKind) => 'code' in e && Boolean(e.code)

describe('renderEmail (E-02)', () => {
  it.each(ALL.map((e) => [e.kind + ('code' in e && e.code ? '+code' : ''), e] as const))('%s: subject', (_n, e) => {
    expect(renderEmail(e, SITE).subject).toBe(SUBJECTS[e.kind])
  })

  it.each(ALL.map((e) => [e.kind, e] as const))('%s: html is a full document with the subject as title', (_n, e) => {
    const { html, subject } = renderEmail(e, SITE)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain(`<title>${subject.replace(/'/g, '&#39;')}</title>`)
    expect(html).toContain('lang="en"')
    expect(html).toContain(`href="${SITE}"`)
  })

  it.each(ALL.filter(hasUrl).map((e) => [e.kind, e] as const))('%s: link in button, fallback and text, escaped in html', (_n, e) => {
    const { html, text } = renderEmail(e, SITE)
    const escaped = e.url.replace(/&/g, '&amp;')
    // button + paste-this-link anchor + visible link text
    expect(html.split(`href="${escaped}"`).length - 1).toBe(2)
    expect(html).toContain(`>${escaped}</a>`)
    expect(html).not.toContain(`href="${e.url}"`) // raw & never appears in an attribute
    expect(text).toContain(`: ${e.url}`)
  })

  it.each(ALL.filter((e) => !hasUrl(e)).map((e) => [e.kind, e] as const))('%s: notice or code has no button', (_n, e) => {
    const { html } = renderEmail(e, SITE)
    expect(html).not.toContain('Button not working?')
  })

  it.each(ALL.filter(hasCode).map((e) => [e.kind, e] as const))('%s: shows the code in html and text', (_n, e) => {
    const code = (e as { code: string }).code
    const { html, text } = renderEmail(e, SITE)
    expect(html).toContain(`>${code}</div>`)
    expect(text).toContain(`Your code: ${code}`)
  })

  it('magic link without a code shows no code box', () => {
    const { html, text } = renderEmail({ kind: 'magiclink', url: URL_ }, SITE)
    expect(html).not.toContain('letter-spacing:6px')
    expect(text).not.toContain('Your code')
  })

  it.each(ALL.map((e) => [e.kind, e] as const))('%s: copy uses no em or en dashes', (_n, e) => {
    const { subject, html, text } = renderEmail(e, SITE)
    for (const s of [subject, html, text]) {
      expect(s).not.toMatch(/[—–]/)
      expect(s).not.toContain('&mdash;')
    }
  })

  it.each(ALL.map((e) => [e.kind, e] as const))('%s: subject, heading and button are sentence case', (_n, e) => {
    const { subject, text } = renderEmail(e, SITE)
    const lines = text.split('\n')
    const heading = lines[0]
    expect(isSentenceCase(subject)).toBe(true)
    expect(isSentenceCase(heading)).toBe(true)
    if (hasUrl(e)) {
      const button = lines.find((l) => l.endsWith(`: ${e.url}`))!.replace(`: ${e.url}`, '')
      expect(isSentenceCase(button)).toBe(true)
    }
  })

  it('the sentence-case check itself catches Title Case', () => {
    expect(isSentenceCase('Reset Your Password')).toBe(false)
    expect(isSentenceCase('Reset your Bartrrr password')).toBe(true)
  })

  it('escapes user-controlled values in html (email change, old email, code, url)', () => {
    const evil = '"><script>alert(1)</script>'
    const outs = [
      renderEmail({ kind: 'email_change_current', url: URL_, newEmail: `x${evil}@e.co` }, SITE),
      renderEmail({ kind: 'email_changed', oldEmail: `x${evil}@e.co` }, SITE),
      renderEmail({ kind: 'otp', code: evil }, SITE),
      renderEmail({ kind: 'signup', url: `https://e.co/?q=${evil}` }, SITE),
    ]
    for (const { html } of outs) {
      expect(html).not.toContain('<script>')
      expect(html).toContain('&lt;script&gt;')
      expect(html).toContain('&quot;&gt;')
    }
  })

  it('names the new address to the current one, and the old address after a change', () => {
    expect(renderEmail({ kind: 'email_change_current', url: URL_, newEmail: 'new@example.com' }, SITE).text).toContain(
      'change your Bartrrr email to new@example.com',
    )
    expect(renderEmail({ kind: 'email_changed', oldEmail: 'old@example.com' }, SITE).text).toContain(
      'no longer uses old@example.com',
    )
    expect(renderEmail({ kind: 'email_changed' }, SITE).text).toContain('was just changed')
  })

  it('security notices tell the reader what to do if it was not them', () => {
    for (const kind of ['password_changed', 'email_changed', 'account_updated', 'email_change_current'] as const) {
      const e = kind === 'email_change_current' ? { kind, url: URL_, newEmail: 'n@e.co' } : { kind }
      expect(renderEmail(e as EmailKind, SITE).text).toContain("If this wasn't you, reply to this email")
    }
  })

  it('text version ends with the footer and site link', () => {
    const { text } = renderEmail({ kind: 'signup', url: URL_ }, SITE)
    expect(text.trimEnd().split('\n').slice(-2)).toEqual([`Bartrrr: trade, don't buy. ${SITE}`, 'Questions? Reply to this email.'])
  })
})
