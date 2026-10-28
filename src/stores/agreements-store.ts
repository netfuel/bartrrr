import { create } from 'zustand'
import type { ExchangeDetails, TradeAgreement } from '@/types'
import { mockAgreements } from '@/data/mock-agreements'
import { DEMO_MODE } from '@/lib/env'
import * as svc from '@/lib/supabase/supabase-service'
import { hasBackend, persist } from './persist'
import { sendPushNotification } from '@/lib/push'
import { canCancel, canFlag, isBeingAgreed, isLateCancellation } from '@/lib/agreements'

interface CreateAgreementData {
  offerId: string
  partyA: { userId: string; item: string }
  partyB: { userId: string; item: string }
}

interface AgreementsState {
  agreements: TradeAgreement[]
  setAgreements: (agreements: TradeAgreement[]) => void
  upsertAgreement: (agreement: TradeAgreement) => void
  removeAgreementForOffer: (offerId: string) => void
  getAgreementById: (id: string) => TradeAgreement | undefined
  getAgreementsByUser: (userId: string) => TradeAgreement[]
  getAgreementByOfferId: (offerId: string) => TradeAgreement | undefined
  createAgreement: (data: CreateAgreementData) => string
  signAgreement: (id: string, userId: string) => void
  completeAgreement: (id: string) => void
  /** Set or change the time and place. Clears both signatures, as the server does. */
  updateExchangeDetails: (id: string, userId: string, details: ExchangeDetails) => void
  /** Returns whether this counts as a late cancellation (the server has the final say). */
  cancelAgreement: (id: string, userId: string) => boolean
  flagAgreement: (id: string, userId: string, reason: string) => void
}

const otherParty = (a: TradeAgreement, userId: string) =>
  a.partyA.userId === userId ? a.partyB.userId : a.partyA.userId

/** Matches the id the server assigns when it drafts the agreement on accept. */
export const agreementIdForOffer = (offerId: string) => `agreement-${offerId}`

export const initialAgreements = (): TradeAgreement[] => (DEMO_MODE ? [...mockAgreements] : [])

