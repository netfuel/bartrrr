import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { UserProfile } from '@/types'

type Callbacks = { onSaved?: () => void; onFailed?: () => void }

const h = vi.hoisted(() => ({
  googlePhoto: undefined as string | undefined,
  /** 'saved' | 'failed': how the next updateUser call ends */
  outcome: 'saved' as 'saved' | 'failed',
  updateUser: vi.fn(),
  deleteOwnedPhotos: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('@/lib/auth/google-photo', () => ({
  getGooglePhotoUrl: vi.fn(async () => h.googlePhoto),
}))
vi.mock('@/lib/photos', () => ({
  PhotoError: class PhotoError extends Error {},
  uploadAvatar: vi.fn(),
  deleteOwnedPhotos: h.deleteOwnedPhotos,
}))
vi.mock('@/stores', () => ({
  useUsersStore: (pick: (s: { updateUser: typeof h.updateUser }) => unknown) => pick({ updateUser: h.updateUser }),
  showToast: h.showToast,
}))

import { AvatarUploader } from './AvatarUploader'

const GOOGLE = 'https://lh3.googleusercontent.com/a/maria=s96-c'
const UPLOADED = 'https://proj.supabase.co/storage/v1/object/public/listing-photos/user-002/avatar-1.webp'

const maria = (avatarUrl?: string): UserProfile => ({
  id: 'user-002',
  username: 'maria_s',
  displayName: 'Maria Santos',
  avatarUrl,
  neighborhood: 'Midtown',
  reputationScore: 4.9,
  tradeCount: 41,
  joinedAt: '2025-06-01T10:00:00Z',
})

const googleButton = () => screen.queryByRole('button', { name: 'Use my Google photo' })

beforeEach(() => {
  h.googlePhoto = GOOGLE
  h.outcome = 'saved'
  h.updateUser.mockImplementation((_id: string, _data: unknown, cb?: Callbacks) => {
    if (h.outcome === 'saved') cb?.onSaved?.()
    else cb?.onFailed?.()
  })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Use my Google photo (T-06)', () => {
  it('shows when the Google picture differs from the current photo', async () => {
    render(<AvatarUploader user={maria(UPLOADED)} />)
    expect(await screen.findByRole('button', { name: 'Use my Google photo' })).toBeVisible()
  })

  it('shows after the photo was removed', async () => {
    render(<AvatarUploader user={maria(undefined)} />)
    expect(await screen.findByRole('button', { name: 'Use my Google photo' })).toBeVisible()
  })

  it('hides while the Google picture is already the photo', async () => {
    render(<AvatarUploader user={maria(GOOGLE)} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Change photo' })).toBeVisible())
    await Promise.resolve()
    expect(googleButton()).toBeNull()
  })

  it('hides for neighbors without a Google picture', async () => {
    h.googlePhoto = undefined
    render(<AvatarUploader user={maria(UPLOADED)} />)
    await Promise.resolve()
    expect(googleButton()).toBeNull()
  })

  it('saves the Google picture, then deletes the uploaded file', async () => {
    render(<AvatarUploader user={maria(UPLOADED)} />)
    ;(await screen.findByRole('button', { name: 'Use my Google photo' })).click()
    expect(h.updateUser).toHaveBeenCalledWith('user-002', { avatarUrl: GOOGLE }, expect.any(Object))
    expect(h.deleteOwnedPhotos).toHaveBeenCalledWith([UPLOADED])
    expect(h.showToast).toHaveBeenCalledWith('Your Google photo is back.', 'success')
  })

  it('keeps the uploaded file when the save fails, and says so', async () => {
    h.outcome = 'failed'
    render(<AvatarUploader user={maria(UPLOADED)} />)
    ;(await screen.findByRole('button', { name: 'Use my Google photo' })).click()
    expect(h.deleteOwnedPhotos).not.toHaveBeenCalled()
    expect(await screen.findByText('Your Google photo didn’t save. Try again in a moment.')).toBeVisible()
  })

  it('from no photo: nothing to delete', async () => {
    render(<AvatarUploader user={maria(undefined)} />)
    ;(await screen.findByRole('button', { name: 'Use my Google photo' })).click()
    expect(h.updateUser).toHaveBeenCalledWith('user-002', { avatarUrl: GOOGLE }, expect.any(Object))
    expect(h.deleteOwnedPhotos).not.toHaveBeenCalled()
  })
})
