import { describe, expect, it } from 'vitest'
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { friendlyAuthError, isNetworkError } from './errors'

const apiError = (code: string) => new AuthApiError('raw server text', 400, code)

describe('isNetworkError', () => {
  it.each([
    new TypeError('Failed to fetch'),
    new TypeError('NetworkError when attempting to fetch resource.'),
    new TypeError('Load failed'),
    new AuthRetryableFetchError('whatever', 0),
  ])('is true for %s', (err) => expect(isNetworkError(err)).toBe(true))

  it.each([new Error('nope'), 'Failed to fetch', { message: 'Failed to fetch' }, null, undefined])(
    'is false for %j',
    (err) => expect(isNetworkError(err)).toBe(false),
  )
})

describe('friendlyAuthError', () => {
  it.each([
    ['invalid_credentials', "That email and password don't match. Try again or reset your password."],
    ['email_not_confirmed', 'Check your inbox and confirm your email before logging in.'],
    ['user_already_exists', 'An account with that email already exists. Try logging in instead.'],
    ['email_exists', 'An account with that email already exists. Try logging in instead.'],
    ['weak_password', 'Choose a stronger password: at least 8 characters with letters and numbers.'],
    ['same_password', 'Your new password must be different from your old one.'],
    ['over_email_send_rate_limit', 'Too many tries in a row. Wait a minute, then try again.'],
    ['over_request_rate_limit', 'Too many tries in a row. Wait a minute, then try again.'],
    ['provider_disabled', "That way of logging in isn't available right now. Use your email and password instead."],
    ['flow_state_expired', 'That link expired or was opened in a different browser. Start again from this browser.'],
    ['bad_code_verifier', 'That link expired or was opened in a different browser. Start again from this browser.'],
    ['otp_expired', 'That link has expired. Request a new one.'],
    ['signup_disabled', 'New accounts are paused right now. Check back soon.'],
  ])('maps %s', (code, text) => {
    expect(friendlyAuthError(apiError(code))).toBe(text)
  })

  it('network first', () => {
    expect(friendlyAuthError(new TypeError('Failed to fetch'))).toBe(
      "We couldn't reach Bartrrr. Check your connection and try again.",
    )
  })
  it('OAuth cancel strings from the URL', () => {
    expect(friendlyAuthError('access_denied')).toBe("Login was canceled. Try again whenever you're ready.")
  })
  it.each([
    new AuthApiError('Password cannot be longer than 72 characters', 422, 'validation_failed'),
    new AuthApiError('Password cannot be longer than 72 characters', 422, 'weak_password'),
    new Error('bcrypt: password length exceeds 72 bytes'),
  ])('T-31: password too long → shorter password (%s)', (err) => {
    expect(friendlyAuthError(err)).toBe(
      'Use a shorter password. Accented letters and emoji count extra toward the 72-character limit.',
    )
  })
  it('generic expired text', () => {
    expect(friendlyAuthError(new Error('Token has expired'))).toBe('That link has expired. Request a new one.')
  })
  it('never leaks raw server text', () => {
    expect(friendlyAuthError(new Error('relation "users" does not exist'))).toBe(
      'Something went wrong on our end. Try again in a moment.',
    )
    expect(friendlyAuthError(apiError('some_new_code'))).not.toContain('raw server text')
    expect(friendlyAuthError(undefined)).toBe('Something went wrong on our end. Try again in a moment.')
  })
  it('copy uses no em dashes', () => {
    for (const code of ['invalid_credentials', 'weak_password', 'flow_state_expired', 'x']) {
      expect(friendlyAuthError(apiError(code))).not.toContain('—')
    }
  })
})
