import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { RealtimeChannel, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import * as svc from '@/lib/supabase/supabase-service'
import { DEMO_MODE } from '@/lib/env'
import { subscribeToPush, isPushSupported, getPushPermissionState } from '@/lib/push'
import { useAuthStore } from '@/stores/auth-store'
import { useUsersStore } from '@/stores/users-store'
import { useListingsStore } from '@/stores/listings-store'
import { useOffersStore } from '@/stores/offers-store'
import { useAgreementsStore } from '@/stores/agreements-store'
import { useNotificationsStore } from '@/stores/notifications-store'
import { useReviewsStore } from '@/stores/reviews-store'
import { resetDataStores } from '@/stores/reset'
import { useOfferExpiryTicker } from '@/stores/expiry'
import type { UserProfile } from '@/types'

interface AuthContextValue {
  currentUser: UserProfile | null
  isAuthenticated: boolean
  /** True until the initial session (and profile, if signed in) has loaded */
  isLoading: boolean
  /** Set when the signed-in user's profile/data couldn't load */
  loadError: string | null
  /** True after a password-recovery link signed the user in */
  isPasswordRecovery: boolean
  /** Demo mode only: sign in as a sample user by first name */
  login: (username: string) => Promise<void>
  logout: () => Promise<void>
  retryLoad: () => void
  markOnboarded: (userId: string) => void
  hasOnboarded: (userId: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Best-effort display name + avatar from provider metadata (Google / Apple). */
function profileSeedFromSession(session: Session) {
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  const email = session.user.email ?? ''
  const fromEmail = email && !email.endsWith('@privaterelay.appleid.com')
    ? email.split('@')[0].replace(/[._+-]+/g, ' ')
    : undefined
  return {
    id: session.user.id,
    displayName:
      str(meta.full_name) ||
      str(meta.name) ||
      [str(meta.given_name), str(meta.family_name)].filter(Boolean).join(' ') ||
      fromEmail ||
      'Neighbor',
    avatarUrl: str(meta.avatar_url) ?? str(meta.picture),
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const currentUserId = useAuthStore((s) => s.currentUserId)
  const storeLogin = useAuthStore((s) => s.login)
  const storeLogout = useAuthStore((s) => s.logout)
  const markOnboarded = useAuthStore((s) => s.markOnboarded)
  const hasOnboarded = useAuthStore((s) => s.hasOnboarded)
  const currentUser = useUsersStore((s) =>
    currentUserId ? (s.users.find((u) => u.id === currentUserId) ?? null) : null,
  )

  const [isLoading, setIsLoading] = useState(Boolean(supabase))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  const channelsRef = useRef<RealtimeChannel[]>([])
  // Which user the data load + realtime wiring belongs to, and a generation
  // counter so a slow load for a previous session can't clobber a newer one
  // (user A signs out and B signs in while A's fetches are in flight).
  const wiredUserIdRef = useRef<string | null>(null)
  const generationRef = useRef(0)

  const isAuthenticated = !!currentUserId && !!currentUser

  useOfferExpiryTicker()

  const teardownRealtime = useCallback(() => {
    for (const ch of channelsRef.current) {
      void supabase?.removeChannel(ch)
    }
    channelsRef.current = []
  }, [])

  const wireRealtime = useCallback(
    (userId: string) => {
      teardownRealtime()
      const upsertBy = <T extends { id: string }>(list: T[], item: T) =>
        list.some((x) => x.id === item.id)
          ? list.map((x) => (x.id === item.id ? item : x))
          : [item, ...list]

      channelsRef.current = [
        svc.subscribeToOffers(userId, (offer) => {
          useOffersStore.setState((s) => ({ offers: upsertBy(s.offers, offer) }))
        }),
        svc.subscribeToAgreements(userId, (agreement) => {
          useAgreementsStore.setState((s) => ({ agreements: upsertBy(s.agreements, agreement) }))
        }),
        svc.subscribeToNotifications(userId, (notif) => {
          // Server id passes through so a notification that also arrived via
          // fetchNotifications isn't inserted twice.
          useNotificationsStore.getState().receiveNotification(notif)
        }),
      ]
    },
    [teardownRealtime],
  )

  const loadSession = useCallback(
    async (session: Session) => {
      const userId = session.user.id
      const generation = ++generationRef.current
      wiredUserIdRef.current = userId
      setLoadError(null)
      setIsLoading(true)
      const stale = () => generationRef.current !== generation

      try {
        // Profile first: the trigger normally created it; create it here if not.
        const me = await svc.ensureOwnProfile(profileSeedFromSession(session))
        if (stale()) return
        useUsersStore.getState().upsertUser(me)
        storeLogin(userId)

        const [users, listings, offers, agreements, notifications, reviews] = await Promise.all([
          svc.fetchAllUsers(),
          svc.fetchListings(),
          svc.fetchOffers(userId),
          svc.fetchAgreements(userId),
          svc.fetchNotifications(userId),
          svc.fetchAllReviews(),
        ])
        if (stale()) return
        useUsersStore.getState().setUsers(users.some((u) => u.id === me.id) ? users : [me, ...users])
        useListingsStore.getState().setListings(listings)
        useOffersStore.getState().setOffers(offers)
        useAgreementsStore.getState().setAgreements(agreements)
        useNotificationsStore.getState().setNotifications(notifications)
        useReviewsStore.getState().setReviews(reviews)

        wireRealtime(userId)

        // Only re-subscribe silently if permission was already granted;
        // asking for permission needs a user gesture (Settings).
        if (isPushSupported() && getPushPermissionState() === 'granted') {
          subscribeToPush(userId).catch(() => {})
        }
      } catch (err) {
        if (stale()) return
        console.error('[Bartr] Failed to load your account', err)
        setLoadError("We couldn't load your account. Check your connection and try again.")
      } finally {
        if (!stale()) setIsLoading(false)
      }
    },
    [storeLogin, wireRealtime],
  )

  const clearSession = useCallback(() => {
    generationRef.current++
    wiredUserIdRef.current = null
    teardownRealtime()
    storeLogout()
    resetDataStores()
    setLoadError(null)
    setIsPasswordRecovery(false)
    setIsLoading(false)
  }, [storeLogout, teardownRealtime])

  // ── Supabase auth lifecycle ───────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) {
      // Offline demo mode: a persisted demo login is not restored, so start signed out
      setIsLoading(false)
      return
    }
    const client = supabase
    const generation = generationRef

    // onAuthStateChange fires INITIAL_SESSION once on subscribe (after any
    // ?code= exchange), then SIGNED_IN / TOKEN_REFRESHED / SIGNED_OUT etc.
    // Callbacks must not await Supabase calls directly (deadlocks the auth
    // lock), so work is deferred with setTimeout.
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)

        if (event === 'SIGNED_OUT' || !session) {
          if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') clearSession()
          return
        }
        // Token refreshes and USER_UPDATED for the same user need no reload
        if (wiredUserIdRef.current === session.user.id) {
          setIsLoading(false)
          return
        }
        void loadSession(session)
      }, 0)
    })

    return () => {
      subscription.unsubscribe()
      // Invalidate any in-flight load (it's a counter, not a DOM ref)
      generation.current++
      teardownRealtime()
    }
  }, [clearSession, loadSession, teardownRealtime])

  // ── Public auth actions ───────────────────────────────────────────────────

  const login = useCallback(
    async (username: string) => {
      if (!DEMO_MODE) throw new Error('Demo login is disabled')
      if (supabase) {
        // Demo against a real Supabase project with seeded demo accounts
        const { error } = await supabase.auth.signInWithPassword({
          email: `${username}@bartrrr.demo`,
          password: import.meta.env.VITE_DEMO_PASSWORD ?? '',
        })
        if (error) throw error
        return
      }
      const user = useUsersStore
        .getState()
        .users.find((u) => u.displayName.split(' ')[0].toLowerCase() === username)
      if (!user) throw new Error('Demo user not found')
      storeLogin(user.id)
    },
    [storeLogin],
  )

  const logout = useCallback(async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut()
      if (error) console.warn('[Bartr] Sign-out request failed; clearing local session', error)
    }
    // Always clear local state too: offline demo logins have no Supabase
    // session, and a failed network sign-out must still sign out locally.
    clearSession()
  }, [clearSession])

  const retryLoad = useCallback(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        wiredUserIdRef.current = null
        void loadSession(data.session)
      }
    })
  }, [loadSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      isAuthenticated,
      isLoading,
      loadError,
      isPasswordRecovery,
      login,
      logout,
      retryLoad,
      markOnboarded,
      hasOnboarded,
    }),
    [
      currentUser,
      isAuthenticated,
      isLoading,
      loadError,
      isPasswordRecovery,
      login,
      logout,
      retryLoad,
      markOnboarded,
      hasOnboarded,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
