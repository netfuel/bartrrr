import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  authPathWithReturn,
  authRedirectUrl,
  consumeReturnTo,
  DEFAULT_AFTER_LOGIN,
  rememberReturnTo,
  sanitizeReturnTo,
} from './redirect'

describe('sanitizeReturnTo', () => {
  it.each([
    ['/offers/offer-1', '/offers/offer-1'],
    ['/browse?category=goods#map', '/browse?category=goods#map'],
    ['  /profile  ', '/profile'],
    ['/a/../b', '/b'],
    ['/authors', '/authors'],
  ])('keeps same-origin path %j', (input, out) => {
    expect(sanitizeReturnTo(input)).toBe(out)
  })

  it.each([
    null,
    undefined,
    '',
    'browse',
    '//evil.com',
    '//evil.com/path',
    'https://evil.com',
    'javascript:alert(1)',
    '/\\evil.com',
    '/\tevil',
    '/auth/login',
    '/auth',
    '/auth/callback?code=x',
  ])('refuses %j', (input) => {
    expect(sanitizeReturnTo(input)).toBeNull()
  })
})

describe('authPathWithReturn', () => {
  it('adds an encoded returnTo for a safe path', () => {
    expect(authPathWithReturn('/auth/login', '/offers/1?x=a&b=c')).toBe(
      `/auth/login?returnTo=${encodeURIComponent('/offers/1?x=a&b=c')}`,
    )
  })
  it('leaves it off for the default destination or unsafe input', () => {
    expect(authPathWithReturn('/auth/signup', DEFAULT_AFTER_LOGIN)).toBe('/auth/signup')
    expect(authPathWithReturn('/auth/login', '//evil.com')).toBe('/auth/login')
    expect(authPathWithReturn('/auth/login')).toBe('/auth/login')
  })
})

describe('rememberReturnTo / consumeReturnTo', () => {
  beforeEach(() => sessionStorage.clear())

  it('round-trips once', () => {
    rememberReturnTo('/listings/abc')
    expect(consumeReturnTo()).toBe('/listings/abc')
    expect(consumeReturnTo()).toBeNull()
  })
  it('unsafe values clear what was stored', () => {
    rememberReturnTo('/listings/abc')
    rememberReturnTo('https://evil.com')
    expect(consumeReturnTo()).toBeNull()
  })
  it('re-checks what comes out of storage', () => {
    sessionStorage.setItem('bartrrr:returnTo', '//evil.com')
    expect(consumeReturnTo()).toBeNull()
  })
  it('survives blocked storage', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => rememberReturnTo('/x')).not.toThrow()
    expect(consumeReturnTo()).toBeNull()
    get.mockRestore()
    set.mockRestore()
  })
})

describe('authRedirectUrl', () => {
  it('is absolute on the current origin', () => {
    expect(authRedirectUrl('/auth/callback')).toBe(`${window.location.origin}/auth/callback`)
  })
})
