import { create } from 'zustand'
import type { TradeAgreement } from '@/types'
import { mockAgreements } from '@/data/mock-agreements'
import { generateId } from '@/lib/utils'
import * as svc from '@/lib/supabase/supabase-service'
import { persistError } from './persist'
import { sendPushNotification } from '@/lib/push'

interface CreateAgreementData {
  offerId: string
  partyA: { userId: string; item: string }
  partyB: { userId: string; item: string }
}

interface AgreementsState {
  agreements: TradeAgreement[]
  setAgreements: (agreements: TradeAgreement[]) => void
  getAgreementById: (id: string) => TradeAgreement | undefined
  getAgreementsByUser: (userId: string) => TradeAgreement[]
  getAgreementByOfferId: (offerId: string) => TradeAgreement | undefined
  createAgreement: (data: CreateAgreementData) => string
  signAgreement: (id: string, userId: string) => void
  completeAgreement: (id: string) => void
}

export const useAgreementsStore = create<AgreementsState>((set, get) => ({
  agreements: [...mockAgreements],

  setAgreements: (agreements) => set({ agreements }),

  getAgreementById: (id) => get().agreements.find((a) => a.id === id),

  getAgreementsByUser: (userId) =>
    get().agreements.filter(
      (a) => a.partyA.userId === userId || a.partyB.userId === userId,
    ),

  getAgreementByOfferId: (offerId) =>
    get().agreements.find((a) => a.offerId === offerId),

  createAgreement: (data) => {
    const id = generateId()
    const agreement: TradeAgreement = {
      id,
      offerId: data.offerId,
      partyA: { ...data.partyA, signed: false },
      partyB: { ...data.partyB, signed: false },
      status: 'pending_signatures',
      createdAt: new Date().toISOString(),
    }
    set((state) => ({ agreements: [agreement, ...state.agreements] }))
    // Persist to Supabase and replace with real DB record
    svc.createAgreement(data.offerId, data.partyA, data.partyB).then((saved) => {
      set((state) => ({
        agreements: state.agreements.map((a) => (a.id === id ? saved : a)),
      }))
    }).catch(persistError("Couldn't create the trade agreement"))
    return id
  },

  signAgreement: (id, userId) => {
    set((state) => ({
      agreements: state.agreements.map((a) => {
        if (a.id !== id) return a
        const updated = { ...a }
        if (a.partyA.userId === userId) {
          updated.partyA = { ...a.partyA, signed: true }
        }
        if (a.partyB.userId === userId) {
          updated.partyB = { ...a.partyB, signed: true }
        }
        if (updated.partyA.signed && updated.partyB.signed) {
          updated.status = 'active'
        }
        return updated
      }),
    }))
    svc.signAgreement(id, userId).catch(persistError("Couldn't sign the agreement"))
    // Notify the other party
    const ag = get().agreements.find((a) => a.id === id)
    if (ag) {
      const notifyUserId = ag.partyA.userId === userId ? ag.partyB.userId : ag.partyA.userId
      const bothSigned = ag.partyA.signed && ag.partyB.signed
      sendPushNotification({
        userId: notifyUserId,
        title: bothSigned ? 'Agreement fully signed!' : 'Agreement signed',
        body: bothSigned
          ? "Both parties have signed. The trade is officially on!"
          : 'Your trade partner signed the agreement. Your turn!',
        url: `/agreements/${id}`,
      })
    }
  },

  completeAgreement: (id) => {
    set((state) => ({
      agreements: state.agreements.map((a) =>
        a.id === id
          ? { ...a, status: 'completed' as const, completedAt: new Date().toISOString() }
          : a,
      ),
    }))
    svc.completeAgreement(id).catch(persistError("Couldn't mark the trade complete"))
  },
}))
