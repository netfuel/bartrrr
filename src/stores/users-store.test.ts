import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserProfile } from '@/types'

const h = vi.hoisted(() => ({ on: true }))
vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return h.on ? {} : null
  },
}))
vi.mock('@/lib/supabase/supabase-service', () => ({
  updateUser: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  addReview: vi.fn(),
}))

import * as svc from '@/lib/supabase/supabase-service'
import { useUsersStore } from './users-store'
import { useNotificationsStore } from './notifications-store'
import { useReviewsStore } from './reviews-store'
import { useToastStore } from './toast-store'
import type { AppNotification } from '@/types'

const flush = () => new Promise((r) => setTimeout(r, 0))
const OLD = 'https://proj.supabase.co/storage/v1/object/public/listing-photos/u1/avatar-old.webp'
const NEW = 'https://proj.supabase.co/storage/v1/object/public/listing-photos/u1/avatar-new.webp'

const user = (over: Partial<UserProfile> = {}): UserProfile => ({
  id: 'u1',
  username: 'matt',
  displayName: 'Matt',
  avatarUrl: OLD,
  neighborhood: 'Midtown',
  reputationScore: 4.5,
  tradeCount: 3,
  joinedAt: '2026-01-01T00:00:00Z',
  ...over,
})
const get = () => useUsersStore.getState().getUserById('u1')!

beforeEach(() => {
  h.on = true
  vi.clearAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  useUsersStore.setState({ users: [user(), user({ id: 'u2', username: 'sam' })] })
  useToastStore.setState({ toasts: [] })
})

describe('updateUser avatar save callbacks (P-03)', () => {
  it('onSaved runs after the server has it, not before', async () => {
    let resolve!: () => void
    vi.mocked(svc.updateUser).mockReturnValue(new Promise<void>((r) => (resolve = r)))
    const onSaved = vi.fn()
    const onFailed = vi.fn()
    useUsersStore.getState().updateUser('u1', { avatarUrl: NEW }, { onSaved, onFailed })
    expect(get().avatarUrl).toBe(NEW)
    await flush()
    expect(onSaved).not.toHaveBeenCalled()
    resolve()
    await flush()
    expect(onSaved).toHaveBeenCalledOnce()
    expect(onFailed).not.toHaveBeenCalled()
  })

  it('on failure: restores the old avatar, then onFailed', async () => {
    vi.mocked(svc.updateUser).mockRejectedValue(new TypeError('Failed to fetch'))
    const onSaved = vi.fn()
    const onFailed = vi.fn(() => expect(get().avatarUrl).toBe(OLD))
    useUsersStore.getState().updateUser('u1', { avatarUrl: NEW }, { onSaved, onFailed })
    await flush()
    expect(onFailed).toHaveBeenCalledOnce()
    expect(onSaved).not.toHaveBeenCalled()
    expect(get()).toEqual(user())
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
      "Couldn't save your profile changes. Check your connection and try again.",
    )
  })

  it('demo mode: saved right away, no server call', () => {
    h.on = false
    const onSaved = vi.fn()
    useUsersStore.getState().updateUser('u1', { avatarUrl: NEW }, { onSaved })
    expect(onSaved).toHaveBeenCalledOnce()
    expect(svc.updateUser).not.toHaveBeenCalled()
    expect(get().avatarUrl).toBe(NEW)
  })

  it(
    'a failed save rolls back only its own change (T-28: a later edit that saved stays)',
    async () => {
      let failAvatar!: (e: unknown) => void
      vi.mocked(svc.updateUser)
        .mockReturnValueOnce(new Promise<void>((_, rej) => (failAvatar = rej)))
        .mockResolvedValueOnce()
      useUsersStore.getState().updateUser('u1', { avatarUrl: NEW })
      useUsersStore.getState().updateUser('u1', { bio: 'Plant swapper' })
      await flush() // the bio save succeeds first
      failAvatar(new Error('upload row failed'))
      await flush()
      expect(get().avatarUrl).toBe(OLD)
      expect(get().bio).toBe('Plant swapper') // saved on the server, so it must stay
    },
  )

  it('works without callbacks', async () => {
    vi.mocked(svc.updateUser).mockResolvedValue()
    useUsersStore.getState().updateUser('u1', { bio: 'Hi' })
    await flush()
    expect(get().bio).toBe('Hi')
  })
})

