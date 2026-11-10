import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgreementRow, ListingRow, NotificationRow, OfferMessageRow, OfferRow, UserRow } from './database.types'

type Result = { data?: unknown; error?: unknown }
type Call = { table: string; op: string; args: unknown[] }

const h = vi.hoisted(() => {
  const calls: Call[] = []
  const results: Result[] = []
  const builder = (table: string) => {
    const b: Record<string, unknown> = {}
    for (const op of ['select', 'insert', 'update', 'eq', 'or', 'in', 'is', 'gt', 'order', 'limit', 'single', 'maybeSingle']) {
      b[op] = (...args: unknown[]) => {
        calls.push({ table, op, args })
        return b
      }
    }
    b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(results.shift() ?? { data: null, error: null }).then(res, rej)
    return b
  }
  const client = {
    from: vi.fn((table: string) => builder(table)),
    rpc: vi.fn<(...args: unknown[]) => Promise<{ error: unknown }>>(async () => ({ error: null })),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: { id: 'u1' } } }, error: null as unknown })),
    },
  }
  return { calls, results, client }
})

vi.mock('@/lib/supabase', () => ({ supabase: h.client }))
vi.mock('./index', () => ({ supabase: h.client }))

import * as svc from './supabase-service'
import { ValidationError } from '@/lib/validation'

const NOW = new Date('2026-11-03T12:00:00Z')

const listingRow = (over: Partial<ListingRow> = {}): ListingRow => ({
  id: 'listing-1',
  title: 'Bike',
  description: 'Trek',
  category: 'goods',
  condition: 'good',
  seeking: 'Plants',
  images: ['https://e.co/1.webp'],
  user_id: 'u1',
  neighborhood: 'Cooper-Young',
  lat: 35.12,
  lng: -89.99,
  distance_mi: 0.4,
  status: 'active',
  created_at: '2026-10-20T12:00:00Z',
  expires_at: '2026-11-19T12:00:00Z',
  ...over,
})

const agreementRow = (over: Partial<AgreementRow> = {}): AgreementRow => ({
  id: 'agreement-offer-1',
  offer_id: 'offer-1',
  party_a_user_id: 'u1',
  party_a_item: 'Bike',
  party_a_signed: true,
  party_b_user_id: 'u2',
  party_b_item: 'Gardening',
  party_b_signed: false,
  status: 'pending_signatures',
  exchange_method: null,
  exchange_date: null,
  exchange_location: null,
  special_instructions: null,
  created_at: '2026-11-01T00:00:00Z',
  completed_at: null,
  terms_updated_at: null,
  terms_updated_by: null,
  cancelled_at: null,
  cancelled_by: null,
  cancelled_late: false,
  disputed_at: null,
  disputed_by: null,
  dispute_reason: null,
  ...over,
})

const userRow = (over: Partial<UserRow> = {}): UserRow => ({
  id: 'u1',
  username: 'matt',
  display_name: 'Matt',
  avatar_url: 'https://e.co/a.webp',
  bio: null,
  neighborhood: 'Midtown',
  interests: ['plants'],
  reputation_score: 4.5,
  trade_count: 3,
  late_cancellations: 1,
  notification_prefs: { newOffers: false },
  joined_at: '2026-01-01T00:00:00Z',
  ...over,
})

const offerRow = (over: Partial<OfferRow> = {}): OfferRow => ({
  id: 'offer-1',
  listing_id: 'listing-1',
  from_user_id: 'u2',
  to_user_id: 'u1',
  status: 'pending',
  round: 1,
  max_rounds: 5,
  expires_at: '2026-11-05T12:00:00Z',
  created_at: '2026-11-02T12:00:00Z',
  updated_at: '2026-11-02T12:00:00Z',
  last_actor_id: 'u2',
  ...over,
})

const msgRow = (over: Partial<OfferMessageRow> = {}): OfferMessageRow => ({
  id: 'msg-1',
  offer_id: 'offer-1',
  from_user_id: 'u2',
  type: 'offer',
  content: 'Bike for plants?',
  items: ['Monstera'],
  created_at: '2026-11-02T12:00:00Z',
  ...over,
})

