/**
 * Supabase service layer for Bartrrr.
 *
 * Each function:
 *  1. Guards against a null supabase client (offline demo mode).
 *  2. Validates user-supplied input with zod before it leaves the browser.
 *  3. Maps DB snake_case column names ↔ app camelCase TypeScript types.
 *  4. Throws on every error so callers can roll back / tell the user.
 *
 * Authorization is enforced by RLS and triggers (migration 004), not here:
 * the acting user is always auth.uid() on the server, never a client-sent id.
 */

import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './index'
import type {
  AgreementRow,
  AgreementUpdate,
  ListingRow,
  ListingUpdate,
  NotificationRow,
  OfferMessageRow,
  OfferRow,
  ReviewRow,
  UserRow,
  UserUpdate,
} from './database.types'
import type {
  AppNotification,
  Category,
  ExchangeDetails,
  Listing,
  ListingCondition,
  ListingStatus,
  NotificationType,
  Offer,
  OfferMessage,
  OfferMessageType,
  Review,
  TradeAgreement,
  UserProfile,
} from '@/types'
import {
  disputeReasonSchema,
  exchangeDetailsSchema,
  listingInputSchema,
  offerItemsSchema,
  offerMessageSchema,
  parseOrThrow,
  profileUpdateSchema,
  reviewSchema,
} from '@/lib/validation'

// ─── Guards ──────────────────────────────────────────────────────────────────

function client() {
  if (!supabase) {
    throw new Error(
      'Supabase client is not initialized. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    )
  }
  return supabase
}

/** Throw if the user isn't the one signed in. Defense in depth over RLS. */
async function requireSelf(userId: string): Promise<void> {
  const { data, error } = await client().auth.getSession()
  if (error) throw error
  if (data.session?.user.id !== userId) {
    throw new Error('Not signed in as this user')
  }
}

// ─── Row → App type mappers ───────────────────────────────────────────────────

/** User-supplied URLs only ever render as https images. */
const httpsOnly = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined
  try {
    return new URL(url).protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}

const LISTING_STATUS: Record<ListingRow['status'], ListingStatus> = {
  active: 'active',
  pending: 'pending',
  completed: 'closed',
  withdrawn: 'closed',
}

export function mapListingRow(row: ListingRow): Listing {
  // A listing past its 30-day window reads as closed until its owner renews it
  const expired = row.status === 'active' && row.expires_at && new Date(row.expires_at) <= new Date()
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category as Category,
    condition: (row.condition ?? undefined) as ListingCondition | undefined,
    seeking: row.seeking,
    images: (row.images ?? []).map(httpsOnly).filter((u): u is string => Boolean(u)),
    userId: row.user_id,
    location: {
      lat: row.lat ?? 0,
      lng: row.lng ?? 0,
      neighborhood: row.neighborhood,
    },
    distanceMi: row.distance_mi,
    createdAt: row.created_at,
    expiresAt: row.expires_at ?? undefined,
    status: expired ? 'closed' : LISTING_STATUS[row.status],
  }
}

function mapOfferMessages(msgs: OfferMessageRow[]): OfferMessage[] {
  return msgs.map((m) => ({
    id: m.id,
    fromUserId: m.from_user_id,
    content: m.content,
    items: m.items && m.items.length > 0 ? m.items : undefined,
    type: m.type as OfferMessageType,
    createdAt: m.created_at,
  }))
}

export function mapOfferRow(row: OfferRow, messages: OfferMessageRow[] = []): Offer {
  return {
    id: row.id,
    listingId: row.listing_id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    messages: mapOfferMessages(messages),
    status: row.status as Offer['status'],
    round: row.round,
    maxRounds: row.max_rounds,
    expiresAt: row.expires_at ?? new Date(new Date(row.created_at).getTime() + OFFER_TTL_MS).toISOString(),
    createdAt: row.created_at,
  }
}

export function mapAgreementRow(row: AgreementRow): TradeAgreement {
  return {
    id: row.id,
    offerId: row.offer_id,
    partyA: {
      userId: row.party_a_user_id,
      item: row.party_a_item,
      signed: row.party_a_signed,
    },
    partyB: {
      userId: row.party_b_user_id,
      item: row.party_b_item,
      signed: row.party_b_signed,
    },
    exchangeMethod: (row.exchange_method ?? undefined) as TradeAgreement['exchangeMethod'],
    exchangeDate: row.exchange_date ?? undefined,
    exchangeLocation: row.exchange_location ?? undefined,
    specialInstructions: row.special_instructions ?? undefined,
    status: row.status as TradeAgreement['status'],
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    termsUpdatedBy: row.terms_updated_by ?? undefined,
    termsUpdatedAt: row.terms_updated_at ?? undefined,
    cancelledBy: row.cancelled_by ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    cancelledLate: row.cancelled_late ?? false,
    disputedBy: row.disputed_by ?? undefined,
    disputedAt: row.disputed_at ?? undefined,
    disputeReason: row.dispute_reason ?? undefined,
  }
}

