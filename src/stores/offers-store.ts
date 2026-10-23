import { create } from 'zustand'
import {
  MAX_OFFER_ROUNDS,
  OFFER_TTL_HOURS,
  OFFER_STATUS_LABELS,
  type Offer,
  type OfferMessage,
  type OfferDeclineReason,
} from '@/types'
import { mockOffers } from '@/data/mock-offers'
import { DEMO_MODE } from '@/lib/env'
import { generateId } from '@/lib/utils'
import * as svc from '@/lib/supabase/supabase-service'
import { persist } from './persist'
import { showToast } from './toast-store'
import { sendPushNotification } from '@/lib/push'
import { useAgreementsStore } from './agreements-store'

interface CreateOfferData {
  listingId: string
  fromUserId: string
  toUserId: string
  content: string
  items: string[]
}

interface OffersState {
  offers: Offer[]
  setOffers: (offers: Offer[]) => void
  /** Mark pending/countered offers past their 72h window as expired */
  expireStale: () => void
  getOfferById: (id: string) => Offer | undefined
  getOffersByUser: (userId: string) => { incoming: Offer[]; outgoing: Offer[] }
  getOfferByOfferId: (offerId: string) => Offer | undefined
  createOffer: (data: CreateOfferData) => string
  acceptOffer: (offerId: string, userId: string) => void
  declineOffer: (offerId: string, userId: string, reason: OfferDeclineReason, note?: string) => void
  counterOffer: (offerId: string, userId: string, content: string, items: string[]) => void
  addMessage: (offerId: string, fromUserId: string, content: string) => void
}

const OFFER_TTL_MS = OFFER_TTL_HOURS * 60 * 60 * 1000
const ttlFromNow = () => new Date(Date.now() + OFFER_TTL_MS).toISOString()

export function isOfferOpen(offer: Offer): boolean {
  return offer.status === 'pending' || offer.status === 'countered'
}

function withExpiry(offer: Offer, now = Date.now()): Offer {
  return isOfferOpen(offer) && new Date(offer.expiresAt).getTime() <= now
    ? { ...offer, status: 'expired' }
    : offer
}

/** Demo data is dated; keep its open offers inside their 72h window. */
export const initialOffers = (): Offer[] =>
  DEMO_MODE
    ? mockOffers.map((o) => (isOfferOpen(o) ? { ...o, expiresAt: ttlFromNow() } : o))
    : []

