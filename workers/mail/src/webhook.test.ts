// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import { verifyWebhook, WebhookError } from './webhook'

const secretBytes = crypto.getRandomValues(new Uint8Array(32))
const b64 = (bytes: ArrayBuffer | Uint8Array) => Buffer.from(bytes as ArrayBuffer).toString('base64')
const SECRET = `v1,whsec_${b64(secretBytes)}`
const BODY = JSON.stringify({ user: { email: 'matt@example.com' }, email_data: { email_action_type: 'recovery' } })
const NOW = 1_793_700_000 // fixed "now" in seconds

let key: CryptoKey
beforeAll(async () => {
  key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
})

async function sig(body: string, id = 'msg_1', ts = NOW) {
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`))
  return `v1,${b64(mac)}`
}
async function headers(body = BODY, id = 'msg_1', ts = NOW, signature?: string) {
  return new Headers({
    'webhook-id': id,
    'webhook-timestamp': String(ts),
    'webhook-signature': signature ?? (await sig(body, id, ts)),
  })
}
const reason = (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e) => {
      expect(e).toBeInstanceOf(WebhookError)
      return (e as Error).message
    },
  )

describe('verifyWebhook (E-02)', () => {
  it('accepts a valid signature', async () => {
    await expect(verifyWebhook(SECRET, await headers(), BODY, NOW)).resolves.toBeUndefined()
  })

  it('accepts the secret without the v1,whsec_ prefix too', async () => {
    await expect(verifyWebhook(b64(secretBytes), await headers(), BODY, NOW)).resolves.toBeUndefined()
  })

  it('accepts when any one of several signatures matches (key rotation)', async () => {
    const h = await headers(BODY, 'msg_1', NOW, `v1,AAAA v1,${'B'.repeat(44)} ${await sig(BODY)}`)
    await expect(verifyWebhook(SECRET, h, BODY, NOW)).resolves.toBeUndefined()
  })

  it('rejects a bad signature', async () => {
    expect(await reason(verifyWebhook(SECRET, await headers(BODY, 'msg_1', NOW, 'v1,AAAA'), BODY, NOW))).toBe(
      'Invalid webhook signature',
    )
  })

  it('rejects a signature made with another secret', async () => {
    const otherKey = await crypto.subtle.importKey(
      'raw',
      crypto.getRandomValues(new Uint8Array(32)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const mac = await crypto.subtle.sign('HMAC', otherKey, new TextEncoder().encode(`msg_1.${NOW}.${BODY}`))
    expect(await reason(verifyWebhook(SECRET, await headers(BODY, 'msg_1', NOW, `v1,${b64(mac)}`), BODY, NOW))).toBe(
      'Invalid webhook signature',
    )
  })

  it('rejects a right signature with the wrong version tag', async () => {
    const good = (await sig(BODY)).replace(/^v1,/, 'v2,')
    expect(await reason(verifyWebhook(SECRET, await headers(BODY, 'msg_1', NOW, good), BODY, NOW))).toBe(
      'Invalid webhook signature',
    )
  })

  it('rejects a tampered body', async () => {
    const h = await headers()
    expect(await reason(verifyWebhook(SECRET, h, BODY.replace('matt@', 'evil@'), NOW))).toBe('Invalid webhook signature')
  })

  it('rejects a tampered id (replay under another id)', async () => {
    const h = await headers()
    h.set('webhook-id', 'msg_2')
    expect(await reason(verifyWebhook(SECRET, h, BODY, NOW))).toBe('Invalid webhook signature')
  })

  it('rejects a re-timestamped request with the old signature', async () => {
    const h = await headers()
    h.set('webhook-timestamp', String(NOW + 10))
    expect(await reason(verifyWebhook(SECRET, h, BODY, NOW))).toBe('Invalid webhook signature')
  })

  it('allows 5 minutes of clock skew either way, not more', async () => {
    await expect(verifyWebhook(SECRET, await headers(BODY, 'm', NOW - 300), BODY, NOW)).resolves.toBeUndefined()
    await expect(verifyWebhook(SECRET, await headers(BODY, 'm', NOW + 300), BODY, NOW)).resolves.toBeUndefined()
    expect(await reason(verifyWebhook(SECRET, await headers(BODY, 'm', NOW - 301), BODY, NOW))).toBe(
      'Webhook timestamp outside tolerance',
    )
    expect(await reason(verifyWebhook(SECRET, await headers(BODY, 'm', NOW + 301), BODY, NOW))).toBe(
      'Webhook timestamp outside tolerance',
    )
  })

  it('rejects a stale request (1 hour old)', async () => {
    expect(await reason(verifyWebhook(SECRET, await headers(BODY, 'm', NOW - 3600), BODY, NOW))).toBe(
      'Webhook timestamp outside tolerance',
    )
  })

  it('rejects a non-numeric timestamp', async () => {
    const h = await headers()
    h.set('webhook-timestamp', 'yesterday')
    expect(await reason(verifyWebhook(SECRET, h, BODY, NOW))).toBe('Webhook timestamp outside tolerance')
  })

  it.each(['webhook-id', 'webhook-timestamp', 'webhook-signature'])('rejects when %s is missing', async (name) => {
    const h = await headers()
    h.delete(name)
    expect(await reason(verifyWebhook(SECRET, h, BODY, NOW))).toBe('Missing webhook headers')
  })

  it('uses the clock by default', async () => {
    const now = Math.floor(Date.now() / 1000)
    await expect(verifyWebhook(SECRET, await headers(BODY, 'm', now), BODY)).resolves.toBeUndefined()
  })
})
