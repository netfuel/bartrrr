import { create } from 'zustand'
import type { Offer, OfferMessage, OfferDeclineReason } from '@/types'
import { mockOffers } from '@/data/mock-offers'
import { generateId } from '@/lib/utils'
import * as svc from '@/lib/supabase/supabase-service'
import { sendPushNotification } from '@/lib/push'

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
  getOfferById: (id: string) => Offer | undefined
  getOffersByUser: (userId: string) => { incoming: Offer[]; outgoing: Offer[] }
  getOfferByOfferId: (offerId: string) => Offer | undefined
  createOffer: (data: CreateOfferData) => string
  acceptOffer: (offerId: string, userId: string) => void
  declineOffer: (offerId: string, userId: string, reason: OfferDeclineReason, note?: string) => void
  counterOffer: (offerId: string, userId: string, content: string, items: string[]) => void
  addMessage: (offerId: string, fromUserId: string, content: string) => void
}

export const useOffersStore = create<OffersState>((set, get) => ({
  offers: [...mockOffers],

  setOffers: (offers) => set({ offers }),

  getOfferById: (id) => get().offers.find((o) => o.id === id),

  getOffersByUser: (userId) => ({
    incoming: get().offers.filter((o) => o.toUserId === userId),
    outgoing: get().offers.filter((o) => o.fromUserId === userId),
  }),

  getOfferByOfferId: (offerId) => get().offers.find((o) => o.id === offerId),

  createOffer: (data) => {
    const id = generateId()
    const message: OfferMessage = {
      id: generateId(),
      fromUserId: data.fromUserId,
      content: data.content,
      items: data.items,
      type: 'offer',
      createdAt: new Date().toISOString(),
    }
    const offer: Offer = {
      id,
      listingId: data.listingId,
      fromUserId: data.fromUserId,
      toUserId: data.toUserId,
      messages: [message],
      status: 'pending',
      round: 1,
      maxRounds: 5,
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    }
    set((state) => ({ offers: [offer, ...state.offers] }))
    // Notify the listing owner
    sendPushNotification({
      userId: data.toUserId,
      title: 'New offer on your listing!',
      body: 'Someone made you a trade offer. Tap to view.',
      url: `/offers/${id}`,
    })
    // Persist to Supabase and replace local temp offer with real one
    svc.createOffer(data).then((saved) => {
      set((state) => ({
        offers: state.offers.map((o) => (o.id === id ? saved : o)),
      }))
    }).catch((err) =>
      console.warn('[Bartr] Failed to persist new offer to Supabase', err),
    )
    return id
  },

  acceptOffer: (offerId, userId) => {
    set((state) => ({
      offers: state.offers.map((o) => {
        if (o.id !== offerId) return o
        const msg: OfferMessage = {
          id: generateId(),
          fromUserId: userId,
          content: 'Offer accepted!',
          type: 'accept',
          createdAt: new Date().toISOString(),
        }
        return { ...o, status: 'accepted' as const, messages: [...o.messages, msg] }
      }),
    }))
    svc.acceptOffer(offerId, userId).catch((err) =>
      console.warn('[Bartr] Failed to accept offer in Supabase', err),
    )
    // Notify the original offer sender
    const offer = get().offers.find((o) => o.id === offerId)
    if (offer) {
      const notifyUserId = offer.fromUserId === userId ? offer.toUserId : offer.fromUserId
      sendPushNotification({
        userId: notifyUserId,
        title: 'Your offer was accepted!',
        body: "Great news — it's a deal. Tap to sign the agreement.",
        url: `/offers/${offerId}`,
      })
    }
  },

  declineOffer: (offerId, userId, reason, note) => {
    set((state) => ({
      offers: state.offers.map((o) => {
        if (o.id !== offerId) return o
        const msg: OfferMessage = {
          id: generateId(),
          fromUserId: userId,
          content: note || reason,
          type: 'decline',
          createdAt: new Date().toISOString(),
        }
        return { ...o, status: 'declined' as const, messages: [...o.messages, msg] }
      }),
    }))
    svc.declineOffer(offerId, userId, reason, note).catch((err) =>
      console.warn('[Bartr] Failed to decline offer in Supabase', err),
    )
  },

  counterOffer: (offerId, userId, content, items) => {
    set((state) => ({
      offers: state.offers.map((o) => {
        if (o.id !== offerId) return o
        const msg: OfferMessage = {
          id: generateId(),
          fromUserId: userId,
          content,
          items,
          type: 'counter',
          createdAt: new Date().toISOString(),
        }
        return {
          ...o,
          status: 'countered' as const,
          round: o.round + 1,
          messages: [...o.messages, msg],
        }
      }),
    }))
    svc.counterOffer(offerId, userId, content, items).catch((err) =>
      console.warn('[Bartr] Failed to counter offer in Supabase', err),
    )
    // Notify the other party
    const counterOffer = get().offers.find((o) => o.id === offerId)
    if (counterOffer) {
      const notifyUserId = counterOffer.fromUserId === userId ? counterOffer.toUserId : counterOffer.fromUserId
      sendPushNotification({
        userId: notifyUserId,
        title: 'New counter-offer',
        body: 'Someone responded with a counter-offer. Tap to review.',
        url: `/offers/${offerId}`,
      })
    }
  },

  addMessage: (offerId, fromUserId, content) => {
    set((state) => ({
      offers: state.offers.map((o) => {
        if (o.id !== offerId) return o
        const msg: OfferMessage = {
          id: generateId(),
          fromUserId,
          content,
          type: 'message',
          createdAt: new Date().toISOString(),
        }
        return { ...o, messages: [...o.messages, msg] }
      }),
    }))
    svc.addOfferMessage(offerId, fromUserId, content).catch((err) =>
      console.warn('[Bartr] Failed to persist message to Supabase', err),
    )
  },
}))