function mapReviewRow(row: ReviewRow): Review {
  return {
    id: row.id,
    agreementId: row.agreement_id,
    reviewerId: row.reviewer_id,
    revieweeId: row.reviewee_id,
    rating: row.rating,
    comment: row.comment ?? '',
    createdAt: row.created_at,
  }
}

export function mapNotificationRow(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    data: (row.data as Record<string, string>) ?? undefined,
    readAt: row.read_at ?? undefined,
    createdAt: row.created_at,
  }
}

export function mapUserRow(row: UserRow): UserProfile {
  const prefs = row.notification_prefs as Record<string, boolean> | null
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: httpsOnly(row.avatar_url),
    bio: row.bio ?? undefined,
    neighborhood: row.neighborhood,
    interests: row.interests ?? [],
    reputationScore: Number(row.reputation_score),
    tradeCount: row.trade_count,
    lateCancellations: row.late_cancellations ?? 0,
    joinedAt: row.joined_at,
    notificationPrefs: prefs
      ? {
          newOffers: prefs.newOffers ?? true,
          messages: prefs.messages ?? true,
          agreementUpdates: prefs.agreementUpdates ?? true,
          tradeCompletions: prefs.tradeCompletions ?? true,
          perfectMatches: prefs.perfectMatches ?? true,
        }
      : undefined,
  }
}

// ─── Listings ─────────────────────────────────────────────────────────────────

