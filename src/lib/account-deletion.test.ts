import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Entry = { name: string; id: string | null }
type ListResult = { data: Entry[] | null; error: unknown }

const h = vi.hoisted(() => {
  const list = vi.fn<(prefix: string, opts: { limit: number; offset: number }) => Promise<ListResult>>()
  const remove = vi.fn<(paths: string[]) => Promise<{ data: unknown[] | null; error: unknown }>>()
  const rpc = vi.fn<(name: string) => Promise<{ error: unknown }>>()
  const signOut = vi.fn<(opts?: unknown) => Promise<{ error: null }>>(async () => ({ error: null }))
  const getSession = vi.fn<() => Promise<{ data: { session: unknown } }>>()
  const signInWithPassword = vi.fn<(c: { email: string; password: string }) => Promise<{ error: unknown }>>()
  const signInWithOAuth = vi.fn<(o: unknown) => Promise<{ error: unknown }>>()
  const from = vi.fn(() => ({ list, remove }))
  return {
    list,
    remove,
    rpc,
    signOut,
    getSession,
    signInWithPassword,
    signInWithOAuth,
    from,
    client: { storage: { from }, rpc, auth: { signOut, getSession, signInWithPassword, signInWithOAuth } },
  }
})

vi.mock('@/lib/env', () => ({ DEMO_MODE: false, SUPABASE_URL: 'https://proj.supabase.co' }))
vi.mock('@/lib/supabase', () => ({ supabase: h.client }))

import {
  AccountDeletionError,
  ACCOUNT_DELETION_IS_DEMO,
  CONFIRM_RETURN_PATH,
  confirmWithPassword,
  deleteMyAccount,
  deleteOwnPhotos,
  forgetDeletedSession,
  getReauthMethod,
  readOAuthConfirm,
  sessionSignedInAt,
  startOAuthConfirm,
} from './account-deletion'

const file = (name: string): Entry => ({ name, id: `id-${name}` })
const folder = (name: string): Entry => ({ name, id: null })

/** A fake bucket tree: prefix → entries, served in pages like Supabase does. */
function serveTree(tree: Record<string, Entry[]>) {
  h.list.mockImplementation(async (prefix, { limit, offset }) => ({
    data: (tree[prefix] ?? []).slice(offset, offset + limit),
    error: null,
  }))
}

let warn: ReturnType<typeof vi.spyOn>
let error: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  h.list.mockReset()
  h.remove.mockReset().mockImplementation(async (paths) => ({ data: paths.map((p) => ({ name: p })), error: null }))
  h.rpc.mockReset().mockResolvedValue({ error: null })
  h.signOut.mockClear()
  h.getSession.mockReset().mockResolvedValue({ data: { session: null } })
  h.signInWithPassword.mockReset().mockResolvedValue({ error: null })
  h.signInWithOAuth.mockReset().mockResolvedValue({ error: null })
  sessionStorage.clear()
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  error = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('mode', () => {
  it('with a backend and no demo flag, deletion is real', () => {
    expect(ACCOUNT_DELETION_IS_DEMO).toBe(false)
  })
})

