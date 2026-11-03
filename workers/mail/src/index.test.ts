// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import worker, { planEmails, type Env } from './index'

const secretBytes = crypto.getRandomValues(new Uint8Array(24))
const b64 = (bytes: ArrayBuffer | Uint8Array) => Buffer.from(bytes as ArrayBuffer).toString('base64')
const SUPABASE = 'https://uykknvmxntknclkyqvao.supabase.co'

type Sent = Parameters<Env['EMAIL']['send']>[0]
let sent: Sent[]
let env: Env

beforeEach(() => {
  sent = []
  env = {
    EMAIL: {
      send: vi.fn(async (m: Sent) => {
        sent.push(m)
        return { messageId: `msg-${sent.length}` }
      }),
    },
    SEND_EMAIL_HOOK_SECRET: `v1,whsec_${b64(secretBytes)}`,
    SENDER_EMAIL: 'no-reply@bartrrr.app',
    SENDER_NAME: 'Bartrrr',
    REPLY_TO: 'hello@bartrrr.app',
    SITE_URL: 'https://bartrrr.app',
    SUPABASE_URL: SUPABASE,
  }
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

async function signedHeaders(body: string, id = 'msg_1', ts = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`))
  return { 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': `v1,${b64(mac)}` }
}

interface Extra {
  user?: Record<string, string>
  data?: Record<string, string>
}
const payload = (type: string, extra: Extra = {}) => ({
  user: { email: 'matt@example.com', ...extra.user },
  email_data: {
    token: '123456',
    token_hash: 'hash_abc',
    token_new: '654321',
    token_hash_new: '',
    redirect_to: 'https://bartrrr.app/auth/callback',
    email_action_type: type,
    site_url: 'https://bartrrr.app',
    ...extra.data,
  },
})
const body = (type: string, extra?: Extra) => JSON.stringify(payload(type, extra))

const post = async (b: string, headers?: Record<string, string>) =>
  worker.fetch(
    new Request('https://bartrrr-mail.example/hook', { method: 'POST', body: b, headers: headers ?? (await signedHeaders(b)) }),
    env,
  )

const verifyParams = (url: string) => {
  const u = new URL(url)
  expect(`${u.origin}${u.pathname}`).toBe(`${SUPABASE}/auth/v1/verify`)
  return Object.fromEntries(u.searchParams)
}

describe('planEmails: every email_action_type (E-02)', () => {
  const p = (type: string, extra?: Extra) => planEmails(payload(type, extra), env)

  it.each([
    ['signup', 'signup'],
    ['recovery', 'recovery'],
    ['invite', 'invite'],
  ])('%s → one %s email with a verify link', (type, kind) => {
    const [o, ...rest] = p(type)
    expect(rest).toHaveLength(0)
    expect(o.to).toBe('matt@example.com')
    expect(o.email.kind).toBe(kind)
    expect(verifyParams((o.email as { url: string }).url)).toEqual({
      token: 'hash_abc',
      type,
      redirect_to: 'https://bartrrr.app/auth/callback',
    })
  })

  it('magiclink carries the link and the OTP code', () => {
    const [o] = p('magiclink')
    expect(o.email).toMatchObject({ kind: 'magiclink', code: '123456' })
    expect(verifyParams((o.email as { url: string }).url).type).toBe('magiclink')
  })

  it('magiclink without a token has no code', () => {
    expect(p('magiclink', { data: { token: '' } })[0].email).toMatchObject({ code: undefined })
  })

  it('secure email change: two emails with the token fields swapped', () => {
    const out = p('email_change', {
      user: { new_email: 'new@example.com' },
      data: { token_hash: 'h_for_new_address', token_hash_new: 'h_for_current_address' },
    })
    expect(out).toHaveLength(2)
    const [current, next] = out
    expect(current.to).toBe('matt@example.com')
    expect(current.email).toMatchObject({ kind: 'email_change_current', newEmail: 'new@example.com' })
    expect(verifyParams((current.email as { url: string }).url)).toMatchObject({ token: 'h_for_current_address', type: 'email_change' })
    expect(next.to).toBe('new@example.com')
    expect(next.email.kind).toBe('email_change_new')
    expect(verifyParams((next.email as { url: string }).url)).toMatchObject({ token: 'h_for_new_address', type: 'email_change' })
  })

  it('secure email change also reads the legacy email_new field', () => {
    const out = p('email_change', { user: { email_new: 'legacy@example.com' }, data: { token_hash_new: 'x' } })
    expect(out.map((o) => o.to)).toEqual(['matt@example.com', 'legacy@example.com'])
  })

  it('secure email change without a new-address token sends only the current-address email', () => {
    const out = p('email_change', { user: { new_email: 'new@example.com' }, data: { token_hash: '', token_hash_new: 'x' } })
    expect(out.map((o) => o.email.kind)).toEqual(['email_change_current'])
  })

  it('single-confirmation email change goes to the new address only', () => {
    const out = p('email_change', { user: { new_email: 'new@example.com' } })
    expect(out).toHaveLength(1)
    expect(out[0].to).toBe('new@example.com')
    expect(verifyParams((out[0].email as { url: string }).url).token).toBe('hash_abc')
  })

  it('reauthentication and email (OTP) send codes, no links', () => {
    expect(p('reauthentication')[0].email).toEqual({ kind: 'reauthentication', code: '123456' })
    expect(p('email')[0].email).toEqual({ kind: 'otp', code: '123456' })
  })

  it('security notifications', () => {
    expect(p('password_changed_notification')[0].email).toEqual({ kind: 'password_changed' })
    expect(p('email_changed_notification', { data: { old_email: 'old@example.com' } })[0].email).toEqual({
      kind: 'email_changed',
      oldEmail: 'old@example.com',
    })
    for (const t of ['mfa_factor_enrolled_notification', 'identity_linked_notification', 'phone_changed_notification']) {
      expect(p(t)[0].email).toEqual({ kind: 'account_updated' })
    }
  })

  it('unknown types send nothing', () => {
    expect(p('weird_type')).toEqual([])
  })

  it('redirect falls back to site_url, then SITE_URL', () => {
    const r1 = verifyParams((p('signup', { data: { redirect_to: '' } })[0].email as { url: string }).url)
    expect(r1.redirect_to).toBe('https://bartrrr.app')
    const r2 = planEmails(
      { user: { email: 'a@b.co' }, email_data: { email_action_type: 'signup', token_hash: 'h' } },
      { ...env, SITE_URL: 'https://staging.bartrrr.app' },
    )
    expect(verifyParams((r2[0].email as { url: string }).url).redirect_to).toBe('https://staging.bartrrr.app')
  })

  it('link parameters are URL-encoded', () => {
    const [o] = p('recovery', { data: { token_hash: 'a&b=c', redirect_to: 'https://bartrrr.app/x?y=1&z=2' } })
    const params = verifyParams((o.email as { url: string }).url)
    expect(params.token).toBe('a&b=c')
    expect(params.redirect_to).toBe('https://bartrrr.app/x?y=1&z=2')
  })
})

describe('fetch handler status codes (E-02)', () => {
  it('GET /health → 200', async () => {
    const r = await worker.fetch(new Request('https://x.example/health'), env)
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true })
  })

  it.each(['GET', 'PUT', 'DELETE'])('%s elsewhere → 404', async (method) => {
    const r = await worker.fetch(new Request('https://x.example/hook', { method }), env)
    expect(r.status).toBe(404)
    expect(sent).toHaveLength(0)
  })

  it('valid signed recovery → 200 and one email', async () => {
    const r = await post(body('recovery'))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({})
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({
      to: 'matt@example.com',
      from: { email: 'no-reply@bartrrr.app', name: 'Bartrrr' },
      replyTo: 'hello@bartrrr.app',
      subject: 'Reset your Bartrrr password',
    })
    expect(sent[0].text).toContain(`${SUPABASE}/auth/v1/verify?token=hash_abc&type=recovery`)
    expect(sent[0].html).toContain(`${SUPABASE}/auth/v1/verify?token=hash_abc&amp;type=recovery`)
  })

  it('secure email change → 200 and two emails', async () => {
    const r = await post(
      body('email_change', { user: { new_email: 'new@example.com' }, data: { token_hash: 'h_new', token_hash_new: 'h_cur' } }),
    )
    expect(r.status).toBe(200)
    expect(sent.map((m) => [m.to, m.subject])).toEqual([
      ['matt@example.com', 'Confirm your Bartrrr email change'],
      ['new@example.com', 'Confirm your new email for Bartrrr'],
    ])
  })

  it('bad signature → 401 in the hook error shape', async () => {
    const b = body('recovery')
    const r = await post(b, { ...(await signedHeaders(b)), 'webhook-signature': 'v1,AAAA' })
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ error: { http_code: 401, message: 'Invalid webhook signature' } })
    expect(sent).toHaveLength(0)
  })

  it('tampered body → 401', async () => {
    const b = body('recovery')
    const r = await post(b.replace('matt@', 'evil@'), await signedHeaders(b))
    expect(r.status).toBe(401)
    expect(sent).toHaveLength(0)
  })

  it('stale timestamp → 401', async () => {
    const b = body('recovery')
    const r = await post(b, await signedHeaders(b, 'm', Math.floor(Date.now() / 1000) - 3600))
    expect(r.status).toBe(401)
    expect((await r.json()).error.message).toBe('Webhook timestamp outside tolerance')
  })

  it('missing headers → 401', async () => {
    const r = await post(body('recovery'), {})
    expect(r.status).toBe(401)
    expect((await r.json()).error.message).toBe('Missing webhook headers')
  })

  it('a malformed secret is still a 401, not a crash', async () => {
    env.SEND_EMAIL_HOOK_SECRET = 'v1,whsec_%%%not-base64%%%'
    const r = await post(body('recovery'))
    expect(r.status).toBe(401)
    expect((await r.json()).error.message).toBe('Signature check failed')
  })

  it('signed but not JSON → 400', async () => {
    const r = await post('not json')
    expect(r.status).toBe(400)
    expect(await r.json()).toEqual({ error: { http_code: 400, message: 'Invalid JSON' } })
  })

  it('unknown type → 200 with nothing sent', async () => {
    const r = await post(body('weird_type'))
    expect(r.status).toBe(200)
    expect(sent).toHaveLength(0)
  })

  it('no recipient → 200 with nothing sent', async () => {
    const r = await post(JSON.stringify({ user: {}, email_data: { email_action_type: 'signup', token_hash: 'h' } }))
    expect(r.status).toBe(200)
    expect(sent).toHaveLength(0)
  })

  it('send failure → 500 with the provider code', async () => {
    env.EMAIL.send = vi.fn(async () => {
      throw Object.assign(new Error('nope'), { code: 'E_SENDER_NOT_VERIFIED' })
    })
    const r = await post(body('recovery'))
    expect(r.status).toBe(500)
    expect(await r.json()).toEqual({ error: { http_code: 500, message: 'Email send failed (E_SENDER_NOT_VERIFIED)' } })
  })

  it('send failure without a code → 500 without one', async () => {
    env.EMAIL.send = vi.fn(async () => {
      throw new Error('nope')
    })
    const r = await post(body('recovery'))
    expect(r.status).toBe(500)
    expect((await r.json()).error.message).toBe('Email send failed')
  })

  it('second email failing still reports 500', async () => {
    let n = 0
    env.EMAIL.send = vi.fn(async () => {
      if (++n === 2) throw Object.assign(new Error('x'), { code: 'E_RATE' })
      return { messageId: 'ok' }
    })
    const r = await post(
      body('email_change', { user: { new_email: 'new@example.com' }, data: { token_hash: 'h1', token_hash_new: 'h2' } }),
    )
    expect(r.status).toBe(500)
    expect((await r.json()).error.message).toBe('Email send failed (E_RATE)')
  })

  it.fails('signed JSON without email_data → 400 BUG: planEmails throws TypeError, Worker answers with an uncaught 500', async () => {
    const r = await post(JSON.stringify({ user: { email: 'matt@example.com' } }))
    expect(r.status).toBe(400)
  })
})