describe('local counters', () => {
  it('upsert, counts and rating', () => {
    const s = useUsersStore.getState()
    s.incrementTradeCount('u1')
    s.noteLateCancellation('u1')
    s.noteLateCancellation('u1')
    s.updateRating('u1', 4.8)
    expect(get()).toMatchObject({ tradeCount: 4, lateCancellations: 2, reputationScore: 4.8 })
    s.upsertUser(user({ id: 'u3', username: 'kai' }))
    expect(useUsersStore.getState().getUserByUsername('kai')?.id).toBe('u3')
    expect(useUsersStore.getState().users).toHaveLength(3)
  })
})

describe('notifications store', () => {
  const n = (over: Partial<AppNotification> = {}): AppNotification => ({
    id: 'n1',
    userId: 'u1',
    type: 'new_offer',
    title: 't',
    body: 'b',
    createdAt: '2026-11-01T00:00:00Z',
    ...over,
  })
  beforeEach(() => useNotificationsStore.setState({ notifications: [n(), n({ id: 'n2' }), n({ id: 'n3', userId: 'u2' })] }))

  it('dedupes realtime inserts', () => {
    useNotificationsStore.getState().receiveNotification(n())
    expect(useNotificationsStore.getState().notifications).toHaveLength(3)
  })

  it('markAsRead rolls back on failure', async () => {
    vi.mocked(svc.markNotificationRead).mockRejectedValue(new Error('x'))
    useNotificationsStore.getState().markAsRead('n1')
    expect(useNotificationsStore.getState().getUnreadCount('u1')).toBe(1)
    await flush()
    expect(useNotificationsStore.getState().getUnreadCount('u1')).toBe(2)
  })

  it('markAllAsRead only touches that user, and rolls back', async () => {
    vi.mocked(svc.markAllNotificationsRead).mockRejectedValue(new Error('x'))
    useNotificationsStore.getState().markAllAsRead('u1')
    expect(useNotificationsStore.getState().getUnreadCount('u1')).toBe(0)
    expect(useNotificationsStore.getState().getUnreadCount('u2')).toBe(1)
    await flush()
    expect(useNotificationsStore.getState().getUnreadCount('u1')).toBe(2)
  })

  it('with a backend, local addNotification without a server id is a no-op', () => {
    useNotificationsStore.getState().addNotification({ userId: 'u2', type: 'match', title: 't', body: 'b' })
    expect(useNotificationsStore.getState().notifications).toHaveLength(3)
  })
})

describe('reviews store', () => {
  beforeEach(() => useReviewsStore.setState({ reviews: [] }))
  const data = { agreementId: 'a1', reviewerId: 'u1', revieweeId: 'u2', rating: 5, comment: 'Great' }

  it('one review per agreement per reviewer', () => {
    vi.mocked(svc.addReview).mockReturnValue(new Promise(() => {}))
    useReviewsStore.getState().addReview(data)
    useReviewsStore.getState().addReview(data)
    expect(useReviewsStore.getState().reviews).toHaveLength(1)
    expect(svc.addReview).toHaveBeenCalledTimes(1)
  })

  it('removes the review when the save fails', async () => {
    vi.mocked(svc.addReview).mockRejectedValue(new Error('x'))
    useReviewsStore.getState().addReview(data)
    await flush()
    expect(useReviewsStore.getState().reviews).toHaveLength(0)
    expect(useReviewsStore.getState().hasReviewed('a1', 'u1')).toBe(false)
  })
})
