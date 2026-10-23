/**
 * Bartrrr — send-push Edge Function
 *
 * POST { userId, title, body, url? }
 * Authorization: Bearer <caller's Supabase access token>
 *
 * Sends a Web Push notification to `userId`. The caller must be signed in
 * and must share an offer with the recipient — otherwise anyone holding the
 * public anon key could push arbitrary text to any user.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ??
  'https://bartrrr.app,https://www.bartrrr.app,http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function json(req: Request, status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

const MAX_TITLE = 120
const MAX_BODY = 300

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(req) })
  }
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:push@bartrrr.app'
    if (!supabaseUrl || !serviceKey || !vapidPublicKey || !vapidPrivateKey) {
      console.error('[send-push] missing server configuration')
      return json(req, 500, { error: 'not_configured' })
    }

    // ── Authenticate the caller ──────────────────────────────────────────
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return json(req, 401, { error: 'unauthorized' })

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: authData, error: authErr } = await admin.auth.getUser(token)
    const callerId = authData?.user?.id
    if (authErr || !callerId) return json(req, 401, { error: 'unauthorized' })

    // ── Validate input ───────────────────────────────────────────────────
    const input = await req.json().catch(() => null)
    const userId = typeof input?.userId === 'string' ? input.userId : ''
    const title = typeof input?.title === 'string' ? input.title.slice(0, MAX_TITLE) : ''
    const body = typeof input?.body === 'string' ? input.body.slice(0, MAX_BODY) : ''
    const rawUrl = typeof input?.url === 'string' ? input.url : '/'
    // Only same-site relative paths — never let a push open an external URL.
    const url = rawUrl.startsWith('/') && !rawUrl.startsWith('//') ? rawUrl : '/'

    if (!userId || !title || !body) {
      return json(req, 400, { error: 'userId, title, body required' })
    }
    if (userId === callerId) return json(req, 200, { sent: 0, reason: 'self' })

    // ── Authorize: caller and recipient must share an offer ──────────────
    const { count, error: relErr } = await admin
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .or(
        `and(from_user_id.eq.${callerId},to_user_id.eq.${userId}),and(from_user_id.eq.${userId},to_user_id.eq.${callerId})`,
      )
    if (relErr) throw relErr
    if (!count) return json(req, 403, { error: 'forbidden' })

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const { data: subs, error } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)
    if (error) throw error

    if (!subs || subs.length === 0) {
      return json(req, 200, { sent: 0, reason: 'no_subscriptions' })
    }

    const payload = JSON.stringify({ title, body, data: { url }, tag: 'bartrrr' })

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        ),
      ),
    )

    // Clean up expired subscriptions (404/410 Gone)
    const expiredEndpoints: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const statusCode = (r.reason as { statusCode?: number })?.statusCode
        if (statusCode === 404 || statusCode === 410) expiredEndpoints.push(subs[i].endpoint)
      }
    })
    if (expiredEndpoints.length > 0) {
      await admin.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
    }

    const sent = results.filter((r) => r.status === 'fulfilled').length
    return json(req, 200, { sent })
  } catch (err) {
    console.error('[send-push]', err)
    return json(req, 500, { error: 'internal_error' })
  }
})