export async function fetchListings(): Promise<Listing[]> {
  const { data, error } = await client()
    .from('listings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw error
  return (data ?? []).map(mapListingRow)
}

/**
 * A few active listings with photos for the public landing page. Listings
 * are readable without a session (RLS select policy is public), so this
 * works for signed-out visitors.
 */
export async function fetchShowcaseListings(limit = 8): Promise<Listing[]> {
  const { data, error } = await client()
    .from('listings')
    .select('*')
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(limit * 3)
  if (error) throw error
  return (data ?? [])
    .map(mapListingRow)
    .filter((l) => l.images.length > 0)
    .slice(0, limit)
}

export async function fetchListing(id: string): Promise<Listing | null> {
  const { data, error } = await client().from('listings').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? mapListingRow(data) : null
}

export async function createListing(
  data: Omit<Listing, 'createdAt' | 'distanceMi' | 'status' | 'expiresAt'> & { id?: string },
): Promise<Listing> {
  const input = parseOrThrow(listingInputSchema, data)
  await requireSelf(data.userId)
  const { data: row, error } = await client()
    .from('listings')
    .insert({
      ...(data.id ? { id: data.id } : {}),
      title: input.title,
      description: input.description,
      category: input.category,
      condition: input.condition ?? null,
      seeking: input.seeking,
      images: input.images,
      user_id: data.userId,
      neighborhood: data.location.neighborhood,
      lat: data.location.lat,
      lng: data.location.lng,
    })
    .select()
    .single()
  if (error) throw error
  return mapListingRow(row)
}

export async function updateListing(id: string, partial: Partial<Listing>): Promise<Listing> {
  const dbStatusMap: Record<ListingStatus, ListingRow['status']> = {
    active: 'active',
    pending: 'pending',
    closed: 'withdrawn',
  }
  const checked = parseOrThrow(listingInputSchema.partial(), {
    title: partial.title,
    description: partial.description,
    category: partial.category,
    condition: partial.condition,
    seeking: partial.seeking,
    images: partial.images,
  })
  const update: ListingUpdate = {}
  if (checked.title !== undefined) update.title = checked.title
  if (checked.description !== undefined) update.description = checked.description
  if (checked.category !== undefined) update.category = checked.category
  if (partial.condition !== undefined) update.condition = checked.condition ?? null
  if (checked.seeking !== undefined) update.seeking = checked.seeking
  if (checked.images !== undefined) update.images = checked.images
  if (partial.status !== undefined) update.status = dbStatusMap[partial.status]
  if (partial.location !== undefined) {
    update.neighborhood = partial.location.neighborhood
    update.lat = partial.location.lat
    update.lng = partial.location.lng
  }

  const { data, error } = await client().from('listings').update(update).eq('id', id).select().single()
  if (error) throw error
  return mapListingRow(data)
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function fetchAllUsers(): Promise<UserProfile[]> {
  const { data, error } = await client()
    .from('users')
    .select('*')
    .order('joined_at', { ascending: true })
    .limit(1000)
  if (error) throw error
  return (data ?? []).map(mapUserRow)
}

export async function fetchUser(id: string): Promise<UserProfile | null> {
  const { data, error } = await client().from('users').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? mapUserRow(data) : null
}

/**
 * Create the profile row for the signed-in user if the auth trigger hasn't
 * (e.g. migration 004 not applied yet). Only writable columns are sent;
 * reputation and trade counts are server-maintained.
 */
export async function ensureOwnProfile(seed: {
  id: string
  displayName: string
  avatarUrl?: string
}): Promise<UserProfile> {
  const existing = await fetchUser(seed.id)
  if (existing) return existing

  const base =
    seed.displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 20) || 'neighbor'
  const username = `${base.length >= 2 ? base : 'neighbor'}_${seed.id.replace(/-/g, '').slice(0, 5)}`

  const { error } = await client()
    .from('users')
    .insert({
      id: seed.id,
      username,
      display_name: seed.displayName.slice(0, 60) || 'Neighbor',
      avatar_url: seed.avatarUrl?.startsWith('https://') ? seed.avatarUrl : null,
      neighborhood: '',
    })
  // 23505: the trigger (or another tab) created it first. That's fine.
  if (error && error.code !== '23505') throw error

  const created = await fetchUser(seed.id)
  if (!created) throw new Error('Profile could not be created')
  return created
}

export async function updateUser(id: string, partial: Partial<UserProfile>): Promise<void> {
  await requireSelf(id)
  const checked = parseOrThrow(profileUpdateSchema, {
    username: partial.username,
    displayName: partial.displayName,
    avatarUrl: partial.avatarUrl || undefined,
    bio: partial.bio,
    neighborhood: partial.neighborhood,
    interests: partial.interests,
    notificationPrefs: partial.notificationPrefs,
  })
  const update: UserUpdate = {}
  if (checked.username !== undefined) update.username = checked.username
  if (checked.displayName !== undefined) update.display_name = checked.displayName
  if (partial.avatarUrl !== undefined) update.avatar_url = checked.avatarUrl ?? null
  if (checked.bio !== undefined) update.bio = checked.bio
  if (checked.neighborhood !== undefined) update.neighborhood = checked.neighborhood
  if (checked.interests !== undefined) update.interests = checked.interests
  if (checked.notificationPrefs !== undefined) update.notification_prefs = checked.notificationPrefs
  // reputation_score / trade_count are server-maintained and not writable
  if (Object.keys(update).length === 0) return

  const { error } = await client().from('users').update(update).eq('id', id)
  if (error) throw error
}

// ─── Offers ───────────────────────────────────────────────────────────────────

export const OFFER_TTL_MS = 72 * 60 * 60 * 1000

async function fetchOfferWithMessages(id: string): Promise<Offer | null> {
  const db = client()
  const [{ data: row, error: offerErr }, { data: msgs, error: msgErr }] = await Promise.all([
    db.from('offers').select('*').eq('id', id).maybeSingle(),
    db.from('offer_messages').select('*').eq('offer_id', id).order('created_at', { ascending: true }),
  ])
  if (offerErr) throw offerErr
  if (msgErr) throw msgErr
  return row ? mapOfferRow(row, msgs ?? []) : null
}

/**
 * Fetch all offers where userId is either the sender or receiver,
 * with their message thread eager-loaded.
 */
export async function fetchOffers(userId: string): Promise<Offer[]> {
  // RLS already restricts rows to the caller's offers; the filter keeps the
  // query explicit. userId comes from the session, not user input.
  const db = client()
  const { data: offerRows, error: offersErr } = await db
    .from('offers')
    .select('*')
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (offersErr) throw offersErr
  if (!offerRows || offerRows.length === 0) return []

  const offerIds = offerRows.map((o) => o.id)
  const { data: msgRows, error: msgsErr } = await db
    .from('offer_messages')
    .select('*')
    .in('offer_id', offerIds)
    .order('created_at', { ascending: true })
  if (msgsErr) throw msgsErr

  const msgsByOfferId = (msgRows ?? []).reduce<Record<string, OfferMessageRow[]>>((acc, m) => {
    ;(acc[m.offer_id] ??= []).push(m)
    return acc
  }, {})

  return offerRows.map((row) => mapOfferRow(row, msgsByOfferId[row.id] ?? []))
}

export async function createOffer(data: {
  id: string
  messageId: string
  listingId: string
  content: string
  items: string[]
}): Promise<Offer> {
  const content = parseOrThrow(offerMessageSchema, data.content)
  const items = parseOrThrow(offerItemsSchema.min(1), data.items)
  const { error } = await client().rpc('make_offer', {
    p_offer_id: data.id,
    p_listing_id: data.listingId,
    p_message_id: data.messageId,
    p_content: content,
    p_items: items,
  })
  if (error) throw error
  const saved = await fetchOfferWithMessages(data.id)
  if (!saved) throw new Error('Offer was not saved')
  return saved
}

async function respond(
  id: string,
  action: 'accept' | 'decline' | 'counter' | 'withdraw',
  messageId: string,
  content: string,
  items: string[] = [],
): Promise<Offer> {
  const checkedContent = parseOrThrow(offerMessageSchema, content)
  const checkedItems = parseOrThrow(offerItemsSchema, items)
  const { error } = await client().rpc('respond_to_offer', {
    p_offer_id: id,
    p_action: action,
    p_message_id: messageId,
    p_content: checkedContent,
    p_items: checkedItems,
  })
  if (error) throw error
  const saved = await fetchOfferWithMessages(id)
  if (!saved) throw new Error('Offer not found')
  return saved
}

export function acceptOffer(id: string, messageId: string): Promise<Offer> {
  return respond(id, 'accept', messageId, 'Offer accepted.')
}

export function declineOffer(id: string, messageId: string, reason: string, note?: string): Promise<Offer> {
  return respond(id, 'decline', messageId, note?.trim() || reason)
}

export function counterOffer(id: string, messageId: string, content: string, items: string[]): Promise<Offer> {
  return respond(id, 'counter', messageId, content, items)
}

export async function addOfferMessage(
  offerId: string,
  messageId: string,
  fromUserId: string,
  content: string,
): Promise<void> {
  const checked = parseOrThrow(offerMessageSchema, content)
  const { error } = await client().from('offer_messages').insert({
    id: messageId,
    offer_id: offerId,
    from_user_id: fromUserId,
    type: 'message',
    content: checked,
    items: [],
  })
  if (error) throw error
}

// ─── Agreements ───────────────────────────────────────────────────────────────

export async function fetchAgreements(userId: string): Promise<TradeAgreement[]> {
  const { data, error } = await client()
    .from('agreements')
    .select('*')
    .or(`party_a_user_id.eq.${userId},party_b_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapAgreementRow)
}

export async function fetchAgreement(id: string): Promise<TradeAgreement | null> {
  const { data, error } = await client().from('agreements').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? mapAgreementRow(data) : null
}

/** The server signs only the caller's side (agreements_guard). */
export async function signAgreement(id: string, userId: string): Promise<TradeAgreement> {
  const db = client()
  const { data: agreement, error: fetchErr } = await db
    .from('agreements')
    .select('party_a_user_id, party_b_user_id')
    .eq('id', id)
    .single()
  if (fetchErr) throw fetchErr

  const update: AgreementUpdate = {}
  if (agreement.party_a_user_id === userId) update.party_a_signed = true
  else if (agreement.party_b_user_id === userId) update.party_b_signed = true
  else throw new Error('You are not a party to this agreement')

  const { data, error } = await db.from('agreements').update(update).eq('id', id).select().single()
  if (error) throw error
  return mapAgreementRow(data)
}

export async function completeAgreement(id: string): Promise<TradeAgreement> {
  const { data, error } = await client()
    .from('agreements')
    .update({ status: 'completed' })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return mapAgreementRow(data)
}

/**
 * Set or change how, when and where the swap happens. The server clears
 * both signatures when anything changes (agreements_guard, 004), stores the
 * time as UTC ISO and refuses edits once both have signed (009).
 */
export async function updateExchangeDetails(id: string, details: ExchangeDetails): Promise<TradeAgreement> {
  const checked = parseOrThrow(exchangeDetailsSchema, details)
  const { data, error } = await client()
    .from('agreements')
    .update({
      exchange_method: checked.exchangeMethod ?? null,
      exchange_date: checked.exchangeDate ?? null,
      exchange_location: checked.exchangeLocation || null,
      special_instructions: checked.specialInstructions || null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return mapAgreementRow(data)
}

/** Who canceled, when, and whether it was late are stamped server-side (009). */
export async function cancelAgreement(id: string): Promise<TradeAgreement> {
  const { data, error } = await client()
    .from('agreements')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return mapAgreementRow(data)
}

/** Flag for review: status 'disputed' with the neighbor's reason (009). */
export async function flagAgreement(id: string, reason: string): Promise<TradeAgreement> {
  const checked = parseOrThrow(disputeReasonSchema, reason)
  const { data, error } = await client()
    .from('agreements')
    .update({ status: 'disputed', dispute_reason: checked })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return mapAgreementRow(data)
}

// ─── Notifications ────────────────────────────────────────────────────────────
// Created server-side by triggers (migration 004). Clients only read and
// mark them read.

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await client()
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []).map(mapNotificationRow)
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await client()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await client()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) throw error
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export async function fetchReviews(userId: string): Promise<Review[]> {
  const { data, error } = await client()
    .from('reviews')
    .select('*')
    .eq('reviewee_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapReviewRow)
}

/** Recent reviews (profile pages show reviews for any user). */
export async function fetchAllReviews(): Promise<Review[]> {
  const { data, error } = await client()
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw error
  return (data ?? []).map(mapReviewRow)
}

export async function addReview(data: {
  id: string
  agreementId: string
  reviewerId: string
  revieweeId: string
  rating: number
  comment: string
}): Promise<Review> {
  const checked = parseOrThrow(reviewSchema, { rating: data.rating, comment: data.comment })
  const { data: row, error } = await client()
    .from('reviews')
    .insert({
      id: data.id,
      agreement_id: data.agreementId,
      reviewer_id: data.reviewerId,
      reviewee_id: data.revieweeId,
      rating: checked.rating,
      comment: checked.comment || null,
    })
    .select()
    .single()
  if (error) throw error
  return mapReviewRow(row)
}

// ─── Realtime subscriptions ───────────────────────────────────────────────────

/**
 * Watch agreements where the user is either party — lets the UI update
 * live when the other side signs or completes a trade.
 */
export function subscribeToAgreements(
  userId: string,
  callback: (agreement: TradeAgreement) => void,
): RealtimeChannel {
  const handle = (payload: { new: unknown }) => {
    const row = payload.new as AgreementRow | null
    if (row && row.id) callback(mapAgreementRow(row))
  }

  return client()
    .channel(`agreements:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'agreements', filter: `party_a_user_id=eq.${userId}` },
      handle,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'agreements', filter: `party_b_user_id=eq.${userId}` },
      handle,
    )
    .subscribe()
}