export const useAgreementsStore = create<AgreementsState>((set, get) => {
  const replace = (agreement: TradeAgreement | undefined) => {
    if (!agreement) return
    get().upsertAgreement(agreement)
  }

  return {
    agreements: initialAgreements(),

    setAgreements: (agreements) => set({ agreements }),

    upsertAgreement: (agreement) =>
      set((state) => ({
        agreements: state.agreements.some((a) => a.id === agreement.id)
          ? state.agreements.map((a) => (a.id === agreement.id ? agreement : a))
          : [agreement, ...state.agreements],
      })),

    removeAgreementForOffer: (offerId) =>
      set((state) => ({ agreements: state.agreements.filter((a) => a.offerId !== offerId) })),

    getAgreementById: (id) => get().agreements.find((a) => a.id === id),

    getAgreementsByUser: (userId) =>
      get().agreements.filter(
        (a) => a.partyA.userId === userId || a.partyB.userId === userId,
      ),

    getAgreementByOfferId: (offerId) =>
      get().agreements.find((a) => a.offerId === offerId),

    /**
     * Optimistic draft shown the moment an offer is accepted. With a backend
     * the real agreement is created server-side in the same transaction as
     * the acceptance (migration 004) under the same id, and replaces this
     * draft when acceptOffer's response arrives.
     */
    createAgreement: (data) => {
      const id = agreementIdForOffer(data.offerId)
      if (get().agreements.some((a) => a.id === id)) return id
      const agreement: TradeAgreement = {
        id,
        offerId: data.offerId,
        partyA: { ...data.partyA, signed: false },
        partyB: { ...data.partyB, signed: false },
        status: 'pending_signatures',
        createdAt: new Date().toISOString(),
      }
      set((state) => ({ agreements: [agreement, ...state.agreements] }))
      return id
    },

    signAgreement: (id, userId) => {
      const previous = get().agreements.find((a) => a.id === id)
      if (!previous) return
      const updated = { ...previous }
      if (previous.partyA.userId === userId) updated.partyA = { ...previous.partyA, signed: true }
      if (previous.partyB.userId === userId) updated.partyB = { ...previous.partyB, signed: true }
      if (updated.partyA.signed && updated.partyB.signed) updated.status = 'active'
      replace(updated)

      const notifyUserId = previous.partyA.userId === userId ? previous.partyB.userId : previous.partyA.userId
      const bothSigned = updated.status === 'active'
      persist(() => svc.signAgreement(id, userId), {
        error: "Couldn't sign the trade agreement",
        onSuccess: (saved) => {
          replace(saved)
          sendPushNotification({
            userId: notifyUserId,
            title: bothSigned ? "You're both signed: time to swap" : 'Your turn to sign',
            body: bothSigned
              ? 'You both signed the trade agreement. Meet up and make the swap.'
              : 'Your neighbor signed the trade agreement. Review it and sign to lock in the trade.',
            url: `/agreements/${id}`,
          })
        },
        rollback: () => replace(previous),
      })
    },

    completeAgreement: (id) => {
      const previous = get().agreements.find((a) => a.id === id)
      if (!previous) return
      if (hasBackend() && previous.status !== 'active') return
      replace({ ...previous, status: 'completed', completedAt: new Date().toISOString() })
      persist(() => svc.completeAgreement(id), {
        error: "Couldn't mark the trade as done",
        onSuccess: replace,
        rollback: () => replace(previous),
      })
    },

    updateExchangeDetails: (id, userId, details) => {
      const previous = get().agreements.find((a) => a.id === id)
      if (!previous || !isBeingAgreed(previous)) return
      const now = new Date().toISOString()
      replace({
        ...previous,
        exchangeMethod: details.exchangeMethod,
        exchangeDate: details.exchangeDate,
        exchangeLocation: details.exchangeLocation?.trim() || undefined,
        specialInstructions: details.specialInstructions?.trim() || undefined,
        partyA: { ...previous.partyA, signed: false },
        partyB: { ...previous.partyB, signed: false },
        termsUpdatedBy: userId,
        termsUpdatedAt: now,
      })
      persist(() => svc.updateExchangeDetails(id, details), {
        error: "Couldn't save the time and place",
        onSuccess: (saved) => {
          replace(saved)
          sendPushNotification({
            userId: otherParty(previous, userId),
            title: 'Trade details changed',
            body: 'Your neighbor changed the time and place. Review the agreement and sign again.',
            url: `/agreements/${id}`,
          })
        },
        rollback: () => replace(previous),
      })
    },

    cancelAgreement: (id, userId) => {
      const previous = get().agreements.find((a) => a.id === id)
      if (!previous || !canCancel(previous)) return false
      const late = isLateCancellation(previous)
      replace({
        ...previous,
        status: 'cancelled',
        cancelledBy: userId,
        cancelledAt: new Date().toISOString(),
        cancelledLate: late,
      })
      persist(() => svc.cancelAgreement(id), {
        error: "Couldn't cancel the trade",
        onSuccess: (saved) => {
          replace(saved)
          sendPushNotification({
            userId: otherParty(previous, userId),
            title: 'Trade canceled',
            body: 'Your neighbor canceled your trade agreement. Message them if you want to try again.',
            url: `/agreements/${id}`,
          })
        },
        rollback: () => replace(previous),
      })
      return late
    },

    flagAgreement: (id, userId, reason) => {
      const previous = get().agreements.find((a) => a.id === id)
      const trimmed = reason.trim()
      if (!previous || !canFlag(previous) || !trimmed) return
      replace({
        ...previous,
        status: 'disputed',
        disputedBy: userId,
        disputedAt: new Date().toISOString(),
        disputeReason: trimmed,
      })
      persist(() => svc.flagAgreement(id, trimmed), {
        error: "Couldn't flag the trade",
        onSuccess: (saved) => {
          replace(saved)
          sendPushNotification({
            userId: otherParty(previous, userId),
            title: 'Trade flagged for review',
            body: 'Your neighbor flagged your trade. Talk it through with them in your messages.',
            url: `/agreements/${id}`,
          })
        },
        rollback: () => replace(previous),
      })
    },
  }
})
