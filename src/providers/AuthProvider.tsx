import { createContext, useContext, type ReactNode } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useUsersStore } from '@/stores/users-store'
import type { UserProfile } from '@/types'

interface AuthContextValue {
  currentUser: UserProfile | null
  isAuthenticated: boolean
  login: (userId: string) => void
  logout: () => void
  markOnboarded: (userId: string) => void
  hasOnboarded: (userId: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { currentUserId, isAuthenticated, login, logout, markOnboarded, hasOnboarded } = useAuthStore()
  const getUserById = useUsersStore((s) => s.getUserById)

  const currentUser = currentUserId ? getUserById(currentUserId) ?? null : null

  return (
    <AuthContext.Provider
      value={{ currentUser, isAuthenticated, login, logout, markOnboarded, hasOnboarded }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