/**
 * Subscribe to offer changes (inserts + updates) and new thread messages
 * for offers where userId is a party. The callback receives full Offer
 * objects including their messages.
 */
export function subscribeToOffers(
  userId: string,
  callback: (offer: Offer) => void,
): RealtimeChannel {
  // Coalesce bursts (offer update + message insert arrive together)
  const pending = new Map<string, ReturnType<typeof setTimeout>>()
  const refresh = (offerId: string) => {
    clearTimeout(pending.get(offerId))
    pending.set(
      offerId,
      setTimeout(() => {
        pending.delete(offerId)
        fetchOfferWithMessages(offerId)
          .then((offer) => {
            if (offer) callback(offer)
          })
          .catch((err) => console.warn('[Bartrrr] realtime offer refresh failed', err))
      }, 150),
    )
  }

  const onOffer = (payload: { new: unknown }) => {
    const row = payload.new as OfferRow | null
    if (row?.id) refresh(row.id)
  }

  return client()
    .channel(`offers:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'offers', filter: `from_user_id=eq.${userId}` },
      onOffer,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'offers', filter: `to_user_id=eq.${userId}` },
      onOffer,
    )
    // RLS limits message events to offers the user is a party to
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'offer_messages' },
      (payload) => {
        const row = payload.new as OfferMessageRow | null
        if (row?.offer_id) refresh(row.offer_id)
      },
    )
    .subscribe()
}

/**
 * Subscribe to notification inserts for a user.
 * Returns the RealtimeChannel so the caller can unsubscribe.
 */
export function subscribeToNotifications(
  userId: string,
  callback: (notification: AppNotification) => void,
): RealtimeChannel {
  return client()
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(mapNotificationRow(payload.new as NotificationRow))
      },
    )
    .subscribe()
}
