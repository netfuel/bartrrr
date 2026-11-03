import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  disputeReasonSchema,
  emailSchema,
  exchangeDetailsSchema,
  httpsUrlSchema,
  isSafeHttpUrl,
  listingInputSchema,
  loginSchema,
  offerItemsSchema,
  offerMessageSchema,
  parseOrThrow,
  passwordSchema,
  profileUpdateSchema,
  reviewSchema,
  signupSchema,
  ValidationError,
} from './validation'

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  expect(schema.safeParse(v).success).toBe(true)
const bad = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  expect(schema.safeParse(v).success).toBe(false)

// S-04 hostile but legal inputs
const SCRIPT = '<script>alert("x")</script>'
const IMG_ONERROR = '<img src=x onerror=alert(1)>'
const EMOJI = 'Trade 🚲 for 🪴 👩🏽‍🌾'
const RTL = 'مرحبا بالجيران ‮gnp.exe'
const ZALGO = 'Z̷̢͓a̸͇l̵͉g̷o'

describe('emailSchema', () => {
  it('trims and lowercases', () => {
    expect(emailSchema.parse('  Matt@Example.COM ')).toBe('matt@example.com')
  })
  it.each(['', 'matt', 'matt@', '@example.com', 'matt@example', 'a b@example.com', `${SCRIPT}@example.com`])(
    'rejects %j',
    (v) => bad(emailSchema, v),
  )
  it('accepts plus addressing and subdomains', () => {
    ok(emailSchema, 'matt+bartrrr@mail.example.co.uk')
  })
})

describe('passwordSchema', () => {
  it('accepts 8 chars with a letter and number', () => ok(passwordSchema, 'abcdefg1'))
  it('rejects 7 chars', () => bad(passwordSchema, 'abcdef1'))
  it('accepts exactly 72 characters', () => ok(passwordSchema, 'a1'.repeat(36)))
  it('rejects 73 characters', () => bad(passwordSchema, 'a1'.repeat(36) + 'x'))
  it('needs a letter', () => bad(passwordSchema, '12345678'))
  it('needs a number', () => bad(passwordSchema, 'abcdefgh'))
  it('does not trim (spaces are part of a password)', () => {
    expect(passwordSchema.parse(' abcdef1 ')).toBe(' abcdef1 ')
  })
  it('accepts emoji and RTL text alongside a letter and number', () => {
    ok(passwordSchema, 'pass1🚲🪴word')
    ok(passwordSchema, 'a1' + RTL.slice(0, 10))
  })
  it.fails(
    'rejects a password over 72 bytes even when under 72 characters BUG: bcrypt/Supabase limit is 72 bytes, schema counts UTF-16 units',
    () => {
      // 36 × "é" is 36 characters but 72 bytes; with "a1" it's 74 bytes.
      const pw = 'a1' + 'é'.repeat(36)
      expect(new TextEncoder().encode(pw).length).toBeGreaterThan(72)
      bad(passwordSchema, pw)
    },
  )
})

describe('loginSchema and signupSchema', () => {
  it('login only needs a non-empty password', () => {
    ok(loginSchema, { email: 'a@b.co', password: 'x' })
    bad(loginSchema, { email: 'a@b.co', password: '' })
  })
  it('signup accepts a normal neighbor', () => {
    expect(signupSchema.parse({ displayName: '  Matt  ', email: 'M@B.co', password: 'swap4life' })).toEqual({
      displayName: 'Matt',
      email: 'm@b.co',
      password: 'swap4life',
    })
  })
  it('display name: 1 to 60 after trimming', () => {
    ok(signupSchema, { displayName: 'x'.repeat(60), email: 'a@b.co', password: 'abcdefg1' })
    bad(signupSchema, { displayName: 'x'.repeat(61), email: 'a@b.co', password: 'abcdefg1' })
    bad(signupSchema, { displayName: '   ', email: 'a@b.co', password: 'abcdefg1' })
  })
  it('S-04: keeps markup, emoji and RTL names verbatim (React escapes on render)', () => {
    for (const name of [SCRIPT, EMOJI, RTL.slice(0, 30), ZALGO]) {
      const parsed = signupSchema.parse({ displayName: name, email: 'a@b.co', password: 'abcdefg1' })
      expect(parsed.displayName).toBe(name.trim())
    }
  })
})

