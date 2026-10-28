/**
 * Standard Webhooks signature check (https://www.standardwebhooks.com),
 * which is what Supabase auth hooks use. No dependencies: WebCrypto only.
 *
 * Signed content: `${webhook-id}.${webhook-timestamp}.${raw body}`, HMAC-SHA256
 * with the base64-decoded secret (the part after "v1,whsec_"). The
 * webhook-signature header holds one or more space-separated "v1,<base64>".
 */

const TOLERANCE_SECONDS = 5 * 60

export class WebhookError extends Error {}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToBase64(bytes: ArrayBuffer): string {
  let bin = ''
  const view = new Uint8Array(bytes)
  for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i])
  return btoa(bin)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyWebhook(
  secret: string,
  headers: Headers,
  body: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<void> {
  const id = headers.get('webhook-id')
  const timestamp = headers.get('webhook-timestamp')
  const signatures = headers.get('webhook-signature')
  if (!id || !timestamp || !signatures) throw new WebhookError('Missing webhook headers')

  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) {
    throw new WebhookError('Webhook timestamp outside tolerance')
  }

  const rawSecret = secret.replace(/^v1,/, '').replace(/^whsec_/, '')
  const key = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(rawSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`))
  const expected = bytesToBase64(mac)

  const ok = signatures
    .split(' ')
    .map((s) => s.split(','))
    .some(([version, sig]) => version === 'v1' && !!sig && timingSafeEqual(sig, expected))
  if (!ok) throw new WebhookError('Invalid webhook signature')
}
