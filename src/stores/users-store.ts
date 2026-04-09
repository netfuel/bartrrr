import { create } from 'zustand'
import type { UserProfile } from '@/types'
import { mockUsers } from '@/data/mock-users'

interface UsersState {
  users: UserProfile[]
  getUserById: (id: string) => UserProfile | undefined
  getUserByUsername: (username: string) => UserProfile | undefined
  updateUser: (id: string, data: Partial<UserProfile>) => void
  incrementTradeCount: (userId: string) => void
  updateRating: (userId: string, newAvg: number) => void
}

export const useUsersStore = create<UsersState>((set, get) => ({
  users: [...mockUsers],

  getUserById: (id) => get().users.find((u) => u.id === id),

  getUserByUsername: (username) =>
    get().users.find((u) => u.username === username),

  updateUser: (id, data) =>
    set((state) => ({
      users: state.users.map((u) => (u.id === id ? { ...u, ...data } : u)),
    })),

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
