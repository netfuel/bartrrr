import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { HAS_SUPABASE } from '@/lib/env'

interface AuthState {
  currentUserId: string | null
  isAuthenticated: boolean
  onboardedUserIds: string[]
  login: (userId: string) => void
  logout: () => void
  markOnboarded: (userId: string) => void
  hasOnboarded: (userId: string) => boolean
}

/**
 * With Supabase, the session (stored by supabase-js) is the source of truth
 * and AuthProvider sets currentUserId from it on every load, so it is not
 * persisted: a stale id must never outlive a signed-out session. Offline demo
 * logins have no session, so there it is persisted to survive a refresh.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUserId: null,
      isAuthenticated: false,
      onboardedUserIds: [],

      login: (userId) =>
        set({ currentUserId: userId, isAuthenticated: true }),

      logout: () =>
        set({ currentUserId: null, isAuthenticated: false }),

      markOnboarded: (userId) =>
        set((state) => ({
          onboardedUserIds: state.onboardedUserIds.includes(userId)
            ? state.onboardedUserIds
            : [...state.onboardedUserIds, userId],
        })),

      hasOnboarded: (userId) => get().onboardedUserIds.includes(userId),
    }),
    {
      name: 'bartrrr-auth',
      version: 1,
      partialize: (state) =>
        HAS_SUPABASE
          ? { onboardedUserIds: state.onboardedUserIds }
          : {
              onboardedUserIds: state.onboardedUserIds,
              currentUserId: state.currentUserId,
              isAuthenticated: state.isAuthenticated,
            },
      // v0 persisted currentUserId unconditionally
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<AuthState>
        return HAS_SUPABASE
          ? { onboardedUserIds: p.onboardedUserIds ?? [] }
          : {
              onboardedUserIds: p.onboardedUserIds ?? [],
              currentUserId: p.currentUserId ?? null,
              isAuthenticated: Boolean(p.currentUserId),
            }
      },
    },
  ),
)