const opsFor = (table: string, op: string) => h.calls.filter((c) => c.table === table && c.op === op)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  h.calls.length = 0
  h.results.length = 0
  h.client.from.mockClear()
  h.client.rpc.mockClear()
  h.client.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null })
})
afterEach(() => vi.useRealTimers())

describe('mapListingRow', () => {
  it('maps snake_case to the app shape', () => {
    expect(svc.mapListingRow(listingRow())).toEqual({
      id: 'listing-1',
      title: 'Bike',
      description: 'Trek',
      category: 'goods',
      condition: 'good',
      seeking: 'Plants',
      images: ['https://e.co/1.webp'],
      userId: 'u1',
      location: { lat: 35.12, lng: -89.99, neighborhood: 'Cooper-Young' },
      distanceMi: 0.4,
      createdAt: '2026-10-20T12:00:00Z',
      expiresAt: '2026-11-19T12:00:00Z',
      status: 'active',
    })
  })
  it.each([
    ['active', 'active'],
    ['pending', 'pending'],
    ['completed', 'closed'],
    ['withdrawn', 'closed'],
  ] as const)('status %s → %s', (db, app) => {
    expect(svc.mapListingRow(listingRow({ status: db })).status).toBe(app)
  })
  it('an active listing past its expiry reads as closed (boundary inclusive)', () => {
    expect(svc.mapListingRow(listingRow({ expires_at: '2026-11-03T11:59:59Z' })).status).toBe('closed')
    expect(svc.mapListingRow(listingRow({ expires_at: NOW.toISOString() })).status).toBe('closed')
    expect(svc.mapListingRow(listingRow({ expires_at: '2026-11-03T12:00:01Z' })).status).toBe('active')
  })
  it('expiry does not change a pending listing', () => {
    expect(svc.mapListingRow(listingRow({ status: 'pending', expires_at: '2026-01-01T00:00:00Z' })).status).toBe('pending')
  })
  it('drops non-https images (httpsOnly)', () => {
    const l = svc.mapListingRow(
      listingRow({ images: ['https://ok.co/a.jpg', 'http://bad.co/b.jpg', 'javascript:alert(1)', 'not a url', '', 'data:image/png;base64,AA'] }),
    )
    expect(l.images).toEqual(['https://ok.co/a.jpg'])
  })
  it('null-safe for condition, coords and images', () => {
    const l = svc.mapListingRow(listingRow({ condition: null, lat: null, lng: null, images: null as unknown as string[] }))
    expect(l.condition).toBeUndefined()
    expect(l.location).toEqual({ lat: 0, lng: 0, neighborhood: 'Cooper-Young' })
    expect(l.images).toEqual([])
  })
})

describe('mapOfferRow', () => {
  it('maps the offer and its messages; empty items become undefined', () => {
    const o = svc.mapOfferRow(offerRow(), [msgRow(), msgRow({ id: 'msg-2', type: 'message', items: [] })])
    expect(o).toMatchObject({
      id: 'offer-1',
      listingId: 'listing-1',
      fromUserId: 'u2',
      toUserId: 'u1',
      status: 'pending',
      round: 1,
      maxRounds: 5,
      expiresAt: '2026-11-05T12:00:00Z',
    })
    expect(o.messages).toEqual([
      { id: 'msg-1', fromUserId: 'u2', content: 'Bike for plants?', items: ['Monstera'], type: 'offer', createdAt: '2026-11-02T12:00:00Z' },
      { id: 'msg-2', fromUserId: 'u2', content: 'Bike for plants?', items: undefined, type: 'message', createdAt: '2026-11-02T12:00:00Z' },
    ])
  })
  it('missing expires_at falls back to created + 72h', () => {
    expect(svc.mapOfferRow(offerRow({ expires_at: null })).expiresAt).toBe('2026-11-05T12:00:00.000Z')
    expect(svc.OFFER_TTL_MS).toBe(72 * 3_600_000)
  })
})