export const useOffersStore = create<OffersState>((set, get) => {
  const replace = (offer: Offer) =>
    set((state) => ({
      offers: state.offers.map((o) => (o.id === offer.id ? withExpiry(offer) : o)),
    }))

  const snapshot = (id: string) => get().offers.find((o) => o.id === id)

  /** Refuse actions the server would reject anyway, with a clear message. */
  const assertOpen = (offer: Offer | undefined): offer is Offer => {
    if (!offer) return false
    const current = withExpiry(offer)
    if (!isOfferOpen(current)) {
      if (current.status !== offer.status) replace(current)
      showToast(
        current.status === 'expired'
          ? `This offer expired after ${OFFER_TTL_HOURS} hours without a reply. Make a new offer to keep trading.`
          : `This offer is closed: ${OFFER_STATUS_LABELS[current.status].toLowerCase()}.`,
        'error',
      )
      return false
    }
    return true
  }

  const appendMessage = (offerId: string, msg: OfferMessage, patch: Partial<Offer> = {}) =>
    set((state) => ({
      offers: state.offers.map((o) =>
        o.id === offerId ? { ...o, ...patch, messages: [...o.messages, msg] } : o,
      ),
    }))

  return {
    offers: initialOffers(),

    setOffers: (offers) => {
      const now = Date.now()
      set({ offers: offers.map((o) => withExpiry(o, now)) })
    },

    expireStale: () => {
      const now = Date.now()
      const { offers } = get()
      if (offers.some((o) => withExpiry(o, now) !== o)) {
        set({ offers: offers.map((o) => withExpiry(o, now)) })
      }
    },

    getOfferById: (id) => get().offers.find((o) => o.id === id),

    getOffersByUser: (userId) => ({
      incoming: get().offers.filter((o) => o.toUserId === userId),
      outgoing: get().offers.filter((o) => o.fromUserId === userId),
    }),

    getOfferByOfferId: (offerId) => get().offers.find((o) => o.id === offerId),

    createOffer: (data) => {
      // Same id the server will store, so /offers/:id works immediately
      const id = generateId('offer')
      const messageId = generateId('msg')
      const now = new Date().toISOString()
      const offer: Offer = {
        id,
        listingId: data.listingId,
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        messages: [
          {
            id: messageId,
            fromUserId: data.fromUserId,
            content: data.content,
            items: data.items,
            type: 'offer',
            createdAt: now,
          },
        ],
        status: 'pending',
        round: 1,
        maxRounds: MAX_OFFER_ROUNDS,
        expiresAt: ttlFromNow(),
        createdAt: now,
      }
      set((state) => ({
        offers: state.offers.some((o) => o.id === id) ? state.offers : [offer, ...state.offers],
      }))
      persist(
        () =>
          svc.createOffer({
            id,
            messageId,
            listingId: data.listingId,
            content: data.content,
            items: data.items,
          }),
        {
          error: "Couldn't send your offer",
          onSuccess: (saved) => {
            replace(saved)
            sendPushNotification({
              userId: data.toUserId,
              title: 'New offer on your listing',
              body: 'A neighbor wants to trade with you. Tap to see what they offered.',
              url: `/offers/${id}`,
            })
          },
          rollback: () => set((state) => ({ offers: state.offers.filter((o) => o.id !== id) })),
        },
      )
      return id
    },

    acceptOffer: (offerId, userId) => {
      const previous = snapshot(offerId)
      if (!assertOpen(previous)) return
      const messageId = generateId('msg')
      appendMessage(
        offerId,
        { id: messageId, fromUserId: userId, content: 'Offer accepted.', type: 'accept', createdAt: new Date().toISOString() },
        { status: 'accepted' },
      )
      persist(() => svc.acceptOffer(offerId, messageId), {
        error: "Couldn't accept the trade",
        onSuccess: async (saved) => {
          replace(saved)
          // The server drafts the agreement in the same transaction
          const agreement = await svc.fetchAgreement(`agreement-${offerId}`).catch(() => null)
          if (agreement) useAgreementsStore.getState().upsertAgreement(agreement)
          const notifyUserId = saved.fromUserId === userId ? saved.toUserId : saved.fromUserId
          sendPushNotification({
            userId: notifyUserId,
            title: 'Your offer was accepted',
            body: "It's a deal. Tap to review and sign the trade agreement.",
            url: `/offers/${offerId}`,
          })
        },
        rollback: () => {
          replace(previous)
          useAgreementsStore.getState().removeAgreementForOffer(offerId)
        },
      })
    },

    declineOffer: (offerId, userId, reason, note) => {
      const previous = snapshot(offerId)
      if (!assertOpen(previous)) return
      const messageId = generateId('msg')
      appendMessage(
        offerId,
        { id: messageId, fromUserId: userId, content: note || reason, type: 'decline', createdAt: new Date().toISOString() },
        { status: 'declined' },
      )
      persist(() => svc.declineOffer(offerId, messageId, reason, note), {
        error: "Couldn't decline the offer",
        onSuccess: replace,
        rollback: () => replace(previous),
      })
    },

    counterOffer: (offerId, userId, content, items) => {
      const previous = snapshot(offerId)
      if (!assertOpen(previous)) return
      if (previous.round >= previous.maxRounds) {
        showToast(
          `Counter-offers are limited to ${previous.maxRounds} rounds. Accept or decline this one.`,
          'error',
        )
        return
      }
      const messageId = generateId('msg')
      appendMessage(
        offerId,
        { id: messageId, fromUserId: userId, content, items, type: 'counter', createdAt: new Date().toISOString() },
        { status: 'countered', round: previous.round + 1, expiresAt: ttlFromNow() },
      )
      persist(() => svc.counterOffer(offerId, messageId, content, items), {
        error: "Couldn't send your counter-offer",
        onSuccess: (saved) => {
          replace(saved)
          const notifyUserId = saved.fromUserId === userId ? saved.toUserId : saved.fromUserId
          sendPushNotification({
            userId: notifyUserId,
            title: 'New counter-offer',
            body: 'Your neighbor suggested a change. Tap to review it.',
            url: `/offers/${offerId}`,
          })
        },
        rollback: () => replace(previous),
      })
    },

    addMessage: (offerId, fromUserId, content) => {
      const messageId = generateId('msg')
      appendMessage(offerId, {
        id: messageId,
        fromUserId,
        content,
        type: 'message',
        createdAt: new Date().toISOString(),
      })
      persist(() => svc.addOfferMessage(offerId, messageId, fromUserId, content), {
        error: "Couldn't send your message",
        rollback: () =>
          set((state) => ({
            offers: state.offers.map((o) =>
              o.id === offerId ? { ...o, messages: o.messages.filter((m) => m.id !== messageId) } : o,
            ),
          })),
      })
    },
  }
})