describe('httpsUrlSchema and isSafeHttpUrl', () => {
  it.each([
    'https://uykknvmxntknclkyqvao.supabase.co/storage/v1/object/public/listing-photos/u/a.webp',
    'https://images.example.com/x.jpg?w=200',
    '  https://example.com/a.png  ',
  ])('accepts %s', (v) => ok(httpsUrlSchema, v))

  it.each([
    'http://example.com/a.png',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'blob:https://bartrrr.app/abc',
    'ftp://example.com/a.png',
    '//example.com/a.png',
    '/relative.png',
    '',
    'not a url',
  ])('rejects %s', (v) => bad(httpsUrlSchema, v))

  it('rejects URLs over 2048 characters', () => {
    const base = 'https://example.com/'
    ok(httpsUrlSchema, base + 'a'.repeat(2048 - base.length))
    bad(httpsUrlSchema, base + 'a'.repeat(2049 - base.length))
  })

  it('isSafeHttpUrl allows http(s) only', () => {
    expect(isSafeHttpUrl('https://a.co')).toBe(true)
    expect(isSafeHttpUrl('http://a.co')).toBe(true)
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeHttpUrl('JaVaScRiPt:alert(1)')).toBe(false)
    expect(isSafeHttpUrl('data:text/html,hi')).toBe(false)
    expect(isSafeHttpUrl('')).toBe(false)
    expect(isSafeHttpUrl(null)).toBe(false)
    expect(isSafeHttpUrl(undefined)).toBe(false)
    expect(isSafeHttpUrl('nope')).toBe(false)
  })
})

describe('listingInputSchema', () => {
  const valid = {
    title: 'Mountain bike',
    description: 'Trek, 21 speed, new tires.',
    category: 'goods' as const,
    condition: 'good' as const,
    seeking: 'Gardening help or kids books',
    images: ['https://example.com/1.webp'],
  }

  it('accepts a normal listing and trims text', () => {
    const parsed = listingInputSchema.parse({ ...valid, title: '  Mountain bike  ' })
    expect(parsed.title).toBe('Mountain bike')
  })
  it('condition is optional, description may be empty', () => {
    ok(listingInputSchema, { ...valid, condition: undefined, description: '' })
  })
  it('title is 1 to 120', () => {
    ok(listingInputSchema, { ...valid, title: 't'.repeat(120) })
    bad(listingInputSchema, { ...valid, title: 't'.repeat(121) })
    bad(listingInputSchema, { ...valid, title: '  ' })
  })
  it('description up to 4000', () => {
    ok(listingInputSchema, { ...valid, description: 'd'.repeat(4000) })
    bad(listingInputSchema, { ...valid, description: 'd'.repeat(4001) })
  })
  it('seeking is 1 to 1000', () => {
    ok(listingInputSchema, { ...valid, seeking: 's'.repeat(1000) })
    bad(listingInputSchema, { ...valid, seeking: 's'.repeat(1001) })
    bad(listingInputSchema, { ...valid, seeking: '' })
  })
  it('rejects unknown categories and conditions', () => {
    bad(listingInputSchema, { ...valid, category: 'cash' })
    bad(listingInputSchema, { ...valid, condition: 'broken' })
  })
  it('allows 0 to 6 images', () => {
    ok(listingInputSchema, { ...valid, images: [] })
    ok(listingInputSchema, { ...valid, images: Array.from({ length: 6 }, (_, i) => `https://e.co/${i}.jpg`) })
    bad(listingInputSchema, { ...valid, images: Array.from({ length: 7 }, (_, i) => `https://e.co/${i}.jpg`) })
  })
  it('images must be https', () => {
    bad(listingInputSchema, { ...valid, images: ['http://e.co/a.jpg'] })
    bad(listingInputSchema, { ...valid, images: ['https://e.co/a.jpg', 'javascript:alert(1)'] })
    bad(listingInputSchema, { ...valid, images: ['blob:https://bartrrr.app/x'] })
  })
  it('S-04: markup, emoji and RTL text pass through unchanged', () => {
    const parsed = listingInputSchema.parse({ ...valid, title: SCRIPT, description: IMG_ONERROR, seeking: `${EMOJI} ${RTL}` })
    expect(parsed.title).toBe(SCRIPT)
    expect(parsed.description).toBe(IMG_ONERROR)
    expect(parsed.seeking).toBe(`${EMOJI} ${RTL}`)
  })
  it('S-04: a very long string is refused, not truncated', () => {
    const result = listingInputSchema.safeParse({ ...valid, description: 'x'.repeat(100_000) })
    expect(result.success).toBe(false)
  })
  it.fails(
    'counts emoji as one character like the database does BUG: zod max counts UTF-16 units, char_length counts code points',
    () => {
      // 120 bikes is 120 characters to Postgres (listings_title_len) but 240 to .max()
      ok(listingInputSchema, { ...valid, title: '🚲'.repeat(120) })
    },
  )
})

