import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import * as svc from '@/lib/supabase/supabase-service'
import { subscribeToPush, isPushSupported } from '@/lib/push'
import { useAuthStore } from '@/stores/auth-store'
import { useUsersStore } from '@/stores/users-store'
import { useListingsStore } from '@/stores/listings-store'
import { useOffersStore } from '@/stores/offers-store'
import { useAgreementsStore } from '@/stores/agreements-store'
import { useNotificationsStore } from '@/stores/notifications-store'
import type { UserProfile } from '@/types'

interface AuthContextValue {
  currentUser: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string) => Promise<void>
  logout: () => Promise<void>
  markOnboarded: (userId: string) => void
  hasOnboarded: (userId: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    currentUserId,
    login: storeLogin,
    logout: storeLogout,
    markOnboarded,
    hasOnboarded,
  } = useAuthStore()

  const setUsers = useUsersStore((s) => s.setUsers)
  const getUserById = useUsersStore((s) => s.getUserById)
  const setListings = useListingsStore((s) => s.setListings)
  const setOffers = useOffersStore((s) => s.setOffers)
  const setAgreements = useAgreementsStore((s) => s.setAgreements)
  const setNotifications = useNotificationsStore((s) => s.setNotifications)
  const addNotification = useNotificationsStore((s) => s.addNotification)

  const [isLoading, setIsLoading] = useState(true)

  // Track realtime channels so we can tear them down on logout
  const offersChannelRef = useRef<RealtimeChannel | null>(null)
  const notifChannelRef = useRef<RealtimeChannel | null>(null)
  // Which user the data load + realtime wiring currently belongs to.
  // getSession and SIGNED_IN both fire on page load, and token refreshes
  // re-emit SIGNED_IN — without this guard we double-load and re-wire.
  const wiredUserIdRef = useRef<string | null>(null)

  const currentUser = currentUserId ? (getUserById(currentUserId) ?? null) : null
  const isAuthenticated = !!currentUserId && !!currentUser

  // ── Load all data from Supabase for a logged-in user ─────────────────────
  const loadUserData = async (userId: string) => {
    try {
      const [dbUsers, dbListings, dbOffers, dbAgreements, dbNotifications] = await Promise.all([
        svc.fetchAllUsers(),
        svc.fetchListings(),
        svc.fetchOffers(userId),
        svc.fetchAgreements(userId),
        svc.fetchNotifications(userId),
      ])
      setUsers(dbUsers)
      setListings(dbListings)
      setOffers(dbOffers)
      setAgreements(dbAgreements)
      setNotifications(dbNotifications)
    } catch (err) {
      console.warn('[Bartr] Supabase data load failed — falling back to mock data', err)
    }

    // Request push permission and subscribe (non-blocking)
    if (isPushSupported()) {
      subscribeToPush(userId).catch(() => { /* permission denied is fine */ })
    }
  }

  // ── Subscribe to realtime updates ─────────────────────────────────────────
  const wireRealtime = (userId: string) => {
    if (!supabase) return

    // Tear down existing channels
    offersChannelRef.current?.unsubscribe()
    notifChannelRef.current?.unsubscribe()

    offersChannelRef.current = svc.subscribeToOffers(userId, (updatedOffer) => {
      // Merge the updated offer into the local store
      useOffersStore.setState((s) => ({
        offers: s.offers.some((o) => o.id === updatedOffer.id)
          ? s.offers.map((o) => (o.id === updatedOffer.id ? updatedOffer : o))
          : [updatedOffer, ...s.offers],
      }))
    })

    notifChannelRef.current = svc.subscribeToNotifications(userId, (notif) => {
      // Pass the server id through so a notification that also arrived via
      // fetchNotifications isn't inserted twice.
      addNotification({
        id: notif.id,
        userId: notif.userId,
        type: notif.type,
        title: notif.title,
        body: notif.body,
        data: notif.data,
      })
    })
  }

  // ── One-time setup per logged-in user ─────────────────────────────────────
  const initSession = async (userId: string) => {
    if (wiredUserIdRef.current === userId) return
    wiredUserIdRef.current = userId
    storeLogin(userId)
    await loadUserData(userId)
    // A different user may have logged in while we were loading — don't
    // wire realtime for a session that's no longer current.
    if (wiredUserIdRef.current === userId) wireRealtime(userId)
  }

  const teardownSession = () => {
    offersChannelRef.current?.unsubscribe()
    notifChannelRef.current?.unsubscribe()
    offersChannelRef.current = null
    notifChannelRef.current = null
    wiredUserIdRef.current = null
  }

  // ── Supabase auth lifecycle ───────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) {
      // No Supabase — keep mock auth running, just mark done loading
      setIsLoading(false)
      return
    }

    // Check for an existing session (e.g. page refresh)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await initSession(session.user.id)
      }
      setIsLoading(false)
    })

    // Listen for login / logout events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await initSession(session.user.id)
        setIsLoading(false)
      } else if (event === 'SIGNED_OUT') {
        teardownSession()
        storeLogout()
        setIsLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
      teardownSession()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Public auth actions ───────────────────────────────────────────────────

  // Demo-mode login: find by first name match in the mock users store
  const offlineLogin = (username: string) => {
    const user = useUsersStore.getState().users.find(
      (u) => u.displayName.split(' ')[0].toLowerCase() === username,
    )
    if (user) storeLogin(user.id)
  }

  // A fetch that never reached Supabase (dead/paused project, no network) —
  // as opposed to a real auth rejection like a wrong password.
  const isNetworkError = (err: unknown) =>
    err instanceof Error &&
    (err.name === 'AuthRetryableFetchError' || err.message.includes('Failed to fetch'))

  const login = async (username: string) => {
    if (!supabase) {
      offlineLogin(username)
      return
    }
    const email = `${username}@bartrrr.demo`
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: 'bartrrr-demo-2024',
      })
      if (error) throw error
      // onAuthStateChange handles the rest
    } catch (err) {
      if (isNetworkError(err)) {
        console.warn('Supabase unreachable — falling back to demo mode.')
        offlineLogin(username)
        return
      }
      throw err
    }
  }

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut().catch(() => {})
    }
    // Always clear local state too: demo-mode logins have no Supabase
    // session, so onAuthStateChange never fires for them.
    storeLogout()
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isLoading,
        login,
        logout,
        markOnboarded,
        hasOnboarded,
      }}
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
