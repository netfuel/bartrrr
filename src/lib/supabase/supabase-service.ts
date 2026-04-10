/**
 * Supabase service layer for Bartr.
 *
 * Provides async functions that mirror Zustand store actions so stores can be
 * migrated incrementally. Each function:
 *  1. Guards against a null supabase client (offline/no-credentials mode).
 *  2. Maps DB snake_case column names ↔ app camelCase TypeScript types.
 *  3. Throws on unexpected errors so callers can handle them.
 */

import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './index'
import type {
  AgreementRow,
  ListingRow,
  NotificationRow,
  OfferMessageRow,
  OfferRow,
  ReviewRow,
  UserRow,
} from './database.types'
import type {
  AppNotification,
  Category,
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

// ─── Guards ──────────────────────────────────────────────────────────────────

function assertClient(
  client: typeof supabase,
): asserts client is NonNullable<typeof supabase> {
  if (!client) {
    throw new Error(
      'Supabase client is not initialized. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    )
  }
}

// ─── Row → App type mappers ───────────────────────────────────────────────────

function mapListingRow(row: ListingRow): Listing {
  // DB status 'completed'|'withdrawn' → app status 'closed'
  const statusMap: Record<ListingRow['status'], ListingStatus> = {
    active: 'active',
    pending: 'pending',
    completed: 'closed',
    withdrawn: 'closed',
  }
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category as Category,
    condition: row.condition as ListingCondition | undefined,
    seeking: row.seeking,
    images: row.images,
    userId: row.user_id,
    location: {
      lat: row.lat ?? 0,
      lng: row.lng ?? 0,
      neighborhood: row.neighborhood,
    },
    distanceMi: row.distance_mi,
    createdAt: row.created_at,
    status: statusMap[row.status],
  }
}

function mapOfferMessages(msgs: OfferMessageRow[]): OfferMessage[] {
  return msgs.map((m) => ({
    id: m.id,
    fromUserId: m.from_user_id,
    content: m.content,
    items: m.items.length > 0 ? m.items : undefined,
    type: m.type as OfferMessageType,
    createdAt: m.created_at,
  }))
}

function mapOfferRow(
  row: OfferRow,
  messages: OfferMessageRow[] = [],
): Offer {
  return {
    id: row.id,
    listingId: row.listing_id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    messages: mapOfferMessages(messages),
    status: row.status as Offer['status'],
    round: row.round,
    maxRounds: row.max_rounds,
    expiresAt: row.expires_at ?? new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    createdAt: row.created_at,
  }
}

function mapAgreementRow(row: AgreementRow): TradeAgreement {
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
    exchangeMethod: row.exchange_method as TradeAgreement['exchangeMethod'],
    exchangeDate: row.exchange_date ?? undefined,
    exchangeLocation: row.exchange_location ?? undefined,
    specialInstructions: row.special_instructions ?? undefined,
    status: row.status as TradeAgreement['status'],
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
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

function mapNotificationRow(row: NotificationRow): AppNotification {
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

function mapUserRow(row: UserRow): UserProfile {
  const prefs = row.notification_prefs as Record<string, boolean> | null
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? undefined,
    bio: row.bio ?? undefined,
    neighborhood: row.neighborhood,
    interests: row.interests,
    reputationScore: row.reputation_score,
    tradeCount: row.trade_count,
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
  assertClient(supabase)
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapListingRow)
}

export async function fetchListing(id: string): Promise<Listing | null> {
  assertClient(supabase)
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null // no rows
    throw error
  }
  return data ? mapListingRow(data) : null
}

export async function createListing(
  data: Omit<Listing, 'id' | 'createdAt' | 'distanceMi' | 'status'>,
): Promise<Listing> {
  assertClient(supabase)
  // Map app status 'closed' → db 'withdrawn'
  const { data: row, error } = await supabase
    .from('listings')
    .insert({
      title: data.title,
      description: data.description,
      category: data.category,
      condition: data.condition ?? null,
      seeking: data.seeking,
      images: data.images,
      user_id: data.userId,
      neighborhood: data.location.neighborhood,
      lat: data.location.lat,
      lng: data.location.lng,
      status: 'active',
    })
    .select()
    .single()
  if (error) throw error
  return mapListingRow(row)
}

export async function updateListing(
  id: string,
  partial: Partial<Listing>,
): Promise<void> {
  assertClient(supabase)
  // Map app ListingStatus → db status values
  const dbStatusMap: Record<string, ListingRow['status']> = {
    active: 'active',
    pending: 'pending',
    closed: 'withdrawn',
  }
  const update: Record<string, unknown> = {}
  if (partial.title !== undefined) update.title = partial.title
  if (partial.description !== undefined) update.description = partial.description
  if (partial.category !== undefined) update.category = partial.category
  if (partial.condition !== undefined) update.condition = partial.condition
  if (partial.seeking !== undefined) update.seeking = partial.seeking
  if (partial.images !== undefined) update.images = partial.images
  if (partial.status !== undefined) update.status = dbStatusMap[partial.status] ?? partial.status
  if (partial.location !== undefined) {
    update.neighborhood = partial.location.neighborhood
    update.lat = partial.location.lat
    update.lng = partial.location.lng
  }

  const { error } = await supabase.from('listings').update(update).eq('id', id)
  if (error) throw error
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function fetchAllUsers(): Promise<UserProfile[]> {
  assertClient(supabase)
  const { data, error } = await supabase.from('users').select('*').order('joined_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapUserRow)
}

export async function fetchUser(id: string): Promise<UserProfile | null> {
  assertClient(supabase)
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data ? mapUserRow(data) : null
}

export async function upsertUser(profile: UserProfile): Promise<void> {
  assertClient(supabase)
  const { error } = await supabase.from('users').upsert({
    id: profile.id,
    username: profile.username,
    display_name: profile.displayName,
    avatar_url: profile.avatarUrl ?? null,
    bio: profile.bio ?? null,
    neighborhood: profile.neighborhood,
    interests: profile.interests ?? [],
    reputation_score: profile.reputationScore,
    trade_count: profile.tradeCount,
    notification_prefs: profile.notificationPrefs ?? null,
    joined_at: profile.joinedAt,
  })
  if (error) throw error
}

export async function updateUser(
  id: string,
  partial: Partial<UserProfile>,
): Promise<void> {
  assertClient(supabase)
  const update: Record<string, unknown> = {}
  if (partial.username !== undefined) update.username = partial.username
  if (partial.displayName !== undefined) update.display_name = partial.displayName
  if (partial.avatarUrl !== undefined) update.avatar_url = partial.avatarUrl
  if (partial.bio !== undefined) update.bio = partial.bio
  if (partial.neighborhood !== undefined) update.neighborhood = partial.neighborhood
  if (partial.interests !== undefined) update.interests = partial.interests
  if (partial.reputationScore !== undefined) update.reputation_score = partial.reputationScore
  if (partial.tradeCount !== undefined) update.trade_count = partial.tradeCount
  if (partial.notificationPrefs !== undefined) update.notification_prefs = partial.notificationPrefs

  const { error } = await supabase.from('users').update(update).eq('id', id)
  if (error) throw error
}

// ─── Offers ───────────────────────────────────────────────────────────────────

/**
 * Fetch all offers where userId is either the sender or receiver,
 * with their message thread eager-loaded.
 */
export async function fetchOffers(userId: string): Promise<Offer[]> {
  assertClient(supabase)

  // Fetch offers for this user
  const { data: offerRows, error: offersErr } = await supabase
    .from('offers')
    .select('*')
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (offersErr) throw offersErr

  if (!offerRows || offerRows.length === 0) return []

  // Fetch all messages for those offers in one query
  const offerIds = offerRows.map((o) => o.id)
  const { data: msgRows, error: msgsErr } = await supabase
    .from('offer_messages')
    .select('*')
    .in('offer_id', offerIds)
    .order('created_at', { ascending: true })
  if (msgsErr) throw msgsErr

  const msgsByOfferId = (msgRows ?? []).reduce<Record<string, OfferMessageRow[]>>(
    (acc, m) => {
      ;(acc[m.offer_id] ??= []).push(m)
      return acc
    },
    {},
  )

  return offerRows.map((row) => mapOfferRow(row, msgsByOfferId[row.id] ?? []))
}

export async function createOffer(data: {
  listingId: string
  fromUserId: string
  toUserId: string
  content: string
  items: string[]
}): Promise<Offer> {
  assertClient(supabase)

  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

  const { data: offerRow, error: offerErr } = await supabase
    .from('offers')
    .insert({
      listing_id: data.listingId,
      from_user_id: data.fromUserId,
      to_user_id: data.toUserId,
      status: 'pending',
      round: 1,
      max_rounds: 5,
      expires_at: expiresAt,
    })
    .select()
    .single()
  if (offerErr) throw offerErr

  const { data: msgRow, error: msgErr } = await supabase
    .from('offer_messages')
    .insert({
      offer_id: offerRow.id,
      from_user_id: data.fromUserId,
      type: 'offer',
      content: data.content,
      items: data.items,
    })
    .select()
    .single()
  if (msgErr) throw msgErr

  return mapOfferRow(offerRow, [msgRow])
}

export async function acceptOffer(id: string, userId: string): Promise<void> {
  assertClient(supabase)

  const { error: updateErr } = await supabase
    .from('offers')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updateErr) throw updateErr

  const { error: msgErr } = await supabase.from('offer_messages').insert({
    offer_id: id,
    from_user_id: userId,
    type: 'accept',
    content: 'Offer accepted!',
    items: [],
  })
  if (msgErr) throw msgErr
}

export async function declineOffer(
  id: string,
  userId: string,
  reason: string,
  note?: string,
): Promise<void> {
  assertClient(supabase)

  const { error: updateErr } = await supabase
    .from('offers')
    .update({ status: 'declined', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updateErr) throw updateErr

  const { error: msgErr } = await supabase.from('offer_messages').insert({
    offer_id: id,
    from_user_id: userId,
    type: 'decline',
    content: note || reason,
    items: [],
  })
  if (msgErr) throw msgErr
}

export async function counterOffer(
  id: string,
  userId: string,
  content: string,
  items: string[],
): Promise<void> {
  assertClient(supabase)

  // Increment round
  const { data: offer, error: fetchErr } = await supabase
    .from('offers')
    .select('round')
    .eq('id', id)
    .single()
  if (fetchErr) throw fetchErr

  const { error: updateErr } = await supabase
    .from('offers')
    .update({
      status: 'countered',
      round: offer.round + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (updateErr) throw updateErr

  const { error: msgErr } = await supabase.from('offer_messages').insert({
    offer_id: id,
    from_user_id: userId,
    type: 'counter',
    content,
    items,
  })
  if (msgErr) throw msgErr
}

export async function addOfferMessage(
  offerId: string,
  fromUserId: string,
  content: string,
): Promise<void> {
  assertClient(supabase)
  const { error } = await supabase.from('offer_messages').insert({
    offer_id: offerId,
    from_user_id: fromUserId,
    type: 'message',
    content,
    items: [],
  })
  if (error) throw error
}

// ─── Agreements ───────────────────────────────────────────────────────────────

export async function fetchAgreements(userId: string): Promise<TradeAgreement[]> {
  assertClient(supabase)
  const { data, error } = await supabase
    .from('agreements')
    .select('*')
    .or(`party_a_user_id.eq.${userId},party_b_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapAgreementRow)
}

export async function createAgreement(
  offerId: string,
  partyA: { userId: string; item: string },
  partyB: { userId: string; item: string },
): Promise<TradeAgreement> {
  assertClient(supabase)
  const { data, error } = await supabase
    .from('agreements')
    .insert({
      offer_id: offerId,
      party_a_user_id: partyA.userId,
      party_a_item: partyA.item,
      party_a_signed: false,
      party_b_user_id: partyB.userId,
      party_b_item: partyB.item,
      party_b_signed: false,
      status: 'pending_signatures',
    })
    .select()
    .single()
  if (error) throw error
  return mapAgreementRow(data)
}

export async function signAgreement(id: string, userId: string): Promise<void> {
  assertClient(supabase)

  // Fetch current state to determine which party is signing
  const { data: agreement, error: fetchErr } = await supabase
    .from('agreements')
    .select('party_a_user_id, party_a_signed, party_b_user_id, party_b_signed')
    .eq('id', id)
    .single()
  if (fetchErr) throw fetchErr

  const update: Record<string, unknown> = {}
  if (agreement.party_a_user_id === userId) update.party_a_signed = true
  if (agreement.party_b_user_id === userId) update.party_b_signed = true

  const bothSigned =
    (agreement.party_a_user_id === userId ? true : agreement.party_a_signed) &&
    (agreement.party_b_user_id === userId ? true : agreement.party_b_signed)

  if (bothSigned) update.status = 'active'

  const { error: updateErr } = await supabase
    .from('agreements')
    .update(update)
    .eq('id', id)
  if (updateErr) throw updateErr
}

export async function completeAgreement(id: string): Promise<void> {
  assertClient(supabase)
  const { error } = await supabase
    .from('agreements')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  assertClient(supabase)
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapNotificationRow)
}

export async function addNotification(data: {
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, string>
  listingId?: string
  offerId?: string
  agreementId?: string
}): Promise<void> {
  assertClient(supabase)
  const { error } = await supabase.from('notifications').insert({
    user_id: data.userId,
    type: data.type,
    title: data.title,
    body: data.body,
    data: data.data ?? {},
    listing_id: data.listingId ?? null,
    offer_id: data.offerId ?? null,
    agreement_id: data.agreementId ?? null,
  })
  if (error) throw error
}

export async function markNotificationRead(id: string): Promise<void> {
  assertClient(supabase)
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  assertClient(supabase)
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) throw error
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export async function fetchReviews(userId: string): Promise<Review[]> {
  assertClient(supabase)
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('reviewee_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapReviewRow)
}

export async function addReview(data: {
  agreementId: string
  reviewerId: string
  revieweeId: string
  rating: number
  comment: string
}): Promise<Review> {
  assertClient(supabase)
  const { data: row, error } = await supabase
    .from('reviews')
    .insert({
      agreement_id: data.agreementId,
      reviewer_id: data.reviewerId,
      reviewee_id: data.revieweeId,
      rating: data.rating,
      comment: data.comment,
    })
    .select()
    .single()
  if (error) throw error
  return mapReviewRow(row)
}

// ─── Realtime subscriptions ───────────────────────────────────────────────────

/**
 * Subscribe to offer changes (inserts + updates) where userId is a party.
 * The callback receives full Offer objects including their messages.
 * Returns the RealtimeChannel so the caller can unsubscribe.
 */
export function subscribeToOffers(
  userId: string,
  callback: (offer: Offer) => void,
): RealtimeChannel {
  if (!supabase) throw new Error('Supabase client not initialized')

  return supabase
    .channel(`offers:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'offers',
        filter: `from_user_id=eq.${userId}`,
      },
      async (payload) => {
        const row = payload.new as OfferRow
        // Re-fetch messages for the updated offer
        const { data: msgs } = await supabase!
          .from('offer_messages')
          .select('*')
          .eq('offer_id', row.id)
          .order('created_at', { ascending: true })
        callback(mapOfferRow(row, msgs ?? []))
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'offers',
        filter: `to_user_id=eq.${userId}`,
      },
      async (payload) => {
        const row = payload.new as OfferRow
        const { data: msgs } = await supabase!
          .from('offer_messages')
          .select('*')
          .eq('offer_id', row.id)
          .order('created_at', { ascending: true })
        callback(mapOfferRow(row, msgs ?? []))
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
  if (!supabase) throw new Error('Supabase client not initialized')

  return supabase
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
