/**
 * bartrrr-mail: Supabase "Send Email" auth hook → Cloudflare Email Service.
 *
 * Supabase POSTs a signed JSON payload for every auth email (sign-up,
 * password reset, email change, sign-in link). We verify the signature,
 * render the email and send it with the Worker's send_email binding.
 * Returning non-2xx makes Supabase report the send as failed.
 */
import { verifyWebhook, WebhookError } from './webhook'
import { renderEmail, type EmailKind } from './templates'

interface SendEmailBinding {
  send(message: {
    to: string | { email: string; name?: string }
    from: string | { email: string; name?: string }
    replyTo?: string | { email: string; name?: string }
    subject: string
    html?: string
    text?: string
  }): Promise<{ messageId: string }>
}

export interface Env {
  EMAIL: SendEmailBinding
  SEND_EMAIL_HOOK_SECRET: string
  SENDER_EMAIL: string
  SENDER_NAME: string
  REPLY_TO: string
  SITE_URL: string
  SUPABASE_URL: string
}

interface HookPayload {
  user: { email?: string; new_email?: string; email_new?: string }
  email_data: {
    token?: string
    token_hash?: string
    token_new?: string
    token_hash_new?: string
    redirect_to?: string
    email_action_type: string
    site_url?: string
    old_email?: string
  }
}

interface Outgoing {
  to: string
  email: EmailKind
}

function verifyUrl(env: Env, tokenHash: string, type: string, redirectTo: string): string {
  const params = new URLSearchParams({ token: tokenHash, type, redirect_to: redirectTo })
  return `${env.SUPABASE_URL}/auth/v1/verify?${params.toString()}`
}

/** Turn one hook payload into the email(s) Supabase expects us to send. */
export function planEmails(payload: HookPayload, env: Env): Outgoing[] {
  const { user, email_data: d } = payload
  const redirectTo = d.redirect_to || d.site_url || env.SITE_URL
  const type = d.email_action_type
  const to = user.email ?? ''
  const link = (hash: string | undefined, t = type) => verifyUrl(env, hash ?? '', t, redirectTo)

  switch (type) {
    case 'signup':
      return [{ to, email: { kind: 'signup', url: link(d.token_hash) } }]
    case 'recovery':
      return [{ to, email: { kind: 'recovery', url: link(d.token_hash) } }]
    case 'magiclink':
      return [{ to, email: { kind: 'magiclink', url: link(d.token_hash), code: d.token || undefined } }]
    case 'invite':
      return [{ to, email: { kind: 'invite', url: link(d.token_hash) } }]
    case 'email_change': {
      const newEmail = user.new_email ?? user.email_new ?? ''
      // Secure email change: two emails. The field names are swapped for
      // backward compatibility: current address gets token_hash_new, new
      // address gets token_hash.
      if (d.token_hash_new) {
        const out: Outgoing[] = [
          { to, email: { kind: 'email_change_current', url: link(d.token_hash_new), newEmail } },
        ]
        if (newEmail && d.token_hash) {
          out.push({ to: newEmail, email: { kind: 'email_change_new', url: link(d.token_hash) } })
        }
        return out
      }
      return [{ to: newEmail || to, email: { kind: 'email_change_new', url: link(d.token_hash) } }]
    }
    case 'reauthentication':
      return [{ to, email: { kind: 'reauthentication', code: d.token ?? '' } }]
    case 'email':
      return [{ to, email: { kind: 'otp', code: d.token ?? '' } }]
    case 'password_changed_notification':
      return [{ to, email: { kind: 'password_changed' } }]
    case 'email_changed_notification':
      return [{ to, email: { kind: 'email_changed', oldEmail: d.old_email } }]
    default:
      if (type.endsWith('_notification')) return [{ to, email: { kind: 'account_updated' } }]
      return []
  }
}

function hookError(status: number, message: string): Response {
  return Response.json({ error: { http_code: status, message } }, { status })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true })
    }
    if (request.method !== 'POST') return new Response('Not found', { status: 404 })

    const body = await request.text()
    try {
      await verifyWebhook(env.SEND_EMAIL_HOOK_SECRET, request.headers, body)
    } catch (err) {
      const message = err instanceof WebhookError ? err.message : 'Signature check failed'
      console.warn('[bartrrr-mail] rejected request:', message)
      return hookError(401, message)
    }

    let payload: HookPayload
    try {
      payload = JSON.parse(body) as HookPayload
    } catch {
      return hookError(400, 'Invalid JSON')
    }

    const outgoing = planEmails(payload, env).filter((o) => o.to)
    if (outgoing.length === 0) {
      console.log('[bartrrr-mail] nothing to send for', payload.email_data?.email_action_type)
      return Response.json({})
    }

    try {
      for (const o of outgoing) {
        const rendered = renderEmail(o.email, env.SITE_URL)
        const result = await env.EMAIL.send({
          to: o.to,
          from: { email: env.SENDER_EMAIL, name: env.SENDER_NAME },
          replyTo: env.REPLY_TO,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        })
        console.log('[bartrrr-mail] sent', o.email.kind, result.messageId)
      }
      return Response.json({})
    } catch (err) {
      const e = err as { code?: string; message?: string }
      console.error('[bartrrr-mail] send failed:', e.code, e.message)
      return hookError(500, `Email send failed${e.code ? ` (${e.code})` : ''}`)
    }
  },
}
