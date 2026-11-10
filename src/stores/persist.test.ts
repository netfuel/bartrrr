import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ client: {} as unknown, on: true }))
vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return h.on ? h.client : null
  },
}))

import { hasBackend, persist, persistError, revertKeys, sameValue } from './persist'
import { useToastStore } from './toast-store'
import { ValidationError } from '@/lib/validation-error'

const flush = () => new Promise((r) => setTimeout(r, 0))
const lastToast = () => useToastStore.getState().toasts.at(-1)

beforeEach(() => {
  h.on = true
  useToastStore.setState({ toasts: [] })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('persistError message selection', () => {
  it('validation reason without the field prefix', () => {
    const rollback = vi.fn()
    persistError("Couldn't save your listing", rollback)(new ValidationError('images.0: Use an https:// image link.'))
    expect(rollback).toHaveBeenCalledOnce()
    expect(lastToast()).toMatchObject({
      type: 'error',
      message: "Couldn't save your listing: Use an https:// image link.",
    })
  })

  it('P0001 trigger reason from the server', () => {
    persistError("Couldn't cancel the trade")({ code: 'P0001', message: 'This trade is already done.' })
    expect(lastToast()?.message).toBe("Couldn't cancel the trade: This trade is already done.")
  })

  it('P0001 with no message falls back to generic', () => {
    persistError("Couldn't cancel the trade")({ code: 'P0001', message: '' })
    expect(lastToast()?.message).toBe("Couldn't cancel the trade. Try again in a moment.")
  })

  it('network failure', () => {
    persistError("Couldn't send your offer")(new TypeError('Failed to fetch'))
    expect(lastToast()?.message).toBe("Couldn't send your offer. Check your connection and try again.")
  })

  it('generic, and never leaks raw server text', () => {
    persistError("Couldn't send your offer")({ code: '23505', message: 'duplicate key value violates unique constraint "offers_pkey"' })
    expect(lastToast()?.message).toBe("Couldn't send your offer. Try again in a moment.")
    persistError("Couldn't send your offer")(null)
    expect(lastToast()?.message).toBe("Couldn't send your offer. Try again in a moment.")
  })

  it('demo mode is silent: no rollback, no toast', () => {
    h.on = false
    const rollback = vi.fn()
    persistError('x', rollback)(new Error('boom'))
    expect(rollback).not.toHaveBeenCalled()
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})

describe('persist', () => {
  it('applies the server copy on success', async () => {
    const onSuccess = vi.fn()
    const rollback = vi.fn()
    persist(async () => 'saved', { onSuccess, rollback, error: 'x' })
    await flush()
    expect(onSuccess).toHaveBeenCalledWith('saved')
    expect(rollback).not.toHaveBeenCalled()
  })

  it('rolls back and tells the user on failure', async () => {
    const onSuccess = vi.fn()
    const rollback = vi.fn()
    persist(async () => Promise.reject(new TypeError('Failed to fetch')), { onSuccess, rollback, error: "Couldn't save" })
    await flush()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(rollback).toHaveBeenCalledOnce()
    expect(lastToast()?.message).toBe("Couldn't save. Check your connection and try again.")
  })

  it('demo mode never runs the task', () => {
    h.on = false
    const task = vi.fn(async () => 1)
    persist(task, { error: 'x' })
    expect(task).not.toHaveBeenCalled()
    expect(hasBackend()).toBe(false)
  })

  it('hasBackend is true with a client', () => {
    expect(hasBackend()).toBe(true)
  })
})

describe('toast store', () => {
  it('keeps at most 3, dropping the oldest', () => {
    for (const m of ['1', '2', '3', '4']) useToastStore.getState().addToast(m)
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(['2', '3', '4'])
    const id = useToastStore.getState().toasts[0].id
    useToastStore.getState().dismissToast(id)
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(['3', '4'])
  })
})

describe('revertKeys (T-28, T-29)', () => {
  type R = { a: string; b: string; tags?: string[]; prefs?: { x: boolean } }
  const prev: R = { a: 'old', b: 'old', prefs: { x: false } }

  it('restores only the keys this write applied', () => {
    expect(revertKeys<R>({ a: 'new', b: 'other' }, prev, { a: 'new' })).toEqual({ a: 'old', b: 'other' })
  })
  it('leaves a key a newer edit changed since', () => {
    expect(revertKeys<R>({ a: 'newer', b: 'old' }, prev, { a: 'new' })).toEqual({ a: 'newer', b: 'old' })
  })
  it('compares arrays and objects by value (server copies are new references)', () => {
    const cur: R = { ...prev, tags: ['x', 'y'], prefs: { x: true } }
    expect(revertKeys<R>(cur, prev, { tags: ['x', 'y'], prefs: { x: true } })).toEqual(prev)
  })
  it('drops a key the previous copy did not have', () => {
    expect('tags' in revertKeys<R>({ ...prev, tags: ['x'] }, prev, { tags: ['x'] })).toBe(false)
  })
  it('sameValue ignores undefined keys and tells arrays from objects', () => {
    expect(sameValue({ a: 1, b: undefined }, { a: 1 })).toBe(true)
    expect(sameValue([], {})).toBe(false)
    expect(sameValue([1, 2], [1, 3])).toBe(false)
  })
})