describe('deleteOwnPhotos', () => {
  it('lists the user folder recursively and removes every file', async () => {
    serveTree({
      u1: [file('a.webp'), folder('old'), file('avatar-1.webp')],
      'u1/old': [file('b.jpg'), folder('deeper')],
      'u1/old/deeper': [file('c.jpg')],
    })
    await expect(deleteOwnPhotos('u1')).resolves.toBe(0)
    expect(h.remove).toHaveBeenCalledTimes(1)
    expect(h.remove.mock.calls[0][0].sort()).toEqual(
      ['u1/a.webp', 'u1/avatar-1.webp', 'u1/old/b.jpg', 'u1/old/deeper/c.jpg'].sort(),
    )
    // never touches anyone else's folder
    for (const [prefix] of h.list.mock.calls) expect(prefix.startsWith('u1')).toBe(true)
  })

  it('pages through big folders 100 at a time and removes in batches of 100', async () => {
    const many = Array.from({ length: 250 }, (_, i) => file(`p${i}.webp`))
    serveTree({ u1: many })
    await expect(deleteOwnPhotos('u1')).resolves.toBe(0)
    expect(h.list.mock.calls.map(([, o]) => o)).toEqual([
      { limit: 100, offset: 0 },
      { limit: 100, offset: 100 },
      { limit: 100, offset: 200 },
    ])
    expect(h.remove.mock.calls.map(([b]) => b.length)).toEqual([100, 100, 50])
  })

  it('asks for one more page when a page is exactly full', async () => {
    serveTree({ u1: Array.from({ length: 100 }, (_, i) => file(`p${i}`)) })
    await deleteOwnPhotos('u1')
    expect(h.list).toHaveBeenCalledTimes(2)
  })

  it('stops recursing after 3 levels', async () => {
    serveTree({
      u1: [folder('a')],
      'u1/a': [folder('b')],
      'u1/a/b': [folder('c')],
      'u1/a/b/c': [folder('d'), file('deep.jpg')],
      'u1/a/b/c/d': [file('too-deep.jpg')],
    })
    await deleteOwnPhotos('u1')
    expect(h.list.mock.calls.map(([p]) => p)).toEqual(['u1', 'u1/a', 'u1/a/b', 'u1/a/b/c'])
    expect(h.remove.mock.calls[0][0]).toEqual(['u1/a/b/c/deep.jpg'])
  })

  it('an empty folder makes no remove call', async () => {
    serveTree({})
    await expect(deleteOwnPhotos('u1')).resolves.toBe(0)
    expect(h.remove).not.toHaveBeenCalled()
  })

  it('counts files the server did not remove', async () => {
    serveTree({ u1: [file('a'), file('b'), file('c')] })
    h.remove.mockResolvedValue({ data: [{ name: 'u1/a' }], error: null })
    await expect(deleteOwnPhotos('u1')).resolves.toBe(2)
    expect(warn).toHaveBeenCalled()
  })

  it('counts a whole failed batch', async () => {
    serveTree({ u1: [file('a'), file('b')] })
    h.remove.mockResolvedValue({ data: null, error: { message: 'denied' } })
    await expect(deleteOwnPhotos('u1')).resolves.toBe(2)
  })

  it('never throws when listing fails', async () => {
    h.list.mockResolvedValue({ data: null, error: new Error('list failed') })
    await expect(deleteOwnPhotos('u1')).resolves.toBe(1)
    expect(warn).toHaveBeenCalled()
  })

  it('never throws when remove rejects', async () => {
    serveTree({ u1: [file('a'), file('b'), file('c')] })
    h.remove.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(deleteOwnPhotos('u1')).resolves.toBe(3)
  })
})

/** A Supabase session whose access token carries these amr entries. */
function sessionFor(
  userId: string,
  {
    amr,
    lastSignInAt,
    providers = ['email'],
    email = 'jamie@example.com',
  }: { amr?: unknown; lastSignInAt?: string; providers?: string[]; email?: string } = {},
) {
  const b64url = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const payload: Record<string, unknown> = { sub: userId, iat: Math.floor(Date.now() / 1000) }
  if (amr !== undefined) payload.amr = amr
  return {
    access_token: `${b64url({ alg: 'HS256' })}.${b64url(payload)}.sig`,
    user: {
      id: userId,
      email,
      last_sign_in_at: lastSignInAt,
      app_metadata: { provider: providers[0], providers },
      identities: providers.map((provider) => ({ provider })),
    },
  }
}
const secondsAgo = (s: number) => Math.floor(Date.now() / 1000) - s