describe('mapAgreementRow', () => {
  it('maps signature times (migration 014); absent or null means not recorded', () => {
    const a = svc.mapAgreementRow(agreementRow({ party_a_signed_at: '2026-11-02T15:00:00Z', party_b_signed_at: null }))
    expect(a.partyA.signedAt).toBe('2026-11-02T15:00:00Z')
    expect(a.partyB.signedAt).toBeUndefined()
    const before014 = svc.mapAgreementRow(agreementRow())
    expect(before014.partyA).not.toHaveProperty('signedAt', expect.anything())
  })
  it('maps nulls to undefined and keeps cancelled_late false by default', () => {
    const a = svc.mapAgreementRow(agreementRow())
    expect(a).toEqual({
      id: 'agreement-offer-1',
      offerId: 'offer-1',
      partyA: { userId: 'u1', item: 'Bike', signed: true },
      partyB: { userId: 'u2', item: 'Gardening', signed: false },
      exchangeMethod: undefined,
      exchangeDate: undefined,
      exchangeLocation: undefined,
      specialInstructions: undefined,
      status: 'pending_signatures',
      createdAt: '2026-11-01T00:00:00Z',
      completedAt: undefined,
      termsUpdatedBy: undefined,
      termsUpdatedAt: undefined,
      cancelledBy: undefined,
      cancelledAt: undefined,
      cancelledLate: false,
      disputedBy: undefined,
      disputedAt: undefined,
      disputeReason: undefined,
    })
  })
  it('maps every filled column', () => {
    const a = svc.mapAgreementRow(
      agreementRow({
        exchange_method: 'dropoff',
        exchange_date: '2026-11-07T16:00:00Z',
        exchange_location: 'Overton Park',
        special_instructions: 'Bring a truck',
        status: 'disputed',
        completed_at: '2026-11-07T17:00:00Z',
        terms_updated_by: 'u2',
        terms_updated_at: '2026-11-02T00:00:00Z',
        cancelled_by: 'u1',
        cancelled_at: '2026-11-06T00:00:00Z',
        cancelled_late: null as unknown as boolean,
        disputed_by: 'u1',
        disputed_at: '2026-11-08T00:00:00Z',
        dispute_reason: 'No show',
      }),
    )
    expect(a).toMatchObject({
      exchangeMethod: 'dropoff',
      exchangeDate: '2026-11-07T16:00:00Z',
      exchangeLocation: 'Overton Park',
      specialInstructions: 'Bring a truck',
      status: 'disputed',
      completedAt: '2026-11-07T17:00:00Z',
      termsUpdatedBy: 'u2',
      cancelledBy: 'u1',
      cancelledLate: false,
      disputedBy: 'u1',
      disputeReason: 'No show',
    })
  })
})

describe('mapUserRow', () => {
  it('fills missing notification prefs with true, keeps explicit false', () => {
    expect(svc.mapUserRow(userRow()).notificationPrefs).toEqual({
      newOffers: false,
      messages: true,
      agreementUpdates: true,
      tradeCompletions: true,
      perfectMatches: true,
    })
  })
  it('no prefs row → undefined', () => {
    expect(svc.mapUserRow(userRow({ notification_prefs: null })).notificationPrefs).toBeUndefined()
  })
  it('numeric reputation from a string column, null-safe counters', () => {
    const u = svc.mapUserRow(
      userRow({ reputation_score: '4.75' as unknown as number, late_cancellations: null as unknown as number, interests: null as unknown as string[] }),
    )
    expect(u.reputationScore).toBe(4.75)
    expect(u.lateCancellations).toBe(0)
    expect(u.interests).toEqual([])
    expect(u.bio).toBeUndefined()
  })
  it.each(['http://e.co/a.png', 'javascript:alert(1)', '', null])('drops unsafe avatar %j', (avatar) => {
    expect(svc.mapUserRow(userRow({ avatar_url: avatar })).avatarUrl).toBeUndefined()
  })
})

describe('fetchReviewCounts (T-69)', () => {
  it('counts reviews per neighbor without loading them, zero when there are none', async () => {
    h.results.push({
      data: [
        { id: 'u1', reviews: [{ count: 3 }] },
        { id: 'u2', reviews: [{ count: 0 }] },
        { id: 'u3', reviews: [] },
      ],
      error: null,
    })
    expect(await svc.fetchReviewCounts()).toEqual({ u1: 3, u2: 0, u3: 0 })
    expect(opsFor('users', 'select')[0].args[0]).toBe('id, reviews:reviews!reviews_reviewee_id_fkey(count)')
  })
  it('passes errors on (the caller falls back to loaded reviews)', async () => {
    h.results.push({ data: null, error: new Error('nope') })
    await expect(svc.fetchReviewCounts()).rejects.toThrow('nope')
  })
})

