import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Entry = { name: string; id: string | null }
type ListResult = { data: Entry[] | null; error: unknown }

const h = vi.hoisted(() => {
  const list = vi.fn<(prefix: string, opts: { limit: number; offset: number }) => Promise<ListResult>>()
  const remove = vi.fn<(paths: string[]) => Promise<{ data: unknown[] | null; error: unknown }>>()
  const rpc = vi.fn<(name: string) => Promise<{ error: unknown }>>()
  const signOut = vi.fn<(opts?: unknown) => Promise<{ error: null }>>(async () => ({ error: null }))
  const from = vi.fn(() => ({ list, remove }))
  return { list, remove, rpc, signOut, from, client: { storage: { from }, rpc, auth: { signOut } } }
})

vi.mock('@/lib/env', () => ({ DEMO_MODE: false, SUPABASE_URL: 'https://proj.supabase.co' }))
vi.mock('@/lib/supabase', () => ({ supabase: h.client }))

import { AccountDeletionError, ACCOUNT_DELETION_IS_DEMO, deleteMyAccount, deleteOwnPhotos, forgetDeletedSession } from './account-deletion'

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

describe('deleteMyAccount', () => {
  beforeEach(() => serveTree({ u1: [file('a.webp')] }))

  it('removes photos, then calls delete_my_account', async () => {
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
    expect(order).toEqual(['photos', 'rpc'])
    expect(h.rpc).toHaveBeenCalledWith('delete_my_account')
  })

  it('goes ahead even when photo cleanup fails', async () => {
    h.list.mockResolvedValue({ data: null, error: new Error('x') })
    await expect(deleteMyAccount('u1')).resolves.toBeUndefined()
    expect(h.rpc).toHaveBeenCalled()
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

  it('server: anything else, with the cause kept', async () => {
    const cause = { code: 'P0001', message: 'boom' }
    h.rpc.mockResolvedValue({ error: cause })
    const err = (await deleteMyAccount('u1').catch((e) => e)) as AccountDeletionError
    expect(err.kind).toBe('server')
    expect(err.cause).toBe(cause)
    expect(err.message).toBe('Account deletion failed (server)')
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
    await mod.deleteMyAccount('u1')
    await mod.forgetDeletedSession()
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
