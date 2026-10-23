import { create } from 'zustand'
import type { UserProfile } from '@/types'
import { mockUsers } from '@/data/mock-users'
import { DEMO_MODE } from '@/lib/env'
import * as svc from '@/lib/supabase/supabase-service'
import { persist } from './persist'

/** Fields a user may edit on their own profile (the rest are server-owned). */
export type EditableProfile = Pick<
  UserProfile,
  'username' | 'displayName' | 'avatarUrl' | 'bio' | 'neighborhood' | 'interests' | 'notificationPrefs'
>

interface UsersState {
  users: UserProfile[]
  setUsers: (users: UserProfile[]) => void
  upsertUser: (user: UserProfile) => void
  getUserById: (id: string) => UserProfile | undefined
  getUserByUsername: (username: string) => UserProfile | undefined
  updateUser: (id: string, data: Partial<EditableProfile>) => void
  /** Local-only: the server maintains trade counts (migration 004) */
  incrementTradeCount: (userId: string) => void
  /** Local-only: the server maintains reputation (migration 004) */
  updateRating: (userId: string, newAvg: number) => void
}

export const initialUsers = (): UserProfile[] => (DEMO_MODE ? [...mockUsers] : [])

export const useUsersStore = create<UsersState>((set, get) => ({
  users: initialUsers(),

  setUsers: (users) => set({ users }),

  upsertUser: (user) =>
    set((state) => ({
      users: state.users.some((u) => u.id === user.id)
        ? state.users.map((u) => (u.id === user.id ? user : u))
        : [user, ...state.users],
    })),

  getUserById: (id) => get().users.find((u) => u.id === id),

  getUserByUsername: (username) =>
    get().users.find((u) => u.username === username),

  updateUser: (id, data) => {
    const previous = get().users.find((u) => u.id === id)
    set((state) => ({
      users: state.users.map((u) => (u.id === id ? { ...u, ...data } : u)),
    }))
    persist(() => svc.updateUser(id, data), {
      error: "Couldn't save your profile changes",
      rollback: () => {
        if (previous) get().upsertUser(previous)
      },
    })
  },

  incrementTradeCount: (userId) =>
    set((state) => ({
      users: state.users.map((u) =>
        u.id === userId ? { ...u, tradeCount: u.tradeCount + 1 } : u,
      ),
    })),

  updateRating: (userId, newAvg) =>
    set((state) => ({
      users: state.users.map((u) =>
        u.id === userId ? { ...u, reputationScore: newAvg } : u,
      ),
    })),
}))