describe('mapNotificationRow', () => {
  it('maps and leaves read_at undefined when unread', () => {
    const row: NotificationRow = {
      id: 'n1',
      user_id: 'u1',
      type: 'new_offer',
      title: 'New offer',
      body: 'A neighbor made an offer',
      data: { offerId: 'offer-1' },
      read_at: null,
      created_at: '2026-11-02T00:00:00Z',
    } as unknown as NotificationRow
    expect(svc.mapNotificationRow(row)).toEqual({
      id: 'n1',
      userId: 'u1',
      type: 'new_offer',
      title: 'New offer',
      body: 'A neighbor made an offer',
      data: { offerId: 'offer-1' },
      readAt: undefined,
      createdAt: '2026-11-02T00:00:00Z',
    })
  })
})

describe('updateListing builder', () => {
  it('sends only content fields, maps closed → withdrawn, and ignores server-owned fields', async () => {
    h.results.push({ data: listingRow({ title: 'New title', status: 'withdrawn' }), error: null })
    const saved = await svc.updateListing('listing-1', {
      title: '  New title ',
      status: 'closed',
      // server-owned: must never be sent
      id: 'hijack',
      userId: 'someone-else',
      createdAt: '2020-01-01T00:00:00Z',
      expiresAt: '2099-01-01T00:00:00Z',
      distanceMi: 0,
    })
    const [update] = opsFor('listings', 'update')
    expect(update.args[0]).toEqual({ title: 'New title', status: 'withdrawn' })
    expect(opsFor('listings', 'eq')[0].args).toEqual(['id', 'listing-1'])
    expect(saved.status).toBe('closed')
  })

  it('renew sends status active only (the server restarts the 30-day window)', async () => {
    h.results.push({ data: listingRow(), error: null })
    await svc.updateListing('listing-1', { status: 'active', expiresAt: '2026-12-03T12:00:00Z' })
    expect(opsFor('listings', 'update')[0].args[0]).toEqual({ status: 'active' })
  })

  it('maps pending and sends location as three columns', async () => {
    h.results.push({ data: listingRow(), error: null })
    await svc.updateListing('listing-1', {
      status: 'pending',
      location: { lat: 35.1, lng: -90, neighborhood: 'Midtown' },
      images: ['https://e.co/a.jpg'],
      condition: 'fair',
    })
    expect(opsFor('listings', 'update')[0].args[0]).toEqual({
      status: 'pending',
      neighborhood: 'Midtown',
      lat: 35.1,
      lng: -90,
      images: ['https://e.co/a.jpg'],
      condition: 'fair',
    })
  })

  it('switching to a category without a condition clears the stored condition (T-49)', async () => {
    h.results.push({ data: listingRow(), error: null })
    await svc.updateListing('listing-1', { category: 'services' })
    expect(opsFor('listings', 'update')[0].args[0]).toEqual({ category: 'services', condition: null })
  })

  it('a goods listing keeps the condition it is sent', async () => {
    h.results.push({ data: listingRow(), error: null })
    await svc.updateListing('listing-1', { category: 'goods', condition: 'good' })
    expect(opsFor('listings', 'update')[0].args[0]).toEqual({ category: 'goods', condition: 'good' })
  })

  it('validates before writing (http image refused)', async () => {
    await expect(svc.updateListing('listing-1', { images: ['http://e.co/a.jpg'] })).rejects.toBeInstanceOf(ValidationError)
    expect(opsFor('listings', 'update')).toHaveLength(0)
  })

  it('throws the server error', async () => {
    h.results.push({ data: null, error: { code: 'P0001', message: 'nope' } })
    await expect(svc.updateListing('listing-1', { title: 'x' })).rejects.toEqual({ code: 'P0001', message: 'nope' })
  })
})

