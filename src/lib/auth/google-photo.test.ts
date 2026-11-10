import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const getSession = vi.fn()
  return { getSession, client: { auth: { getSession } } as unknown, useClient: false }
})

vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return h.useClient ? h.client : null
  },
}))
vi.mock('@/lib/env', () => ({ DEMO_MODE: true }))

import {
  DEMO_GOOGLE_PHOTOS,
  DEMO_OAUTH_USERS,
  getGooglePhotoUrl,
  googlePhotoFromUser,
  photoFromMetadata,
} from './google-photo'

const PIC = 'https://lh3.googleusercontent.com/a/ACg8ocK=s96-c'
const OTHER = 'https://lh3.googleusercontent.com/a/other=s96-c'

beforeEach(() => {
  h.useClient = false
  h.getSession.mockReset()
})

describe('photoFromMetadata', () => {
  it('reads avatar_url first, then picture', () => {
    expect(photoFromMetadata({ avatar_url: PIC, picture: OTHER })).toBe(PIC)
    expect(photoFromMetadata({ picture: ` ${OTHER} ` })).toBe(OTHER)
  })
  it('only takes https links', () => {
    expect(photoFromMetadata({ avatar_url: 'http://example.com/a.jpg' })).toBeUndefined()
    expect(photoFromMetadata({ avatar_url: 'javascript:alert(1)', picture: PIC })).toBe(PIC)
    expect(photoFromMetadata({ avatar_url: '   ' })).toBeUndefined()
    expect(photoFromMetadata({ avatar_url: 42 })).toBeUndefined()
  })
  it('is undefined without metadata', () => {
    expect(photoFromMetadata(undefined)).toBeUndefined()
    expect(photoFromMetadata(null)).toBeUndefined()
    expect(photoFromMetadata('x')).toBeUndefined()
  })
})

describe('googlePhotoFromUser', () => {
  it("prefers the Google identity's own picture", () => {
    expect(
      googlePhotoFromUser({
        identities: [{ provider: 'google', identity_data: { picture: PIC } }] as never,
        user_metadata: { avatar_url: OTHER },
        app_metadata: { provider: 'google', providers: ['google'] },
      }),
    ).toBe(PIC)
  })
  it('falls back to user_metadata for Google accounts', () => {
    expect(
      googlePhotoFromUser({
        identities: [{ provider: 'google' }] as never,
        user_metadata: { avatar_url: PIC },
        app_metadata: {},
      }),
    ).toBe(PIC)
    expect(
      googlePhotoFromUser({ identities: [], user_metadata: { picture: PIC }, app_metadata: { providers: ['email', 'google'] } }),
    ).toBe(PIC)
  })
  it('is undefined for email and Apple accounts, even with a picture in metadata', () => {
    expect(
      googlePhotoFromUser({ identities: [{ provider: 'email' }] as never, user_metadata: { avatar_url: PIC }, app_metadata: { provider: 'email', providers: ['email'] } }),
    ).toBeUndefined()
    expect(
      googlePhotoFromUser({ identities: [{ provider: 'apple' }] as never, user_metadata: { avatar_url: PIC }, app_metadata: { provider: 'apple', providers: ['apple'] } }),
    ).toBeUndefined()
  })
  it('is undefined when Google has no picture', () => {
    expect(
      googlePhotoFromUser({ identities: [{ provider: 'google', identity_data: {} }] as never, user_metadata: {}, app_metadata: { provider: 'google' } }),
    ).toBeUndefined()
  })
})

describe('getGooglePhotoUrl', () => {
  it('demo: Maria is the Google neighbor and gets her sample photo back', async () => {
    expect(DEMO_OAUTH_USERS['user-002']).toBe('google')
    expect(await getGooglePhotoUrl('user-002')).toBe(DEMO_GOOGLE_PHOTOS['user-002'])
    expect(await getGooglePhotoUrl('user-001')).toBeUndefined()
  })

  it("reads the signed-in neighbor's session", async () => {
    h.useClient = true
    h.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1', identities: [{ provider: 'google', identity_data: { avatar_url: PIC } }], user_metadata: {}, app_metadata: {} } } },
    })
    expect(await getGooglePhotoUrl('u1')).toBe(PIC)
  })

  it("nothing for someone else's id or without a session", async () => {
    h.useClient = true
    h.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1', identities: [{ provider: 'google', identity_data: { avatar_url: PIC } }], user_metadata: {}, app_metadata: {} } } },
    })
    expect(await getGooglePhotoUrl('u2')).toBeUndefined()
    h.getSession.mockResolvedValue({ data: { session: null } })
    expect(await getGooglePhotoUrl('u1')).toBeUndefined()
  })
})
