import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  currentUserId: string | null
  isAuthenticated: boolean
  onboardedUserIds: string[]
  login: (userId: string) => void
  logout: () => void
  markOnboarded: (userId: string) => void
  hasOnboarded: (userId: string) => boolean
}

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
    { name: 'bartrrr-auth' },
  ),
)