describe('createListing', () => {
  const input = {
    id: 'listing-new',
    title: 'Bike',
    description: '',
    category: 'goods' as const,
    seeking: 'Plants',
    images: [],
    userId: 'u1',
    location: { lat: 35.12, lng: -89.99, neighborhood: 'Midtown' },
  }
  it('inserts with the client id and the signed-in owner', async () => {
    h.results.push({ data: listingRow({ id: 'listing-new' }), error: null })
    await svc.createListing(input)
    expect(opsFor('listings', 'insert')[0].args[0]).toEqual({
      id: 'listing-new',
      title: 'Bike',
      description: '',
      category: 'goods',
      condition: null,
      seeking: 'Plants',
      images: [],
      user_id: 'u1',
      neighborhood: 'Midtown',
      lat: 35.12,
      lng: -89.99,
    })
  })
  it('refuses to create a listing for someone else (requireSelf)', async () => {
    await expect(svc.createListing({ ...input, userId: 'u2' })).rejects.toThrow('Not signed in as this user')
    expect(opsFor('listings', 'insert')).toHaveLength(0)
  })
  it('refuses when signed out', async () => {
    h.client.auth.getSession.mockResolvedValue({ data: { session: null } as never, error: null })
    await expect(svc.createListing(input)).rejects.toThrow('Not signed in as this user')
  })
})

describe('updateUser builder', () => {
  it('sends only editable columns, never reputation or counts', async () => {
    await svc.updateUser('u1', {
      displayName: '  Matt  ',
      bio: 'Plants',
      reputationScore: 5,
      tradeCount: 999,
      lateCancellations: 0,
      joinedAt: '2000-01-01',
      id: 'u2',
    })
    expect(opsFor('users', 'update')[0].args[0]).toEqual({ display_name: 'Matt', bio: 'Plants' })
    expect(opsFor('users', 'eq')[0].args).toEqual(['id', 'u1'])
  })
  it('empty avatar clears it (null), https avatar is saved', async () => {
    await svc.updateUser('u1', { avatarUrl: '' })
    expect(opsFor('users', 'update')[0].args[0]).toEqual({ avatar_url: null })
    h.calls.length = 0
    await svc.updateUser('u1', { avatarUrl: 'https://e.co/a.webp' })
    expect(opsFor('users', 'update')[0].args[0]).toEqual({ avatar_url: 'https://e.co/a.webp' })
  })
  it('maps every editable field', async () => {
    const prefs = { newOffers: true, messages: true, agreementUpdates: false, tradeCompletions: true, perfectMatches: true }
    await svc.updateUser('u1', { username: 'matt_b', neighborhood: 'Midtown', interests: ['dj'], notificationPrefs: prefs })
    expect(opsFor('users', 'update')[0].args[0]).toEqual({
      username: 'matt_b',
      neighborhood: 'Midtown',
      interests: ['dj'],
      notification_prefs: prefs,
    })
  })
  it('makes no request when nothing editable changed', async () => {
    await svc.updateUser('u1', { tradeCount: 3 })
    expect(opsFor('users', 'update')).toHaveLength(0)
  })
  it('refuses another user and invalid input', async () => {
    await expect(svc.updateUser('u2', { bio: 'x' })).rejects.toThrow('Not signed in as this user')
    await expect(svc.updateUser('u1', { avatarUrl: 'http://e.co/a.png' })).rejects.toBeInstanceOf(ValidationError)
    expect(opsFor('users', 'update')).toHaveLength(0)
  })
})