describe('offer schemas', () => {
  it('message is 1 to 2000 after trimming', () => {
    expect(offerMessageSchema.parse('  hi  ')).toBe('hi')
    ok(offerMessageSchema, 'm'.repeat(2000))
    bad(offerMessageSchema, 'm'.repeat(2001))
    bad(offerMessageSchema, '   ')
  })
  it('S-04: messages keep markup, emoji, RTL verbatim', () => {
    for (const m of [SCRIPT, EMOJI, RTL, ZALGO]) expect(offerMessageSchema.parse(m)).toBe(m)
  })
  it('items: up to 10, each 1 to 200', () => {
    ok(offerItemsSchema, [])
    ok(offerItemsSchema, Array.from({ length: 10 }, (_, i) => `item ${i}`))
    bad(offerItemsSchema, Array.from({ length: 11 }, (_, i) => `item ${i}`))
    ok(offerItemsSchema, ['i'.repeat(200)])
    bad(offerItemsSchema, ['i'.repeat(201)])
    bad(offerItemsSchema, [' '])
    bad(offerItemsSchema, 'lawnmower')
  })
  it('createOffer needs at least one item (min(1) extension)', () => {
    bad(offerItemsSchema.min(1), [])
    ok(offerItemsSchema.min(1), ['lawnmower'])
  })
})

describe('profileUpdateSchema', () => {
  it('is partial: an empty object is fine', () => ok(profileUpdateSchema, {}))
  it('username: 2 to 32 of a-z, 0-9, _', () => {
    ok(profileUpdateSchema, { username: 'matt_38104' })
    ok(profileUpdateSchema, { username: 'ab' })
    ok(profileUpdateSchema, { username: 'a'.repeat(32) })
    bad(profileUpdateSchema, { username: 'a' })
    bad(profileUpdateSchema, { username: 'a'.repeat(33) })
    bad(profileUpdateSchema, { username: 'Matt' })
    bad(profileUpdateSchema, { username: 'matt-b' })
    bad(profileUpdateSchema, { username: 'matt b' })
    bad(profileUpdateSchema, { username: '<b>' })
  })
  it('bio up to 500, neighborhood up to 80', () => {
    ok(profileUpdateSchema, { bio: 'b'.repeat(500), neighborhood: 'n'.repeat(80) })
    bad(profileUpdateSchema, { bio: 'b'.repeat(501) })
    bad(profileUpdateSchema, { neighborhood: 'n'.repeat(81) })
    ok(profileUpdateSchema, { bio: '' })
  })
  it('avatar must be https', () => {
    ok(profileUpdateSchema, { avatarUrl: 'https://lh3.googleusercontent.com/a/x' })
    bad(profileUpdateSchema, { avatarUrl: 'http://example.com/a.png' })
    bad(profileUpdateSchema, { avatarUrl: 'javascript:alert(1)' })
  })
  it('interests: up to 32, each 1 to 40', () => {
    ok(profileUpdateSchema, { interests: Array.from({ length: 32 }, (_, i) => `i${i}`) })
    bad(profileUpdateSchema, { interests: Array.from({ length: 33 }, (_, i) => `i${i}`) })
    bad(profileUpdateSchema, { interests: ['x'.repeat(41)] })
    bad(profileUpdateSchema, { interests: [''] })
  })
  it('notification prefs need all five booleans', () => {
    const prefs = { newOffers: true, messages: false, agreementUpdates: true, tradeCompletions: true, perfectMatches: false }
    ok(profileUpdateSchema, { notificationPrefs: prefs })
    bad(profileUpdateSchema, { notificationPrefs: { ...prefs, messages: 'yes' } })
    bad(profileUpdateSchema, { notificationPrefs: { newOffers: true } })
  })
  it('S-04: display name and bio with markup are kept verbatim', () => {
    const parsed = profileUpdateSchema.parse({ displayName: SCRIPT, bio: `${IMG_ONERROR} ${EMOJI}` })
    expect(parsed.displayName).toBe(SCRIPT)
    expect(parsed.bio).toBe(`${IMG_ONERROR} ${EMOJI}`)
  })
})