describe('deleteMyAccount', () => {
  beforeEach(() => serveTree({ u1: [file('a.webp')] }))

  it('deletes the account first, then the photos', async () => {
    const order: string[] = []
    h.remove.mockImplementation(async (p) => {
      order.push('photos')
      return { data: p, error: null }
    })
    h.rpc.mockImplementation(async () => {
      order.push('rpc')
      return { error: null }
    })
    await deleteMyAccount('u1')
    expect(order).toEqual(['rpc', 'photos'])
    expect(h.rpc).toHaveBeenCalledWith('delete_my_account')
    expect(h.remove).toHaveBeenCalledWith(['u1/a.webp'])
  })

  it('when the account step fails, no photo is touched', async () => {
    h.rpc.mockResolvedValue({ error: { code: 'P0001', message: 'boom' } })
    await expect(deleteMyAccount('u1')).rejects.toBeInstanceOf(AccountDeletionError)
    expect(h.list).not.toHaveBeenCalled()
    expect(h.remove).not.toHaveBeenCalled()
  })

  it('a photo cleanup failure after the account is gone is logged, not thrown', async () => {
    h.list.mockResolvedValue({ data: null, error: new Error('x') })
    await expect(deleteMyAccount('u1')).resolves.toBeUndefined()
    expect(h.rpc).toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
  })

  it('a rejected remove after the account is gone is logged, not thrown', async () => {
    h.remove.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(deleteMyAccount('u1')).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
  })

  it('stops waiting for a stalled photo cleanup after 20 seconds', async () => {
    vi.useFakeTimers()
    try {
      h.list.mockImplementation(() => new Promise(() => {}))
      let done = false
      const p = deleteMyAccount('u1').then(() => {
        done = true
      })
      await vi.advanceTimersByTimeAsync(19_000)
      expect(done).toBe(false)
      await vi.advanceTimersByTimeAsync(1_500)
      await p
      expect(done).toBe(true)
      expect(warn).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  const kindOf = async () => {
    const err = await deleteMyAccount('u1').catch((e) => e)
    expect(err).toBeInstanceOf(AccountDeletionError)
    return (err as AccountDeletionError).kind
  }

  it.each([
    ['fetch TypeError thrown', () => h.rpc.mockRejectedValue(new TypeError('Failed to fetch'))],
    ['returned network error', () => h.rpc.mockResolvedValue({ error: { message: 'TypeError: Load failed' } })],
    ['NetworkError text', () => h.rpc.mockResolvedValue({ error: { message: 'NetworkError when attempting to fetch resource.' } })],
  ])('network: %s', async (_n, arrange) => {
    arrange()
    expect(await kindOf()).toBe('network')
    expect(error).toHaveBeenCalled()
  })

  it('network: offline browser', async () => {
    h.rpc.mockResolvedValue({ error: { code: '500', message: 'whatever' } })
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect(await kindOf()).toBe('network')
  })

  it.each(['42501', 'PGRST301', 'PGRST303'])('session: code %s', async (code) => {
    h.rpc.mockResolvedValue({ error: { code, message: 'not signed in' } })
    expect(await kindOf()).toBe('session')
  })

  it('reauth: the server says the sign-in is too old (013), and no photo is touched', async () => {
    h.rpc.mockResolvedValue({ error: { code: '28000', message: 'Confirm it’s you again', hint: 'reauth_required' } })
    expect(await kindOf()).toBe('reauth')
    expect(h.remove).not.toHaveBeenCalled()
  })

  it('reauth: recognized by the hint too', async () => {
    h.rpc.mockResolvedValue({ error: { code: 'XX000', message: 'x', hint: 'reauth_required' } })
    expect(await kindOf()).toBe('reauth')
  })

  it('server: anything else, with the cause kept', async () => {
    const cause = { code: 'P0001', message: 'boom' }
    h.rpc.mockResolvedValue({ error: cause })
    const err = (await deleteMyAccount('u1').catch((e) => e)) as AccountDeletionError
    expect(err.kind).toBe('server')
    expect(err.cause).toBe(cause)
    expect(err.message).toBe('Account deletion failed (server)')
  })
})

describe('getReauthMethod', () => {
  it('email + password accounts type their password', async () => {
    h.getSession.mockResolvedValue({ data: { session: sessionFor('u1') } })
    expect(await getReauthMethod('u1')).toEqual({ kind: 'password', email: 'jamie@example.com' })
  })

  it('Google-only accounts go through Google', async () => {
    h.getSession.mockResolvedValue({ data: { session: sessionFor('u1', { providers: ['google'] }) } })
    expect(await getReauthMethod('u1')).toMatchObject({ kind: 'oauth', provider: { id: 'google', label: 'Google' } })
  })

  it('Apple-only accounts go through Apple', async () => {
    h.getSession.mockResolvedValue({ data: { session: sessionFor('u1', { providers: ['apple'] }) } })
    expect(await getReauthMethod('u1')).toMatchObject({ kind: 'oauth', provider: { id: 'apple' } })
  })

  it('accounts with both a password and Google use the password', async () => {
    h.getSession.mockResolvedValue({ data: { session: sessionFor('u1', { providers: ['google', 'email'] }) } })
    expect(await getReauthMethod('u1')).toMatchObject({ kind: 'password' })
  })

  it('no session, or a session for someone else: null', async () => {
    expect(await getReauthMethod('u1')).toBeNull()
    h.getSession.mockResolvedValue({ data: { session: sessionFor('u2') } })
    expect(await getReauthMethod('u1')).toBeNull()
  })
})

describe('confirmWithPassword', () => {
  it('signs in again with the account email and the typed password', async () => {
    await confirmWithPassword('jamie@example.com', 'hunter22')
    expect(h.signInWithPassword).toHaveBeenCalledWith({ email: 'jamie@example.com', password: 'hunter22' })
  })

  it('an empty password is refused without a request', async () => {
    await expect(confirmWithPassword('jamie@example.com', '')).rejects.toMatchObject({ kind: 'password' })
    expect(h.signInWithPassword).not.toHaveBeenCalled()
  })

  it.each([
    ['wrong password', { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' }, 'password'],
    ['too many tries', { code: 'over_request_rate_limit', status: 429, message: 'rate' }, 'rate_limited'],
    ['network', Object.assign(new Error('Failed to fetch'), { name: 'AuthRetryableFetchError' }), 'network'],
    ['anything else', { code: 'unexpected_failure', status: 500, message: 'x' }, 'server'],
  ])('%s', async (_n, err, kind) => {
    h.signInWithPassword.mockResolvedValue({ error: err })
    await expect(confirmWithPassword('jamie@example.com', 'pw')).rejects.toMatchObject({ kind })
  })
})

describe('sessionSignedInAt', () => {
  it('the newest amr timestamp, ignoring token refreshes', async () => {
    const amr = [
      { method: 'token_refresh', timestamp: secondsAgo(5) },
      { method: 'password', timestamp: secondsAgo(3600) },
      { method: 'oauth', timestamp: secondsAgo(120) },
    ]
    h.getSession.mockResolvedValue({ data: { session: sessionFor('u1', { amr }) } })
    expect(await sessionSignedInAt()).toBe(secondsAgo(120))
  })

  it('falls back to last_sign_in_at without a usable amr', async () => {
    const at = new Date(Date.now() - 60_000).toISOString()
    h.getSession.mockResolvedValue({ data: { session: sessionFor('u1', { amr: ['pwd'], lastSignInAt: at }) } })
    expect(await sessionSignedInAt()).toBe(Math.floor(Date.parse(at) / 1000))
  })

  it('null without a session', async () => {
    expect(await sessionSignedInAt()).toBeNull()
  })
})

describe('confirming with Google or Apple', () => {
  const google = { id: 'google' as const, label: 'Google', queryParams: { prompt: 'select_account' } }

  it('goes through the provider and comes back to Settings with the dialog reopened', async () => {
    expect(await startOAuthConfirm(google, 'u1')).toBe('redirecting')
    expect(h.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({ redirectTo: `${window.location.origin}/auth/callback` }),
    })
    // The callback page sends people on to the remembered path
    expect(sessionStorage.getItem('bartrrr:returnTo')).toBe(CONFIRM_RETURN_PATH)
  })

  it('a provider error is reported', async () => {
    h.signInWithOAuth.mockResolvedValue({ error: { message: 'provider is disabled' } })
    await expect(startOAuthConfirm(google, 'u1')).rejects.toMatchObject({ kind: 'server' })
  })

  it('back with a fresh sign-in to the same account: confirmed, once', async () => {
    await startOAuthConfirm(google, 'u1')
    h.getSession.mockResolvedValue({
      data: { session: sessionFor('u1', { providers: ['google'], amr: [{ method: 'oauth', timestamp: secondsAgo(20) }] }) },
    })
    expect(await readOAuthConfirm('u1')).toBe('confirmed')
    // Single use: the marker is gone, but the session is still fresh
    expect(sessionStorage.getItem('bartrrr:confirmDelete')).toBeNull()
  })

  it('back with an old sign-in (canceled at Google): stale', async () => {
    await startOAuthConfirm(google, 'u1')
    h.getSession.mockResolvedValue({
      data: { session: sessionFor('u1', { providers: ['google'], amr: [{ method: 'oauth', timestamp: secondsAgo(3 * 3600) }] }) },
    })
    expect(await readOAuthConfirm('u1')).toBe('stale')
  })

  it('stale a minute before the server would refuse, so the delete never races the 10-minute line', async () => {
    await startOAuthConfirm(google, 'u1')
    h.getSession.mockResolvedValue({
      data: { session: sessionFor('u1', { amr: [{ method: 'oauth', timestamp: secondsAgo(9 * 60 + 30) }] }) },
    })
    expect(await readOAuthConfirm('u1')).toBe('stale')
  })

  it('back signed in to a different account: other_account, and nothing is checked', async () => {
    await startOAuthConfirm(google, 'u1')
    expect(await readOAuthConfirm('u2')).toBe('other_account')
    expect(h.getSession).not.toHaveBeenCalled()
  })
})

describe('forgetDeletedSession', () => {
  it('signs out locally only and tolerates a failure', async () => {
    await forgetDeletedSession()
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' })
    h.signOut.mockRejectedValueOnce(new Error('x'))
    await expect(forgetDeletedSession()).resolves.toBeUndefined()
  })
})

describe('demo mode', () => {
  it('deletes nothing: no storage, no RPC, no sign-out call', async () => {
    vi.resetModules()
    vi.doMock('@/lib/env', () => ({ DEMO_MODE: true, SUPABASE_URL: 'https://proj.supabase.co' }))
    const mod = await import('./account-deletion')
    expect(mod.ACCOUNT_DELETION_IS_DEMO).toBe(true)
    // The confirm step still shows: email users type any password, Maria
    // (user-002) "signed up with Google" and comes straight back
    expect(await mod.getReauthMethod('user-001')).toEqual({ kind: 'password', email: '' })
    expect(await mod.getReauthMethod('user-002')).toMatchObject({ kind: 'oauth', provider: { id: 'google' } })
    await expect(mod.confirmWithPassword('', 'anything')).resolves.toBeUndefined()
    await expect(mod.confirmWithPassword('', '')).rejects.toMatchObject({ kind: 'password' })
    expect(await mod.startOAuthConfirm({ id: 'google', label: 'Google' }, 'user-002')).toBe('demo')
    expect(await mod.readOAuthConfirm('user-002')).toBe('confirmed')
    expect(await mod.readOAuthConfirm('user-002')).toBe('stale')
    await mod.deleteMyAccount('u1')
    await mod.forgetDeletedSession()
    expect(h.signInWithPassword).not.toHaveBeenCalled()
    expect(h.signInWithOAuth).not.toHaveBeenCalled()
    expect(h.getSession).not.toHaveBeenCalled()
    expect(h.list).not.toHaveBeenCalled()
    expect(h.remove).not.toHaveBeenCalled()
    expect(h.rpc).not.toHaveBeenCalled()
    expect(h.signOut).not.toHaveBeenCalled()
    vi.doUnmock('@/lib/env')
  })

  it('offline demo (no Supabase client) is also demo', async () => {
    vi.resetModules()
    vi.doMock('@/lib/env', () => ({ DEMO_MODE: false, SUPABASE_URL: '' }))
    vi.doMock('@/lib/supabase', () => ({ supabase: null }))
    const mod = await import('./account-deletion')
    expect(mod.ACCOUNT_DELETION_IS_DEMO).toBe(true)
    await expect(mod.deleteMyAccount('u1')).resolves.toBeUndefined()
    await expect(mod.deleteOwnPhotos('u1')).resolves.toBe(0)
    expect(h.rpc).not.toHaveBeenCalled()
    vi.doUnmock('@/lib/env')
    vi.doUnmock('@/lib/supabase')
  })
})