describe('agreement writes', () => {
  it('signAgreement signs only the caller side', async () => {
    h.results.push({ data: { party_a_user_id: 'u1', party_b_user_id: 'u2' }, error: null })
    h.results.push({ data: agreementRow(), error: null })
    await svc.signAgreement('agreement-offer-1', 'u2')
    expect(opsFor('agreements', 'update')[0].args[0]).toEqual({ party_b_signed: true })
  })
  it('signAgreement refuses a non-party', async () => {
    h.results.push({ data: { party_a_user_id: 'u1', party_b_user_id: 'u2' }, error: null })
    await expect(svc.signAgreement('agreement-offer-1', 'u3')).rejects.toThrow('You are not a party to this agreement')
  })
  it('updateExchangeDetails sends all four columns, blanks as null', async () => {
    h.results.push({ data: agreementRow(), error: null })
    await svc.updateExchangeDetails('a1', { exchangeMethod: 'in_person', exchangeDate: '2026-11-07T16:00:00.000Z', exchangeLocation: '  ' })
    expect(opsFor('agreements', 'update')[0].args[0]).toEqual({
      exchange_method: 'in_person',
      exchange_date: '2026-11-07T16:00:00.000Z',
      exchange_location: null,
      special_instructions: null,
    })
  })
  it('updateExchangeDetails refuses a past time before the request', async () => {
    await expect(svc.updateExchangeDetails('a1', { exchangeDate: '2026-11-01T00:00:00Z' })).rejects.toBeInstanceOf(ValidationError)
    expect(opsFor('agreements', 'update')).toHaveLength(0)
  })
  it('cancel sends only the status; who and when are server-stamped', async () => {
    h.results.push({ data: agreementRow({ status: 'cancelled' }), error: null })
    await svc.cancelAgreement('a1')
    expect(opsFor('agreements', 'update')[0].args[0]).toEqual({ status: 'cancelled' })
  })
  it('flag trims the reason and refuses an empty one', async () => {
    h.results.push({ data: agreementRow({ status: 'disputed' }), error: null })
    await svc.flagAgreement('a1', '  no show  ')
    expect(opsFor('agreements', 'update')[0].args[0]).toEqual({ status: 'disputed', dispute_reason: 'no show' })
    await expect(svc.flagAgreement('a1', '   ')).rejects.toBeInstanceOf(ValidationError)
  })
  it('complete sends status completed', async () => {
    h.results.push({ data: agreementRow({ status: 'completed' }), error: null })
    await svc.completeAgreement('a1')
    expect(opsFor('agreements', 'update')[0].args[0]).toEqual({ status: 'completed' })
  })
})