describe('reviewSchema', () => {
  it.each([1, 2, 3, 4, 5])('accepts rating %i', (rating) => ok(reviewSchema, { rating, comment: '' }))
  it.each([0, 6, 3.5, -1, Number.NaN])('rejects rating %s', (rating) => bad(reviewSchema, { rating, comment: '' }))
  it('rejects a string rating', () => bad(reviewSchema, { rating: '5', comment: '' }))
  it('comment up to 1000', () => {
    ok(reviewSchema, { rating: 5, comment: 'c'.repeat(1000) })
    bad(reviewSchema, { rating: 5, comment: 'c'.repeat(1001) })
  })
})

describe('exchangeDetailsSchema', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-03T15:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('every part is optional', () => ok(exchangeDetailsSchema, {}))
  it('accepts a future time, refuses now and the past', () => {
    ok(exchangeDetailsSchema, { exchangeDate: '2026-11-03T15:00:01Z' })
    bad(exchangeDetailsSchema, { exchangeDate: '2026-11-03T15:00:00Z' })
    bad(exchangeDetailsSchema, { exchangeDate: '2026-11-02T15:00:00Z' })
  })
  it('refuses something that is not a date', () => {
    const r = exchangeDetailsSchema.safeParse({ exchangeDate: 'next Saturday' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe('Pick a date and time for the swap.')
  })
  it('method must be one of the three', () => {
    for (const m of ['in_person', 'dropoff', 'service_at_location']) ok(exchangeDetailsSchema, { exchangeMethod: m })
    bad(exchangeDetailsSchema, { exchangeMethod: 'mail' })
  })
  it('place up to 300, notes up to 1000, both trimmed', () => {
    expect(exchangeDetailsSchema.parse({ exchangeLocation: '  Overton Park  ' }).exchangeLocation).toBe('Overton Park')
    ok(exchangeDetailsSchema, { exchangeLocation: 'p'.repeat(300), specialInstructions: 's'.repeat(1000) })
    bad(exchangeDetailsSchema, { exchangeLocation: 'p'.repeat(301) })
    bad(exchangeDetailsSchema, { specialInstructions: 's'.repeat(1001) })
  })
})

describe('disputeReasonSchema', () => {
  it('1 to 500 after trimming', () => {
    expect(disputeReasonSchema.parse('  no show  ')).toBe('no show')
    ok(disputeReasonSchema, 'r'.repeat(500))
    bad(disputeReasonSchema, 'r'.repeat(501))
    bad(disputeReasonSchema, '   ')
  })
})

describe('parseOrThrow', () => {
  it('returns parsed data', () => {
    expect(parseOrThrow(offerMessageSchema, ' hi ')).toBe('hi')
  })
  it('throws a ValidationError prefixed with the field path', () => {
    try {
      parseOrThrow(listingInputSchema, {
        title: 'x',
        description: '',
        category: 'goods',
        seeking: 'y',
        images: ['http://e.co/a.jpg'],
      })
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError)
      expect((err as Error).name).toBe('ValidationError')
      expect((err as Error).message).toBe('images.0: Use an https:// image link.')
    }
  })
  it('throws without a prefix for a top-level value', () => {
    expect(() => parseOrThrow(disputeReasonSchema, '')).toThrow(/^Say briefly what went wrong\.$/)
  })
})
