import { create } from 'zustand'
import type { UserProfile } from '@/types'
import { mockUsers } from '@/data/mock-users'
import * as svc from '@/lib/supabase/supabase-service'
import { persistError } from './persist'

interface UsersState {
  users: UserProfile[]
  setUsers: (users: UserProfile[]) => void
  getUserById: (id: string) => UserProfile | undefined
  getUserByUsername: (username: string) => UserProfile | undefined
  updateUser: (id: string, data: Partial<UserProfile>) => void
  incrementTradeCount: (userId: string) => void
  updateRating: (userId: string, newAvg: number) => void
}

export const useUsersStore = create<UsersState>((set, get) => ({
  users: [...mockUsers],

  setUsers: (users) => set({ users }),

  getUserById: (id) => get().users.find((u) => u.id === id),

  getUserByUsername: (username) =>
    get().users.find((u) => u.username === username),

  updateUser: (id, data) => {
    set((state) => ({
      users: state.users.map((u) => (u.id === id ? { ...u, ...data } : u)),
    }))
    // Dual-write to Supabase (fire and forget)
    svc.updateUser(id, data).catch(persistError("Couldn't save your profile changes"))
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