describe('offer RPCs', () => {
  it('createOffer validates, calls make_offer and returns the saved thread', async () => {
    h.results.push({ data: offerRow(), error: null }, { data: [msgRow()], error: null })
    const o = await svc.createOffer({ id: 'offer-1', messageId: 'msg-1', listingId: 'listing-1', content: ' hi ', items: ['Monstera'] })
    expect(h.client.rpc).toHaveBeenCalledWith('make_offer', {
      p_offer_id: 'offer-1',
      p_listing_id: 'listing-1',
      p_message_id: 'msg-1',
      p_content: 'hi',
      p_items: ['Monstera'],
    })
    expect(o.messages).toHaveLength(1)
  })
  it('createOffer needs at least one item', async () => {
    await expect(
      svc.createOffer({ id: 'o', messageId: 'm', listingId: 'l', content: 'hi', items: [] }),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(h.client.rpc).not.toHaveBeenCalled()
  })
  it.each([
    ['acceptOffer', () => svc.acceptOffer('offer-1', 'm'), 'accept', 'Offer accepted.'],
    ['withdrawOffer', () => svc.withdrawOffer('offer-1', 'm'), 'withdraw', 'Offer withdrawn.'],
  ] as const)('%s → respond_to_offer(%s) without p_reason', async (_n, run, action, content) => {
    h.results.push({ data: offerRow(), error: null }, { data: [], error: null })
    await run()
    expect(h.client.rpc).toHaveBeenCalledWith('respond_to_offer', {
      p_offer_id: 'offer-1',
      p_action: action,
      p_message_id: 'm',
      p_content: content,
      p_items: [],
    })
  })
  it.each([
    ['with note', '  too low  ', 'too low'],
    ['without note', '  ', 'not_fair'],
  ] as const)('declineOffer %s sends the code as p_reason (migration 014)', async (_n, note, content) => {
    h.results.push({ data: offerRow(), error: null }, { data: [], error: null })
    await svc.declineOffer('offer-1', 'm', 'not_fair', note)
    expect(h.client.rpc).toHaveBeenCalledTimes(1)
    expect(h.client.rpc).toHaveBeenCalledWith('respond_to_offer', {
      p_offer_id: 'offer-1',
      p_action: 'decline',
      p_message_id: 'm',
      p_content: content,
      p_items: [],
      p_reason: 'not_fair',
    })
  })
  it.each([
    ['with note', '  too low  ', "Offer doesn't feel like a fair trade. too low"],
    ['without note', '  ', 'not_fair'],
  ] as const)('declineOffer %s falls back to the pre-014 call when p_reason is unknown (PGRST202)', async (_n, note, content) => {
    h.client.rpc.mockResolvedValueOnce({ error: { code: 'PGRST202', message: 'Could not find the function public.respond_to_offer' } })
    h.results.push({ data: offerRow(), error: null }, { data: [], error: null })
    await svc.declineOffer('offer-1', 'm', 'not_fair', note)
    expect(h.client.rpc).toHaveBeenCalledTimes(2)
    expect(h.client.rpc).toHaveBeenLastCalledWith('respond_to_offer', {
      p_offer_id: 'offer-1',
      p_action: 'decline',
      p_message_id: 'm',
      p_content: content,
      p_items: [],
    })
  })
  it('declineOffer doesn\'t retry other errors', async () => {
    h.client.rpc.mockResolvedValueOnce({ error: { code: 'P0001', message: 'This offer is already declined.' } })
    await expect(svc.declineOffer('offer-1', 'm', 'not_fair')).rejects.toEqual({ code: 'P0001', message: 'This offer is already declined.' })
    expect(h.client.rpc).toHaveBeenCalledTimes(1)
  })
  it('maps decline_reason onto the message, and its absence (before 014) to undefined', async () => {
    h.results.push(
      { data: offerRow(), error: null },
      {
        data: [
          msgRow({ id: 'd1', type: 'decline', content: 'Too low', decline_reason: 'not_fair' }),
          msgRow({ id: 'd2', type: 'decline', content: 'not_fair' }),
        ],
        error: null,
      },
    )
    const o = await svc.declineOffer('offer-1', 'm', 'not_fair', 'Too low')
    expect(o?.messages.map((m) => m.declineReason)).toEqual(['not_fair', undefined])
  })
  it('RPC errors are thrown as-is', async () => {
    h.client.rpc.mockResolvedValueOnce({ error: { code: 'P0001', message: 'Offer is closed' } })
    await expect(svc.counterOffer('offer-1', 'm', 'how about', ['x'])).rejects.toEqual({ code: 'P0001', message: 'Offer is closed' })
  })
})

describe('reviews', () => {
  it('addReview validates and stores an empty comment as null', async () => {
    h.results.push({
      data: { id: 'r1', agreement_id: 'a1', reviewer_id: 'u1', reviewee_id: 'u2', rating: 5, comment: null, created_at: 'x' },
      error: null,
    })
    const r = await svc.addReview({ id: 'r1', agreementId: 'a1', reviewerId: 'u1', revieweeId: 'u2', rating: 5, comment: '  ' })
    expect(opsFor('reviews', 'insert')[0].args[0]).toMatchObject({ rating: 5, comment: null })
    expect(r.comment).toBe('')
    await expect(
      svc.addReview({ id: 'r2', agreementId: 'a1', reviewerId: 'u1', revieweeId: 'u2', rating: 6, comment: '' }),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('reads', () => {
  it('fetchShowcaseListings keeps only listings with photos, up to the limit', async () => {
    h.results.push({
      data: [listingRow({ id: 'a', images: [] }), listingRow({ id: 'b' }), listingRow({ id: 'c', images: ['http://x/a.jpg'] }), listingRow({ id: 'd' })],
      error: null,
    })
    const out = await svc.fetchShowcaseListings(1)
    expect(out.map((l) => l.id)).toEqual(['b'])
  })
  it('fetchOffers groups messages by offer', async () => {
    h.results.push(
      { data: [offerRow({ id: 'o1' }), offerRow({ id: 'o2' })], error: null },
      { data: [msgRow({ id: 'm1', offer_id: 'o2' }), msgRow({ id: 'm2', offer_id: 'o1' }), msgRow({ id: 'm3', offer_id: 'o2' })], error: null },
    )
    const out = await svc.fetchOffers('u1')
    expect(out.map((o) => [o.id, o.messages.map((m) => m.id)])).toEqual([
      ['o1', ['m2']],
      ['o2', ['m1', 'm3']],
    ])
  })
  it('fetchOffers with none skips the message query', async () => {
    h.results.push({ data: [], error: null })
    expect(await svc.fetchOffers('u1')).toEqual([])
    expect(opsFor('offer_messages', 'select')).toHaveLength(0)
  })
})
